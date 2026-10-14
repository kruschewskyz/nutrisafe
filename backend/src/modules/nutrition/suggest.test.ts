import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { proteinFoodSuggestions, rankByFit, remainingMacros } from './suggest.js';

const target = { calories: 2000, proteinG: 150, carbsG: 200, fatG: 65 };

describe('remainingMacros', () => {
  it('subtrai o consumido da meta', () => {
    const r = remainingMacros(target, { calories: 500, proteinG: 30, carbsG: 60, fatG: 10 });
    assert.deepEqual(r, { calories: 1500, proteinG: 120, carbsG: 140, fatG: 55 });
  });
});

describe('rankByFit', () => {
  const remaining = { calories: 1500, proteinG: 120, carbsG: 140, fatG: 55 };
  const good = { name: 'bom', totals: { calories: 600, proteinG: 48, carbsG: 56, fatG: 22 } };
  const poor = { name: 'só carbo', totals: { calories: 600, proteinG: 5, carbsG: 120, fatG: 2 } };
  const tooBig = { name: 'grande demais', totals: { calories: 1800, proteinG: 120, carbsG: 140, fatG: 55 } };

  it('prefere o que se encaixa melhor e exclui o que estoura as calorias', () => {
    const ranked = rankByFit(remaining, [poor, tooBig, good]);
    assert.deepEqual(ranked.map((r) => r.name), ['bom', 'só carbo']);
  });

  it('não sugere nada quando a meta já foi atingida', () => {
    assert.deepEqual(rankByFit({ ...remaining, calories: 50 }, [good]), []);
  });
});

describe('proteinFoodSuggestions', () => {
  const food = (name: string, calories: number, proteinG: number) => ({
    name, calories, proteinG, carbsG: 0, fatG: 0, fiberG: 0, sodiumMg: 0, ironMg: 0, calciumMg: 0, vitCMg: 0,
  });
  const remaining = { calories: 800, proteinG: 80, carbsG: 100, fatG: 30 };

  it('sugere porção que cobre ~metade da proteína faltante', () => {
    const [s] = proteinFoodSuggestions(remaining, [food('frango', 160, 32)]);
    assert.ok(s);
    assert.equal(s.grams, 130); // 40 g de proteína / 0,32 ≈ 125 g -> 130 g
  });

  it('ignora alimentos pobres em proteína e respeita o teto de calorias', () => {
    const out = proteinFoodSuggestions({ ...remaining, calories: 120 }, [food('arroz', 128, 2.5), food('frango', 160, 32)]);
    assert.ok(out.every((s) => s.calories <= 120));
    assert.ok(out.every((s) => s.food.name !== 'arroz'));
  });
});
