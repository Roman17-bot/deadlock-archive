import { validateHeroProfiles, validateHeroStatistics } from '../../shared/hero-reference';
import type { HeroProfiles, HeroStatistics } from '../../shared/hero-reference';
import { asset } from '../lib/format';
import { jsonResource } from './jsonResource';

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
export const referenceMedia = (path: string) => (path.startsWith('https://') ? path : asset(path));
