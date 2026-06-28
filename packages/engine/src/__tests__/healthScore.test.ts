import { describe, it, expect } from 'vitest';
import {
  healthScore,
  glucoseSubscore,
  sleepSubscore,
  activitySubscore,
  bpSubscore,
  nutritionSubscore,
  weightSubscore,
} from '../healthScore';
import type { UserProfile } from '../types';

const healthy: UserProfile = {
  age: 30,
  gender: 'female',
  heightCm: 165,
  weightKg: 60,
  activityLevel: 'moderate',
  region: 'north_indian',
};

describe('healthScore components', () => {
  it('glucose subscore peaks at nominal', () => {
    expect(glucoseSubscore(100, false)).toBe(100);
    expect(glucoseSubscore(160, false)).toBeLessThan(100);
  });

  it('diabetics have a higher nominal glucose', () => {
    expect(glucoseSubscore(130, true)).toBeGreaterThan(glucoseSubscore(130, false));
  });

  it('sleep 7-9h scores 100', () => {
    expect(sleepSubscore(7.5)).toBe(100);
    expect(sleepSubscore(5)).toBeLessThan(80);
  });

  it('activity scales with steps to 8000', () => {
    expect(activitySubscore(8000)).toBe(100);
    expect(activitySubscore(4000)).toBe(50);
  });

  it('BP 115/75 is near-peak', () => {
    expect(bpSubscore(115, 75)).toBe(100);
    expect(bpSubscore(150, 95)).toBeLessThan(60);
  });

  it('nutrition scales with green fraction', () => {
    expect(nutritionSubscore(0.8)).toBe(100);
    expect(nutritionSubscore(0.2)).toBe(25);
  });

  it('weight subscore rewards BMI ~21.7', () => {
    expect(weightSubscore({ ...healthy, weightKg: 59, heightCm: 165 })).toBeGreaterThan(90);
  });
});

describe('healthScore composite', () => {
  it('a healthy profile scores high', () => {
    const r = healthScore(healthy, {
      avgGlucose: 100,
      systolicBp: 115,
      diastolicBp: 75,
      avgSleepHours: 7.5,
      avgSteps: 9000,
      greenMealFraction: 0.9,
    });
    expect(r.score).toBeGreaterThan(90);
    for (const v of Object.values(r.components)) {
      expect(v).toBeGreaterThan(85);
    }
  });

  it('a poor profile scores low', () => {
    const poor: UserProfile = { ...healthy, weightKg: 110, diabetic: true, hba1c: 9 };
    const r = healthScore(poor, {
      avgGlucose: 200,
      systolicBp: 150,
      diastolicBp: 95,
      avgSleepHours: 5,
      avgSteps: 2000,
      greenMealFraction: 0.2,
    });
    expect(r.score).toBeLessThan(50);
  });

  it('is always within 0-100', () => {
    const r = healthScore(healthy, {});
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
