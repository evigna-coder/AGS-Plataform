"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHALLENGE_TTL_SEC = exports.RATE_LIMIT = exports.SUPPORT_URL = exports.ALLOWED_EMAIL_DOMAIN = exports.origin = exports.rpID = exports.rpName = void 0;
/**
 * Configuración MFA WebAuthn (Relying Party).
 * rpID debe coincidir con el dominio donde se sirve la app (sin puerto en prod).
 */
exports.rpName = 'Reportes OT - AGS';
exports.rpID = process.env.RP_ID ?? 'localhost';
exports.origin = process.env.ORIGIN ?? `http://${exports.rpID}`;
/**
 * Dominio de correo permitido para acceso (Google Workspace).
 * Solo usuarios con email @agsanalitica.com pueden ingresar.
 * Vacío o no definido = no se valida dominio (útil en desarrollo).
 */
exports.ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? 'agsanalitica.com';
/** URL de soporte mostrada cuando el usuario no pertenece al dominio. */
exports.SUPPORT_URL = process.env.SUPPORT_URL ?? 'https://agsanalitica.com/contacto';
/** Límites para rate limiting (por uid y por IP). */
exports.RATE_LIMIT = {
    registerOptionsPerMinute: 5,
    registerResultPerMinute: 5,
    authOptionsPerMinute: 10,
    authResultPerMinute: 10,
    revokePerMinute: 5,
};
/** TTL del challenge en Firestore (segundos). */
exports.CHALLENGE_TTL_SEC = 300;
