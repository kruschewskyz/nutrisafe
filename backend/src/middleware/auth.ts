import type { RequestHandler } from 'express';
import { AppError } from '../lib/http.js';
import { verifyAccessToken, type Role } from '../lib/tokens.js';

/**
 * Autenticação: exige "Authorization: Bearer <access token>" válido.
 * A identidade (req.user.id) vem SEMPRE do token assinado, nunca do corpo/query da requisição.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) throw new AppError(401, 'Não autenticado', 'UNAUTHENTICATED');
  try {
    const { userId, role } = verifyAccessToken(header.slice(7));
    req.user = { id: userId, role };
    next();
  } catch {
    throw new AppError(401, 'Sessão inválida ou expirada', 'UNAUTHENTICATED');
  }
};

/** Controle de acesso por papel (RBAC). Uso: router.post('/x', requireRole('ADMIN'), ...) */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw new AppError(403, 'Acesso negado', 'FORBIDDEN');
    next();
  };

/**
 * Retorna o id do usuário autenticado. TODA consulta a dados do usuário deve filtrar por
 * este id (ex.: where: { id, userId }). Recurso de outro usuário responde 404, não 403,
 * para não revelar que ele existe (previne IDOR/enumeração).
 */
export function currentUserId(req: { user?: { id: string } }): string {
  if (!req.user) throw new AppError(401, 'Não autenticado', 'UNAUTHENTICATED');
  return req.user.id;
}
