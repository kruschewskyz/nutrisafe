import { Router, type Response } from 'express';
import { env, isProd } from '../../config/env.js';
import { AppError, parse } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { currentUserId, requireAuth } from '../../middleware/auth.js';
import { loginLimiter, sensitiveLimiter } from '../../middleware/security.js';
import {
  forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema,
} from './auth.schemas.js';
import * as auth from './auth.service.js';

export const authRouter = Router();

const REFRESH_COOKIE = 'ns_rt';

/**
 * O refresh token vive num cookie:
 *  - httpOnly: JavaScript (e portanto XSS) não consegue lê-lo
 *  - secure: só trafega por HTTPS em produção
 *  - sameSite=strict: o navegador não o envia em requisições originadas de outros sites (CSRF)
 *  - path=/api/auth: só é enviado às rotas de autenticação, não a toda a API
 * O access token (curto) fica só em MEMÓRIA no frontend, nunca em localStorage.
 */
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: env.COOKIE_SAMESITE,
  path: '/api/auth',
} as const;

function sendSession(res: Response, session: auth.Session, status = 200) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.COOKIE_SAMESITE as 'lax' | 'none' | 'strict',
  path: '/api/auth',
});
  res.status(status).json({ accessToken: session.accessToken, user: session.user });
}

import { CookieOptions } from 'express';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.COOKIE_SAMESITE as 'lax' | 'none' | 'strict',
  path: '/api/auth',
};

authRouter.post('/register', sensitiveLimiter, async (req, res) => {
  const input = parse(registerSchema, req.body);
  sendSession(res, await auth.register(input), 201);
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  sendSession(res, await auth.login(email, password));
});

authRouter.post('/refresh', async (req, res) => {
  const raw: unknown = req.cookies?.[REFRESH_COOKIE];
  if (typeof raw !== 'string' || raw.length === 0) throw new AppError(401, 'Não autenticado', 'UNAUTHENTICATED');
  try {
    sendSession(res, await auth.rotateRefreshToken(raw));
  } catch (e) {
    clearCookie(res);
    throw e;
  }
});

authRouter.post('/logout', async (req, res) => {
  const raw: unknown = req.cookies?.[REFRESH_COOKIE];
  await auth.logout(typeof raw === 'string' ? raw : undefined);
  clearCookie(res);
  res.status(204).end();
});

authRouter.post('/logout-all', requireAuth, async (req, res) => {
  await auth.logoutEverywhere(currentUserId(req));
  clearCookie(res);
  res.status(204).end();
});

// Resposta idêntica exista o e-mail ou não (previne enumeração de usuários).
authRouter.post('/forgot-password', sensitiveLimiter, async (req, res) => {
  const { email } = parse(forgotPasswordSchema, req.body);
  await auth.requestPasswordReset(email);
  res.status(202).json({ message: 'Se o e-mail estiver cadastrado, enviaremos as instruções.' });
});

authRouter.post('/reset-password', sensitiveLimiter, async (req, res) => {
  const { token, password } = parse(resetPasswordSchema, req.body);
  await auth.resetPassword(token, password);
  clearCookie(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: currentUserId(req) },
    select: { id: true, name: true, email: true, role: true, profile: { select: { id: true } } },
  });
  if (!user) throw new AppError(401, 'Não autenticado', 'UNAUTHENTICATED');
  const { profile, ...rest } = user;
  res.json({ user: rest, hasProfile: profile !== null });
});
