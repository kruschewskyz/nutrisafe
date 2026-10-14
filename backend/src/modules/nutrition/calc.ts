/**
 * Cálculos nutricionais PUROS (sem banco, sem Express): fáceis de testar e de auditar.
 *
 * Fórmula de TMB: Mifflin-St Jeor (1990), considerada mais precisa que Harris-Benedict
 * para a população atual:
 *   homem:  10·peso(kg) + 6,25·altura(cm) − 5·idade + 5
 *   mulher: 10·peso(kg) + 6,25·altura(cm) − 5·idade − 161
 *
 * AVISO: são estimativas populacionais, não aconselhamento médico/nutricional.
 */

export type Sex = 'MALE' | 'FEMALE';
export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';
export type Goal = 'LOSE' | 'MAINTAIN' | 'GAIN';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

/** Ajuste calórico por objetivo (kcal/dia). ~500 kcal/dia ≈ 0,45 kg/semana. */
export const GOAL_ADJUSTMENT: Record<Goal, number> = { LOSE: -500, MAINTAIN: 0, GAIN: 300 };

/** Proteína em g por kg de peso, por objetivo. */
export const PROTEIN_G_PER_KG: Record<Goal, number> = { LOSE: 2.0, MAINTAIN: 1.6, GAIN: 1.8 };

/** Piso calórico de segurança: o app nunca sugere abaixo disso automaticamente. */
export const MIN_CALORIES: Record<Sex, number> = { MALE: 1500, FEMALE: 1200 };

/** Gordura = 25% das calorias. Carboidratos = o restante. */
const FAT_SHARE = 0.25;

export interface BodyInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
}

export interface TargetInput extends BodyInput {
  activityLevel: ActivityLevel;
  goal: Goal;
}

export interface Targets {
  bmr: number;
  tdee: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Idade completa em anos (usa UTC para não variar com o fuso do servidor). */
export function ageFromBirthDate(birthDate: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function mifflinStJeor({ sex, weightKg, heightCm, age }: BodyInput): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'MALE' ? base + 5 : base - 161;
}

export function computeTargets(input: TargetInput): Targets {
  const bmr = mifflinStJeor(input);
  const tdee = bmr * ACTIVITY_FACTORS[input.activityLevel];
  const calories = Math.max(MIN_CALORIES[input.sex], Math.round(tdee + GOAL_ADJUSTMENT[input.goal]));

  const proteinG = Math.round(PROTEIN_G_PER_KG[input.goal] * input.weightKg);
  const fatG = Math.round((calories * FAT_SHARE) / 9);
  // 1 g proteína = 4 kcal, 1 g carboidrato = 4 kcal, 1 g gordura = 9 kcal
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));

  return { bmr: Math.round(bmr), tdee: Math.round(tdee), calories, proteinG, carbsG, fatG };
}

/* ---------- Nutrientes de alimentos/refeições ---------- */

export interface Nutrients {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
  ironMg: number;
  calciumMg: number;
  vitCMg: number;
}

/** Valores por 100 g, como armazenados em Food. */
export type FoodPer100g = Nutrients;

export const emptyNutrients = (): Nutrients => ({
  calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sodiumMg: 0, ironMg: 0, calciumMg: 0, vitCMg: 0,
});

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Nutrientes de uma porção: valores por 100 g × gramas / 100. */
export function nutrientsForPortion(food: FoodPer100g, grams: number): Nutrients {
  const k = grams / 100;
  const out = emptyNutrients();
  for (const key of Object.keys(out) as (keyof Nutrients)[]) out[key] = round1(food[key] * k);
  return out;
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  const total = emptyNutrients();
  for (const n of list) for (const key of Object.keys(total) as (keyof Nutrients)[]) total[key] += n[key];
  for (const key of Object.keys(total) as (keyof Nutrients)[]) total[key] = round1(total[key]);
  return total;
}
