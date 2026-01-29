/**
 * Configuración MFA WebAuthn (Relying Party).
 * rpID debe coincidir con el dominio donde se sirve la app (sin puerto en prod).
 */
export const rpName = 'Reportes OT - AGS';
export const rpID = process.env.RP_ID ?? 'localhost';
export const origin = process.env.ORIGIN ?? `http://${rpID}`;

/**
 * Dominio de correo permitido para acceso (Google Workspace).
 * Solo usuarios con email @agsanalitica.com pueden ingresar.
 * Vacío o no definido = no se valida dominio (útil en desarrollo).
 */
export const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? 'agsanalitica.com';

/** URL de soporte mostrada cuando el usuario no pertenece al dominio. */
export const SUPPORT_URL = process.env.SUPPORT_URL ?? 'https://agsanalitica.com/contacto';

/** Límites para rate limiting (por uid y por IP). */
export const RATE_LIMIT = {
  registerOptionsPerMinute: 5,
  registerResultPerMinute: 5,
  authOptionsPerMinute: 10,
  authResultPerMinute: 10,
  revokePerMinute: 5,
} as const;

/** TTL del challenge en Firestore (segundos). */
export const CHALLENGE_TTL_SEC = 300;
