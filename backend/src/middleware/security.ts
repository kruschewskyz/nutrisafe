import cors from 'cors';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { env, isProd } from '../config/env.js';
import { AppError } from '../lib/http.js';

/**
 * Headers de segurança (Helmet). Esta API só devolve JSON, então a CSP é a mais
 * restritiva possível: nada pode ser carregado/embutido a partir de respostas da API.
 */
export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"], // anti-clickjacking
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
  // HSTS só em produção (em dev o localhost é http)
  hsts: isProd ? { maxAge: 63_072_000, includeSubDomains: true, preload: true } : false,
});

/** CORS com lista explícita de origens (nunca "*" com credenciais). */
export const corsMiddleware: RequestHandler = cors({
  origin: (origin, callback) => {
    // Sem header Origin = cliente não-navegador (curl, health check); CORS não se aplica.
    if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 600,
});

/** Em produção, exige HTTPS (a plataforma termina o TLS e envia X-Forwarded-Proto; ver trust proxy). */
export const enforceHttps: RequestHandler = (req, _res, next) => {
  if (!isProd || req.secure) return next();
  // Rejeitamos em vez de redirecionar: redirecionar com base no header Host (controlado
  // pelo cliente) abriria espaço para open redirect. A plataforma (Railway/Render) já
  // redireciona http -> https na borda; isto é a segunda barreira.
  throw new AppError(400, 'HTTPS é obrigatório', 'HTTPS_REQUIRED');
};

/** Respostas da API contêm dados de saúde: nada de cache em navegador/proxy. */
export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
};

/**
 * Proteção CSRF para métodos que alteram estado (defesa em camadas):
 *  1) O refresh token fica em cookie SameSite=Strict, restrito a /api/auth.
 *  2) O access token vai no header Authorization (não é enviado automaticamente pelo navegador).
 *  3) Aqui: se houver header Origin, precisa estar na lista permitida, e exigimos o header
 *     customizado X-Requested-With, que um <form> de outro site não consegue enviar e que
 *     obriga o navegador a fazer preflight CORS.
 */
export const csrfGuard: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const origin = req.get('origin');
  if (origin && !env.corsOrigins.includes(origin)) throw new AppError(403, 'Origem não permitida');
  if (req.get('x-requested-with') !== 'nutrisafe') throw new AppError(403, 'Requisição inválida');
  next();
};

const limiterBase = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  message: { error: { message: 'Muitas requisições. Tente novamente em instantes.', code: 'RATE_LIMITED' } },
};

/** Limite geral da API: 120 req/min por IP. */
export const apiLimiter: RequestHandler = rateLimit({ ...limiterBase, windowMs: 60_000, limit: 120 });

/** Login: 10 tentativas FALHAS a cada 15 min por IP (sucessos não contam). Contra força bruta. */
export const loginLimiter: RequestHandler = rateLimit({
  ...limiterBase,
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
});

/** Cadastro, recuperação de senha, exclusão de conta: 5 por hora por IP. */
export const sensitiveLimiter: RequestHandler = rateLimit({ ...limiterBase, windowMs: 60 * 60_000, limit: 5 });

/**
 * Observação: o armazenamento padrão é em memória (1 instância). Com várias instâncias,
 * use um store compartilhado (ex.: rate-limit-redis) para o limite valer globalmente.
 */
