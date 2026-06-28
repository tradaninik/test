import { describe, it, expect } from 'vitest';
import {
  bmi,
  bmiCategory,
  bmr,
  tdee,
  portionToGrams,
  macrosForGrams,
  netCarbsG,
  giFactor,
  clamp,
  lerp,
} from '../nutrition';
import type { Food, UserProfile } from '../types';

const food: Food = {
  id: 'dosa',
  name: 'Plain Dosa',
  region: 'south_indian',
  category: 'cereal',
  servingGrams: 100,
  katoriGrams: 150,
  kcalPer100g: 168,
  carbsPer100g: 29,
  proteinPer100g: 4,
  fatPer100g: 3.5,
  fiberPer100g: 1.2,
  gi: 66,
};

const profile: UserProfile = {
  age: 45,
  gender: 'male',
  heightCm: 170,
  weightKg: 82,
  activityLevel: 'light',
  region: 'south_indian',
};

describe('nutrition / anthropometry', () => {
  it('computes BMI correctly', () => {
    expect(bmi(82, 170)).toBeCloseTo(28.37, 1);
  });

  it('classifies BMI categories', () => {
    expect(bmiCategory(17)).toBe('underweight');
    expect(bmiCategory(22)).toBe('normal');
    expect(bmiCategory(27)).toBe('overweight');
    expect(bmiCategory(32)).toBe('obese');
  });

  it('computes Mifflin-St Jeor BMR for a male', () => {
    // 10*82 + 6.25*170 - 5*45 + 5 = 820 + 1062.5 - 225 + 5 = 1662.5 → 1663
    expect(bmr(profile)).toBe(1663);
  });

  it('applies activity factor to TDEE', () => {
    expect(tdee(profile)).toBe(Math.round(1663 * 1.375));
  });

  it('resolves katori/serving/grams portions', () => {
    expect(portionToGrams(food, 'grams', 50)).toBe(50);
    expect(portionToGrams(food, 'serving', 2)).toBe(200);
    expect(portionToGrams(food, 'katori', 1)).toBe(150);
  });

  it('computes macros scaled to grams', () => {
    const m = macrosForGrams(food, 200);
    expect(m.kcal).toBe(336);
    expect(m.carbsG).toBe(58);
    expect(m.proteinG).toBe(8);
  });

  it('subtracts half of fiber for net carbs', () => {
    expect(netCarbsG(30, 4)).toBe(28);
    expect(netCarbsG(10, 30)).toBe(0); // floor at 0
  });

  it('maps GI to a 0.3-1.0 factor', () => {
    expect(giFactor(55)).toBeCloseTo(0.55);
    expect(giFactor(100)).toBe(1);
    expect(giFactor(10)).toBe(0.3); // floored
  });

  it('clamp and lerp behave', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
});
