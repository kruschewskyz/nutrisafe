import { Router } from 'express';
import { z } from 'zod';
import { AppError, idSchema, parse } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { text } from '../../lib/sanitize.js';
import { currentUserId } from '../../middleware/auth.js';
import { FOOD_SELECT, assertFoodsAccessible } from '../foods/foods.service.js';
import { formatItems, formatMeal } from '../nutrition/format.js';
import { MEAL_TYPES } from '../meals/meals.routes.js';

export const favoritesRouter = Router();

const favoriteSchema = z.object({
  name: text(1, 80),
  type: z.enum(MEAL_TYPES),
  items: z
    .array(z.object({ foodId: idSchema, grams: z.number().positive().max(5000) }))
    .min(1)
    .max(50),
});

const logSchema = z.object({
  eatenAt: z.string().datetime({ offset: true }).transform((s) => new Date(s)),
  type: z.enum(MEAL_TYPES).optional(),
});

const include = { items: { include: { food: { select: FOOD_SELECT } } } } as const;

function formatFavorite(f: {
  id: string;
  name: string;
  type: string;
  items: Parameters<typeof formatItems>[0];
}) {
  const { items, totals } = formatItems(f.items);
  return { id: f.id, name: f.name, type: f.type, items, totals };
}

favoritesRouter.get('/', async (req, res) => {
  const userId = currentUserId(req);
  const favorites = await prisma.favoriteMeal.findMany({
    where: { userId },
    include,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ favorites: favorites.map(formatFavorite) });
});

favoritesRouter.post('/', async (req, res) => {
  const userId = currentUserId(req);
  const input = parse(favoriteSchema, req.body);
  await assertFoodsAccessible(userId, input.items.map((i) => i.foodId));
  const favorite = await prisma.favoriteMeal.create({
    data: {
      userId,
      name: input.name,
      type: input.type,
      items: { create: input.items.map((i) => ({ foodId: i.foodId, grams: i.grams })) },
    },
    include,
  });
  res.status(201).json({ favorite: formatFavorite(favorite) });
});

favoritesRouter.put('/:id', async (req, res) => {
  const userId = currentUserId(req);
  const id = parse(idSchema, req.params['id']);
  const input = parse(favoriteSchema, req.body);
  const existing = await prisma.favoriteMeal.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) throw new AppError(404, 'Favorito não encontrado');
  await assertFoodsAccessible(userId, input.items.map((i) => i.foodId));

  const [, favorite] = await prisma.$transaction([
    prisma.favoriteMealItem.deleteMany({ where: { favoriteId: id } }),
    prisma.favoriteMeal.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        items: { create: input.items.map((i) => ({ foodId: i.foodId, grams: i.grams })) },
      },
      include,
    }),
  ]);
  res.json({ favorite: formatFavorite(favorite) });
});

favoritesRouter.delete('/:id', async (req, res) => {
  const userId = currentUserId(req);
  const id = parse(idSchema, req.params['id']);
  const { count } = await prisma.favoriteMeal.deleteMany({ where: { id, userId } });
  if (count === 0) throw new AppError(404, 'Favorito não encontrado');
  res.status(204).end();
});

// Registra uma refeição a partir de um favorito (1 clique).
favoritesRouter.post('/:id/log', async (req, res) => {
  const userId = currentUserId(req);
  const id = parse(idSchema, req.params['id']);
  const { eatenAt, type } = parse(logSchema, req.body);
  const favorite = await prisma.favoriteMeal.findFirst({ where: { id, userId }, include });
  if (!favorite) throw new AppError(404, 'Favorito não encontrado');

  const meal = await prisma.meal.create({
    data: {
      userId,
      type: type ?? favorite.type,
      eatenAt,
      items: { create: favorite.items.map((i) => ({ foodId: i.foodId, grams: i.grams })) },
    },
    include,
  });
  res.status(201).json({ meal: formatMeal(meal) });
});
