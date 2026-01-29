import type { Request, Response } from 'express';
import { RATE_LIMIT } from './config.js';
/** Resultado del middleware de autenticación. */
export interface AuthContext {
    uid: string;
    email?: string;
    role?: string;
}
/**
 * Verifica el Firebase ID token y devuelve el contexto del usuario.
 * Responde con 401 si no hay token o es inválido.
 */
export declare function requireAuth(req: Request, res: Response): Promise<AuthContext | null>;
/**
 * Requiere que el email del usuario pertenezca al dominio corporativo (@agsanalitica.com).
 * Debe llamarse después de requireAuth.
 * Si ALLOWED_EMAIL_DOMAIN está vacío, no se valida (permite desarrollo).
 */
export declare function requireAllowedDomain(ctx: AuthContext, res: Response): boolean;
/**
 * Requiere que el usuario tenga custom claim role === 'admin'.
 * Debe llamarse después de requireAuth.
 */
export declare function requireAdmin(ctx: AuthContext, res: Response): boolean;
/**
 * Rate limiting por uid e IP usando Firestore como store (contador por minuto).
 * Responde con 429 si se excede el límite.
 */
export declare function checkRateLimit(uid: string, action: keyof typeof RATE_LIMIT, req: Request, res: Response): Promise<boolean>;
