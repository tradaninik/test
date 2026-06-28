import { describe, it, expect } from 'vitest';
import { scoreFood, scoreThresholds } from '../scoring';
import type { Food, UserProfile } from '../types';

const lowGiFood: Food = {
  id: 'moong_dal',
  name: 'Moong Dal',
  region: 'north_indian',
  category: 'legume',
  servingGrams: 150,
  katoriGrams: 150,
  kcalPer100g: 105,
  carbsPer100g: 12,
  proteinPer100g: 6,
  fatPer100g: 0.4,
  fiberPer100g: 4,
  gi: 31,
};

const highGiFood: Food = {
  id: 'white_rice',
  name: 'White Rice',
  region: 'south_indian',
  category: 'cereal',
  servingGrams: 150,
  katoriGrams: 150,
  kcalPer100g: 130,
  carbsPer100g: 28,
  proteinPer100g: 2.7,
  fatPer100g: 0.3,
  fiberPer100g: 0.4,
  gi: 73,
};

const healthy: UserProfile = {
  age: 30,
  gender: 'female',
  heightCm: 165,
  weightKg: 60,
  activityLevel: 'moderate',
  region: 'north_indian',
};

describe('scoreFood', () => {
  it('wider thresholds for a diabetic user', () => {
    const non = scoreThresholds(healthy);
    const dia = scoreThresholds({ ...healthy, diabetic: true });
    expect(dia.green).toBeGreaterThan(non.green);
    expect(dia.yellow).toBeGreaterThan(non.yellow);
  });

  it('scores a low-GI legume green for a sensitive user', () => {
    const r = scoreFood(lowGiFood, healthy, 1.0);
    expect(r.score).toBe('green');
    expect(r.predictedDeltaMgDl).toBeLessThan(20);
  });

  it('scores high-GI white rice red for a sensitive user', () => {
    const r = scoreFood(highGiFood, healthy, 1.0);
    expect(r.score).not.toBe('green');
    expect(r.predictedDeltaMgDl).toBeGreaterThan(15);
  });

  it('reasoning string cites the predicted delta', () => {
    const r = scoreFood(highGiFood, healthy, 1.0);
    expect(r.reason).toMatch(/mg\/dL/);
  });

  it('a post-meal walk can move a yellow into a better band', () => {
    const noWalk = scoreFood(highGiFood, healthy, 1.0, 'serving', 1);
    const walk = scoreFood(highGiFood, healthy, 1.0, 'serving', 1, { activityAfterMin: 20 });
    expect(walk.predictedDeltaMgDl).toBeLessThanOrEqual(noWalk.predictedDeltaMgDl);
  });
});
