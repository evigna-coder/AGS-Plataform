/**
 * Cliente para endpoints WebAuthn (Cloud Function).
 * Usa Bearer token de Firebase para autorización.
 */
import { getIdToken } from './authService';

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '';
const EXPLICIT_WEBAUTHN_URL = import.meta.env.VITE_WEBAUTHN_URL ?? '';
const isDev = import.meta.env.DEV;

/** URL base de la Cloud Function webauthn. En desarrollo usa el proxy de Vite para evitar CORS. */
function getBaseUrl(): string {
  if (isDev) {
    return '/api/webauthn';
  }
  const base =
    EXPLICIT_WEBAUTHN_URL ||
    (PROJECT_ID ? `https://us-central1-${PROJECT_ID}.cloudfunctions.net/webauthn` : '');
  if (!base) {
    console.warn('VITE_WEBAUTHN_URL no definida y VITE_FIREBASE_PROJECT_ID ausente; las llamadas MFA fallarán.');
  }
  return base.replace(/\/$/, '');
}

async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getIdToken();
  const url = `${getBaseUrl()}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers as Record<string, string>),
  };
  return fetch(url, { ...options, headers });
}

/**
 * Obtiene opciones para segundo factor (navigator.credentials.get).
 * Si el usuario no tiene dispositivos registrados, response tiene error: 'no_registered_devices'.
 */
export async function getAuthOptions(): Promise<
  | { options: PublicKeyCredentialRequestOptions; error?: undefined }
  | { options: null; error: 'no_registered_devices' }
  | { options: null; error: string }
> {
  const res = await fetchWithAuth('/auth-options', { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { options: null, error: data.error ?? data.message ?? 'Error al obtener opciones' };
  }
  if (data.error === 'no_registered_devices') {
    return { options: null, error: 'no_registered_devices' };
  }
  if (!data.options) {
    return { options: null, error: data.error ?? 'Sin opciones' };
  }
  const options = toCredentialRequestOptions(data.options);
  return { options };
}

/**
 * Envía el resultado de navigator.credentials.get() para verificar el segundo factor.
 */
export async function submitAuthResult(credential: PublicKeyCredential): Promise<{ verified: boolean; error?: string }> {
  const body = credentialToAuthJSON(credential);
  const res = await fetchWithAuth('/auth-result', {
    method: 'POST',
    body: JSON.stringify({ response: body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { verified: false, error: data.error ?? data.message ?? 'Error al verificar' };
  }
  return { verified: !!data.verified, error: data.error };
}

/**
 * Obtiene opciones para registro de dispositivo (navigator.credentials.create).
 */
export async function getRegisterOptions(deviceName?: string): Promise<
  | { options: PublicKeyCredentialCreationOptions; error?: undefined }
  | { options: null; error: string }
> {
  const res = await fetchWithAuth('/register-options', { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { options: null, error: data.error ?? data.message ?? 'Error al obtener opciones de registro' };
  }
  if (!data.options) {
    return { options: null, error: data.error ?? 'Sin opciones' };
  }
  const options = toCredentialCreationOptions(data.options);
  return { options };
}

/**
 * Envía el resultado de navigator.credentials.create() para completar el registro.
 */
export async function submitRegisterResult(
  credential: PublicKeyCredential,
  deviceName?: string
): Promise<{ verified: boolean; error?: string }> {
  const body = credentialToRegisterJSON(credential);
  const res = await fetchWithAuth('/register-result', {
    method: 'POST',
    body: JSON.stringify({ response: body, deviceName: deviceName ?? 'Dispositivo' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { verified: false, error: data.error ?? data.message ?? 'Error al registrar' };
  }
  return { verified: !!data.verified, error: data.error };
}

function toCredentialRequestOptions(json: Record<string, unknown>): PublicKeyCredentialRequestOptions {
  return {
    challenge: base64URLToBuffer(json.challenge as string),
    timeout: (json.timeout as number) ?? 60000,
    rpId: json.rpId as string,
    allowCredentials: ((json.allowCredentials as Array<{ id: string; type?: string }>) ?? []).map((c) => ({
      type: 'public-key',
      id: base64URLToBuffer(c.id),
      transports: (c as { transports?: AuthenticatorTransport[] }).transports,
    })),
    userVerification: (json.userVerification as UserVerificationRequirement) ?? 'preferred',
  };
}

function toCredentialCreationOptions(json: Record<string, unknown>): PublicKeyCredentialCreationOptions {
  const user = json.user as { id: string; name: string; displayName?: string };
  return {
    challenge: base64URLToBuffer(json.challenge as string),
    rp: json.rp as PublicKeyCredentialRpEntity,
    user: {
      id: base64URLToBuffer(user.id),
      name: user.name,
      displayName: user.displayName ?? user.name,
    },
    pubKeyCredParams: (json.pubKeyCredParams as PublicKeyCredentialParameters[]) ?? [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    timeout: (json.timeout as number) ?? 60000,
    attestation: (json.attestation as AttestationConveyancePreference) ?? 'none',
    authenticatorSelection: json.authenticatorSelection as AuthenticatorSelectionCriteria | undefined,
    excludeCredentials: ((json.excludeCredentials as Array<{ id: string }>) ?? []).map((c) => ({
      type: 'public-key',
      id: base64URLToBuffer(c.id),
    })),
  };
}

function base64URLToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(base64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function credentialToAuthJSON(credential: PublicKeyCredential): Record<string, unknown> {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64URL(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64URL(response.clientDataJSON),
      authenticatorData: bufferToBase64URL(response.authenticatorData),
      signature: bufferToBase64URL(response.signature),
      userHandle: response.userHandle ? bufferToBase64URL(response.userHandle) : null,
    },
    clientExtensionResults: {},
    authenticatorAttachment: (credential as unknown as { authenticatorAttachment?: string }).authenticatorAttachment,
  };
}

function credentialToRegisterJSON(credential: PublicKeyCredential): Record<string, unknown> {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64URL(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64URL(response.clientDataJSON),
      attestationObject: bufferToBase64URL(response.attestationObject),
    },
    clientExtensionResults: {},
    authenticatorAttachment: (credential as unknown as { authenticatorAttachment?: string }).authenticatorAttachment,
  };
}

function bufferToBase64URL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
