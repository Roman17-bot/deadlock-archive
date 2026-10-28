import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { validateSnapshot } from '../../shared/heroes';
import { validateVersionHistory } from '../../shared/version-history';
import type { CuratedBundle, MechanicsCatalog } from '../../shared/database-types';
import { validateItemCatalog, validateItemStatistics } from '../../shared/items';

const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const https = (value: unknown): boolean => {
  if (!text(value)) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};
const timestamp = (value: unknown): boolean =>
  text(value) &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));

function validateCatalog(value: unknown): asserts value is MechanicsCatalog {
  if (!value || typeof value !== 'object') throw new Error('Invalid mechanics catalogue');
  const catalog = value as MechanicsCatalog;
  const meta = catalog.meta;
  if (
    !meta ||
    meta.schemaVersion !== 1 ||
    !Number.isSafeInteger(meta.reviewedClientVersion) ||
    meta.reviewedClientVersion < 1 ||
    !Number.isSafeInteger(meta.sourceRevision) ||
    meta.sourceRevision < 1 ||
    !/^[a-f0-9]{40}$/.test(meta.gameCommit) ||
    !timestamp(meta.checkedAt) ||
    !text(meta.title) ||
    !text(meta.policy) ||
    !Array.isArray(catalog.sources) ||
    !catalog.sources.length ||
    !Array.isArray(catalog.formulas) ||
    !catalog.formulas.length
  )
    throw new Error('Invalid mechanics catalogue metadata');
  const ids = new Set<string>();
  for (const source of catalog.sources) {
    if (
      !source ||
      !text(source.id) ||
      ids.has(source.id) ||
      !text(source.label) ||
      !https(source.url) ||
      !['raw', 'community', 'official'].includes(source.kind)
    )
      throw new Error('Invalid or duplicate mechanics source');
    ids.add(source.id);
  }
  const formulas = new Set<string>();
  for (const formula of catalog.formulas) {
    if (
      !formula ||
      !text(formula.id) ||
      formulas.has(formula.id) ||
      !text(formula.category) ||
      !text(formula.title) ||
      !text(formula.expression) ||
      !strings(formula.variables) ||
      !strings(formula.explanation) ||
      !formula.explanation.length ||
      !text(formula.example) ||
      !strings(formula.caveats) ||
      !strings(formula.sourceIds) ||
      !formula.sourceIds.length ||
      formula.sourceIds.some((id) => !ids.has(id)) ||
      !text(formula.confidence)
    )
      throw new Error('Invalid formula or missing source evidence');
    formulas.add(formula.id);
  }
}

export function validateCuratedBundle(input: unknown): asserts input is CuratedBundle {
  if (!input || typeof input !== 'object') throw new Error('Invalid curated bundle');
  const bundle = input as CuratedBundle;
  if ((bundle.items === undefined) !== (bundle.itemStatistics === undefined))
    throw new Error('Items and item statistics must be supplied together');
  if (
    bundle.items !== undefined &&
    (!validateItemCatalog(bundle.items) ||
      !validateItemStatistics(bundle.itemStatistics, bundle.items) ||
      bundle.items.meta.clientVersion !== bundle.heroes?.meta.clientVersion ||
      bundle.itemStatistics?.meta.clientVersion !== bundle.items.meta.clientVersion)
  )
    throw new Error('Invalid items or item statistics metadata');
  if (!validateSnapshot(bundle.heroes)) throw new Error('Invalid hero snapshot');
  if (!bundle.mechanics) throw new Error('Missing mechanics catalogues');
  validateCatalog(bundle.mechanics.ru);
  validateCatalog(bundle.mechanics.en);
  const ru = bundle.mechanics.ru;
  const en = bundle.mechanics.en;
  for (const key of ['reviewedClientVersion', 'sourceRevision', 'gameCommit', 'checkedAt'] as const)
    if (ru.meta[key] !== en.meta[key]) throw new Error('Mechanics language metadata mismatch');
  if (
    ru.meta.reviewedClientVersion > bundle.heroes.meta.clientVersion ||
    (ru.meta.reviewedClientVersion === bundle.heroes.meta.clientVersion &&
      (ru.meta.sourceRevision !== bundle.heroes.meta.sourceRevision ||
        ru.meta.gameCommit !== bundle.heroes.meta.gameCommit))
  )
    throw new Error('Mechanics and hero metadata mismatch');
  if (
    !isDeepStrictEqual(
      ru.sources.map((s) => [s.id, s.url, s.kind]),
      en.sources.map((s) => [s.id, s.url, s.kind]),
    )
  )
    throw new Error('Mechanics source languages mismatch');
  if (
    !isDeepStrictEqual(
      ru.formulas.map((f) => [
        f.id,
        f.sourceIds,
        f.confidence,
        f.variables.length,
        f.explanation.length,
        f.caveats.length,
      ]),
      en.formulas.map((f) => [
        f.id,
        f.sourceIds,
        f.confidence,
        f.variables.length,
        f.explanation.length,
        f.caveats.length,
      ]),
    )
  )
    throw new Error('Mechanics formula languages or source evidence mismatch');
  if (
    !validateVersionHistory(bundle.history) ||
    !bundle.history.versions.some(
      (v) =>
        v.clientVersion === bundle.heroes.meta.clientVersion &&
        v.buildDate === bundle.heroes.meta.buildDate,
    )
  )
    throw new Error('Invalid or incomplete version history');
  if (!bundle.provenance || typeof bundle.provenance !== 'object')
    throw new Error('Invalid provenance');
  const provenance = bundle.provenance as { meta?: unknown };
  if (!isDeepStrictEqual(provenance.meta, bundle.heroes.meta))
    throw new Error('Provenance metadata mismatch');
}

export async function readCuratedBundle(root: string): Promise<CuratedBundle> {
  const read = async (name: string) =>
    JSON.parse(await readFile(path.join(root, 'data', name), 'utf8')) as unknown;
  const [heroes, ru, en, provenance, history] = await Promise.all([
    read('heroes.json'),
    read('mechanics.json'),
    read('mechanics.en.json'),
    read('provenance.json'),
    read('version-history.json'),
  ]);
  const optional = async (name: string) => {
    try {
      return await read(name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  };
  const [items, itemStatistics] = await Promise.all([
    optional('items.json'),
    optional('item-statistics.json'),
  ]);
  const bundle = {
    heroes,
    mechanics: { ru, en },
    provenance,
    history,
    ...(items === undefined ? {} : { items }),
    ...(itemStatistics === undefined ? {} : { itemStatistics }),
  };
  validateCuratedBundle(bundle);
  return bundle;
}
