import { initializeApp } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
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

// CORS: responder preflight OPTIONS y añadir headers a todas las respuestas.
// Cloud Functions puede no pasar OPTIONS al middleware cors(), por eso lo hacemos explícito.
const allowOrigin = (req: Request): string => {
  const origin = req.get('Origin') ?? '';
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  if (/\.firebaseapp\.com$/.test(origin)) return origin;
  if (/\.web\.app$/.test(origin)) return origin; // Firebase Hosting (app desplegada)
  return '*';
};
app.use((req: Request, res: Response, next) => {
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
app.use(express.json({ limit: '64kb' }));

/** Helper: responde JSON y termina. */
function json(res: Response, status: number, body: object): void {
  res.status(status).json(body);
}

/**
 * POST /register-options (URL completa: .../webauthn/register-options)
 * Requiere Authorization: Bearer <Firebase ID token>.
 * Devuelve options para navigator.credentials.create().
 */
app.post('/register-options', async (req: Request, res: Response) => {
  const ctx = await requireAuth(req, res);
  if (!ctx) return;
  if (!requireAllowedDomain(ctx, res)) return;
  const ok = await checkRateLimit(ctx.uid, 'registerOptionsPerMinute', req, res);
  if (!ok) return;
  const result = await handleRegisterOptions(ctx, req);
  if ('error' in result) {
    json(res, 400, { error: result.error });
    return;
  }
  json(res, 200, result);
});

/**
 * POST /register-result (URL completa: .../webauthn/register-result)
 * Body: { response: RegistrationResponseJSON, deviceName?: string }
 */
app.post('/register-result', async (req: Request, res: Response) => {
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

/**
 * POST /auth-options (URL completa: .../webauthn/auth-options)
 * Requiere Authorization: Bearer <Firebase ID token>.
 * Devuelve options para navigator.credentials.get().
 */
app.post('/auth-options', async (req: Request, res: Response) => {
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

/**
 * POST /auth-result (URL completa: .../webauthn/auth-result)
 * Body: { response: AuthenticationResponseJSON }
 */
app.post('/auth-result', async (req: Request, res: Response) => {
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

/**
 * POST /revoke (URL completa: .../webauthn/revoke)
 * Admin only. Body: { targetUid: string, credentialId?: string }
 */
app.post('/revoke', async (req: Request, res: Response) => {
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

/** Exportar una sola función HTTP que maneja todas las rutas WebAuthn. */
export const webauthn = onRequest(
  {
    region: 'us-central1',
    cors: true,
    maxInstances: 10,
  },
  app
);
