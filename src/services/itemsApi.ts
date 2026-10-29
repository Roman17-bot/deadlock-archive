import type { ItemCatalog, ItemStatistics } from '../../shared/item-types';
import { validateItemCatalog, validateItemStatistics } from '../../shared/items';
import { asset } from '../lib/format';
import { readJson } from './http';

// Keep route changes quick while allowing editorial updates within the same game version.
const FRESH_FOR_MS = 60_000;
function resource<T>(url: string, validate: (value: unknown) => value is T) {
  let cached: { value: T; loadedAt: number } | undefined;
  let pending: Promise<T> | undefined;
  return {
    clear() {
      cached = undefined;
    },
    read(signal: AbortSignal): Promise<T> {
      if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
      if (!pending && (!cached || Date.now() - cached.loadedAt >= FRESH_FOR_MS)) {
        // The shared transport has its own timeout: cancelling one reader must not
        // cancel another reader (including React StrictMode's replacement effect).
        pending = readJson(url)
          .then((value) => {
            if (!validate(value)) throw new Error('Invalid item data');
            cached = { value, loadedAt: Date.now() };
            return value;
          })
          .finally(() => {
            pending = undefined;
          });
      }
      const request = pending ?? Promise.resolve(cached!.value);
      return new Promise((resolve, reject) => {
        const abort = () => reject(new DOMException('Aborted', 'AbortError'));
        signal.addEventListener('abort', abort, { once: true });
        request
          .then((value) => {
            if (!signal.aborted) resolve(value);
          }, reject)
          .finally(() => signal.removeEventListener('abort', abort));
      });
    },
  };
}
const catalogResource = resource<ItemCatalog>(
  import.meta.env.DEV ? '/api/items' : asset('data/items.json'),
  validateItemCatalog,
);
const statisticsResource = resource<ItemStatistics>(
  import.meta.env.DEV ? '/api/item-statistics' : asset('data/item-statistics.json'),
  validateItemStatistics,
);
export function loadItems(signal: AbortSignal): Promise<ItemCatalog> {
  return catalogResource.read(signal);
}
export async function loadItemStatistics(
  signal: AbortSignal,
  catalog: ItemCatalog | Promise<ItemCatalog>,
): Promise<ItemStatistics> {
  const [value, items] = await Promise.all([statisticsResource.read(signal), catalog]);
  if (!validateItemStatistics(value, items)) {
    catalogResource.clear();
    statisticsResource.clear();
    throw new Error('Invalid item statistics');
  }
  return value;
}
