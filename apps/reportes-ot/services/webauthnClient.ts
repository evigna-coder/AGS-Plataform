/**
 * Cliente para endpoints WebAuthn (Cloud Function).
 * Usa Bearer token de Firebase para autorización.
 */
import { getIdToken } from './authService';

/** URL base: mismo origen /api/webauthn (proxy en Vite, Firebase Hosting y Vercel) para evitar CORS. */
function getBaseUrl(): string {
  return '/api/webauthn';
}

async function fetchWithAuth(path: string, options: RequestInit & { forceRefresh?: boolean } = {}): Promise<Response> {
  const { forceRefresh, ...rest } = options;
  const token = await getIdToken(forceRefresh === true);
  const url = `${getBaseUrl()}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    // Alternativa por si el proxy/CDN elimina Authorization (p. ej. en móvil)
    'X-Firebase-ID-Token': token,
    // El backend usa esto para rpID/origin cuando Origin no viene (p. ej. same-origin en Android).
    'X-WebAuthn-Origin': typeof window !== 'undefined' ? window.location.origin : '',
    ...(rest.headers as Record<string, string>),
  };
  return fetch(url, { ...rest, headers });
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
 * Si recibe 401, reintenta una vez con token fresco (en móvil el token puede caducar).
 */
export async function getRegisterOptions(deviceName?: string): Promise<
  | { options: PublicKeyCredentialCreationOptions; error?: undefined }
  | { options: null; error: string }
> {
  const doRequest = () => fetchWithAuth('/register-options', { method: 'POST', forceRefresh: true });

  let res: Response;
  try {
    res = await doRequest();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de red';
    return { options: null, error: `No se pudo conectar. ${msg}` };
  }

  if (res.status === 401) {
    await new Promise((r) => setTimeout(r, 800));
    try {
      res = await doRequest();
    } catch {
      return { options: null, error: 'Sesión expirada. Cierra sesión y vuelve a iniciar sesión.' };
    }
  }

  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const fallback = res.status === 401 ? 'Sesión expirada. Cierra sesión y vuelve a iniciar sesión.' : res.status === 403 ? 'Dominio no permitido.' : res.status === 404 ? 'Servicio no encontrado.' : `Error (${res.status}).`;
    const msg = data.error ?? data.message ?? fallback;
    return { options: null, error: msg };
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
