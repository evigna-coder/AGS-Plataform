import { initializeApp } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import { requireAuth, requireAllowedDomain, requireAdmin, checkRateLimit } from './middleware.js';
import {
  handleRegisterOptions,
  handleRegisterResult,
  handleAuthOptions,
  handleAuthResult,
  handleRevokeDevice,
} from './webauthn.js';

initializeApp();

const app = express();

// CORS: usar el paquete cors para preflight OPTIONS (Cloud Functions 2nd gen a veces no pasa OPTIONS al middleware manual).
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-WebAuthn-Origin'],
  maxAge: 86400,
}));
app.use(express.json({ limit: '64kb' }));

/** Helper: responde JSON y termina. */
function json(res: Response, status: number, body: object): void {
  res.status(status).json(body);
}

/** Router WebAuthn: montado en /api/webauthn (Hosting) y /webauthn (invocación directa). */
const webauthnRouter = express.Router();

webauthnRouter.post('/register-options', async (req: Request, res: Response) => {
  const ctx = await requireAuth(req, res);
  if (!ctx) return;
  if (!requireAllowedDomain(ctx, res)) return;
  const ok = await checkRateLimit(ctx.uid, 'registerOptionsPerMinute', req, res);
  if (!ok) return;
  try {
    const result = await handleRegisterOptions(ctx, req);
    if ('error' in result) {
      json(res, 400, { error: result.error });
      return;
    }
    json(res, 200, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno';
    json(res, 500, { error: message });
  }
});

webauthnRouter.post('/register-result', async (req: Request, res: Response) => {
  const ctx = await requireAuth(req, res);
  if (!ctx) return;
  if (!requireAllowedDomain(ctx, res)) return;
  const ok = await checkRateLimit(ctx.uid, 'registerResultPerMinute', req, res);
  if (!ok) return;
  const body = req.body as { response?: unknown; deviceName?: string };
  const deviceName = typeof body?.deviceName === 'string' ? body.deviceName : 'Dispositivo';
  const result = await handleRegisterResult(ctx, body?.response, req, deviceName);
  if (!result.verified) {
    json(res, 400, { error: result.error ?? 'Verification failed' });
    return;
  }
  json(res, 200, { verified: true });
});

webauthnRouter.post('/auth-options', async (req: Request, res: Response) => {
  const ctx = await requireAuth(req, res);
  if (!ctx) return;
  if (!requireAllowedDomain(ctx, res)) return;
  const ok = await checkRateLimit(ctx.uid, 'authOptionsPerMinute', req, res);
  if (!ok) return;
  const result = await handleAuthOptions(ctx, req);
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

webauthnRouter.post('/auth-result', async (req: Request, res: Response) => {
  const ctx = await requireAuth(req, res);
  if (!ctx) return;
  if (!requireAllowedDomain(ctx, res)) return;
  const ok = await checkRateLimit(ctx.uid, 'authResultPerMinute', req, res);
  if (!ok) return;
  const body = req.body as { response?: unknown };
  const result = await handleAuthResult(ctx, body?.response, req);
  if (!result.verified) {
    json(res, 400, { error: result.error ?? 'Verification failed' });
    return;
  }
  json(res, 200, { verified: true });
});

webauthnRouter.post('/revoke', async (req: Request, res: Response) => {
  const ctx = await requireAuth(req, res);
  if (!ctx) return;
  if (!requireAllowedDomain(ctx, res)) return;
  if (!requireAdmin(ctx, res)) return;
  const ok = await checkRateLimit(ctx.uid, 'revokePerMinute', req, res);
  if (!ok) return;
  const body = req.body as { targetUid?: string; credentialId?: string };
  const targetUid = typeof body?.targetUid === 'string' ? body.targetUid : '';
  const credentialId = typeof body?.credentialId === 'string' ? body.credentialId : null;
  if (!targetUid) {
    json(res, 400, { error: 'targetUid required' });
    return;
  }
  const result = await handleRevokeDevice(ctx, targetUid, credentialId, req);
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
export const webauthn = onRequest(
  {
    region: 'us-central1',
    cors: [
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
      /\.web\.app$/,
      /\.firebaseapp\.com$/,
      /\.vercel\.app$/,
      /^https:\/\/ags-plataform\.vercel\.app$/,
    ],
    maxInstances: 10,
  },
  app
);
