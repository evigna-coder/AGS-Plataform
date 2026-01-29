"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAllowedDomain = requireAllowedDomain;
exports.requireAdmin = requireAdmin;
exports.checkRateLimit = checkRateLimit;
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const config_js_1 = require("./config.js");
function getDb() {
    return (0, firestore_1.getFirestore)();
}
/**
 * Verifica el Firebase ID token y devuelve el contexto del usuario.
 * Responde con 401 si no hay token o es inválido.
 */
async function requireAuth(req, res) {
    const authHeader = req.headers.authorization;
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        res.status(401).json({ error: 'Missing or invalid Authorization header' });
        return null;
    }
    try {
        const auth = (0, auth_1.getAuth)();
        const decoded = await auth.verifyIdToken(token);
        return {
            uid: decoded.uid,
            email: decoded.email,
            role: decoded.role,
        };
    }
    catch {
        res.status(401).json({ error: 'Invalid or expired token' });
        return null;
    }
}
/**
 * Requiere que el email del usuario pertenezca al dominio corporativo (@agsanalitica.com).
 * Debe llamarse después de requireAuth.
 * Si ALLOWED_EMAIL_DOMAIN está vacío, no se valida (permite desarrollo).
 */
function requireAllowedDomain(ctx, res) {
    if (!config_js_1.ALLOWED_EMAIL_DOMAIN || config_js_1.ALLOWED_EMAIL_DOMAIN.length === 0) {
        return true;
    }
    const email = ctx.email?.trim().toLowerCase();
    if (!email) {
        res.status(403).json({
            error: 'domain_not_allowed',
            message: 'Solo usuarios del dominio corporativo pueden acceder.',
            supportUrl: config_js_1.SUPPORT_URL,
        });
        return false;
    }
    const domain = email.split('@')[1];
    if (domain !== config_js_1.ALLOWED_EMAIL_DOMAIN.toLowerCase()) {
        res.status(403).json({
            error: 'domain_not_allowed',
            message: `Solo se permite acceso con cuentas @${config_js_1.ALLOWED_EMAIL_DOMAIN}.`,
            supportUrl: config_js_1.SUPPORT_URL,
        });
        return false;
    }
    return true;
}
/**
 * Requiere que el usuario tenga custom claim role === 'admin'.
 * Debe llamarse después de requireAuth.
 */
function requireAdmin(ctx, res) {
    if (ctx.role !== 'admin') {
        res.status(403).json({ error: 'Admin role required' });
        return false;
    }
    return true;
}
/** Clave de rate limit por uid + acción. */
function rateLimitKey(uid, action, ip) {
    return `mfa:${action}:${uid}:${ip}`;
}
/**
 * Rate limiting por uid e IP usando Firestore como store (contador por minuto).
 * Responde con 429 si se excede el límite.
 */
async function checkRateLimit(uid, action, req, res) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : forwarded?.[0]) ?? req.ip ?? 'unknown';
    const limit = config_js_1.RATE_LIMIT[action];
    const key = rateLimitKey(uid, action, ip);
    const now = Date.now();
    const windowStart = now - 60_000;
    const ref = getDb().collection('mfa').doc('ratelimit').collection('counters').doc(key);
    try {
        const doc = await ref.get();
        const data = doc.data();
        if (!data) {
            await ref.set({ count: 1, windowStart: now });
            return true;
        }
        const inWindow = data.windowStart >= windowStart;
        const newCount = inWindow ? data.count + 1 : 1;
        const newWindowStart = inWindow ? data.windowStart : now;
        if (newCount > limit) {
            res.status(429).json({ error: 'Too many requests' });
            return false;
        }
        await ref.set({ count: newCount, windowStart: newWindowStart });
        return true;
    }
    catch {
        res.status(500).json({ error: 'Rate limit check failed' });
        return false;
    }
}
