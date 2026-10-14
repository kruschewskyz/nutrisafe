import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { purgeExpiredTokens } from './modules/auth/auth.service.js';

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'NutriSafe API no ar');
});

// Limpeza diária de tokens expirados.
const purgeTimer = setInterval(() => {
  purgeExpiredTokens().catch(() => logger.error('falha ao limpar tokens expirados'));
}, 24 * 3600 * 1000);
purgeTimer.unref();

// Encerramento gracioso (a plataforma envia SIGTERM em cada deploy).
async function shutdown(signal: string) {
  logger.info({ signal }, 'encerrando');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Não derrubar o processo com detalhes: loga só o tipo do erro.
process.on('unhandledRejection', (reason) => {
  logger.error({ errName: (reason as Error)?.name }, 'unhandledRejection');
});
