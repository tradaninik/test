// Glucose spike estimation + per-user sensitivity learning.
//
// estimateGlucoseSpike: predicts Δ mg/dL after a meal, given carbs, GI, the user's
// learned (or prior) sensitivity, recent sleep & activity, and time-of-day effects.
//
// learnSensitivity: ordinary least squares over the user's (meal, glucose) pairs to fit
// their personal mg/dL-per-gram-carb. Falls back to the profile prior with low data.
import type {
  GlucoseSpike,
  LearnedModel,
  MealGlucosePair,
  MealEntry,
  UserProfile,
} from './types';
import { clamp, giFactor } from './nutrition';
import { priorSensitivity, PRIOR_BASE_MGDL_PER_G } from './prior';

/** Minimum pairs before we trust the fit over the prior. */
export const MIN_PAIRS_FOR_PERSONAL = 5;

export interface SpikeInput {
  /** available (net) carbs in grams */
  carbsG: number;
  /** food glycemic index (0-100) */
  gi: number;
  /** learned or prior sensitivity, mg/dL per g carb */
  sensitivity: number;
  /** minutes of activity in the 2h AFTER the meal (0 if none) */
  activityAfterMin?: number;
  /** hours of sleep the prior night (0 if unknown → neutral) */
  sleepHoursPrior?: number;
  /** epoch ms when the meal occurs (for time-of-day effect) */
  mealAt?: number;
}

const HOUR_MS = 3600_000;

/** Predict the post-meal glucose spike for one meal. Pure & deterministic. */
export function estimateGlucoseSpike(input: SpikeInput): GlucoseSpike {
  const { carbsG, gi, sensitivity } = input;

  // Carb load × GI factor → effective glycemic load (in carb grams).
  const glycemicLoad = carbsG * giFactor(gi);

  // Base predicted Δ from the user's sensitivity. sensitivity is calibrated as
  // mg/dL per gram of available carb, so we apply it directly. A mild sub-linearity
  // softens very large meals (where disposal partially compensates).
  const subLinear = glycemicLoad <= 60 ? 1 : 60 / glycemicLoad + 0.4;
  let delta = sensitivity * glycemicLoad * subLinear;

  // Time-of-day: dawn phenomenon / circadian — mornings spike ~10% more.
  if (typeof input.mealAt === 'number') {
    const h = new Date(input.mealAt).getHours();
    if (h >= 4 && h <= 9) delta *= 1.1;
    else if (h >= 18) delta *= 1.05; // evenings slightly higher
  }

  // Sleep deficit: <6h sleep raises next-day insulin resistance → ~8% larger spikes.
  if (typeof input.sleepHoursPrior === 'number' && input.sleepHoursPrior > 0) {
    if (input.sleepHoursPrior < 6) delta *= 1 + 0.08 * (6 - input.sleepHoursPrior);
    else if (input.sleepHoursPrior >= 7.5) delta *= 0.96; // well-rested → marginally smaller
  }

  // Activity after the meal: walking/movement accelerates glucose disposal.
  // ~0.7 mg/dL reduction per minute of light activity, capped.
  const actMin = input.activityAfterMin ?? 0;
  const activityAdjustment = -clamp(0.7 * actMin, 0, delta * 0.55);
  delta += activityAdjustment;

  // Lower bound: a carb-containing meal won't drop glucose.
  delta = Math.max(0, delta);

  // Time-to-peak scales inversely with GI — high-GI foods peak faster.
  const timeToPeakMin = Math.round(clamp(60 - 0.3 * gi, 25, 90));

  // Incremental AUC over 2h as a triangle-ish area: 0.5 * base * height, scaled.
  // Peak window ~120 min. Triangular AUC = 0.5 * 120 * delta; we use 0.6 for skew.
  const auc = Math.round(0.6 * 120 * delta);

  return {
    deltaMgDl: +delta.toFixed(1),
    timeToPeakMin,
    auc,
    activityAdjustment: +activityAdjustment.toFixed(1),
  };
}

/**
 * Fit a per-user sensitivity (mg/dL per g carb) from their logged (meal, glucose) pairs,
 * using ordinary least squares constrained to positive values.
 *
 * Model: observedDelta = sensitivity * (carbsG * giFactor(gi)) + ε
 *                       = sensitivity * glycemicLoad + ε
 *
 * Sensitivity = Σ(glycemicLoad·observedDelta) / Σ(glycemicLoad²)
 *
 * If too few pairs or the fit is degenerate / negative, fall back to the prior.
 */
export function learnSensitivity(pairs: MealGlucosePair[], profile: UserProfile): LearnedModel {
  const updatedAt = Date.now();

  if (pairs.length < MIN_PAIRS_FOR_PERSONAL) {
    return {
      sensitivityMgDlPerGCarb: +priorSensitivity(profile).toFixed(3),
      sampleSize: pairs.length,
      updatedAt,
      isPrior: true,
    };
  }

  // Filter pairs with positive glycemic load (otherwise uninformative).
  const usable = pairs.filter((p) => p.carbsG > 1 && p.gi > 0 && Number.isFinite(p.observedDelta));
  if (usable.length < MIN_PAIRS_FOR_PERSONAL) {
    return {
      sensitivityMgDlPerGCarb: +priorSensitivity(profile).toFixed(3),
      sampleSize: usable.length,
      updatedAt,
      isPrior: true,
    };
  }

  let num = 0;
  let den = 0;
  for (const p of usable) {
    const rawLoad = p.carbsG * giFactor(p.gi);
    const subLinear = rawLoad <= 60 ? 1 : 60 / rawLoad + 0.4;
    const load = rawLoad * subLinear; // mirror estimateGlucoseSpike scaling
    // Strip out the activity reduction so we attribute the residual to sensitivity.
    const actAdj = -clamp(0.7 * p.activityAfterMin, 0, 100);
    const adjDelta = p.observedDelta - actAdj;
    num += load * adjDelta;
    den += load * load;
  }

  if (den < 1e-6) {
    return {
      sensitivityMgDlPerGCarb: +priorSensitivity(profile).toFixed(3),
      sampleSize: usable.length,
      updatedAt,
      isPrior: true,
    };
  }

  const sensitivity = num / den;

  // Sanity bounds. A physiologically impossible (≤0) fit means revert to prior.
  if (!Number.isFinite(sensitivity) || sensitivity <= 0 || sensitivity > 10) {
    return {
      sensitivityMgDlPerGCarb: +priorSensitivity(profile).toFixed(3),
      sampleSize: usable.length,
      updatedAt,
      isPrior: true,
    };
  }

  // Shrink toward the prior when sample size is small (James-Stein-ish regularization).
  const prior = priorSensitivity(profile);
  const shrink = Math.min(1, usable.length / 20); // fully personal at ~20 pairs
  const blended = lerpPositive(prior, sensitivity, shrink);

  return {
    sensitivityMgDlPerGCarb: +blended.toFixed(3),
    sampleSize: usable.length,
    updatedAt,
    isPrior: false,
  };
}

/** Convenience: build a MealGlucosePair from a meal + the glucose change observed after it. */
export function buildPair(
  meal: MealEntry,
  carbsG: number,
  gi: number,
  observedDelta: number,
  activityAfterMin = 0,
): MealGlucosePair {
  return { meal, carbsG, gi, observedDelta, activityAfterMin };
}

function lerpPositive(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export { PRIOR_BASE_MGDL_PER_G };
