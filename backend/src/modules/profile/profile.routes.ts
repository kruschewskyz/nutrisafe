import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { currentUserId } from '../../middleware/auth.js';
import { ageFromBirthDate, computeTargets } from '../nutrition/calc.js';

export const profileRouter = Router();

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; // rejeita 2024-02-31
  }, 'Data inválida')
  .transform((s) => new Date(`${s}T00:00:00Z`));

const profileSchema = z
  .object({
    birthDate: dateOnly,
    sex: z.enum(['MALE', 'FEMALE']),
    heightCm: z.number().min(120).max(230),
    weightKg: z.number().min(30).max(300),
    activityLevel: z.enum(['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE']),
    goal: z.enum(['LOSE', 'MAINTAIN', 'GAIN']),
    autoGoals: z.boolean().default(true),
  })
  .refine(
    (p) => {
      const age = ageFromBirthDate(p.birthDate);
      return age >= 18 && age <= 100;
    },
    // Metas calóricas automáticas não são apropriadas para menores de idade.
    { message: 'O NutriSafe é destinado a maiores de 18 anos', path: ['birthDate'] },
  );

const targetSchema = z.object({
  calories: z.number().min(1000).max(6000),
  proteinG: z.number().min(0).max(500),
  carbsG: z.number().min(0).max(1000),
  fatG: z.number().min(0).max(400),
});

async function loadBundle(userId: string) {
  const [profile, target] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.dailyTarget.findUnique({ where: { userId } }),
  ]);
  if (!profile) return { profile: null, target: null, estimate: null };

  const age = ageFromBirthDate(profile.birthDate);
  const calc = computeTargets({ ...profile, age });
  return {
    profile: { ...profile, birthDate: profile.birthDate.toISOString().slice(0, 10) },
    target,
    // Estimativa calculada (TMB / gasto diário) e metas sugeridas, mesmo que o usuário tenha metas manuais.
    estimate: { age, bmr: calc.bmr, tdee: calc.tdee, suggested: calc },
  };
}

profileRouter.get('/', async (req, res) => {
  res.json(await loadBundle(currentUserId(req)));
});

profileRouter.put('/', async (req, res) => {
  const userId = currentUserId(req);
  const { autoGoals, ...data } = parse(profileSchema, req.body);

  const previous = await prisma.profile.findUnique({ where: { userId }, select: { weightKg: true } });
  await prisma.profile.upsert({ where: { userId }, create: { userId, ...data }, update: data });

  if (!previous || previous.weightKg !== data.weightKg) {
    await prisma.weightLog.create({ data: { userId, weightKg: data.weightKg } });
  }

  if (autoGoals) {
    const t = computeTargets({ ...data, age: ageFromBirthDate(data.birthDate) });
    const values = { calories: t.calories, proteinG: t.proteinG, carbsG: t.carbsG, fatG: t.fatG };
    await prisma.dailyTarget.upsert({ where: { userId }, create: { userId, ...values }, update: values });
  }
  res.json(await loadBundle(userId));
});

// Metas manuais (o usuário pode ajustar o que foi calculado).
profileRouter.put('/goals', async (req, res) => {
  const userId = currentUserId(req);
  const values = parse(targetSchema, req.body);
  await prisma.dailyTarget.upsert({ where: { userId }, create: { userId, ...values }, update: values });
  res.json(await loadBundle(userId));
});
