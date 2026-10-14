import { Router } from 'express';
import { z } from 'zod';
import { AppError, parse } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { currentUserId } from '../../middleware/auth.js';
import { sensitiveLimiter } from '../../middleware/security.js';
import { verifyPassword } from '../auth/auth.service.js';

/**
 * Direitos do titular (LGPD art. 18 / GDPR arts. 15, 17, 20):
 *  - GET    /api/privacy/export   -> portabilidade/acesso: todos os dados do usuário em JSON
 *  - DELETE /api/privacy/account  -> eliminação: apaga conta e todos os dados, de forma definitiva
 */
export const privacyRouter = Router();

privacyRouter.get('/export', async (req, res) => {
  const userId = currentUserId(req);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    // passwordHash e tokens NUNCA entram na exportação.
    select: {
      id: true, email: true, name: true, role: true, consentAt: true, createdAt: true,
      profile: true,
      target: true,
      weightLogs: { orderBy: { loggedAt: 'asc' } },
      customFoods: true,
      meals: { orderBy: { eatenAt: 'asc' }, include: { items: { include: { food: { select: { name: true } } } } } },
      favorites: { include: { items: { include: { food: { select: { name: true } } } } } },
    },
  });
  if (!user) throw new AppError(404, 'Usuário não encontrado');

  res.setHeader('Content-Disposition', 'attachment; filename="nutrisafe-meus-dados.json"');
  res.json({ exportedAt: new Date().toISOString(), data: user });
});

const deleteSchema = z.object({
  password: z.string().min(1).max(128),
  confirm: z.literal('EXCLUIR', { errorMap: () => ({ message: 'Digite EXCLUIR para confirmar' }) }),
});

privacyRouter.delete('/account', sensitiveLimiter, async (req, res) => {
  const userId = currentUserId(req);
  const { password } = parse(deleteSchema, req.body);

  // Ação destrutiva: exige reautenticação com a senha.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    throw new AppError(403, 'Senha incorreta', 'INVALID_PASSWORD');
  }

  // Ordem explícita por causa das FKs RESTRICT entre itens e alimentos personalizados;
  // tudo numa transação: ou apaga tudo, ou nada.
  await prisma.$transaction([
    prisma.meal.deleteMany({ where: { userId } }),
    prisma.favoriteMeal.deleteMany({ where: { userId } }),
    prisma.food.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }), // cascata: perfil, metas, peso, tokens
  ]);

  res.clearCookie('ns_rt', { path: '/api/auth' });
  res.status(204).end();
});
