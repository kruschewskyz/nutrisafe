import pino from 'pino';

export const logger = pino();

// Middleware de log de requisições exigido pelo app.ts
export const requestLogger = (req: any, res: any, next: any) => {
  logger.info({ method: req.method, url: req.url }, 'Incoming request');
  next();
};