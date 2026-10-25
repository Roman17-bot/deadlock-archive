import { readFile, access } from 'node:fs/promises';
import { validateSnapshot, statsAtLevel } from '../shared/heroes.ts';

const snapshot = JSON.parse(
  await readFile(new URL('../data/heroes.json', import.meta.url), 'utf8'),
);
if (!validateSnapshot(snapshot)) throw new Error('Invalid hero snapshot');
const mechanics = JSON.parse(
  await readFile(new URL('../data/mechanics.json', import.meta.url), 'utf8'),
);
if (
  !Number.isSafeInteger(mechanics.meta.reviewedClientVersion) ||
  !Array.isArray(mechanics.sources) ||
  !Array.isArray(mechanics.formulas) ||
  !mechanics.formulas.length
)
  throw new Error('Invalid mechanics catalogue');
const sources = new Set(mechanics.sources.map((source) => source.id));
if (
  sources.size !== mechanics.sources.length ||
  mechanics.sources.some((source) => !source.label || new URL(source.url).protocol !== 'https:')
)
  throw new Error('Invalid or duplicate mechanics source');
if (
  new Set(mechanics.formulas.map((formula) => formula.id)).size !== mechanics.formulas.length ||
  mechanics.formulas.some(
    (formula) =>
      !formula.title ||
      !formula.expression ||
      !formula.explanation.length ||
      !formula.sourceIds.length ||
      formula.sourceIds.some((id) => !sources.has(id)),
  )
)
  throw new Error('Invalid formula or missing evidence');
await Promise.all(
  snapshot.heroes.map((hero) => access(new URL('../public/' + hero.portrait, import.meta.url))),
);
const nurse = snapshot.heroes.find((h) => h.name === 'Nurse Harrow');
if (nurse && nurse.base.regen !== 0 && snapshot.meta.clientVersion === 6819)
  throw new Error('Unexpected Nurse base regen for6819');
for (const hero of snapshot.heroes)
  for (const level of [1, 2, 36])
    if (!Object.values(statsAtLevel(hero, level)).every(Number.isFinite))
      throw new Error(`Non-finite stats: ${hero.name}`);
console.log(
  `Valid: ${snapshot.heroes.length} unique heroes, client ${snapshot.meta.clientVersion}, all portraits and level1/2/36 values.`,
);
