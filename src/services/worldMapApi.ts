import { assertWorldMapCatalogue } from '../../shared/world-map';
import type { WorldMapCatalogue } from '../../shared/world-map';
import { safeMedia } from '../../shared/hero-reference';
import { asset } from '../lib/format';
import { jsonResource } from './jsonResource';

const resource = jsonResource<WorldMapCatalogue>(
  import.meta.env.DEV ? '/api/world-map' : asset('data/world-map.json'),
  (value): value is WorldMapCatalogue => {
    try {
      assertWorldMapCatalogue(value);
      return Object.values(value.images).every((path) => path === undefined || safeMedia(path));
    } catch {
      return false;
    }
  },
);
export function loadWorldMap(signal: AbortSignal, force = false) {
  if (force) resource.clear();
  return resource.read(signal);
}
