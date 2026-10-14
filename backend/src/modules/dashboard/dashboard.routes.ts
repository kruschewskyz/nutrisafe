import { Router } from 'express';
import { parse, rangeSchema } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { currentUserId } from '../../middleware/auth.js';
import { FOOD_SELECT } from '../foods/foods.service.js';
import { sumNutrients } from '../nutrition/calc.js';
import { formatMeal } from '../nutrition/format.js';
import { remainingMacros } from '../nutrition/suggest.js';

export const dashboardRouter = Router();

/** Carrega e agrega as refeições de um intervalo (o cliente envia os limites do "dia" no seu fuso). */
export async function loadDay(userId: string, from: Date, to: Date) {
  const [target, meals] = await Promise.all([
    prisma.dailyTarget.findUnique({ where: { userId } }),
    prisma.meal.findMany({
      where: { userId, eatenAt: { gte: from, lt: to } },
      include: { items: { include: { food: { select: FOOD_SELECT } } } },
      orderBy: { eatenAt: 'asc' },
      take: 200,
    }),
  ]);
  const formatted = meals.map(formatMeal);
  const consumed = sumNutrients(formatted.map((m) => m.totals));
  return { target, meals: formatted, consumed };
}

dashboardRouter.get('/', async (req, res) => {
  const userId = currentUserId(req);
  const { from, to } = parse(rangeSchema, req.query);
  const { target, meals, consumed } = await loadDay(userId, from, to);

  const pct = (c: number, t?: number) => (t && t > 0 ? Math.round((c / t) * 100) : null);
  res.json({
    target: target && {
      calories: target.calories, proteinG: target.proteinG, carbsG: target.carbsG, fatG: target.fatG,
    },
    consumed,
    remaining: target && remainingMacros(target, consumed),
    percent: {
      calories: pct(consumed.calories, target?.calories),
      proteinG: pct(consumed.proteinG, target?.proteinG),
      carbsG: pct(consumed.carbsG, target?.carbsG),
      fatG: pct(consumed.fatG, target?.fatG),
    },
    meals,
  });
});
