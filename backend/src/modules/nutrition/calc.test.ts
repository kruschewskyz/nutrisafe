import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ageFromBirthDate, computeTargets, mifflinStJeor, nutrientsForPortion, sumNutrients,
} from './calc.js';

describe('ageFromBirthDate', () => {
  it('conta anos completos (antes e depois do aniversário)', () => {
    const birth = new Date('2000-06-15T00:00:00Z');
    assert.equal(ageFromBirthDate(birth, new Date('2026-06-14T12:00:00Z')), 25);
    assert.equal(ageFromBirthDate(birth, new Date('2026-06-15T12:00:00Z')), 26);
  });
});

describe('mifflinStJeor', () => {
  it('homem 80 kg, 180 cm, 30 anos = 1780 kcal', () => {
    assert.equal(mifflinStJeor({ sex: 'MALE', weightKg: 80, heightCm: 180, age: 30 }), 1780);
  });
  it('mulher 60 kg, 165 cm, 25 anos = 1345,25 kcal', () => {
    assert.equal(mifflinStJeor({ sex: 'FEMALE', weightKg: 60, heightCm: 165, age: 25 }), 1345.25);
  });
});

describe('computeTargets', () => {
  const male = { sex: 'MALE', weightKg: 80, heightCm: 180, age: 30, activityLevel: 'MODERATE' } as const;

  it('manutenção: calorias = TDEE e macros somam as calorias (±1%)', () => {
    const t = computeTargets({ ...male, goal: 'MAINTAIN' });
    assert.equal(t.bmr, 1780);
    assert.equal(t.tdee, 2759);
    assert.equal(t.calories, 2759);
    const kcalFromMacros = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9;
    assert.ok(Math.abs(kcalFromMacros - t.calories) / t.calories < 0.01);
  });

  it('emagrecer: déficit de 500 kcal e mais proteína', () => {
    const t = computeTargets({ ...male, goal: 'LOSE' });
    assert.equal(t.calories, 2259);
    assert.equal(t.proteinG, 160); // 2,0 g/kg
  });

  it('ganhar massa: superávit de 300 kcal', () => {
    assert.equal(computeTargets({ ...male, goal: 'GAIN' }).calories, 3059);
  });

  it('nunca recomenda abaixo do piso de segurança', () => {
    const t = computeTargets({
      sex: 'FEMALE', weightKg: 45, heightCm: 150, age: 50, activityLevel: 'SEDENTARY', goal: 'LOSE',
    });
    assert.equal(t.calories, 1200);
    assert.ok(t.carbsG >= 0);
  });
});

describe('nutrientes de porções', () => {
  const chicken = {
    calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0, sodiumMg: 74, ironMg: 1, calciumMg: 15, vitCMg: 0,
  };

  it('escala por gramas (150 g = 1,5 × valores de 100 g)', () => {
    const n = nutrientsForPortion(chicken, 150);
    assert.equal(n.calories, 247.5);
    assert.equal(n.proteinG, 46.5);
  });

  it('soma itens', () => {
    const total = sumNutrients([nutrientsForPortion(chicken, 100), nutrientsForPortion(chicken, 50)]);
    assert.equal(total.calories, 247.5);
  });
});
