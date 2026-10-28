import type { ItemCatalog, ItemStatistics } from '../../shared/item-types';
import { validateItemCatalog, validateItemStatistics } from '../../shared/items';
import { asset } from '../lib/format';
import { readJson } from './http';

export async function loadItems(signal: AbortSignal): Promise<ItemCatalog> {
  const value = await readJson(import.meta.env.DEV ? '/api/items' : asset('data/items.json'), {
    signal,
  });
  if (!validateItemCatalog(value)) throw new Error('Invalid item catalog');
  return value;
}
export async function loadItemStatistics(
  signal: AbortSignal,
  catalog: ItemCatalog,
): Promise<ItemStatistics> {
  const value = await readJson(
    import.meta.env.DEV ? '/api/item-statistics' : asset('data/item-statistics.json'),
    { signal },
  );
  if (!validateItemStatistics(value, catalog)) throw new Error('Invalid item statistics');
  return value as ItemStatistics;
}
