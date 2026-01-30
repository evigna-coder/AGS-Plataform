import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Request, Response } from 'express';
import { RATE_LIMIT, ALLOWED_EMAIL_DOMAIN, SUPPORT_URL } from './config.js';

function getDb() {
  return getFirestore();
}

/** Resultado del middleware de autenticación. */
export interface AuthContext {
  uid: string;
  email?: string;
  role?: string;
}

/**
 * Obtiene el Firebase ID token del request: X-Firebase-ID-Token (proxy) o Authorization Bearer.
 */
function getFirebaseToken(req: Request): string | null {
  const fromHeader = req.headers['x-firebase-id-token'];
  if (typeof fromHeader === 'string' && fromHeader.length > 0) return fromHeader;
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

/**
 * Verifica el Firebase ID token y devuelve el contexto del usuario.
 * Acepta token en Authorization Bearer o en X-Firebase-ID-Token (cuando el proxy usa cuenta de servicio en Authorization).
 * Responde con 401 si no hay token o es inválido.
 */
export async function requireAuth(req: Request, res: Response): Promise<AuthContext | null> {
  const token = getFirebaseToken(req);
  if (!token) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return null;
  }
  try {
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
      role: (decoded as { role?: string }).role,
    };
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return null;
  }
}

/**
 * Requiere que el email del usuario pertenezca al dominio corporativo (@agsanalitica.com).
 * Debe llamarse después de requireAuth.
 * Si ALLOWED_EMAIL_DOMAIN está vacío, no se valida (permite desarrollo).
 */
export function requireAllowedDomain(ctx: AuthContext, res: Response): boolean {
  if (!ALLOWED_EMAIL_DOMAIN || ALLOWED_EMAIL_DOMAIN.length === 0) {
    return true;
  }
  const email = ctx.email?.trim().toLowerCase();
  if (!email) {
    res.status(403).json({
      error: 'domain_not_allowed',
      message: 'Solo usuarios del dominio corporativo pueden acceder.',
      supportUrl: SUPPORT_URL,
    });
    return false;
  }
  const domain = email.split('@')[1];
  if (domain !== ALLOWED_EMAIL_DOMAIN.toLowerCase()) {
    res.status(403).json({
      error: 'domain_not_allowed',
      message: `Solo se permite acceso con cuentas @${ALLOWED_EMAIL_DOMAIN}.`,
      supportUrl: SUPPORT_URL,
    });
    return false;
  }
  return true;
}

/**
 * Requiere que el usuario tenga custom claim role === 'admin'.
 * Debe llamarse después de requireAuth.
 */
export function requireAdmin(ctx: AuthContext, res: Response): boolean {
  if (ctx.role !== 'admin') {
    res.status(403).json({ error: 'Admin role required' });
    return false;
  }
  return true;
}

/** Clave de rate limit por uid + acción. */
function rateLimitKey(uid: string, action: string, ip: string): string {
  return `mfa:${action}:${uid}:${ip}`;
}

/**
 * Rate limiting por uid e IP usando Firestore como store (contador por minuto).
 * Responde con 429 si se excede el límite.
 */
export async function checkRateLimit(
  uid: string,
  action: keyof typeof RATE_LIMIT,
  req: Request,
  res: Response
): Promise<boolean> {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : forwarded?.[0]) ?? req.ip ?? 'unknown';
  const limit = RATE_LIMIT[action];
  const key = rateLimitKey(uid, action, ip);
  const now = Date.now();
  const windowStart = now - 60_000;

  const ref = getDb().collection('mfa').doc('ratelimit').collection('counters').doc(key);
  try {
    const doc = await ref.get();
    const data = doc.data() as { count: number; windowStart: number } | undefined;
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
  } catch {
    res.status(500).json({ error: 'Rate limit check failed' });
    return false;
  }
}
