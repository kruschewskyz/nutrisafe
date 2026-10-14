import { PrismaClient } from '@prisma/client';

/**
 * Cliente único do Prisma. Todas as consultas são parametrizadas pelo Prisma,
 * o que elimina SQL Injection. Nunca usamos $queryRawUnsafe / $executeRawUnsafe.
 * Só logamos erros (nunca queries, que poderiam conter dados de saúde).
 */
export const prisma = new PrismaClient({ log: ['error'] });
