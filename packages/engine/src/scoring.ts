// Food scoring — Green / Yellow / Red per user, based on predicted glucose impact.
import type { Food, FoodScoreResult, UserProfile } from './types';
import { macrosForGrams, netCarbsG, portionToGrams } from './nutrition';
import { estimateGlucoseSpike } from './glucose';

/** Δ mg/dL thresholds for the user's score bands (diabetic users get wider tolerance). */
export function scoreThresholds(profile: UserProfile): { green: number; yellow: number } {
  return profile.diabetic ? { green: 30, yellow: 60 } : { green: 20, yellow: 40 };
}

/**
 * Score a food for this user at their typical portion.
 * Output includes the predicted Δ and a human-readable reason.
 */
export function scoreFood(
  food: Food,
  profile: UserProfile,
  sensitivity: number,
  portionType: 'katori' | 'serving' = 'serving',
  portionValue = 1,
  context?: { activityAfterMin?: number; sleepHoursPrior?: number; mealAt?: number },
): FoodScoreResult {
  const grams = portionToGrams(food, portionType, portionValue);
  const macros = macrosForGrams(food, grams);
  const nc = netCarbsG(macros.carbsG, macros.fiberG);

  const spike = estimateGlucoseSpike({
    carbsG: nc,
    gi: food.gi,
    sensitivity,
    activityAfterMin: context?.activityAfterMin,
    sleepHoursPrior: context?.sleepHoursPrior,
    mealAt: context?.mealAt,
  });

  const { green, yellow } = scoreThresholds(profile);
  let score: FoodScoreResult['score'];
  if (spike.deltaMgDl <= green) score = 'green';
  else if (spike.deltaMgDl <= yellow) score = 'yellow';
  else score = 'red';

  const reason =
    score === 'green'
      ? `Predicted glucose rise ≤ ${green} mg/dL (${spike.deltaMgDl.toFixed(0)} mg/dL) at your sensitivity. Works well for you.`
      : score === 'yellow'
        ? `Predicted rise ${spike.deltaMgDl.toFixed(0)} mg/dL — moderate. Pair with protein, or take a 10-min walk to blunt the spike.`
        : `Predicted rise ${spike.deltaMgDl.toFixed(0)} mg/dL — high for you. Consider a smaller portion or post-meal activity.`;

  return {
    foodId: food.id,
    score,
    predictedDeltaMgDl: spike.deltaMgDl,
    reason,
  };
}
