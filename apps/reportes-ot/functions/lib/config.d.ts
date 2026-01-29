/**
 * Configuración MFA WebAuthn (Relying Party).
 * rpID debe coincidir con el dominio donde se sirve la app (sin puerto en prod).
 */
export declare const rpName = "Reportes OT - AGS";
export declare const rpID: string;
export declare const origin: string;
/**
 * Dominio de correo permitido para acceso (Google Workspace).
 * Solo usuarios con email @agsanalitica.com pueden ingresar.
 * Vacío o no definido = no se valida dominio (útil en desarrollo).
 */
export declare const ALLOWED_EMAIL_DOMAIN: string;
/** URL de soporte mostrada cuando el usuario no pertenece al dominio. */
export declare const SUPPORT_URL: string;
/** Límites para rate limiting (por uid y por IP). */
export declare const RATE_LIMIT: {
    readonly registerOptionsPerMinute: 5;
    readonly registerResultPerMinute: 5;
    readonly authOptionsPerMinute: 10;
    readonly authResultPerMinute: 10;
    readonly revokePerMinute: 5;
};
/** TTL del challenge en Firestore (segundos). */
export declare const CHALLENGE_TTL_SEC = 300;
