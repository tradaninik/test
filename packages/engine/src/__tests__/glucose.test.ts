import { describe, it, expect } from 'vitest';
import {
  estimateGlucoseSpike,
  learnSensitivity,
  MIN_PAIRS_FOR_PERSONAL,
} from '../glucose';
import { priorSensitivity } from '../prior';
import { giFactor } from '../nutrition';
import type { MealGlucosePair, UserProfile } from '../types';

// Mirror the estimator's load computation so generated (meal, glucose) pairs are
// consistent with what learnSensitivity expects to fit.
function loadFor(carbs: number, gi: number): number {
  const raw = carbs * giFactor(gi);
  const subLinear = raw <= 60 ? 1 : 60 / raw + 0.4;
  return raw * subLinear;
}

const profile: UserProfile = {
  age: 45,
  gender: 'male',
  heightCm: 170,
  weightKg: 82,
  hba1c: 7.2,
  diabetic: true,
  activityLevel: 'light',
  region: 'south_indian',
};

describe('estimateGlucoseSpike', () => {
  it('predicts a positive spike for a carb meal', () => {
    const s = estimateGlucoseSpike({
      carbsG: 45,
      gi: 66,
      sensitivity: 2.0,
    });
    expect(s.deltaMgDl).toBeGreaterThan(0);
    expect(s.timeToPeakMin).toBeGreaterThanOrEqual(25);
    expect(s.timeToPeakMin).toBeLessThanOrEqual(90);
    expect(s.auc).toBeGreaterThan(0);
  });

  it('higher GI → larger and faster spike', () => {
    const low = estimateGlucoseSpike({ carbsG: 50, gi: 40, sensitivity: 2 });
    const high = estimateGlucoseSpike({ carbsG: 50, gi: 90, sensitivity: 2 });
    expect(high.deltaMgDl).toBeGreaterThan(low.deltaMgDl);
    expect(high.timeToPeakMin).toBeLessThan(low.timeToPeakMin);
  });

  it('activity after the meal reduces the spike', () => {
    const none = estimateGlucoseSpike({ carbsG: 50, gi: 70, sensitivity: 2 });
    const walk = estimateGlucoseSpike({ carbsG: 50, gi: 70, sensitivity: 2, activityAfterMin: 20 });
    expect(walk.deltaMgDl).toBeLessThan(none.deltaMgDl);
    expect(walk.activityAdjustment).toBeLessThan(0);
    // Reduction should not exceed 55% of the raw delta.
    expect(Math.abs(walk.activityAdjustment)).toBeLessThanOrEqual(none.deltaMgDl * 0.55 + 0.01);
  });

  it('poor sleep inflates the spike', () => {
    const rested = estimateGlucoseSpike({ carbsG: 50, gi: 70, sensitivity: 2, sleepHoursPrior: 8 });
    const tired = estimateGlucoseSpike({ carbsG: 50, gi: 70, sensitivity: 2, sleepHoursPrior: 5 });
    expect(tired.deltaMgDl).toBeGreaterThan(rested.deltaMgDl);
  });

  it('morning meals spike slightly more (dawn phenomenon)', () => {
    const morning = estimateGlucoseSpike({
      carbsG: 50, gi: 70, sensitivity: 2, mealAt: new Date('2024-01-01T07:00:00').getTime(),
    });
    const noon = estimateGlucoseSpike({
      carbsG: 50, gi: 70, sensitivity: 2, mealAt: new Date('2024-01-01T13:00:00').getTime(),
    });
    expect(morning.deltaMgDl).toBeGreaterThan(noon.deltaMgDl);
  });

  it('never produces a negative spike', () => {
    const s = estimateGlucoseSpike({ carbsG: 5, gi: 10, sensitivity: 0.5, activityAfterMin: 60 });
    expect(s.deltaMgDl).toBeGreaterThanOrEqual(0);
  });
});

describe('learnSensitivity', () => {
  function makePairs(trueSensitivity: number, n: number): MealGlucosePair[] {
    const pairs: MealGlucosePair[] = [];
    // Use a fixed seed-ish pattern to keep deterministic.
    for (let i = 0; i < n; i++) {
      const carbs = 30 + (i % 5) * 8; // 30..62
      const gi = 50 + (i % 4) * 10; // 50..80
      const load = loadFor(carbs, gi);
      const observed = trueSensitivity * load;
      pairs.push({
        meal: { foodId: 'f', portionType: 'grams', portionValue: carbs, grams: carbs, loggedAt: i * 1000 },
        carbsG: carbs,
        gi,
        observedDelta: observed,
        activityAfterMin: 0,
      });
    }
    return pairs;
  }

  it('returns the prior when sample size is below threshold', () => {
    const pairs = makePairs(2.5, MIN_PAIRS_FOR_PERSONAL - 1);
    const m = learnSensitivity(pairs, profile);
    expect(m.isPrior).toBe(true);
    expect(m.sensitivityMgDlPerGCarb).toBeCloseTo(priorSensitivity(profile), 2);
  });

  it('recovers a close fit when data is consistent and abundant', () => {
    const trueS = 2.5;
    const pairs = makePairs(trueS, 30);
    const m = learnSensitivity(pairs, profile);
    expect(m.isPrior).toBe(false);
    // Should be within ~15% of the true sensitivity (shrinkage toward prior).
    expect(m.sensitivityMgDlPerGCarb).toBeGreaterThan(trueS * 0.8);
    expect(m.sensitivityMgDlPerGCarb).toBeLessThan(trueS * 1.2);
  });

  it('falls back to prior when the fit would be degenerate', () => {
    // All-zero glycemic load → uninformative.
    const pairs: MealGlucosePair[] = Array.from({ length: 10 }, (_, i) => ({
      meal: { foodId: 'f', portionType: 'grams', portionValue: 0, grams: 0, loggedAt: i },
      carbsG: 0,
      gi: 0,
      observedDelta: 0,
      activityAfterMin: 0,
    }));
    const m = learnSensitivity(pairs, profile);
    expect(m.isPrior).toBe(true);
  });
});
