import { Router } from 'express';
import { AppError, parse, rangeSchema } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { currentUserId } from '../../middleware/auth.js';
import { FOOD_SELECT } from '../foods/foods.service.js';
import { formatItems } from '../nutrition/format.js';
import { proteinFoodSuggestions, rankByFit, remainingMacros } from '../nutrition/suggest.js';
import { loadDay } from './dashboard.routes.js';

export const suggestionsRouter = Router();

suggestionsRouter.get('/', async (req, res) => {
  const userId = currentUserId(req);
  const { from, to } = parse(rangeSchema, req.query);
  const { target, consumed } = await loadDay(userId, from, to);
  if (!target) throw new AppError(409, 'Complete seu perfil para receber sugestões', 'PROFILE_REQUIRED');

  const remaining = remainingMacros(target, consumed);
  if (remaining.calories < 100) {
    res.json({ remaining, message: 'Meta calórica do dia atingida.', favorites: [], foods: [] });
    return;
  }

  const [favs, foods] = await Promise.all([
    prisma.favoriteMeal.findMany({
      where: { userId },
      include: { items: { include: { food: { select: FOOD_SELECT } } } },
      take: 100,
    }),
    prisma.food.findMany({ where: { userId: null, proteinG: { gte: 8 } }, select: FOOD_SELECT, take: 200 }),
  ]);

  const favorites = rankByFit(
    remaining,
    favs.map((f) => ({ id: f.id, name: f.name, type: f.type, ...formatItems(f.items) })),
  ).map(({ id, name, type, totals }) => ({ id, name, type, totals }));

  const foodIdeas = proteinFoodSuggestions(remaining, foods).map((s) => ({
    foodId: s.food.id, name: s.food.name, grams: s.grams, calories: s.calories, proteinG: s.proteinG,
  }));

  res.json({ remaining, favorites, foods: foodIdeas });
});
