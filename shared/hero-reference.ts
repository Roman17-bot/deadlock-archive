import type { LocalizedText } from './item-types';

export interface HeroVideo {
  abilityId: number | 'weapon';
  url: string;
  poster: string;
  title: LocalizedText;
  sourceUrl: string;
  checkedAt: string;
  clientVersion: number | null;
  startSeconds: number;
  endSeconds: number;
}
export interface HeroProfile {
  heroId: number;
  reviewedClientVersion?: number | null;
  slug: string;
  art: { background: string; card: string };
  summary: LocalizedText;
  lore: LocalizedText;
  relationships: { heroId: number; description: LocalizedText }[];
  tips: LocalizedText[];
  videos: HeroVideo[];
}
export interface HeroProfiles {
  schemaVersion: 1;
  clientVersion: number;
  updatedAt: string;
  heroes: HeroProfile[];
}
export interface HeroStatRow {
  heroId: number;
  wins: number;
  losses: number;
  matches: number;
}
export interface HeroStatDay {
  date: string;
  totalSelections: number;
  rows: HeroStatRow[];
}
export interface HeroStatScope {
  id: string;
  mode: 'all' | 'ranked' | 'unranked' | 'brawl';
  gameMode: 'normal' | 'street_brawl';
  matchModes: string[];
  rankMin: number | null;
  rankMax: number | null;
  updatedAt: string;
  from: string;
  to: string;
  requestedFrom: string;
  requestedTo: string;
  days: HeroStatDay[];
}
export interface PairCohort {
  from: string;
  to: string;
  updatedAt: string;
  sameLane: false;
  minMatches: number;
}
export interface HeroStatistics {
  schemaVersion: 1;
  clientVersion: number;
  sourceClientVersion: null;
  updatedAt: string;
  from: string;
  to: string;
  source: 'deadlock-api';
  timeResolutionSeconds: 3600;
  metric: 'selection-share';
  periods: number[];
  scopes: HeroStatScope[];
  matchups: PairCohort & {
    rows: { heroId: number; enemyHeroId: number; wins: number; matches: number }[];
  };
  synergies: PairCohort & {
    rows: { heroId1: number; heroId2: number; wins: number; matches: number }[];
  };
}

const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const positive = (v: unknown): v is number => integer(v) && v > 0;
const date = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && Number.isFinite(Date.parse(v));
const localized = (v: unknown): v is LocalizedText =>
  record(v) && typeof v.ru === 'string' && typeof v.en === 'string';
const array = <T>(v: unknown, predicate: (x: unknown) => x is T): v is T[] =>
  Array.isArray(v) && v.length < 100_000 && v.every(predicate);
const unique = <T>(rows: T[], key: (x: T) => string | number) =>
  new Set(rows.map(key)).size === rows.length;
export const safeMedia = (v: unknown): v is string =>
  typeof v === 'string' &&
  ((/^(?:images|portraits|media)\/[a-zA-Z0-9_./-]+$/.test(v) && !v.includes('..')) ||
    /^https:\/\/assets-bucket\.deadlock-api\.com\/[a-zA-Z0-9_./%-]+$/.test(v));
function video(v: unknown): v is HeroVideo {
  return (
    record(v) &&
    (v.abilityId === 'weapon' || positive(v.abilityId)) &&
    safeMedia(v.url) &&
    safeMedia(v.poster) &&
    localized(v.title) &&
    typeof v.sourceUrl === 'string' &&
    v.sourceUrl.startsWith('https://') &&
    date(v.checkedAt) &&
    (v.clientVersion === null || positive(v.clientVersion)) &&
    typeof v.startSeconds === 'number' &&
    v.startSeconds >= 0 &&
    Number.isFinite(v.startSeconds) &&
    typeof v.endSeconds === 'number' &&
    Number.isFinite(v.endSeconds) &&
    v.endSeconds > v.startSeconds
  );
}
export function validateHeroProfiles(v: unknown): v is HeroProfiles {
  if (!record(v) || v.schemaVersion !== 1 || !positive(v.clientVersion) || !date(v.updatedAt))
    return false;
  return (
    array(
      v.heroes,
      (h): h is HeroProfile =>
        record(h) &&
        positive(h.heroId) &&
        typeof h.slug === 'string' &&
        /^[a-z0-9-]+$/.test(h.slug) &&
        record(h.art) &&
        safeMedia(h.art.background) &&
        safeMedia(h.art.card) &&
        localized(h.summary) &&
        localized(h.lore) &&
        array(h.tips, localized) &&
        array(h.videos, video) &&
        array(
          h.relationships,
          (r): r is HeroProfile['relationships'][number] =>
            record(r) && positive(r.heroId) && localized(r.description),
        ),
    ) &&
    unique(v.heroes, (h) => h.heroId) &&
    unique(v.heroes, (h) => h.slug)
  );
}
function statRow(v: unknown): v is HeroStatRow {
  return (
    record(v) &&
    positive(v.heroId) &&
    integer(v.wins) &&
    integer(v.losses) &&
    integer(v.matches) &&
    v.wins + v.losses <= v.matches
  );
}
function day(v: unknown): v is HeroStatDay {
  return (
    record(v) &&
    date(v.date) &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
    integer(v.totalSelections) &&
    array(v.rows, statRow) &&
    unique(v.rows, (r) => r.heroId) &&
    v.rows.reduce((sum, r) => sum + r.matches, 0) === v.totalSelections
  );
}
function scope(v: unknown): v is HeroStatScope {
  return (
    record(v) &&
    typeof v.id === 'string' &&
    ['all', 'ranked', 'unranked', 'brawl'].includes(String(v.mode)) &&
    ['normal', 'street_brawl'].includes(String(v.gameMode)) &&
    Array.isArray(v.matchModes) &&
    v.matchModes.every((m) => typeof m === 'string') &&
    (v.rankMin === null || integer(v.rankMin)) &&
    (v.rankMax === null || integer(v.rankMax)) &&
    date(v.updatedAt) &&
    date(v.from) &&
    date(v.to) &&
    date(v.requestedFrom) &&
    date(v.requestedTo) &&
    array(v.days, day) &&
    unique(v.days, (d) => d.date)
  );
}
function cohort(v: unknown): v is PairCohort & { rows: unknown[] } {
  return (
    record(v) &&
    date(v.from) &&
    date(v.to) &&
    date(v.updatedAt) &&
    v.sameLane === false &&
    integer(v.minMatches) &&
    Array.isArray(v.rows)
  );
}
export function validateHeroStatistics(v: unknown): v is HeroStatistics {
  if (
    !record(v) ||
    v.schemaVersion !== 1 ||
    !positive(v.clientVersion) ||
    v.sourceClientVersion !== null ||
    !date(v.updatedAt) ||
    !date(v.from) ||
    !date(v.to) ||
    v.source !== 'deadlock-api' ||
    v.timeResolutionSeconds !== 3600 ||
    v.metric !== 'selection-share' ||
    !array(v.periods, positive) ||
    !array(v.scopes, scope) ||
    !unique(v.scopes, (s) => s.id) ||
    !cohort(v.matchups) ||
    !cohort(v.synergies)
  )
    return false;
  const pairs = (p: unknown, left: string, right: string) =>
    record(p) &&
    positive(p[left]) &&
    positive(p[right]) &&
    p[left] !== p[right] &&
    integer(p.wins) &&
    integer(p.matches) &&
    p.wins <= p.matches;
  return (
    v.matchups.rows.every((p) => pairs(p, 'heroId', 'enemyHeroId')) &&
    v.synergies.rows.every((p) => pairs(p, 'heroId1', 'heroId2'))
  );
}

/** Calendar windows anchored to the saved cohort, never the reader's wall clock. */
export function windowDays(scope: HeroStatScope, count: number): HeroStatDay[] {
  if (!scope.days.length || !Number.isInteger(count) || count < 1) return [];
  const end = Date.parse(`${scope.to.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(end)) return [];
  const start = end - (count - 1) * 86_400_000;
  return scope.days
    .filter((d) => {
      const time = Date.parse(`${d.date}T00:00:00Z`);
      return time >= start && time <= end;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function aggregateHeroStats(days: readonly HeroStatDay[]) {
  const result = new Map<number, HeroStatRow>();
  let totalSelections = 0;
  for (const day of days) {
    totalSelections += day.totalSelections;
    for (const row of day.rows) {
      const previous = result.get(row.heroId) ?? {
        heroId: row.heroId,
        matches: 0,
        wins: 0,
        losses: 0,
      };
      result.set(row.heroId, {
        heroId: row.heroId,
        matches: previous.matches + row.matches,
        wins: previous.wins + row.wins,
        losses: previous.losses + row.losses,
      });
    }
  }
  return [...result.values()].map((row) => ({
    ...row,
    winRate: row.matches ? (row.wins / row.matches) * 100 : null,
    selectionShare: totalSelections ? (row.matches / totalSelections) * 100 : null,
  }));
}
export function heroHistory(
  days: readonly HeroStatDay[],
  heroId: number,
  metric: 'winRate' | 'selectionShare',
) {
  return [...days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => {
      const row = day.rows.find((r) => r.heroId === heroId);
      return {
        date: day.date,
        matches: row?.matches ?? 0,
        value: !row?.matches
          ? null
          : metric === 'winRate'
            ? (row.wins / row.matches) * 100
            : day.totalSelections
              ? (row.matches / day.totalSelections) * 100
              : null,
      };
    });
}
