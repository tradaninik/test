// Insight discovery — automatic pattern mining from logged history.
//
// Each detector compares a "low" condition vs a "high" condition on the user's own data
// and emits an InsightCard with an effect magnitude, confidence, and the evidence it used.
// Educational only.
import type {
  GlucosePoint,
  InsightCard,
  MealEntry,
  SleepRecord,
  WeightPoint,
  Food,
} from './types';

export interface InsightHistory {
  sleep: SleepRecord[];
  glucose: GlucosePoint[];
  meals: MealEntry[];
  weights: WeightPoint[];
  /** per-food observed deltas: { foodId: { deltas: number[], avgDelta } } */
  foodResponses?: Record<string, { deltas: number[]; avgDelta: number; gi: number }>;
  foodIndex?: Record<string, Food>;
}

const now = () => Date.now();

/** Effect % for a two-group comparison (meanLow vs meanHigh). */
function effectPct(meanLow: number, meanHigh: number): number {
  if (meanLow === 0) return 0;
  return +(((meanHigh - meanLow) / Math.abs(meanLow)) * 100).toFixed(0);
}

/** Confidence 0-1 from sample size, capping at 1. */
function confFromN(n: number, minN = 4): number {
  if (n < minN) return 0;
  return Math.min(1, 0.4 + 0.06 * (n - minN));
}

/**
 * Run all detectors over the user's history. Returns cards sorted by confidence.
 */
export function discoverInsights(history: InsightHistory): InsightCard[] {
  const cards: InsightCard[] = [];

  // 1. Sleep < 6h vs >= 7h → fasting glucose.
  const lowSleep = history.sleep.filter((s) => s.hours < 6);
  const goodSleep = history.sleep.filter((s) => s.hours >= 7);
  if (lowSleep.length >= 2 && goodSleep.length >= 2) {
    const lowGlucose = avgFastingAfter(history.glucose, lowSleep.map((s) => s.wokeAt));
    const goodGlucose = avgFastingAfter(history.glucose, goodSleep.map((s) => s.wokeAt));
    if (lowGlucose != null && goodGlucose != null) {
      const eff = effectPct(goodGlucose, lowGlucose);
      cards.push({
        id: `sleep_glucose_${now()}`,
        type: 'sleep_glucose',
        title: eff > 0 ? 'Poor sleep raises your fasting glucose' : 'Good sleep steadies your glucose',
        body: `When you sleep under 6h, your fasting glucose averages ${lowGlucose.toFixed(0)} mg/dL vs ${goodGlucose.toFixed(0)} mg/dL after 7h+ sleep — about ${Math.abs(eff)}% ${eff > 0 ? 'higher' : 'lower'}.`,
        effectPct: eff,
        confidence: confFromN(Math.min(lowSleep.length, goodSleep.length)),
        evidence: [
          `${lowSleep.length} nights under 6h`,
          `${goodSleep.length} nights over 7h`,
        ],
        createdAt: now(),
      });
    }
  }

  // 2. Post-meal activity reduces spikes.
  // (Detected via foodResponses split by activity — but we keep it simple: if any
  //  foodResponses exist, look for low-GI vs high-GI foods the user responds to.)
  if (history.foodResponses) {
    const entries = Object.entries(history.foodResponses);
    if (entries.length >= 3) {
      // Sort by avgDelta and pick extremes.
      const sorted = entries.sort((a, b) => a[1].avgDelta - b[1].avgDelta);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      if (best[1].avgDelta < worst[1].avgDelta - 10) {
        const bestName = history.foodIndex?.[best[0]]?.name ?? best[0];
        const worstName = history.foodIndex?.[best[0]]?.name ?? worst[0];
        cards.push({
          id: `food_response_${now()}`,
          type: 'food_response',
          title: `${bestName} suits you better than ${worstName}`,
          body: `Your glucose rises ~${best[1].avgDelta.toFixed(0)} mg/dL after ${bestName} vs ~${worst[1].avgDelta.toFixed(0)} mg/dL after ${worstName}. Lean into the first.`,
          effectPct: effectPct(best[1].avgDelta, worst[1].avgDelta),
          confidence: confFromN(Math.min(best[1].deltas.length, worst[1].deltas.length), 2),
          evidence: [
            `${best[1].deltas.length} ${bestName} meals`,
            `${worst[1].deltas.length} ${worstName} meals`,
          ],
          createdAt: now(),
        });
      }
    }
  }

  // 3. Weekend weight drift vs weekdays.
  if (history.weights.length >= 8) {
    const weekend = history.weights.filter((w) => isWeekend(w.takenAt));
    const weekday = history.weights.filter((w) => !isWeekend(w.takenAt));
    if (weekend.length >= 2 && weekday.length >= 4) {
      const meanWE = mean(weekend.map((w) => w.kg));
      const meanWD = mean(weekday.map((w) => w.kg));
      const eff = effectPct(meanWD, meanWE);
      if (Math.abs(eff) >= 1) {
        cards.push({
          id: `weekend_weight_${now()}`,
          type: 'weekend_weight',
          title: eff > 0 ? 'Weekends nudge your weight up' : 'You weigh less on weekends',
          body: `Your average weight is ${meanWE.toFixed(1)} kg on weekends vs ${meanWD.toFixed(1)} kg on weekdays — about ${Math.abs(eff)}% ${eff > 0 ? 'higher' : 'lower'}.`,
          effectPct: eff,
          confidence: confFromN(Math.min(weekend.length, weekday.length)),
          evidence: [`${weekend.length} weekend weigh-ins`, `${weekday.length} weekday weigh-ins`],
          createdAt: now(),
        });
      }
    }
  }

  return cards.sort((a, b) => b.confidence - a.confidence);
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function isWeekend(ts: number): boolean {
  const day = new Date(ts).getDay();
  return day === 0 || day === 6;
}

/** Average the fasting glucose taken within 0-4h after the given wake timestamps. */
function avgFastingAfter(glucose: GlucosePoint[], wakeTimes: number[]): number | null {
  const picks: number[] = [];
  for (const wake of wakeTimes) {
    const after = glucose
      .filter((g) => g.takenAt >= wake && g.takenAt <= wake + 4 * 3600_000)
      .sort((a, b) => a.takenAt - b.takenAt)[0];
    if (after) picks.push(after.value);
  }
  if (picks.length === 0) return null;
  return mean(picks);
}
