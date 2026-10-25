import { readFile, access } from 'node:fs/promises';
import { validateSnapshot, statsAtLevel } from '../shared/heroes.ts';
import { validateVersionHistory } from '../shared/version-history.ts';
import { isDeepStrictEqual } from 'node:util';

const snapshot = JSON.parse(
  await readFile(new URL('../data/heroes.json', import.meta.url), 'utf8'),
);
if (!validateSnapshot(snapshot)) throw new Error('Invalid hero snapshot');
const history = JSON.parse(
  await readFile(new URL('../data/version-history.json', import.meta.url), 'utf8'),
);
if (
  !validateVersionHistory(history) ||
  !history.versions.some(
    (entry) =>
      entry.clientVersion === snapshot.meta.clientVersion &&
      entry.buildDate === snapshot.meta.buildDate,
  )
)
  throw new Error('Invalid or incomplete version history');
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
const english = JSON.parse(
  await readFile(new URL('../data/mechanics.en.json', import.meta.url), 'utf8'),
);
if (
  english.meta.reviewedClientVersion !== mechanics.meta.reviewedClientVersion ||
  english.meta.sourceRevision !== mechanics.meta.sourceRevision ||
  english.meta.gameCommit !== mechanics.meta.gameCommit ||
  english.meta.checkedAt !== mechanics.meta.checkedAt ||
  !isDeepStrictEqual(
    english.formulas.map((f) => f.id),
    mechanics.formulas.map((f) => f.id),
  ) ||
  !isDeepStrictEqual(
    english.sources.map(({ label: _, ...source }) => source),
    mechanics.sources.map(({ label: _, ...source }) => source),
  ) ||
  english.formulas.some(
    (f, index) =>
      f.confidence !== mechanics.formulas[index].confidence ||
      !isDeepStrictEqual(f.sourceIds, mechanics.formulas[index].sourceIds) ||
      ['variables', 'explanation', 'caveats'].some(
        (key) => f[key].length !== mechanics.formulas[index][key].length,
      ),
  ) ||
  /[А-Яа-яЁё]/.test(JSON.stringify(english))
)
  throw new Error('English mechanics translation is missing or out of sync');
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
