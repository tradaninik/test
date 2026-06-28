// Population prior for per-user carb sensitivity.
//
// Until a user has enough (meal, glucose) pairs to fit their own model, we estimate
// mg/dL-per-gram-carb from their profile. This is the part that makes the product say
// something *personal* on day 1 — not a generic "rice is bad".
//
// Educational / heuristic — calibrated against typical Type-2 response ranges, not a
// clinical model. Clearly labeled non-clinical downstream.
import type { UserProfile } from './types';
import { bmi } from './nutrition';

/** Base sensitivity for a healthy non-diabetic adult: ~1.0 mg/dL per g carb (avg meal). */
export const PRIOR_BASE_MGDL_PER_G = 1.0;

/**
 * Estimate mg/dL glucose rise per gram of available carbohydrate from the user's profile.
 *
 * Drivers:
 *  - HbA1c: higher HbA1c → more insulin resistance → larger spike per gram.
 *  - BMI: obesity worsens insulin sensitivity.
 *  - Age: insulin sensitivity declines modestly with age.
 *  - Diabetic flag: roughly doubles the base response.
 */
export function priorSensitivity(profile: UserProfile): number {
  let s = PRIOR_BASE_MGDL_PER_G;

  // HbA1c adjustment: 5.0% nominal; +12% per full point above 5.0.
  if (typeof profile.hba1c === 'number' && profile.hba1c > 0) {
    s *= 1 + 0.12 * (profile.hba1c - 5.0);
  }

  // BMI adjustment: 22 nominal; +3% per BMI point above 22 (cap +60%).
  const userBmi = bmi(profile.weightKg, profile.heightCm);
  if (userBmi > 22) {
    s *= 1 + Math.min(0.6, 0.03 * (userBmi - 22));
  }

  // Age adjustment: 30 nominal; +0.5% per year above 30 (cap +20%).
  if (profile.age > 30) {
    s *= 1 + Math.min(0.2, 0.005 * (profile.age - 30));
  }

  // Diabetic multiplier.
  if (profile.diabetic) {
    s *= 1.8;
  }

  // Clamp to a physiologically plausible range.
  return Math.max(0.4, Math.min(s, 5.0));
}
