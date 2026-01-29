"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webauthn = void 0;
const app_1 = require("firebase-admin/app");
const https_1 = require("firebase-functions/v2/https");
const express_1 = __importDefault(require("express"));
const middleware_js_1 = require("./middleware.js");
const webauthn_js_1 = require("./webauthn.js");
(0, app_1.initializeApp)();
const app = (0, express_1.default)();
// CORS: responder preflight OPTIONS y añadir headers a todas las respuestas.
const allowOrigin = (req) => {
    const origin = req.get('Origin') ?? '';
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
        return origin;
    if (/\.firebaseapp\.com$/.test(origin))
        return origin;
    if (/\.web\.app$/.test(origin))
        return origin;
    return '*';
};
app.use((req, res, next) => {
    const origin = allowOrigin(req);
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    next();
});
app.use(express_1.default.json({ limit: '64kb' }));
/** Helper: responde JSON y termina. */
function json(res, status, body) {
    res.status(status).json(body);
}
/** Router WebAuthn: montado en /api/webauthn (Hosting) y /webauthn (invocación directa). */
const webauthnRouter = express_1.default.Router();
webauthnRouter.post('/register-options', async (req, res) => {
    const ctx = await (0, middleware_js_1.requireAuth)(req, res);
    if (!ctx)
        return;
    if (!(0, middleware_js_1.requireAllowedDomain)(ctx, res))
        return;
    const ok = await (0, middleware_js_1.checkRateLimit)(ctx.uid, 'registerOptionsPerMinute', req, res);
    if (!ok)
        return;
    const result = await (0, webauthn_js_1.handleRegisterOptions)(ctx, req);
    if ('error' in result) {
        json(res, 400, { error: result.error });
        return;
    }
    json(res, 200, result);
});
webauthnRouter.post('/register-result', async (req, res) => {
    const ctx = await (0, middleware_js_1.requireAuth)(req, res);
    if (!ctx)
        return;
    if (!(0, middleware_js_1.requireAllowedDomain)(ctx, res))
        return;
    const ok = await (0, middleware_js_1.checkRateLimit)(ctx.uid, 'registerResultPerMinute', req, res);
    if (!ok)
        return;
    const body = req.body;
    const deviceName = typeof body?.deviceName === 'string' ? body.deviceName : 'Dispositivo';
    const result = await (0, webauthn_js_1.handleRegisterResult)(ctx, body?.response, req, deviceName);
    if (!result.verified) {
        json(res, 400, { error: result.error ?? 'Verification failed' });
        return;
    }
    json(res, 200, { verified: true });
});
webauthnRouter.post('/auth-options', async (req, res) => {
    const ctx = await (0, middleware_js_1.requireAuth)(req, res);
    if (!ctx)
        return;
    if (!(0, middleware_js_1.requireAllowedDomain)(ctx, res))
        return;
    const ok = await (0, middleware_js_1.checkRateLimit)(ctx.uid, 'authOptionsPerMinute', req, res);
    if (!ok)
        return;
    const result = await (0, webauthn_js_1.handleAuthOptions)(ctx, req);
    if ('error' in result) {
        if (result.error === 'no_registered_devices') {
            json(res, 200, { options: null, error: result.error });
            return;
        }
        json(res, 400, { error: result.error });
        return;
    }
    json(res, 200, result);
});
webauthnRouter.post('/auth-result', async (req, res) => {
    const ctx = await (0, middleware_js_1.requireAuth)(req, res);
    if (!ctx)
        return;
    if (!(0, middleware_js_1.requireAllowedDomain)(ctx, res))
        return;
    const ok = await (0, middleware_js_1.checkRateLimit)(ctx.uid, 'authResultPerMinute', req, res);
    if (!ok)
        return;
    const body = req.body;
    const result = await (0, webauthn_js_1.handleAuthResult)(ctx, body?.response, req);
    if (!result.verified) {
        json(res, 400, { error: result.error ?? 'Verification failed' });
        return;
    }
    json(res, 200, { verified: true });
});
webauthnRouter.post('/revoke', async (req, res) => {
    const ctx = await (0, middleware_js_1.requireAuth)(req, res);
    if (!ctx)
        return;
    if (!(0, middleware_js_1.requireAllowedDomain)(ctx, res))
        return;
    if (!(0, middleware_js_1.requireAdmin)(ctx, res))
        return;
    const ok = await (0, middleware_js_1.checkRateLimit)(ctx.uid, 'revokePerMinute', req, res);
    if (!ok)
        return;
    const body = req.body;
    const targetUid = typeof body?.targetUid === 'string' ? body.targetUid : '';
    const credentialId = typeof body?.credentialId === 'string' ? body.credentialId : null;
    if (!targetUid) {
        json(res, 400, { error: 'targetUid required' });
        return;
    }
    const result = await (0, webauthn_js_1.handleRevokeDevice)(ctx, targetUid, credentialId, req);
    if (!result.success) {
        json(res, 400, { error: result.error });
        return;
    }
    json(res, 200, { success: true });
});
// Hosting reescribe /api/webauthn/** → esta función; la ruta recibida es /api/webauthn/auth-options, etc.
app.use('/api/webauthn', webauthnRouter);
// Invocación directa: path puede ser /webauthn/auth-options o /auth-options según la plataforma
app.use('/webauthn', webauthnRouter);
app.use(webauthnRouter);
/** Exportar una sola función HTTP que maneja todas las rutas WebAuthn. */
exports.webauthn = (0, https_1.onRequest)({
    region: 'us-central1',
    cors: true,
    maxInstances: 10,
}, app);
