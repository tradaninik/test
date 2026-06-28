// Pure nutrition & anthropometry helpers. No I/O, deterministic.
import type { ActivityLevel, Food, Gender, PortionType, UserProfile } from './types';

export const KG_PER_LB = 0.45359237;
export const CM_PER_INCH = 2.54;

/** BMI = kg / m^2 */
export function bmi(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) return 0;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(bmiValue: number): 'underweight' | 'normal' | 'overweight' | 'obese' {
  if (bmiValue < 18.5) return 'underweight';
  if (bmiValue < 25) return 'normal';
  if (bmiValue < 30) return 'overweight';
  return 'obese';
}

/** Mifflin-St Jeor BMR (kcal/day). */
export function bmr(profile: UserProfile): number {
  const { weightKg, heightCm, age, gender } = profile;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const s = gender === 'male' ? 5 : gender === 'female' ? -161 : -78;
  return Math.max(0, Math.round(base + s));
}

const TDEE_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Total daily energy expenditure (kcal/day). */
export function tdee(profile: UserProfile): number {
  return Math.round(bmr(profile) * TDEE_FACTOR[profile.activityLevel]);
}

/** Resolve a portion (katori/serving/grams) to grams of the food. */
export function portionToGrams(food: Food, portionType: PortionType, value: number): number {
  switch (portionType) {
    case 'grams':
      return value;
    case 'serving':
      return value * food.servingGrams;
    case 'katori':
      return value * (food.katoriGrams ?? food.servingGrams);
    default:
      return value;
  }
}

/** Macros for a given gram amount of a food. */
export function macrosForGrams(food: Food, grams: number) {
  const k = grams / 100;
  return {
    kcal: Math.round(food.kcalPer100g * k),
    carbsG: +(food.carbsPer100g * k).toFixed(1),
    proteinG: +(food.proteinPer100g * k).toFixed(1),
    fatG: +(food.fatPer100g * k).toFixed(1),
    fiberG: +(food.fiberPer100g * k).toFixed(1),
  };
}

/** Available (net) carbs after subtracting a fraction of fiber. */
export function netCarbsG(carbsG: number, fiberG: number): number {
  // Per international convention, subtract ~half of fiber grams in mixed diets.
  return Math.max(0, carbsG - 0.5 * fiberG);
}

/** Gender-, age-, region-naive basal glucose target band (mg/dL). Educational only. */
export function targetGlucoseBand(profile: UserProfile): { low: number; high: number } {
  // Wider band for known diabetics (educational, not clinical).
  return profile.diabetic ? { low: 80, high: 180 } : { low: 70, high: 140 };
}

/** Carbohydrate factor on glycemic index: 0..1 multiplier on the carb load. */
export function giFactor(gi: number): number {
  // GI 55 → 0.55, GI 100 → 1.0; linear.
  return Math.max(0.3, Math.min(1.0, gi / 100));
}

/** Clamp helper. */
export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
