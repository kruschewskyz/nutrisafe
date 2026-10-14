import { createHmac, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const ISSUER = 'nutrisafe-api';
const AUDIENCE = 'nutrisafe-web';

export type Role = 'USER' | 'ADMIN';

/** Access token: JWT curto (15 min por padrão), assinado com HS256 e algoritmo FIXADO na verificação. */
export function signAccessToken(userId: string, role: Role): string {
  return jwt.sign({ role }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: env.ACCESS_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): { userId: string; role: Role } {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'], // evita ataque de "alg: none" / troca de algoritmo
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (typeof payload === 'string' || typeof payload.sub !== 'string') throw new Error('invalid payload');
  const role = payload['role'] === 'ADMIN' ? 'ADMIN' : 'USER';
  return { userId: payload.sub, role };
}

/**
 * Refresh e reset tokens são OPACOS (64 caracteres aleatórios, 384 bits de entropia).
 * No banco guardamos só o HMAC-SHA256 com um "pepper" secreto: se o banco vazar,
 * os tokens não podem ser usados nem reconstruídos.
 */
export const newOpaqueToken = (): string => randomBytes(48).toString('base64url');

export const hashToken = (token: string): string =>
  createHmac('sha256', env.TOKEN_HASH_PEPPER).update(token).digest('hex');
