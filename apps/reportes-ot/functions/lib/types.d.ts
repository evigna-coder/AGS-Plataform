/**
 * Documento de dispositivo WebAuthn en Firestore.
 * Colección: mfa/webauthn/{uid}/devices
 */
export interface WebauthnDeviceDoc {
    credentialID: string;
    /** publicKey almacenado como base64 (Buffer/Uint8Array no es serializable en Firestore). */
    publicKeyBase64: string;
    deviceName: string;
    rpId: string;
    counter: number;
    createdAt: {
        _seconds: number;
    };
    lastUsedAt: {
        _seconds: number;
    } | null;
}
/**
 * Entrada de auditoría en Firestore.
 * Colección: mfa/audit
 */
export interface MfaAuditDoc {
    uid: string;
    ip: string | null;
    userAgent: string | null;
    action: 'register_options' | 'register_result' | 'auth_options' | 'auth_result' | 'revoke';
    result: 'success' | 'failure';
    timestamp: {
        _seconds: number;
    };
    details?: string;
}
/**
 * Challenge temporal para registro o autenticación.
 * Documento: mfa/challenges/{uid}
 */
export interface ChallengeDoc {
    challenge: string;
    type: 'registration' | 'authentication';
    createdAt: {
        _seconds: number;
    };
}
