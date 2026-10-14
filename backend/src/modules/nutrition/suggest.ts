/**
 * Sugestões simples de refeições, baseadas no que ainda falta para bater as metas do dia.
 * Funções puras (testáveis). Não é aconselhamento nutricional personalizado.
 */
import type { FoodPer100g } from './calc.js';

export interface Macros {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const remainingMacros = (target: Macros, consumed: Macros): Macros => ({
  calories: target.calories - consumed.calories,
  proteinG: target.proteinG - consumed.proteinG,
  carbsG: target.carbsG - consumed.carbsG,
  fatG: target.fatG - consumed.fatG,
});

/** Uma refeição "ideal" ocupa ~40% do que ainda falta no dia. */
const MEAL_SHARE = 0.4;

/** Quanto menor, melhor o encaixe do candidato com o que falta. */
export function fitScore(remaining: Macros, candidate: Macros): number {
  const ideal = {
    calories: Math.max(remaining.calories * MEAL_SHARE, 1),
    proteinG: Math.max(remaining.proteinG * MEAL_SHARE, 1),
    carbsG: Math.max(remaining.carbsG * MEAL_SHARE, 1),
    fatG: Math.max(remaining.fatG * MEAL_SHARE, 1),
  };
  const rel = (c: number, i: number) => Math.abs(c - i) / i;
  return (
    1.0 * rel(candidate.calories, ideal.calories) +
    1.5 * rel(candidate.proteinG, ideal.proteinG) +
    0.75 * rel(candidate.carbsG, ideal.carbsG) +
    0.75 * rel(candidate.fatG, ideal.fatG)
  );
}

/** Ordena candidatos que CABEM nas calorias restantes, do melhor encaixe para o pior. */
export function rankByFit<T extends { totals: Macros }>(remaining: Macros, candidates: T[], limit = 5): T[] {
  if (remaining.calories < 100) return [];
  return candidates
    .filter((c) => c.totals.calories >= 80 && c.totals.calories <= remaining.calories)
    .map((c) => ({ c, score: fitScore(remaining, c.totals) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((x) => x.c);
}

export interface FoodSuggestion<F> {
  food: F;
  grams: number;
  calories: number;
  proteinG: number;
}

/**
 * Alimentos ricos em proteína, com a porção (em múltiplos de 10 g, entre 30 e 250 g)
 * que cobre ~metade da proteína faltante sem estourar as calorias restantes.
 */
export function proteinFoodSuggestions<F extends FoodPer100g>(
  remaining: Macros,
  foods: F[],
  limit = 5,
): FoodSuggestion<F>[] {
  if (remaining.proteinG < 10 || remaining.calories < 100) return [];
  const targetProtein = remaining.proteinG * 0.5;

  return foods
    .filter((f) => f.proteinG >= 8 && f.calories > 0)
    .sort((a, b) => b.proteinG / b.calories - a.proteinG / a.calories) // mais proteína por kcal primeiro
    .map((food) => {
      const ideal = (targetProtein / food.proteinG) * 100;
      let grams = Math.round(ideal / 10) * 10;
      grams = Math.min(250, Math.max(30, grams));
      // reduz a porção até caber nas calorias restantes
      while (grams > 30 && (food.calories * grams) / 100 > remaining.calories) grams -= 10;
      return {
        food,
        grams,
        calories: Math.round((food.calories * grams) / 100),
        proteinG: Math.round(((food.proteinG * grams) / 100) * 10) / 10,
      };
    })
    .filter((s) => s.calories <= remaining.calories)
    .slice(0, limit);
}
