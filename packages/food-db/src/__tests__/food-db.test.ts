import { describe, it, expect } from 'vitest';
import { FOODS, FOOD_INDEX, foodsByRegion, searchFoods, REGION_LABELS } from '../index';

describe('food database integrity', () => {
  it('has no duplicate ids', () => {
    const ids = FOODS.map((f) => f.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it('every food has valid macros and gi', () => {
    for (const f of FOODS) {
      expect(f.kcalPer100g).toBeGreaterThanOrEqual(0);
      expect(f.carbsPer100g).toBeGreaterThanOrEqual(0);
      expect(f.proteinPer100g).toBeGreaterThanOrEqual(0);
      expect(f.fatPer100g).toBeGreaterThanOrEqual(0);
      expect(f.fiberPer100g).toBeGreaterThanOrEqual(0);
      expect(f.gi).toBeGreaterThanOrEqual(0);
      expect(f.gi).toBeLessThanOrEqual(100);
      expect(f.servingGrams).toBeGreaterThan(0);
      expect(typeof f.region).toBe('string');
    }
  });

  it('covers all 10 cuisine regions including global', () => {
    const regions = new Set(FOODS.map((f) => f.region));
    for (const key of Object.keys(REGION_LABELS)) {
      expect(regions.has(key as never)).toBe(true);
    }
  });

  it('every Indian region has at least 8 foods', () => {
    const indian = Object.keys(REGION_LABELS).filter((r) => r !== 'global');
    for (const r of indian) {
      expect(foodsByRegion(r as never).length).toBeGreaterThanOrEqual(8);
    }
  });

  it('total catalog is substantial', () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(120);
  });

  it('FOOD_INDEX mirrors FOODS', () => {
    for (const f of FOODS) {
      expect(FOOD_INDEX[f.id]).toBe(f);
    }
  });

  it('search finds by name and alias, case-insensitive', () => {
    expect(searchFoods('dosa').some((f) => f.id === 'plain_dosa')).toBe(true);
    expect(searchFoods('BIRYANI').some((f) => f.id === 'hyderabadi_biryani')).toBe(true);
    expect(searchFoods('').length).toBeGreaterThan(0);
  });

  it('region label map is exhaustive', () => {
    for (const f of FOODS) {
      expect(REGION_LABELS[f.region]).toBeDefined();
    }
  });
});
