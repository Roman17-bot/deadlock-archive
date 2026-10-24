import { describe, expect, it } from 'vitest';
import snapshot from '../data/heroes.json';
import { statsAtLevel, selectHeroes, validateSnapshot, toCsv } from './heroes';
import type { HeroSnapshot } from './types';

const data = snapshot as HeroSnapshot;
const named = (name: string) => data.heroes.find((hero) => hero.name === name)!;

describe('verified hero data', () => {
  it('contains 44 unique playable heroes including both new releases', () => {
    expect(validateSnapshot(data)).toBe(true);
    expect(data.heroes).toHaveLength(44);
    expect(new Set(data.heroes.map((hero) => hero.id)).size).toBe(44);
    expect(named('Nurse Harrow').base.health).toBe(730);
    expect(named('Nurse Harrow').base.regen).toBe(0);
    expect(named('Violet').base.health).toBe(710);
    expect(data.heroes.some((hero) => hero.name === 'Baba')).toBe(true);
  });
  it('rejects a broken snapshot rather than treating missing stats as zero', () => {
    const bad = structuredClone(data);
    bad.heroes[0].base.health = Number.NaN;
    expect(validateSnapshot(bad)).toBe(false);
  });
});

describe('level comparisons without items', () => {
  it('uses zero Boons at level 1 and 35 at level 36', () => {
    const nurse = named('Nurse Harrow');
    expect(statsAtLevel(nurse, 1).health).toBe(730);
    expect(statsAtLevel(nurse, 36).health).toBe(730 + 35 * 32);
    expect(statsAtLevel(nurse, 36).spirit).toBeCloseTo(38.5);
  });
  it('uses each hero individual Spirit growth', () => {
    expect(statsAtLevel(named('Haze'), 11).spirit).toBeCloseTo(5);
    expect(statsAtLevel(named('Grey Talon'), 11).spirit).toBeCloseTo(16);
  });
  it('includes natural Spirit weapon scaling exactly once', () => {
    const solomon = statsAtLevel(named('Solomon'), 11);
    expect(solomon.shotDamage).toBeCloseTo(30 + 10 * 0.4 + 11 * 0.14);
    expect(statsAtLevel(named('Victor'), 11).regen).toBeCloseTo(1.5 + 11 * 0.08);
  });
  it('rejects fractional and out-of-range levels', () => {
    for (const level of [0, 37, 1.5, Number.NaN]) {
      expect(() => statsAtLevel(named('Nurse Harrow'), level)).toThrow();
    }
  });
  it('uses Warden rounds-per-second Spirit scaling without a second fire-rate bonus', () => {
    const stats = statsAtLevel(named('Warden'), 11);
    expect(stats.dps).toBeCloseTo((17.34 + 10 * 0.25) * (1 / 0.2625 + 11 * 0.008), 8);
  });
});

describe('register filters and sorting', () => {
  it('searches names and Russian aliases without case sensitivity', () => {
    expect(selectHeroes(data.heroes, '  HARROW ', 'name', 'asc', 1).map((h) => h.name)).toEqual([
      'Nurse Harrow',
    ]);
    expect(selectHeroes(data.heroes, 'харроу', 'name', 'asc', 1).map((h) => h.name)).toEqual([
      'Nurse Harrow',
    ]);
    expect(selectHeroes(data.heroes, 'no-such-hero', 'health', 'asc', 1)).toEqual([]);
  });
  it('sorts all stats numerically in both directions and does not mutate input', () => {
    const keys = [
      'health',
      'spirit',
      'regen',
      'shotDamage',
      'bulletDamage',
      'dps',
      'damageGrowth',
      'healthGrowth',
      'spiritGrowth',
      'regenGrowth',
    ] as const;
    const before = data.heroes.map((h) => h.id);
    for (const key of keys) {
      const asc = selectHeroes(data.heroes, '', key, 'asc', 12).map(
        (h) => statsAtLevel(h, 12)[key],
      );
      const desc = selectHeroes(data.heroes, '', key, 'desc', 12).map(
        (h) => statsAtLevel(h, 12)[key],
      );
      expect(asc).toEqual([...asc].sort((a, b) => a - b));
      expect(desc).toEqual([...desc].sort((a, b) => b - a));
    }
    expect(data.heroes.map((h) => h.id)).toEqual(before);
  });
  it('exports machine-readable numbers and an explicit level in CSV', () => {
    const csv = toCsv([named('Nurse Harrow')], 1);
    expect(csv).toContain('Nurse Harrow');
    expect(csv).toContain('730');
    expect(csv).toContain('Level');
  });
});
