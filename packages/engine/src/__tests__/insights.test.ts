import { describe, it, expect } from 'vitest';
import { discoverInsights } from '../insights';
import type { GlucosePoint, SleepRecord, WeightPoint, Food } from '../types';

const DAY = 86_400_000;

function ts(daysAgo: number, hour = 8): number {
  const d = new Date('2024-03-15T00:00:00Z').getTime();
  return d - daysAgo * DAY + hour * 3600_000;
}

describe('discoverInsights', () => {
  it('detects that poor sleep raises fasting glucose', () => {
    // 5 low-sleep nights with high fasting glucose.
    const sleep: SleepRecord[] = [
      { hours: 5, wokeAt: ts(10) },
      { hours: 5, wokeAt: ts(9) },
      { hours: 5, wokeAt: ts(8) },
      { hours: 8, wokeAt: ts(7) },
      { hours: 8, wokeAt: ts(6) },
      { hours: 8, wokeAt: ts(5) },
    ];
    // Glucose readings on those mornings.
    const glucose: GlucosePoint[] = [
      { value: 140, takenAt: ts(10) + 30 * 60_000 }, // poor sleep
      { value: 142, takenAt: ts(9) + 30 * 60_000 },
      { value: 138, takenAt: ts(8) + 30 * 60_000 },
      { value: 105, takenAt: ts(7) + 30 * 60_000 }, // good sleep
      { value: 108, takenAt: ts(6) + 30 * 60_000 },
      { value: 107, takenAt: ts(5) + 30 * 60_000 },
    ];
    const cards = discoverInsights({ sleep, glucose, meals: [], weights: [] });
    const card = cards.find((c) => c.type === 'sleep_glucose');
    expect(card).toBeDefined();
    expect(card!.effectPct).toBeGreaterThan(10);
    expect(card!.evidence.length).toBe(2);
  });

  it('detects weekend weight drift', () => {
    // Build 14 days with weekends slightly heavier.
    const weights: WeightPoint[] = [];
    for (let i = 13; i >= 0; i--) {
      const t = ts(i);
      const day = new Date(t).getDay();
      const kg = day === 0 || day === 6 ? 82.5 : 81.8;
      weights.push({ kg, takenAt: t });
    }
    const cards = discoverInsights({ sleep: [], glucose: [], meals: [], weights });
    const card = cards.find((c) => c.type === 'weekend_weight');
    expect(card).toBeDefined();
    expect(card!.effectPct).toBeGreaterThan(0);
  });

  it('emits nothing when data is too sparse', () => {
    const cards = discoverInsights({ sleep: [], glucose: [], meals: [], weights: [] });
    expect(cards).toEqual([]);
  });

  it('flags divergent food responses when foodResponses provided', () => {
    const foodIndex: Record<string, Food> = {
      dosa: {
        id: 'dosa', name: 'Dosa', region: 'south_indian', category: 'cereal',
        servingGrams: 100, kcalPer100g: 168, carbsPer100g: 29, proteinPer100g: 4,
        fatPer100g: 3.5, fiberPer100g: 1.2, gi: 66,
      },
      dal: {
        id: 'dal', name: 'Dal', region: 'north_indian', category: 'legume',
        servingGrams: 150, kcalPer100g: 105, carbsPer100g: 12, proteinPer100g: 6,
        fatPer100g: 0.4, fiberPer100g: 4, gi: 31,
      },
      chapati: {
        id: 'chapati', name: 'Chapati', region: 'north_indian', category: 'cereal',
        servingGrams: 60, kcalPer100g: 297, carbsPer100g: 46, proteinPer100g: 9,
        fatPer100g: 3.5, fiberPer100g: 4, gi: 52,
      },
    };
    const cards = discoverInsights({
      sleep: [], glucose: [], meals: [], weights: [],
      foodIndex,
      foodResponses: {
        dosa: { deltas: [50, 52, 48], avgDelta: 50, gi: 66 },
        dal: { deltas: [10, 12, 9], avgDelta: 10, gi: 31 },
        chapati: { deltas: [30, 28, 31], avgDelta: 30, gi: 52 },
      },
    });
    const card = cards.find((c) => c.type === 'food_response');
    expect(card).toBeDefined();
    expect(card!.title).toContain('Dal');
  });
});
