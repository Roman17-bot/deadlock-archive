import { expect, it } from 'vitest';
import heroes from '../tests/fixtures/6819/heroes.json';
import catalog from '../data/items.json';
import { validateSnapshot } from './heroes';
import { validateItemCatalog } from './items';
import type { HeroSnapshot } from './types';
import type { ItemCatalog } from './item-types';
import { buildHero, buildRules, bonus } from '../tests/fixtures/hero-build';

it('accepts legacy archives and complete new metadata without changing old stat fields', () => {
  expect(validateSnapshot(heroes)).toBe(true);
  expect(validateItemCatalog(catalog)).toBe(true);
  const enriched: HeroSnapshot = structuredClone(heroes);
  enriched.calculatorRules = structuredClone(buildRules);
  enriched.heroes[0].calculation = buildHero().calculation;
  expect(validateSnapshot(enriched)).toBe(true);
});

it('rejects malformed optional hero metadata and non-monotone investment rules', () => {
  const valid: HeroSnapshot = structuredClone(heroes);
  valid.calculatorRules = structuredClone(buildRules);
  valid.heroes[0].calculation = buildHero().calculation;
  for (const mutate of [
    (value: any) => (value.heroes[0].calculation.bulletResist = Number.NaN),
    (value: any) => delete value.heroes[0].calculation.staminaRegen,
    (value: any) => (value.calculatorRules.maxSlots = -1),
    (value: any) => (value.calculatorRules.maxActiveItems = 13),
    (value: any) => (value.calculatorRules.investment.weapon[2].souls = 0),
    (value: any) => (value.calculatorRules.investment.vitality = []),
  ]) {
    const malformed = structuredClone(valid);
    mutate(malformed);
    expect(validateSnapshot(malformed)).toBe(false);
  }
});

it('rejects invalid normalized item stats instead of treating unknown effects as self bonuses', () => {
  const valid = structuredClone(catalog) as ItemCatalog;
  valid.items[0].calculation = { modifiers: [bonus('health', 210)] };
  expect(validateItemCatalog(valid)).toBe(true);
  for (const mutate of [
    (value: any) => (value.stat = 'enemyHealth'),
    (value: any) => (value.scope = 'allTargets'),
    (value: any) => (value.value = Number.POSITIVE_INFINITY),
    (value: any) => (value.spiritScale = '2'),
  ]) {
    const malformed = structuredClone(valid);
    mutate(malformed.items[0].calculation!.modifiers[0]);
    expect(validateItemCatalog(malformed)).toBe(false);
  }
});

it('returns false for null or primitive catalogue rows instead of throwing', () => {
  for (const row of [null, 42, 'item'])
    expect(
      validateItemCatalog({ ...catalog, meta: { ...catalog.meta, itemCount: 1 }, items: [row] }),
    ).toBe(false);
});
