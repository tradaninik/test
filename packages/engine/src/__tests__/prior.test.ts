import { describe, it, expect } from 'vitest';
import { priorSensitivity, PRIOR_BASE_MGDL_PER_G } from '../prior';
import type { UserProfile } from '../types';

const base: UserProfile = {
  age: 30,
  gender: 'male',
  heightCm: 175,
  weightKg: 70, // BMI ~22.9
  activityLevel: 'moderate',
  region: 'south_indian',
};

describe('prior sensitivity', () => {
  it('returns the base for a healthy young adult near nominal BMI', () => {
    // BMI 22.9 → +0.03*0.9 ≈ +2.7%; age 30 → no adjustment.
    const s = priorSensitivity({ ...base, age: 30, weightKg: 70 });
    expect(s).toBeGreaterThan(PRIOR_BASE_MGDL_PER_G);
    expect(s).toBeLessThan(PRIOR_BASE_MGDL_PER_G * 1.05);
  });

  it('increases sensitivity with higher HbA1c', () => {
    const low = priorSensitivity({ ...base, hba1c: 5.0 });
    const high = priorSensitivity({ ...base, hba1c: 8.0 });
    expect(high).toBeGreaterThan(low);
    expect(high / low).toBeGreaterThan(1.3);
  });

  it('increases sensitivity with obesity', () => {
    const normal = priorSensitivity({ ...base, weightKg: 70 });
    const obese = priorSensitivity({ ...base, weightKg: 110 }); // BMI ~36
    expect(obese).toBeGreaterThan(normal);
  });

  it('roughly doubles sensitivity for a diabetic', () => {
    const non = priorSensitivity({ ...base });
    const dia = priorSensitivity({ ...base, diabetic: true });
    expect(dia / non).toBeGreaterThan(1.7);
  });

  it('is clamped to a plausible range', () => {
    const s = priorSensitivity({
      ...base,
      age: 80,
      weightKg: 160,
      hba1c: 12,
      diabetic: true,
    });
    expect(s).toBeLessThanOrEqual(5.0);
    expect(s).toBeGreaterThanOrEqual(0.4);
  });
});
