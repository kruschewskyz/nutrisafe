import { Router } from 'express';
import { z } from 'zod';
import { AppError, idSchema, parse, rangeSchema } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { currentUserId } from '../../middleware/auth.js';
import { FOOD_SELECT } from '../foods/foods.service.js';
import { formatMeal } from '../nutrition/format.js';

export const progressRouter = Router();

const tzSchema = z.object({
  // Igual a Date.getTimezoneOffset() do navegador (BRT = 180). Usado para agrupar por dia local.
  tzOffsetMinutes: z.coerce.number().int().min(-840).max(840).default(0),
});

const localDay = (instant: Date, tz: number) => new Date(instant.getTime() - tz * 60_000).toISOString().slice(0, 10);

const DAY_MS = 24 * 3600 * 1000;

/** Totais por dia (diário/semanal/mensal = tamanho do intervalo escolhido pelo cliente). */
progressRouter.get('/', async (req, res) => {
  const userId = currentUserId(req);
  const { from, to } = parse(rangeSchema, req.query);
  const { tzOffsetMinutes: tz } = parse(tzSchema, req.query);

  const [target, meals] = await Promise.all([
    prisma.dailyTarget.findUnique({ where: { userId } }),
    prisma.meal.findMany({
      where: { userId, eatenAt: { gte: from, lt: to } },
      include: { items: { include: { food: { select: FOOD_SELECT } } } },
      orderBy: { eatenAt: 'asc' },
      take: 2000,
    }),
  ]);

  // Dias do intervalo (no fuso do cliente), todos presentes mesmo sem registros.
  const days = new Map<string, { date: string; calories: number; proteinG: number; carbsG: number; fatG: number; meals: number }>();
  for (let t = from.getTime(); t < to.getTime(); t += DAY_MS) {
    const key = localDay(new Date(t), tz);
    days.set(key, { date: key, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, meals: 0 });
  }
  const lastKey = localDay(new Date(to.getTime() - 1), tz);
  if (!days.has(lastKey)) days.set(lastKey, { date: lastKey, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, meals: 0 });

  for (const m of meals.map(formatMeal)) {
    const d = days.get(localDay(new Date(m.eatenAt), tz));
    if (!d) continue;
    d.calories += m.totals.calories;
    d.proteinG += m.totals.proteinG;
    d.carbsG += m.totals.carbsG;
    d.fatG += m.totals.fatG;
    d.meals += 1;
  }

  const series = [...days.values()].map((d) => ({
    ...d,
    calories: Math.round(d.calories),
    proteinG: Math.round(d.proteinG),
    carbsG: Math.round(d.carbsG),
    fatG: Math.round(d.fatG),
  }));
  const logged = series.filter((d) => d.meals > 0);
  const avg = (k: 'calories' | 'proteinG' | 'carbsG' | 'fatG') =>
    logged.length ? Math.round(logged.reduce((s, d) => s + d[k], 0) / logged.length) : 0;

  res.json({
    days: series,
    daysLogged: logged.length,
    averages: { calories: avg('calories'), proteinG: avg('proteinG'), carbsG: avg('carbsG'), fatG: avg('fatG') },
    target: target && {
      calories: target.calories, proteinG: target.proteinG, carbsG: target.carbsG, fatG: target.fatG,
    },
  });
});

/* ---------- Peso ---------- */

const weightSchema = z.object({ weightKg: z.number().min(30).max(300) });

progressRouter.get('/weight', async (req, res) => {
  const userId = currentUserId(req);
  const { from, to } = parse(rangeSchema, req.query);
  const logs = await prisma.weightLog.findMany({
    where: { userId, loggedAt: { gte: from, lt: to } },
    orderBy: { loggedAt: 'asc' },
    take: 1000,
    select: { id: true, weightKg: true, loggedAt: true },
  });
  res.json({ logs });
});

progressRouter.post('/weight', async (req, res) => {
  const userId = currentUserId(req);
  const { weightKg } = parse(weightSchema, req.body);
  const log = await prisma.weightLog.create({ data: { userId, weightKg }, select: { id: true, weightKg: true, loggedAt: true } });
  await prisma.profile.updateMany({ where: { userId }, data: { weightKg } }); // mantém o perfil atualizado
  res.status(201).json({ log });
});

progressRouter.delete('/weight/:id', async (req, res) => {
  const userId = currentUserId(req);
  const id = parse(idSchema, req.params['id']);
  const { count } = await prisma.weightLog.deleteMany({ where: { id, userId } });
  if (count === 0) throw new AppError(404, 'Registro não encontrado');
  res.status(204).end();
});
