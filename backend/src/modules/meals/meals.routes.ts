import { Router } from 'express';
import { z } from 'zod';
import { AppError, idSchema, parse, rangeSchema } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { optionalText } from '../../lib/sanitize.js';
import { currentUserId } from '../../middleware/auth.js';
import { FOOD_SELECT, assertFoodsAccessible } from '../foods/foods.service.js';
import { formatMeal } from '../nutrition/format.js';

export const mealsRouter = Router();

export const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;

const itemSchema = z.object({
  foodId: idSchema,
  grams: z.number().positive().max(5000),
});

const mealSchema = z.object({
  type: z.enum(MEAL_TYPES),
  eatenAt: z
    .string()
    .datetime({ offset: true })
    .transform((s) => new Date(s))
    .refine((d) => d.getUTCFullYear() >= 2000, 'Data inválida'),
  notes: optionalText(500),
  items: z.array(itemSchema).min(1).max(50),
});

const include = { items: { include: { food: { select: FOOD_SELECT } } } } as const;

// Todas as consultas filtram por userId do TOKEN: um usuário nunca enxerga refeições de outro.
mealsRouter.get('/', async (req, res) => {
  const userId = currentUserId(req);
  const { from, to } = parse(rangeSchema, req.query);
  const meals = await prisma.meal.findMany({
    where: { userId, eatenAt: { gte: from, lt: to } },
    include,
    orderBy: { eatenAt: 'asc' },
    take: 500,
  });
  res.json({ meals: meals.map(formatMeal) });
});

mealsRouter.post('/', async (req, res) => {
  const userId = currentUserId(req);
  const input = parse(mealSchema, req.body);
  await assertFoodsAccessible(userId, input.items.map((i) => i.foodId));
  const meal = await prisma.meal.create({
    data: {
      userId,
      type: input.type,
      eatenAt: input.eatenAt,
      notes: input.notes ?? null,
      items: { create: input.items.map((i) => ({ foodId: i.foodId, grams: i.grams })) },
    },
    include,
  });
  res.status(201).json({ meal: formatMeal(meal) });
});

mealsRouter.get('/:id', async (req, res) => {
  const userId = currentUserId(req);
  const id = parse(idSchema, req.params['id']);
  const meal = await prisma.meal.findFirst({ where: { id, userId }, include });
  if (!meal) throw new AppError(404, 'Refeição não encontrada'); // 404 mesmo se for de outro usuário
  res.json({ meal: formatMeal(meal) });
});

mealsRouter.put('/:id', async (req, res) => {
  const userId = currentUserId(req);
  const id = parse(idSchema, req.params['id']);
  const input = parse(mealSchema, req.body);

  const existing = await prisma.meal.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw new AppError(404, 'Refeição não encontrada');
  await assertFoodsAccessible(userId, input.items.map((i) => i.foodId));

  const [, meal] = await prisma.$transaction([
    prisma.mealItem.deleteMany({ where: { mealId: id } }),
    prisma.meal.update({
      where: { id },
      data: {
        type: input.type,
        eatenAt: input.eatenAt,
        notes: input.notes ?? null,
        items: { create: input.items.map((i) => ({ foodId: i.foodId, grams: i.grams })) },
      },
      include,
    }),
  ]);
  res.json({ meal: formatMeal(meal) });
});

mealsRouter.delete('/:id', async (req, res) => {
  const userId = currentUserId(req);
  const id = parse(idSchema, req.params['id']);
  // deleteMany com userId no filtro: só apaga se for do usuário (e é atômico).
  const { count } = await prisma.meal.deleteMany({ where: { id, userId } });
  if (count === 0) throw new AppError(404, 'Refeição não encontrada');
  res.status(204).end();
});
