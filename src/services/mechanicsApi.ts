import ru from '../../data/mechanics.json';
import en from '../../data/mechanics.en.json';
import type { MechanicsCatalog } from '../../shared/database-types';
import { readJson } from './http';

export type Catalogs = { ru: MechanicsCatalog; en: MechanicsCatalog };
export const bundledMechanics: Catalogs = {
  ru: ru as MechanicsCatalog,
  en: en as MechanicsCatalog,
};
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
function isCatalog(value: unknown): value is MechanicsCatalog {
  if (!value || typeof value !== 'object') return false;
  const c = value as MechanicsCatalog;
  if (
    c.meta?.schemaVersion !== 1 ||
    !Number.isSafeInteger(c.meta.reviewedClientVersion) ||
    c.meta.reviewedClientVersion < 1 ||
    !Number.isFinite(Date.parse(c.meta.checkedAt)) ||
    !Array.isArray(c.formulas) ||
    !c.formulas.length ||
    !Array.isArray(c.sources) ||
    !c.sources.length
  )
    return false;
  const ids = new Set(c.sources.map((s) => s?.id));
  if (
    ids.size !== c.sources.length ||
    c.sources.some(
      (s) =>
        !s ||
        !text(s.id) ||
        !text(s.label) ||
        !/^https:\/\//.test(s.url) ||
        !['raw', 'community', 'official'].includes(s.kind),
    )
  )
    return false;
  return (
    new Set(c.formulas.map((f) => f?.id)).size === c.formulas.length &&
    c.formulas.every(
      (f) =>
        f &&
        text(f.id) &&
        text(f.title) &&
        text(f.category) &&
        text(f.expression) &&
        strings(f.variables) &&
        strings(f.explanation) &&
        f.explanation.length > 0 &&
        text(f.example) &&
        strings(f.caveats) &&
        strings(f.sourceIds) &&
        f.sourceIds.length > 0 &&
        f.sourceIds.every((id) => ids.has(id)) &&
        ['math_identity', 'config_confirmed', 'community_documented', 'inferred'].includes(
          f.confidence,
        ),
    )
  );
}
function isPair(ru: unknown, en: unknown): ru is MechanicsCatalog {
  if (!isCatalog(ru) || !isCatalog(en)) return false;
  return (
    ['reviewedClientVersion', 'sourceRevision', 'gameCommit', 'checkedAt'].every(
      (key) =>
        ru.meta[key as keyof MechanicsCatalog['meta']] ===
        en.meta[key as keyof MechanicsCatalog['meta']],
    ) &&
    JSON.stringify(ru.formulas.map((f) => [f.id, f.sourceIds, f.confidence])) ===
      JSON.stringify(en.formulas.map((f) => [f.id, f.sourceIds, f.confidence])) &&
    JSON.stringify(ru.sources.map((s) => [s.id, s.url, s.kind])) ===
      JSON.stringify(en.sources.map((s) => [s.id, s.url, s.kind]))
  );
}

export async function loadMechanicsCatalogs(signal: AbortSignal): Promise<Catalogs> {
  const load = (language: 'ru' | 'en') =>
    readJson(`/api/mechanics?language=${language}`, {
      cache: 'no-store',
      signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
    });
  const [ru, en] = await Promise.all([load('ru'), load('en')]);
  if (!isPair(ru, en)) throw new Error('Invalid bilingual mechanics');
  return { ru, en: en as MechanicsCatalog };
}
