// Forecasting — 30-day weight/glucose/HbA1c and 90-day risk trajectory.
//
// Deterministic projections from the user's recent trend + energy balance. Confidence
// intervals widen with horizon. Educational / heuristic — NOT a clinical prediction.
import type { ForecastPoint, UserProfile } from './types';
import { clamp } from './nutrition';
import { bmi } from './nutrition';

const DAY_MS = 86_400_000;

export interface TrendInputs {
  /** recent average daily kcal intake (last ~7-14 days) */
  avgKcalIntake?: number;
  /** recent average daily kcal expenditure (TDEE + activity) */
  avgKcalExpenditure?: number;
  /** recent average fasting/morning glucose mg/dL */
  avgGlucose?: number;
  /** slope of glucose over time (mg/dL per day), from recent history */
  glucoseSlopePerDay?: number;
  /** current HbA1c % */
  hba1c?: number;
  /** anchor time (epoch ms); defaults to now */
  anchorAt?: number;
  /** projection horizon in days; used when the caller does not pass an explicit arg */
  horizonDays?: number;
}

/** Convert avg glucose (mg/dL) to estimated HbA1c via the ADAG-derived relation. */
export function glucoseToHba1c(avgGlucoseMgDl: number): number {
  // HbA1c(%) = (avgGlucose + 46.7) / 28.7  (ADAG study, mg/dL)
  return +((avgGlucoseMgDl + 46.7) / 28.7).toFixed(1);
}

/** Project weight, HbA1c, and glucose forward. */
export function forecast(
  profile: UserProfile,
  inputs: TrendInputs,
  horizonDays?: number,
): ForecastPoint[] {
  const horizon = horizonDays ?? inputs.horizonDays ?? 30;
  const anchor = inputs.anchorAt ?? Date.now();
  const points: ForecastPoint[] = [];

  // --- Weight: 7700 kcal ≈ 1 kg of body mass. ---
  const deficit = (inputs.avgKcalIntake ?? 0) - (inputs.avgKcalExpenditure ?? 0);
  const kgPerDay = deficit / 7700; // positive = gain

  // --- Glucose: project slope, mean-reverting toward a healthy target. ---
  const startGlucose = inputs.avgGlucose ?? profile.fastingGlucose ?? 110;
  const slope = inputs.glucoseSlopePerDay ?? 0;
  const target = profile.diabetic ? 130 : 100;
  // Mean-reversion strength: pulls 5% of the gap per day.
  const meanRevert = 0.05;

  const startHba1c = inputs.hba1c ?? profile.hba1c ?? glucoseToHba1c(startGlucose);

  for (let d = 0; d <= horizon; d += 1) {
    // Confidence interval widens with sqrt(days).
    const spread = Math.sqrt(d);

    // Weight
    const weight = profile.weightKg + kgPerDay * d;
    const weightUnc = 0.4 * spread + 0.2;
    points.push({
      day: d,
      metric: 'weight_kg',
      value: +weight.toFixed(2),
      low: +(weight - weightUnc).toFixed(2),
      high: +(weight + weightUnc).toFixed(2),
    });

    // Glucose (mean-reverting random walk with drift)
    const gap = target - startGlucose;
    const glucose = startGlucose + slope * d + gap * (1 - Math.exp(-meanRevert * d));
    const glucoseUnc = 6 * spread + 4;
    points.push({
      day: d,
      metric: 'glucose_mgdl',
      value: +glucose.toFixed(1),
      low: +(glucose - glucoseUnc).toFixed(1),
      high: +(glucose + glucoseUnc).toFixed(1),
    });

    // HbA1c (lags glucose by ~30-90 days; approximate via smoothed glucose)
    if (d % 7 === 0 || d === horizon) {
      const projHba1c = glucoseToHba1c(glucose);
      // Blend toward projected over the horizon; full effect by day ~90.
      const blend = clamp(d / 90, 0, 1);
      const hba1c = startHba1c + (projHba1c - startHba1c) * blend;
      const hba1cUnc = 0.3 * spread + 0.2;
      points.push({
        day: d,
        metric: 'hba1c',
        value: +hba1c.toFixed(2),
        low: +(hba1c - hba1cUnc).toFixed(2),
        high: +(hba1c + hba1cUnc).toFixed(2),
      });
    }
  }

  return points;
}

export interface RiskForecast {
  metric: 'diabetes_risk' | 'hypertension_risk' | 'fatty_liver_risk';
  /** 0-1 probability at 90 days (heuristic) */
  probability: number;
  /** qualitative label */
  level: 'low' | 'moderate' | 'high';
  drivers: string[];
}

/** 90-day risk outlook — heuristic, derived from profile + trend. */
export function forecastRisk(
  profile: UserProfile,
  inputs: TrendInputs,
): RiskForecast[] {
  const out: RiskForecast[] = [];
  const userBmi = bmi(profile.weightKg, profile.heightCm);

  // Diabetes risk: HbA1c, BMI, age, family-ish.
  let diabetesP = 0.1;
  const hba1c = inputs.hba1c ?? profile.hba1c ?? glucoseToHba1c(inputs.avgGlucose ?? profile.fastingGlucose ?? 110);
  if (hba1c >= 6.5) diabetesP += 0.5;
  else if (hba1c >= 5.7) diabetesP += 0.25 * (hba1c - 5.7) / 0.8;
  if (userBmi >= 30) diabetesP += 0.2;
  else if (userBmi >= 25) diabetesP += 0.1;
  if (profile.age >= 45) diabetesP += 0.1;
  const dDrivers: string[] = [];
  if (hba1c >= 5.7) dDrivers.push(`HbA1c ${hba1c}%`);
  if (userBmi >= 25) dDrivers.push(`BMI ${userBmi.toFixed(1)}`);
  if (profile.age >= 45) dDrivers.push(`age ${profile.age}`);
  out.push(riskFromProb('diabetes_risk', diabetesP, dDrivers));

  // Hypertension risk: BP + BMI + age.
  let hyperP = 0.1;
  // Without explicit BP, fall back to BMI/age proxies.
  if (userBmi >= 30) hyperP += 0.25;
  if (profile.age >= 50) hyperP += 0.15;
  const hDrivers: string[] = [];
  if (userBmi >= 30) hDrivers.push(`BMI ${userBmi.toFixed(1)}`);
  if (profile.age >= 50) hDrivers.push(`age ${profile.age}`);
  out.push(riskFromProb('hypertension_risk', hyperP, hDrivers));

  // Fatty liver risk: BMI + carbs/sugar proxy + diabetic status.
  let liverP = 0.08;
  if (userBmi >= 30) liverP += 0.3;
  else if (userBmi >= 25) liverP += 0.15;
  if (profile.diabetic) liverP += 0.15;
  const lDrivers: string[] = [];
  if (userBmi >= 25) lDrivers.push(`BMI ${userBmi.toFixed(1)}`);
  if (profile.diabetic) lDrivers.push('diabetic status');
  out.push(riskFromProb('fatty_liver_risk', liverP, lDrivers));

  return out;
}

function riskFromProb(
  metric: RiskForecast['metric'],
  p: number,
  drivers: string[],
): RiskForecast {
  const clamped = clamp(p, 0, 0.99);
  const level: RiskForecast['level'] = clamped >= 0.6 ? 'high' : clamped >= 0.3 ? 'moderate' : 'low';
  return { metric, probability: +clamped.toFixed(2), level, drivers };
}

// expose DAY_MS for downstream scheduling if needed
export { DAY_MS };
