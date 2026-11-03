import type { ItemCatalog, ItemStatistics } from '../../shared/item-types';
import { validateItemCatalog, validateItemStatistics } from '../../shared/items';
import { asset } from '../lib/format';
import { jsonResource } from './jsonResource';

const catalogResource = jsonResource<ItemCatalog>(
  import.meta.env.DEV ? '/api/items' : asset('data/items.json'),
  validateItemCatalog,
);
const statisticsResource = jsonResource<ItemStatistics>(
  import.meta.env.DEV ? '/api/item-statistics' : asset('data/item-statistics.json'),
  validateItemStatistics,
);
export function loadItems(signal: AbortSignal, force = false): Promise<ItemCatalog> {
  if (force) catalogResource.clear();
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
