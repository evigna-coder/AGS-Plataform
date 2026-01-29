import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { getFirestore, FieldValue, type Timestamp, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { rpName, rpID, origin, CHALLENGE_TTL_SEC } from './config.js';
import type { AuthContext } from './middleware.js';

/** Obtiene rpID y origin para WebAuthn desde la petición (Origin, X-WebAuthn-Origin, Referer) o la config. */
function getRpIdAndOrigin(req: ReqWithHeaders): { rpID: string; origin: string } {
  const tryOrigin = (value: string | null): { rpID: string; origin: string } | null => {
    if (!value || !value.startsWith('http')) return null;
    try {
      const u = new URL(value);
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        return { rpID: u.hostname, origin: u.origin };
      }
    } catch {
      // ignore invalid URL
    }
    return null;
  };
  const originHeader = headerString(req.headers, 'origin') || headerString(req.headers, 'Origin');
  let result = tryOrigin(originHeader);
  if (result) return result;
  const clientOrigin = headerString(req.headers, 'x-webauthn-origin');
  result = tryOrigin(clientOrigin);
  if (result) return result;
  const referer = headerString(req.headers, 'referer') || headerString(req.headers, 'Referer');
  if (referer) {
    result = tryOrigin(referer);
    if (result) return result;
  }
  return {
    rpID: rpID === 'localhost' ? 'localhost' : rpID,
    origin: origin.startsWith('http') ? origin : `https://${origin}`,
  };
}

function getDb() {
  return getFirestore();
}

/** Request mínimo para leer headers (compatible con Express). */
type ReqWithHeaders = { headers: Record<string, string | string[] | undefined> };

function headerString(headers: ReqWithHeaders['headers'], name: string): string | null {
  const v = headers[name];
  if (v == null) return null;
  return typeof v === 'string' ? v : v[0] ?? null;
}

const devicesCollection = (uid: string) =>
  getDb().collection('mfa').doc('webauthn').collection('users').doc(uid).collection('devices');
const challengesRef = (uid: string) => getDb().collection('mfa').doc('challenges').collection(uid).doc('current');
const auditRef = () => getDb().collection('mfa').doc('audit').collection('logs');

/** Guarda challenge en Firestore (short-lived). */
async function saveChallenge(uid: string, challenge: string, type: 'registration' | 'authentication'): Promise<void> {
  await challengesRef(uid).set({
    challenge,
    type,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/** Recupera y borra el challenge (para verificación). */
async function consumeChallenge(uid: string): Promise<{ challenge: string; type: string } | null> {
  const ref = challengesRef(uid);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as { challenge: string; type: string; createdAt: Timestamp };
  const createdAt = data.createdAt?.toMillis?.() ?? 0;
  if (Date.now() - createdAt > CHALLENGE_TTL_SEC * 1000) {
    await ref.delete();
    return null;
  }
  await ref.delete();
  return { challenge: data.challenge, type: data.type };
}

/** Lista dispositivos WebAuthn del usuario (para excludeCredentials / allowCredentials). */
async function getDevices(uid: string): Promise<Array<{ id: string; publicKeyBase64: string; counter: number }>> {
  const snap = await devicesCollection(uid).get();
  return snap.docs.map((d: QueryDocumentSnapshot) => {
    const x = d.data();
    return {
      id: x.credentialID,
      publicKeyBase64: x.publicKeyBase64,
      counter: x.counter ?? 0,
    };
  });
}

/** Escribe en mfa/audit. */
async function writeAudit(
  uid: string,
  ip: string | null,
  userAgent: string | null,
  action: MfaAuditDoc['action'],
  result: 'success' | 'failure',
  details?: string
): Promise<void> {
  await auditRef().add({
    uid,
    ip,
    userAgent,
    action,
    result,
    timestamp: FieldValue.serverTimestamp(),
    ...(details ? { details } : {}),
  });
}

import type { MfaAuditDoc } from './types.js';

/**
 * Genera opciones de registro para navigator.credentials.create().
 * Requiere Firebase ID token; guarda challenge en Firestore.
 */
export async function handleRegisterOptions(
  ctx: AuthContext,
  req: ReqWithHeaders
): Promise<{ options: PublicKeyCredentialCreationOptionsJSON } | { error: string }> {
  const uid = ctx.uid;
  const userEmail = ctx.email ?? uid;
  const devices = await getDevices(uid);
  const { rpID: effectiveRpId } = getRpIdAndOrigin(req);

  const options = await generateRegistrationOptions({
    rpName,
    rpID: effectiveRpId,
    userName: userEmail,
    userID: new Uint8Array(Buffer.from(uid, 'utf8')),
    userDisplayName: userEmail,
    attestationType: 'none',
    excludeCredentials: devices.map((d) => ({ id: d.id })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      // Sin authenticatorAttachment: permite plataforma (Face/huella) y cross-platform (llaves, passkeys) para escritorio.
    },
    supportedAlgorithmIDs: [-7, -257],
  });

  await saveChallenge(uid, options.challenge, 'registration');
  return { options };
}

/**
 * Verifica attestation y guarda credencial en mfa/webauthn/{uid}/devices.
 */
export async function handleRegisterResult(
  ctx: AuthContext,
  body: unknown,
  req: ReqWithHeaders,
  deviceName: string
): Promise<{ verified: boolean; error?: string }> {
  const uid = ctx.uid;
  const ip = headerString(req.headers, 'x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = headerString(req.headers, 'user-agent');

  const challengeData = await consumeChallenge(uid);
  if (!challengeData || challengeData.type !== 'registration') {
    await writeAudit(uid, ip, userAgent, 'register_result', 'failure', 'missing_or_invalid_challenge');
    return { verified: false, error: 'Invalid or expired challenge' };
  }

  if (!body || typeof (body as RegistrationResponseJSON).id !== 'string') {
    await writeAudit(uid, ip, userAgent, 'register_result', 'failure', 'invalid_body');
    return { verified: false, error: 'Invalid registration response' };
  }

  const { origin: expectedOrigin, rpID: expectedRpId } = getRpIdAndOrigin(req);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body as RegistrationResponseJSON,
      expectedChallenge: challengeData.challenge,
      expectedOrigin,
      expectedRPID: expectedRpId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Verification failed';
    await writeAudit(uid, ip, userAgent, 'register_result', 'failure', message);
    return { verified: false, error: message };
  }

  if (!verification.verified || !verification.registrationInfo) {
    await writeAudit(uid, ip, userAgent, 'register_result', 'failure', 'verification_failed');
    return { verified: false, error: 'Verification failed' };
  }

  const { credential } = verification.registrationInfo;
  const publicKeyBase64 = Buffer.from(credential.publicKey).toString('base64');
  const docRef = devicesCollection(uid).doc(credential.id);

  await docRef.set({
    credentialID: credential.id,
    publicKeyBase64,
    deviceName: deviceName || 'Dispositivo',
    rpId: expectedRpId,
    counter: credential.counter,
    createdAt: FieldValue.serverTimestamp(),
    lastUsedAt: null,
  });

  await writeAudit(uid, ip, userAgent, 'register_result', 'success');
  return { verified: true };
}

/**
 * Genera opciones de autenticación para navigator.credentials.get().
 * Requiere Firebase ID token; guarda challenge en Firestore.
 */
export async function handleAuthOptions(
  ctx: AuthContext,
  req: ReqWithHeaders
): Promise<{ options: PublicKeyCredentialRequestOptionsJSON } | { error: string }> {
  const uid = ctx.uid;
  const devices = await getDevices(uid);
  if (devices.length === 0) {
    return { error: 'no_registered_devices' };
  }

  const { rpID: effectiveRpId } = getRpIdAndOrigin(req);
  const options = await generateAuthenticationOptions({
    rpID: effectiveRpId,
    allowCredentials: devices.map((d) => ({ id: d.id })),
    userVerification: 'preferred',
  });

  await saveChallenge(uid, options.challenge, 'authentication');
  return { options };
}

/**
 * Verifica assertion y actualiza lastUsedAt y counter.
 */
export async function handleAuthResult(
  ctx: AuthContext,
  body: unknown,
  req: ReqWithHeaders
): Promise<{ verified: boolean; error?: string }> {
  const uid = ctx.uid;
  const ip = headerString(req.headers, 'x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = headerString(req.headers, 'user-agent');

  const challengeData = await consumeChallenge(uid);
  if (!challengeData || challengeData.type !== 'authentication') {
    await writeAudit(uid, ip, userAgent, 'auth_result', 'failure', 'missing_or_invalid_challenge');
    return { verified: false, error: 'Invalid or expired challenge' };
  }

  if (!body || typeof (body as AuthenticationResponseJSON).id !== 'string') {
    await writeAudit(uid, ip, userAgent, 'auth_result', 'failure', 'invalid_body');
    return { verified: false, error: 'Invalid authentication response' };
  }

  const credentialId = (body as AuthenticationResponseJSON).id;
  const devices = await getDevices(uid);
  const device = devices.find((d) => d.id === credentialId);
  if (!device) {
    await writeAudit(uid, ip, userAgent, 'auth_result', 'failure', 'credential_not_found');
    return { verified: false, error: 'Credential not found' };
  }

  const publicKey = new Uint8Array(Buffer.from(device.publicKeyBase64, 'base64'));

  const { origin: expectedOrigin, rpID: expectedRpId } = getRpIdAndOrigin(req);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body as AuthenticationResponseJSON,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: expectedOrigin,
      expectedRPID: expectedRpId,
      credential: {
        id: device.id,
        publicKey,
        counter: device.counter,
        transports: undefined,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Verification failed';
    await writeAudit(uid, ip, userAgent, 'auth_result', 'failure', message);
    return { verified: false, error: message };
  }

  if (!verification.verified || !verification.authenticationInfo) {
    await writeAudit(uid, ip, userAgent, 'auth_result', 'failure', 'verification_failed');
    return { verified: false, error: 'Verification failed' };
  }

  const docRef = devicesCollection(uid).doc(credentialId);
  await docRef.update({
    counter: verification.authenticationInfo.newCounter,
    lastUsedAt: FieldValue.serverTimestamp(),
  });

  await writeAudit(uid, ip, userAgent, 'auth_result', 'success');
  return { verified: true };
}

/**
 * Revoca un dispositivo WebAuthn de un usuario (solo admin).
 * Si credentialId no se indica, revoca todos los dispositivos del usuario.
 * Además revoca refresh tokens del usuario (force sign-out).
 */
export async function handleRevokeDevice(
  adminCtx: AuthContext,
  targetUid: string,
  credentialId: string | null,
  req: ReqWithHeaders
): Promise<{ success: boolean; error?: string }> {
  const ip = headerString(req.headers, 'x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = headerString(req.headers, 'user-agent');

  const { getAuth } = await import('firebase-admin/auth');
  const auth = getAuth();

  try {
    if (credentialId) {
      const docRef = devicesCollection(targetUid).doc(credentialId);
      const snap = await docRef.get();
      if (!snap.exists) {
        await writeAudit(adminCtx.uid, ip, userAgent, 'revoke', 'failure', 'credential_not_found');
        return { success: false, error: 'Credential not found' };
      }
      await docRef.delete();
    } else {
      const devicesSnap = await devicesCollection(targetUid).get();
      const batch = getDb().batch();
      devicesSnap.docs.forEach((d: QueryDocumentSnapshot) => batch.delete(d.ref));
      await batch.commit();
    }
    await auth.revokeRefreshTokens(targetUid);
    await writeAudit(adminCtx.uid, ip, userAgent, 'revoke', 'success', `target=${targetUid}`);
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Revoke failed';
    await writeAudit(adminCtx.uid, ip, userAgent, 'revoke', 'failure', message);
    return { success: false, error: message };
  }
}
