import { validateSnapshot } from '../../shared/heroes';
import { heroSnapshotUrl } from './environment';
import { readJson } from './http';

export async function loadHeroSnapshot(signal: AbortSignal) {
  const value = await readJson(heroSnapshotUrl(), {
    signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
  });
  if (!validateSnapshot(value)) throw new Error('Invalid data');
  return value;
}
