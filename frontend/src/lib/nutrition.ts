import type { Nutrients } from './types';

/** Só para PRÉVIA na tela; o backend recalcula e é a fonte da verdade. */
export const zeroNutrients = (): Nutrients => ({
  calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sodiumMg: 0, ironMg: 0, calciumMg: 0, vitCMg: 0,
});

export function portion(per100: Nutrients, grams: number): Nutrients {
  const out = zeroNutrients();
  (Object.keys(out) as (keyof Nutrients)[]).forEach((k) => {
    out[k] = Math.round(per100[k] * (grams / 100) * 10) / 10;
  });
  return out;
}

export function sum(list: Nutrients[]): Nutrients {
  const out = zeroNutrients();
  for (const n of list) (Object.keys(out) as (keyof Nutrients)[]).forEach((k) => (out[k] += n[k]));
  (Object.keys(out) as (keyof Nutrients)[]).forEach((k) => (out[k] = Math.round(out[k] * 10) / 10));
  return out;
}

export const fmt = (n: number, digits = 0) =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
