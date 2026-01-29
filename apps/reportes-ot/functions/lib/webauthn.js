"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRegisterOptions = handleRegisterOptions;
exports.handleRegisterResult = handleRegisterResult;
exports.handleAuthOptions = handleAuthOptions;
exports.handleAuthResult = handleAuthResult;
exports.handleRevokeDevice = handleRevokeDevice;
const server_1 = require("@simplewebauthn/server");
const firestore_1 = require("firebase-admin/firestore");
const config_js_1 = require("./config.js");
/** Obtiene rpID y origin para WebAuthn desde la petición (Origin, X-WebAuthn-Origin, Referer) o la config. */
function getRpIdAndOrigin(req) {
    const tryOrigin = (value) => {
        if (!value || !value.startsWith('http'))
            return null;
        try {
            const u = new URL(value);
            if (u.protocol === 'https:' || u.protocol === 'http:') {
                return { rpID: u.hostname, origin: u.origin };
            }
        }
        catch {
            // ignore invalid URL
        }
        return null;
    };
    const originHeader = headerString(req.headers, 'origin') || headerString(req.headers, 'Origin');
    let result = tryOrigin(originHeader);
    if (result)
        return result;
    const clientOrigin = headerString(req.headers, 'x-webauthn-origin');
    result = tryOrigin(clientOrigin);
    if (result)
        return result;
    const referer = headerString(req.headers, 'referer') || headerString(req.headers, 'Referer');
    if (referer) {
        result = tryOrigin(referer);
        if (result)
            return result;
    }
    return {
        rpID: config_js_1.rpID === 'localhost' ? 'localhost' : config_js_1.rpID,
        origin: config_js_1.origin.startsWith('http') ? config_js_1.origin : `https://${config_js_1.origin}`,
    };
}
function getDb() {
    return (0, firestore_1.getFirestore)();
}
function headerString(headers, name) {
    const v = headers[name];
    if (v == null)
        return null;
    return typeof v === 'string' ? v : v[0] ?? null;
}
const devicesCollection = (uid) => getDb().collection('mfa').doc('webauthn').collection('users').doc(uid).collection('devices');
const challengesRef = (uid) => getDb().collection('mfa').doc('challenges').collection(uid).doc('current');
const auditRef = () => getDb().collection('mfa').doc('audit').collection('logs');
/** Guarda challenge en Firestore (short-lived). */
async function saveChallenge(uid, challenge, type) {
    await challengesRef(uid).set({
        challenge,
        type,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
}
/** Recupera y borra el challenge (para verificación). */
async function consumeChallenge(uid) {
    const ref = challengesRef(uid);
    const snap = await ref.get();
    if (!snap.exists)
        return null;
    const data = snap.data();
    const createdAt = data.createdAt?.toMillis?.() ?? 0;
    if (Date.now() - createdAt > config_js_1.CHALLENGE_TTL_SEC * 1000) {
        await ref.delete();
        return null;
    }
    await ref.delete();
    return { challenge: data.challenge, type: data.type };
}
/** Lista dispositivos WebAuthn del usuario (para excludeCredentials / allowCredentials). */
async function getDevices(uid) {
    const snap = await devicesCollection(uid).get();
    return snap.docs.map((d) => {
        const x = d.data();
        return {
            id: x.credentialID,
            publicKeyBase64: x.publicKeyBase64,
            counter: x.counter ?? 0,
        };
    });
}
/** Escribe en mfa/audit. */
async function writeAudit(uid, ip, userAgent, action, result, details) {
    await auditRef().add({
        uid,
        ip,
        userAgent,
        action,
        result,
        timestamp: firestore_1.FieldValue.serverTimestamp(),
        ...(details ? { details } : {}),
    });
}
/**
 * Genera opciones de registro para navigator.credentials.create().
 * Requiere Firebase ID token; guarda challenge en Firestore.
 */
async function handleRegisterOptions(ctx, req) {
    const uid = ctx.uid;
    const userEmail = ctx.email ?? uid;
    const devices = await getDevices(uid);
    const { rpID: effectiveRpId } = getRpIdAndOrigin(req);
    const options = await (0, server_1.generateRegistrationOptions)({
        rpName: config_js_1.rpName,
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
async function handleRegisterResult(ctx, body, req, deviceName) {
    const uid = ctx.uid;
    const ip = headerString(req.headers, 'x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const userAgent = headerString(req.headers, 'user-agent');
    const challengeData = await consumeChallenge(uid);
    if (!challengeData || challengeData.type !== 'registration') {
        await writeAudit(uid, ip, userAgent, 'register_result', 'failure', 'missing_or_invalid_challenge');
        return { verified: false, error: 'Invalid or expired challenge' };
    }
    if (!body || typeof body.id !== 'string') {
        await writeAudit(uid, ip, userAgent, 'register_result', 'failure', 'invalid_body');
        return { verified: false, error: 'Invalid registration response' };
    }
    const { origin: expectedOrigin, rpID: expectedRpId } = getRpIdAndOrigin(req);
    let verification;
    try {
        verification = await (0, server_1.verifyRegistrationResponse)({
            response: body,
            expectedChallenge: challengeData.challenge,
            expectedOrigin,
            expectedRPID: expectedRpId,
        });
    }
    catch (e) {
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
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        lastUsedAt: null,
    });
    await writeAudit(uid, ip, userAgent, 'register_result', 'success');
    return { verified: true };
}
/**
 * Genera opciones de autenticación para navigator.credentials.get().
 * Requiere Firebase ID token; guarda challenge en Firestore.
 */
async function handleAuthOptions(ctx, req) {
    const uid = ctx.uid;
    const devices = await getDevices(uid);
    if (devices.length === 0) {
        return { error: 'no_registered_devices' };
    }
    const { rpID: effectiveRpId } = getRpIdAndOrigin(req);
    const options = await (0, server_1.generateAuthenticationOptions)({
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
async function handleAuthResult(ctx, body, req) {
    const uid = ctx.uid;
    const ip = headerString(req.headers, 'x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const userAgent = headerString(req.headers, 'user-agent');
    const challengeData = await consumeChallenge(uid);
    if (!challengeData || challengeData.type !== 'authentication') {
        await writeAudit(uid, ip, userAgent, 'auth_result', 'failure', 'missing_or_invalid_challenge');
        return { verified: false, error: 'Invalid or expired challenge' };
    }
    if (!body || typeof body.id !== 'string') {
        await writeAudit(uid, ip, userAgent, 'auth_result', 'failure', 'invalid_body');
        return { verified: false, error: 'Invalid authentication response' };
    }
    const credentialId = body.id;
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
        verification = await (0, server_1.verifyAuthenticationResponse)({
            response: body,
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
    }
    catch (e) {
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
        lastUsedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    await writeAudit(uid, ip, userAgent, 'auth_result', 'success');
    return { verified: true };
}
/**
 * Revoca un dispositivo WebAuthn de un usuario (solo admin).
 * Si credentialId no se indica, revoca todos los dispositivos del usuario.
 * Además revoca refresh tokens del usuario (force sign-out).
 */
async function handleRevokeDevice(adminCtx, targetUid, credentialId, req) {
    const ip = headerString(req.headers, 'x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const userAgent = headerString(req.headers, 'user-agent');
    const { getAuth } = await Promise.resolve().then(() => __importStar(require('firebase-admin/auth')));
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
        }
        else {
            const devicesSnap = await devicesCollection(targetUid).get();
            const batch = getDb().batch();
            devicesSnap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
        }
        await auth.revokeRefreshTokens(targetUid);
        await writeAudit(adminCtx.uid, ip, userAgent, 'revoke', 'success', `target=${targetUid}`);
        return { success: true };
    }
    catch (e) {
        const message = e instanceof Error ? e.message : 'Revoke failed';
        await writeAudit(adminCtx.uid, ip, userAgent, 'revoke', 'failure', message);
        return { success: false, error: message };
    }
}
