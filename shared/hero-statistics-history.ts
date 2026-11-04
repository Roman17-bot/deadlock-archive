import type { HeroStatRow, HeroStatScope } from './hero-reference';

/** A compact year file for exactly one mode/rank cohort, loaded only when requested. */
export interface HeroStatisticsHistory extends Omit<HeroStatScope, 'days'> {
  schemaVersion: 1;
  clientVersion: number;
  source: 'deadlock-api';
  metric: 'selection-share';
  days: { date: string; rows: string }[];
}
export const HERO_HISTORY_SCOPE_IDS = [
  'normal-all-all',
  'normal-ranked-all',
  'normal-unranked-all',
  ...Array.from({ length: 11 }, (_, i) => `normal-ranked-tier-${i + 1}`),
  'brawl-all',
];
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const time = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
const day = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
function unpack(packed: string): HeroStatRow[] {
  if (!packed) return [];
  if (packed.length > 16000) throw new Error('History day too large');
  const seen = new Set<number>();
  let total = 0;
  const records = packed.split(';');
  if (records.length > 100) throw new Error('Too many heroes');
  return records.map((record) => {
    const fields = record.split(',');
    if (fields.length !== 4 || !fields.every((f) => /^(0|[1-9]\d{0,15})$/.test(f)))
      throw new Error('Invalid history counts');
    const [heroId, wins, losses, matches] = fields.map(Number);
    total += matches;
    if (
      ![heroId, wins, losses, matches, total].every(integer) ||
      heroId === 0 ||
      seen.has(heroId) ||
      wins + losses !== matches
    )
      throw new Error('Inconsistent history counts');
    seen.add(heroId);
    return { heroId, wins, losses, matches };
  });
}
export function validateHeroHistory(value: unknown): value is HeroStatisticsHistory {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    !integer(value.clientVersion) ||
    !value.clientVersion ||
    value.source !== 'deadlock-api' ||
    value.metric !== 'selection-share' ||
    !HERO_HISTORY_SCOPE_IDS.includes(String(value.id)) ||
    !Array.isArray(value.days) ||
    value.days.length > 365
  )
    return false;
  if (![value.from, value.to, value.updatedAt, value.requestedFrom, value.requestedTo].every(time))
    return false;
  const from = Date.parse(value.from as string),
    to = Date.parse(value.to as string);
  if (
    from >= to ||
    to > Date.parse(value.updatedAt as string) ||
    Date.parse(value.requestedFrom as string) >= Date.parse(value.requestedTo as string)
  )
    return false;
  const expectedMode =
    value.id === 'brawl-all'
      ? 'brawl'
      : String(value.id).startsWith('normal-ranked-')
        ? 'ranked'
        : value.id === 'normal-unranked-all'
          ? 'unranked'
          : 'all';
  const tier = /^normal-ranked-tier-(\d+)$/.exec(String(value.id));
  if (
    value.mode !== expectedMode ||
    value.gameMode !== (expectedMode === 'brawl' ? 'street_brawl' : 'normal') ||
    value.rankMin !== (tier ? Number(tier[1]) * 10 + 1 : null) ||
    value.rankMax !== (tier ? Number(tier[1]) * 10 + 6 : null) ||
    !Array.isArray(value.matchModes) ||
    value.matchModes.join(',') !==
      (expectedMode === 'ranked'
        ? 'ranked'
        : expectedMode === 'unranked'
          ? 'unranked'
          : 'ranked,unranked')
  )
    return false;
  const endDay = Date.parse((value.to as string).slice(0, 10)),
    cutoff = endDay - 364 * 86400000;
  let previous = '';
  try {
    for (const entry of value.days) {
      if (
        !object(entry) ||
        !day(entry.date) ||
        entry.date <= previous ||
        Date.parse(entry.date) <
          Math.max(cutoff, Date.parse((value.from as string).slice(0, 10))) ||
        Date.parse(entry.date) > endDay ||
        typeof entry.rows !== 'string'
      )
        return false;
      unpack(entry.rows);
      previous = entry.date;
    }
  } catch {
    return false;
  }
  return true;
}
export function decodeHeroHistory(history: HeroStatisticsHistory): HeroStatScope {
  const {
    schemaVersion: _schema,
    clientVersion: _client,
    source: _source,
    metric: _metric,
    days,
    ...scope
  } = history;
  return {
    ...scope,
    days: days.map((day) => {
      const rows = unpack(day.rows);
      return {
        date: day.date,
        totalSelections: rows.reduce((sum, row) => sum + row.matches, 0),
        rows,
      };
    }),
  };
}
