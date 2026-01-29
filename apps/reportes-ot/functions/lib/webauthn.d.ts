import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';
import type { AuthContext } from './middleware.js';
/** Request mínimo para leer headers (compatible con Express). */
type ReqWithHeaders = {
    headers: Record<string, string | string[] | undefined>;
};
/**
 * Genera opciones de registro para navigator.credentials.create().
 * Requiere Firebase ID token; guarda challenge en Firestore.
 */
export declare function handleRegisterOptions(ctx: AuthContext, req: ReqWithHeaders): Promise<{
    options: PublicKeyCredentialCreationOptionsJSON;
} | {
    error: string;
}>;
/**
 * Verifica attestation y guarda credencial en mfa/webauthn/{uid}/devices.
 */
export declare function handleRegisterResult(ctx: AuthContext, body: unknown, req: ReqWithHeaders, deviceName: string): Promise<{
    verified: boolean;
    error?: string;
}>;
/**
 * Genera opciones de autenticación para navigator.credentials.get().
 * Requiere Firebase ID token; guarda challenge en Firestore.
 */
export declare function handleAuthOptions(ctx: AuthContext, req: ReqWithHeaders): Promise<{
    options: PublicKeyCredentialRequestOptionsJSON;
} | {
    error: string;
}>;
/**
 * Verifica assertion y actualiza lastUsedAt y counter.
 */
export declare function handleAuthResult(ctx: AuthContext, body: unknown, req: ReqWithHeaders): Promise<{
    verified: boolean;
    error?: string;
}>;
/**
 * Revoca un dispositivo WebAuthn de un usuario (solo admin).
 * Si credentialId no se indica, revoca todos los dispositivos del usuario.
 * Además revoca refresh tokens del usuario (force sign-out).
 */
export declare function handleRevokeDevice(adminCtx: AuthContext, targetUid: string, credentialId: string | null, req: ReqWithHeaders): Promise<{
    success: boolean;
    error?: string;
}>;
export {};
