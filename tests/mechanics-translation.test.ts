import { expect, it } from 'vitest';
import ru from '../data/mechanics.json';
import en from '../data/mechanics.en.json';
import { enData } from '../src/i18n/en-data';
import heroes from './fixtures/6819/heroes.json';

it('preserves every rule and source identity and confidence in the English edition', () => {
  expect(en.formulas.map((f) => f.id)).toEqual(ru.formulas.map((f) => f.id));
  expect(en.sources.map(({ label: _, ...source }) => source)).toEqual(
    ru.sources.map(({ label: _, ...source }) => source),
  );
  expect(en.meta.reviewedClientVersion).toBe(ru.meta.reviewedClientVersion);
  expect(en.meta.gameCommit).toBe(ru.meta.gameCommit);
  expect(en.meta.checkedAt).toBe(ru.meta.checkedAt);
  for (const original of ru.formulas) {
    const translated = en.formulas.find((f) => f.id === original.id)!;
    expect(translated.sourceIds).toEqual(original.sourceIds);
    expect(translated.confidence).toBe(original.confidence);
    for (const key of ['variables', 'explanation', 'caveats'] as const)
      expect(translated[key]).toHaveLength(original[key].length);
  }
  expect(JSON.stringify(en)).not.toMatch(/[А-Яа-яЁё]/);
});

it('provides editorial translations for all current hero notes and methodology paragraphs', () => {
  for (const note of [
    ...heroes.meta.methodology,
    ...heroes.heroes.flatMap((hero) => hero.weapon.notes),
  ]) {
    expect(enData[note], note).toBeTruthy();
    expect(enData[note]).not.toMatch(/[А-Яа-яЁё]/);
  }
});
