import { describe, it, expect } from 'vitest';
import { forecast, forecastRisk, glucoseToHba1c } from '../forecast';
import type { UserProfile } from '../types';

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

describe('forecast', () => {
  it('glucoseToHba1c uses the ADAG relation', () => {
    // HbA1c = (154 + 46.7) / 28.7 ≈ 7.0
    expect(glucoseToHba1c(154)).toBeCloseTo(7.0, 1);
  });

  it('projects weight loss with a calorie deficit', () => {
    const pts = forecast(profile, {
      avgKcalIntake: 1600,
      avgKcalExpenditure: 2100, // -500/day → ~0.065 kg/day
      horizonDays: 30,
    });
    const day0 = pts.find((p) => p.day === 0 && p.metric === 'weight_kg')!;
    const day30 = pts.find((p) => p.day === 30 && p.metric === 'weight_kg')!;
    expect(day30.value).toBeLessThan(day0.value);
    // ~0.065 kg/day * 30 ≈ 1.9 kg loss
    expect(day0.value - day30.value).toBeGreaterThan(1.5);
    expect(day30.value).toBeGreaterThan(day30.low);
    expect(day30.value).toBeLessThan(day30.high);
  });

  it('projects weight gain with a surplus', () => {
    const pts = forecast(profile, {
      avgKcalIntake: 2800,
      avgKcalExpenditure: 2100,
      horizonDays: 30,
    });
    const day0 = pts.find((p) => p.day === 0 && p.metric === 'weight_kg')!;
    const day30 = pts.find((p) => p.day === 30 && p.metric === 'weight_kg')!;
    expect(day30.value).toBeGreaterThan(day0.value);
  });

  it('confidence intervals widen with horizon', () => {
    const pts = forecast(profile, { horizonDays: 30 });
    const early = pts.find((p) => p.day === 1 && p.metric === 'glucose_mgdl')!;
    const late = pts.find((p) => p.day === 30 && p.metric === 'glucose_mgdl')!;
    expect(late.high - late.low).toBeGreaterThan(early.high - early.low);
  });

  it('glucose mean-reverts toward target', () => {
    const pts = forecast(profile, { avgGlucose: 220, horizonDays: 60 });
    const start = pts.find((p) => p.day === 0 && p.metric === 'glucose_mgdl')!;
    const end = pts.find((p) => p.day === 60 && p.metric === 'glucose_mgdl')!;
    // Should move toward diabetic target of 130.
    expect(end.value).toBeLessThan(start.value);
  });
});

describe('forecastRisk', () => {
  it('a high-risk profile returns elevated probabilities', () => {
    const risks = forecastRisk(profile, { hba1c: 9, avgGlucose: 220 });
    const dia = risks.find((r) => r.metric === 'diabetes_risk')!;
    expect(dia.probability).toBeGreaterThan(0.5);
    expect(['low', 'moderate', 'high']).toContain(dia.level);
    expect(dia.drivers.length).toBeGreaterThan(0);
  });

  it('a low-risk profile stays modest', () => {
    const healthy: UserProfile = {
      age: 28,
      gender: 'female',
      heightCm: 165,
      weightKg: 58,
      activityLevel: 'active',
      region: 'north_indian',
    };
    const risks = forecastRisk(healthy, { hba1c: 5.0, avgGlucose: 95 });
    for (const r of risks) {
      expect(r.probability).toBeLessThan(0.35);
    }
  });
});
