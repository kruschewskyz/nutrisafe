import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../lib/http.js';
import { logger } from '../lib/logger.js';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { message: 'Rota não encontrada' } });
};

/**
 * Handler central de erros. Nunca devolve stack trace nem mensagens internas
 * (de banco, de libs) ao cliente, e nunca loga o corpo da requisição.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { message: err.message, code: err.code, details: err.details } });
    return;
  }

  const e = err as { type?: string; status?: number; name?: string; code?: string };
  if (e?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { message: 'JSON inválido', code: 'BAD_JSON' } });
    return;
  }
  if (e?.type === 'entity.too.large') {
    res.status(413).json({ error: { message: 'Corpo da requisição muito grande' } });
    return;
  }

  // Erros inesperados: loga só nome/código (mensagens do Prisma podem conter valores de campos).
  logger.error({ reqId: req.id, errName: e?.name, errCode: e?.code }, 'unhandled error');
  res.status(500).json({ error: { message: 'Erro interno do servidor' } });
};
