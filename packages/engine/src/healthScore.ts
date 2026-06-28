// Metabolic Health Score — 0-100 composite.
//
// Components: glucose, weight (BMI), sleep, activity, blood pressure, nutrition.
// Each component is mapped to a 0-100 subscore via simple, explainable functions, then
// combined with weights. Educational / heuristic, not a clinical index.
import type { HealthScore, UserProfile } from './types';
import { bmi, bmiCategory, clamp } from './nutrition';

export interface ScoreInputs {
  /** recent average glucose mg/dL (e.g. last 7-14 days) */
  avgGlucose?: number;
  /** recent systolic BP mmHg */
  systolicBp?: number;
  /** recent diastolic BP mmHg */
  diastolicBp?: number;
  /** average sleep hours over last 7 days */
  avgSleepHours?: number;
  /** steps/day average over last 7 days */
  avgSteps?: number;
  /** fraction of logged meals scored green (0-1) */
  greenMealFraction?: number;
}

const WEIGHTS = {
  glucose: 0.25,
  weight: 0.18,
  sleep: 0.15,
  activity: 0.15,
  bloodPressure: 0.15,
  nutrition: 0.12,
} as const;

export function glucoseSubscore(avgGlucose: number | undefined, diabetic?: boolean): number {
  if (typeof avgGlucose !== 'number' || avgGlucose <= 0) return 70;
  // Non-diabetic target ~90-110 mg/dL → 100. Linear degradation beyond band.
  const nominal = diabetic ? 130 : 100;
  const dev = Math.abs(avgGlucose - nominal);
  return clamp(100 - 1.2 * dev, 0, 100);
}

export function weightSubscore(profile: UserProfile): number {
  const userBmi = bmi(profile.weightKg, profile.heightCm);
  const cat = bmiCategory(userBmi);
  // Normal (18.5-25) → 100; mild penalty near edges; heavy penalty outside.
  if (cat === 'normal') return clamp(100 - 6 * Math.abs(userBmi - 21.7), 80, 100);
  if (cat === 'underweight') return clamp(80 - 4 * (18.5 - userBmi), 20, 80);
  if (cat === 'overweight') return clamp(80 - 3 * (userBmi - 25), 40, 80);
  return clamp(50 - 4 * (userBmi - 30), 0, 50);
}

export function sleepSubscore(avgSleepHours: number | undefined): number {
  if (typeof avgSleepHours !== 'number') return 70;
  // 7-9h → 100; taper outside.
  if (avgSleepHours >= 7 && avgSleepHours <= 9) return 100;
  if (avgSleepHours < 7) return clamp(100 - 18 * (7 - avgSleepHours), 0, 100);
  return clamp(100 - 8 * (avgSleepHours - 9), 0, 100);
}

export function activitySubscore(avgSteps: number | undefined): number {
  if (typeof avgSteps !== 'number') return 70;
  // 8000+ steps → 100; taper.
  if (avgSteps >= 8000) return clamp(100 - 0.0005 * (avgSteps - 8000), 85, 100);
  return clamp((avgSteps / 8000) * 100, 0, 100);
}

export function bpSubscore(
  systolic?: number,
  diastolic?: number,
): number {
  if (typeof systolic !== 'number' || typeof diastolic !== 'number') return 70;
  // 110-120 / 70-80 → 100. Penalty per mmHg outside.
  const sScore = clamp(100 - 1.6 * Math.abs(systolic - 115), 0, 100);
  const dScore = clamp(100 - 2.0 * Math.abs(diastolic - 75), 0, 100);
  return clamp(0.6 * sScore + 0.4 * dScore, 0, 100);
}

export function nutritionSubscore(greenMealFraction: number | undefined): number {
  if (typeof greenMealFraction !== 'number') return 70;
  // 80%+ green → 100.
  return clamp(greenMealFraction * 125, 0, 100);
}

export function healthScore(profile: UserProfile, inputs: ScoreInputs): HealthScore {
  const components = {
    glucose: glucoseSubscore(inputs.avgGlucose, profile.diabetic),
    weight: weightSubscore(profile),
    sleep: sleepSubscore(inputs.avgSleepHours),
    activity: activitySubscore(inputs.avgSteps),
    bloodPressure: bpSubscore(inputs.systolicBp, inputs.diastolicBp),
    nutrition: nutritionSubscore(inputs.greenMealFraction),
  };

  const score = Math.round(
    WEIGHTS.glucose * components.glucose +
      WEIGHTS.weight * components.weight +
      WEIGHTS.sleep * components.sleep +
      WEIGHTS.activity * components.activity +
      WEIGHTS.bloodPressure * components.bloodPressure +
      WEIGHTS.nutrition * components.nutrition,
  );

  return { score: clamp(score, 0, 100), components };
}
