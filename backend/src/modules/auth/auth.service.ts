import { randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/http.js';
import { sendPasswordResetEmail } from '../../lib/mailer.js';
import { prisma } from '../../lib/prisma.js';
import { hashToken, newOpaqueToken, signAccessToken, type Role } from '../../lib/tokens.js';
import type { RegisterInput } from './auth.schemas.js';

/**
 * Argon2id com os parâmetros mínimos recomendados pela OWASP (19 MiB, 2 iterações, 1 thread).
 * Argon2 gera um salt aleatório por senha e o embute no hash.
 */
const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

// Hash "isca": quando o e-mail não existe, verificamos a senha contra ele para que a resposta
// leve o mesmo tempo (evita enumerar contas por timing).
const DUMMY_HASH = await argon2.hash(randomBytes(16).toString('hex'), ARGON_OPTS);

export const hashPassword = (password: string) => argon2.hash(password, ARGON_OPTS);
export const verifyPassword = (hash: string, password: string) =>
  argon2.verify(hash, password).catch(() => false);

const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === 'P2002';
const GENERIC_LOGIN_ERROR = 'E-mail ou senha incorretos';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: PublicUser;
}

/** Cria um refresh token novo (guardando só o HMAC) e o access token JWT correspondente. */
async function createSession(user: PublicUser, family: string = randomUUID()): Promise<Session> {
  const refreshToken = newOpaqueToken();
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TTL_DAYS * 24 * 3600 * 1000);
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hashToken(refreshToken), family, expiresAt: refreshExpiresAt },
  });
  return { accessToken: signAccessToken(user.id, user.role), refreshToken, refreshExpiresAt, user };
}

export async function register(input: RegisterInput): Promise<Session> {
  const exists = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  // Trade-off consciente: devolvemos 409 (UX melhor). Para eliminar a enumeração de e-mails por
  // completo, use verificação de e-mail e responda sempre "verifique sua caixa de entrada".
  // O endpoint tem rate limit estrito (5/h por IP) para dificultar a enumeração em massa.
  const fail = () => new AppError(409, 'Não foi possível criar a conta com estes dados', 'REGISTER_FAILED');
  if (exists) throw fail();

  try {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        consentAt: new Date(),
      },
      select: { id: true, name: true, email: true, role: true },
    });
    return createSession(user);
  } catch (e) {
    if (isUniqueViolation(e)) throw fail(); // corrida entre dois cadastros simultâneos
    throw e;
  }
}

export async function login(email: string, password: string): Promise<Session> {
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, password);
  if (!user || !ok) throw new AppError(401, GENERIC_LOGIN_ERROR, 'INVALID_CREDENTIALS');

  // Se os parâmetros do Argon2 foram reforçados desde o cadastro, atualiza o hash de forma transparente.
  if (argon2.needsRehash(user.passwordHash, ARGON_OPTS)) {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  }
  return createSession({ id: user.id, name: user.name, email: user.email, role: user.role });
}

async function revokeFamily(family: string) {
  await prisma.refreshToken.updateMany({ where: { family, revokedAt: null }, data: { revokedAt: new Date() } });
}

/**
 * Rotação de refresh token: cada refresh invalida o token usado e emite um novo.
 * Se um token JÁ USADO aparecer de novo (possível roubo), toda a família (sessão) é revogada.
 */
export async function rotateRefreshToken(rawToken: string): Promise<Session> {
  const invalid = () => new AppError(401, 'Sessão inválida ou expirada', 'UNAUTHENTICATED');

  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!row) throw invalid();

  if (row.revokedAt) {
    await revokeFamily(row.family); // reuso detectado
    throw invalid();
  }
  if (row.expiresAt <= new Date()) throw invalid();

  // Consumo atômico: só um pedido concorrente consegue revogar este token.
  const consumed = await prisma.refreshToken.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (consumed.count === 0) {
    await revokeFamily(row.family);
    throw invalid();
  }
  return createSession(row.user, row.family);
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (row) await revokeFamily(row.family);
}

export async function logoutEverywhere(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** Sempre "termina com sucesso", exista a conta ou não (sem enumeração de usuários). */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!user) return;

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }); // só o último link vale
  const raw = newOpaqueToken();
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + 60 * 60 * 1000) }, // 1 h
  });
  await sendPasswordResetEmail(user.email, raw);
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const invalid = () => new AppError(400, 'Link inválido ou expirado', 'INVALID_RESET_TOKEN');
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
  if (!row || row.usedAt || row.expiresAt <= new Date()) throw invalid();

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    const used = await tx.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (used.count === 0) throw invalid(); // link já consumido por outra requisição
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    // Trocar a senha encerra TODAS as sessões abertas.
    await tx.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
  });
}

/** Remove tokens expirados (chamado periodicamente pelo server). */
export async function purgeExpiredTokens(): Promise<void> {
  const now = new Date();
  await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } });
  await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } });
}
