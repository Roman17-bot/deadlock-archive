import { describe, expect, it } from 'vitest';
import {
  parseNumber,
  parsePercentList,
  diminishing,
  calculateDefense,
  mixedEffectiveHealth,
  calculateHealing,
  calculateLifesteal,
  calculateDuration,
  calculateCooldown,
  calculateMaxHealth,
  headshotMultiplier,
  calculateDamage,
  calculateSlow,
  calculateFalloff,
  calculateFireRate,
} from './mechanics';
import snapshot from '../tests/fixtures/6819/heroes.json';
import { statsAtLevel } from './heroes';
import type { Hero } from './types';

describe('mechanics input', () => {
  it('accepts a decimal comma while keeping separate percentage sources unambiguous', () => {
    expect(parseNumber(' 30,5 ', 'HP')).toBe(30.5);
    expect(parsePercentList('30,5; 20')).toEqual([30.5, 20]);
    expect(parsePercentList('')).toEqual([]);
  });
  it.each(['', ' ', 'NaN', 'Infinity', '1e309', '10abc', '1,2,3', '0x10'])(
    'does not silently coerce an invalid number %j',
    (value) => expect(() => parseNumber(value, 'HP')).toThrow(),
  );
  it('rejects empty list members, negative resist sources and non-finite arithmetic', () => {
    expect(() => parsePercentList('30;;20')).toThrow();
    expect(() => diminishing([-15])).toThrow();
    expect(() =>
      calculateDefense({ health: Infinity, damage: 1, resists: [], shred: [] }),
    ).toThrow();
  });
});

describe('damage, protection and healing', () => {
  it('keeps the positive and negative resistance pools separate', () => {
    expect(diminishing([30, 20])).toBeCloseTo(44);
    const result = calculateDefense({
      health: 1000,
      damage: 1000,
      resists: [40, 20],
      shred: [25, 20],
    });
    expect(result.resistance).toBeCloseTo(12);
    expect(result.damageTaken).toBeCloseTo(880);
    expect(result.ehp).toBeCloseTo(1136.36363636);
    const pocket = calculateDefense({ health: 1000, damage: 100, resists: [30], shred: [15] });
    expect(pocket.resistance).toBeCloseTo(15);
    expect(pocket.damageTaken).toBeCloseTo(85);
  });
  it('reports effective rather than added real HP and supports negative resistances', () => {
    const result = calculateDefense({ health: 1000, damage: 1000, resists: [30, 20], shred: [] });
    expect(result.health).toBe(1000);
    expect(result.ehp).toBeCloseTo(1785.7142857);
    expect(result.extraEhp).toBeCloseTo(785.7142857);
    expect(
      calculateDefense({ health: 1000, damage: 100, resists: [], shred: [15] }).ehp,
    ).toBeCloseTo(869.56521739);
    expect(() =>
      calculateDefense({ health: 1000, damage: 1, resists: [100], shred: [] }),
    ).toThrow();
  });
  it('weights mixed incoming damage without adding EHP of the two types', () => {
    expect(mixedEffectiveHealth(2000, [60, 40, 0], [40, 20])).toBeCloseTo(2941.176470588);
    expect(() => mixedEffectiveHealth(2000, [70, 40, 0], [40, 20])).toThrow();
  });
  it('scales the headshot bonus rather than the entire critical hit', () => {
    expect(headshotMultiplier(1.65, 0.7, 1)).toBeCloseTo(1.455);
    expect(headshotMultiplier(1.65, 0.7, 0.45)).toBeCloseTo(1.20475);
    expect(headshotMultiplier(1.35, 1, 1)).toBeCloseTo(1.35);
  });
  it('applies typed amp stages and flat damage on its specified stage', () => {
    expect(
      calculateDamage({
        base: 100,
        weaponBonus: 50,
        additiveAmp: -10,
        flat: 10,
        multipliers: [25],
        falloff: 100,
        crit: 1,
        resistance: 20,
      }),
    ).toBeCloseTo(145);
  });
  it('uses different antiheal families once and caps actual healing at missing HP', () => {
    const r = calculateHealing({
      base: 200,
      outgoing: 20,
      receiving: 0,
      reductions: [35, 35],
      missing: 1000,
    });
    expect(r.potential).toBeCloseTo(101.4);
    expect(r.reduction).toBeCloseTo(57.75);
    expect(
      calculateHealing({ base: 250, outgoing: 20, receiving: 0, reductions: [35], missing: 100 })
        .actual,
    ).toBe(100);
    expect(
      calculateHealing({ base: 250, outgoing: 0, receiving: 0, reductions: [100], missing: 100 })
        .actual,
    ).toBe(0);
  });
  it('exposes both unresolved lifesteal amplification orders with literal independent results', () => {
    const r = calculateLifesteal({
      damage: 200,
      sources: [13, 28],
      amp: 20,
      reductions: [],
      targetFactor: 1,
      heroFactor: 1,
      missing: 1000,
    });
    expect(r.rate).toBeCloseTo(37.36);
    expect(r.afterPooling).toBeCloseTo(89.664);
    expect(r.beforePooling).toBeCloseTo(87.9168);
  });
});

describe('time, movement and ordinary HP models', () => {
  it('uses separate extension and resistance layers, and the correct CDR timer inputs', () => {
    expect(calculateDuration(4, [20], [25]).seconds).toBeCloseTo(3.6);
    expect(calculateDuration(10, [28, 15], []).seconds).toBeCloseTo(13.88);
    expect(calculateCooldown(60, [20, 5]).seconds).toBeCloseTo(45.6);
    expect(() => calculateCooldown(60, [100])).toThrow();
  });
  it('does not apply base-health amplification to flat item health', () => {
    expect(calculateMaxHealth({ base: 800, boons: 10, growth: 49, baseBonus: 20, flat: 210 })).toBe(
      1758,
    );
  });
  it('models ordinary slows above the stated floor and rejects unsupported resistance', () => {
    expect(calculateSlow(10, [30, 25], [25, 35]).speed).toBeCloseTo(8.48);
    expect(() => calculateSlow(10, [20], [70, 40])).toThrow();
  });
  it('interpolates the stated neutral-bias falloff and validates its endpoints', () => {
    expect(calculateFalloff(945, 590, 1300, 100, 10)).toBeCloseTo(55);
    expect(calculateFalloff(10, 20, 20, 100, 100)).toBe(100);
    expect(() => calculateFalloff(10, 20, 10, 100, 10)).toThrow();
  });
  it('keeps the asymmetrical negative fire-rate model explicit', () => {
    expect(calculateFireRate(10, [20, 30], []).rate).toBeCloseTo(15);
    expect(calculateFireRate(10, [38], [25, 28]).rate).toBeCloseTo(9.259259259);
  });
});

it('does not triple hit-once Baba and Drifter while preserving ordinary shotgun pellets', () => {
  const hero = (name: string) => snapshot.heroes.find((h) => h.name === name) as Hero;
  expect(statsAtLevel(hero('Baba'), 1).shotDamage).toBe(8.8);
  expect(statsAtLevel(hero('Baba'), 1).dps).toBeCloseTo(28.38709677);
  expect(statsAtLevel(hero('Drifter'), 1).shotDamage).toBe(19.5);
  expect(statsAtLevel(hero('Drifter'), 1).damageGrowth).toBeCloseTo(0.49);
  expect(statsAtLevel(hero('Rat King'), 1).shotDamage).toBe(12);
  expect(statsAtLevel(hero('Abrams'), 1).shotDamage).toBeCloseTo(32.4);
});
