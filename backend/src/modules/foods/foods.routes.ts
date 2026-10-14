import { Router } from 'express';
import { z } from 'zod';
import { AppError, idSchema, parse } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { optionalText, text } from '../../lib/sanitize.js';
import { currentUserId, requireRole } from '../../middleware/auth.js';
import { FOOD_SELECT } from './foods.service.js';

export const foodsRouter = Router();

const searchSchema = z.object({
  q: z.string().trim().min(2).max(60),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// Valores por 100 g, com limites fisicamente plausíveis.
const foodSchema = z
  .object({
    name: text(1, 100),
    brand: optionalText(60),
    calories: z.number().min(0).max(900),
    proteinG: z.number().min(0).max(100),
    carbsG: z.number().min(0).max(100),
    fatG: z.number().min(0).max(100),
    fiberG: z.number().min(0).max(100).default(0),
    sodiumMg: z.number().min(0).max(40_000).default(0),
    ironMg: z.number().min(0).max(100).default(0),
    calciumMg: z.number().min(0).max(2_000).default(0),
    vitCMg: z.number().min(0).max(2_000).default(0),
  })
  .refine((f) => f.proteinG + f.carbsG + f.fatG <= 100.5, {
    message: 'Proteína + carboidratos + gorduras não podem exceder 100 g por 100 g',
    path: ['proteinG'],
  });

// Busca: alimentos públicos + os criados pelo próprio usuário.
// O texto vai para o Prisma como parâmetro (nunca concatenado em SQL).
foodsRouter.get('/', async (req, res) => {
  const userId = currentUserId(req);
  const { q, limit } = parse(searchSchema, req.query);
  const foods = await prisma.food.findMany({
    where: {
      AND: [
        { OR: [{ userId: null }, { userId }] },
        { OR: [{ name: { contains: q, mode: 'insensitive' } }, { brand: { contains: q, mode: 'insensitive' } }] },
      ],
    },
    select: FOOD_SELECT,
    orderBy: { name: 'asc' },
    take: limit,
  });
  res.json({ foods });
});

// Alimento personalizado (privado do usuário).
foodsRouter.post('/', async (req, res) => {
  const userId = currentUserId(req);
  const input = parse(foodSchema, req.body);
  const food = await prisma.food.create({
    data: { ...input, userId, source: 'custom' },
    select: FOOD_SELECT,
  });
  res.status(201).json({ food });
});

// Alimento da base pública: somente ADMIN (exemplo de RBAC).
foodsRouter.post('/public', requireRole('ADMIN'), async (req, res) => {
  const input = parse(foodSchema, req.body);
  const food = await prisma.food.create({ data: { ...input, userId: null, source: 'admin' }, select: FOOD_SELECT });
  res.status(201).json({ food });
});

foodsRouter.get('/:id', async (req, res) => {
  const userId = currentUserId(req);
  const id = parse(idSchema, req.params['id']);
  const food = await prisma.food.findFirst({
    where: { id, OR: [{ userId: null }, { userId }] },
    select: FOOD_SELECT,
  });
  if (!food) throw new AppError(404, 'Alimento não encontrado');
  res.json({ food });
});

// Só é possível apagar alimentos PRÓPRIOS (a base pública nunca é afetada).
foodsRouter.delete('/:id', async (req, res) => {
  const userId = currentUserId(req);
  const id = parse(idSchema, req.params['id']);
  const found = await prisma.food.findFirst({ where: { id, userId }, select: { id: true } });
  if (!found) throw new AppError(404, 'Alimento não encontrado');
  try {
    await prisma.food.delete({ where: { id } });
  } catch (e) {
    // P2003 = violação de chave estrangeira: o alimento está em refeições/favoritos.
    if ((e as { code?: string }).code === 'P2003') {
      throw new AppError(409, 'Este alimento está em uso em refeições ou favoritos', 'FOOD_IN_USE');
    }
    throw e;
  }
  res.status(204).end();
});
