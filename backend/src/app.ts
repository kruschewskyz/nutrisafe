import cookieParser from 'cookie-parser';
import express from 'express';
import { requestLogger } from './lib/logger.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import {
  apiLimiter, corsMiddleware, csrfGuard, enforceHttps, noStore, securityHeaders,
} from './middleware/security.js';
import { env } from './config/env.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { suggestionsRouter } from './modules/dashboard/suggestions.routes.js';
import { favoritesRouter } from './modules/favorites/favorites.routes.js';
import { foodsRouter } from './modules/foods/foods.routes.js';
import { mealsRouter } from './modules/meals/meals.routes.js';
import { privacyRouter } from './modules/privacy/privacy.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { progressRouter } from './modules/progress/progress.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by'); // não revela a tecnologia do servidor
  // Atrás de proxy reverso (Railway/Render), confia nos X-Forwarded-* para req.ip e req.secure.
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestLogger);

  // Health check da plataforma (sem dados sensíveis, antes do enforceHttps).
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(enforceHttps);
  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(express.json({ limit: '50kb' })); // corpo pequeno: dificulta DoS
  app.use(cookieParser());
  app.use(noStore);

  app.use('/api', apiLimiter);
  app.use('/api', csrfGuard);

  // Rotas públicas (autenticação)
  app.use('/api/auth', authRouter);

  // Rotas protegidas: tudo abaixo exige access token válido
  app.use('/api/profile', requireAuth, profileRouter);
  app.use('/api/foods', requireAuth, foodsRouter);
  app.use('/api/meals', requireAuth, mealsRouter);
  app.use('/api/favorites', requireAuth, favoritesRouter);
  app.use('/api/dashboard', requireAuth, dashboardRouter);
  app.use('/api/suggestions', requireAuth, suggestionsRouter);
  app.use('/api/progress', requireAuth, progressRouter);
  app.use('/api/privacy', requireAuth, privacyRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
