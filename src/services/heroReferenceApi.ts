import { validateHeroProfiles, validateHeroStatistics } from '../../shared/hero-reference';
import type { HeroProfiles, HeroStatistics } from '../../shared/hero-reference';
import { asset } from '../lib/format';
import { jsonResource } from './jsonResource';
import {
  decodeHeroHistory,
  validateHeroHistory,
  HERO_HISTORY_SCOPE_IDS,
  type HeroStatisticsHistory,
} from '../../shared/hero-statistics-history';

const profiles = jsonResource<HeroProfiles>(
  import.meta.env.DEV ? '/api/hero-profiles' : asset('data/hero-profiles.json'),
  validateHeroProfiles,
);
const statistics = jsonResource<HeroStatistics>(
  import.meta.env.DEV ? '/api/hero-statistics' : asset('data/hero-statistics.json'),
  validateHeroStatistics,
);
export function loadHeroProfiles(signal: AbortSignal, force = false) {
  if (force) profiles.clear();
  return profiles.read(signal);
}
export function loadHeroStatistics(signal: AbortSignal, force = false) {
  if (force) statistics.clear();
  return statistics.read(signal);
}
const histories = new Map<string, ReturnType<typeof jsonResource<HeroStatisticsHistory>>>();
export async function loadHeroHistory(scopeId: string, signal: AbortSignal, force = false) {
  if (!HERO_HISTORY_SCOPE_IDS.includes(scopeId)) throw new Error('Invalid statistics scope');
  let resource = histories.get(scopeId);
  if (!resource) {
    resource = jsonResource<HeroStatisticsHistory>(
      import.meta.env.DEV
        ? `/api/hero-history/${scopeId}`
        : asset(`data/hero-history-${scopeId}.json`),
      (value): value is HeroStatisticsHistory => validateHeroHistory(value) && value.id === scopeId,
    );
    histories.set(scopeId, resource);
  }
  if (force) resource.clear();
  return decodeHeroHistory(await resource.read(signal));
}
export const referenceMedia = (path: string) => (path.startsWith('https://') ? path : asset(path));
