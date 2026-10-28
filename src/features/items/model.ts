import {
  EMPTY_ITEM_FILTERS,
  ITEM_FILTER_GROUPS,
  type ItemFilters,
} from '../../../shared/item-filters';
import type { ItemCategory, ItemTier } from '../../../shared/item-types';
export const categories: ItemCategory[] = ['weapon', 'vitality', 'spirit'];
export const categoryNames = { weapon: 'Оружие', vitality: 'Выживаемость', spirit: 'Спирит' };
export function readFilters(hash = window.location.hash): ItemFilters {
  const q = new URLSearchParams(hash.split('?')[1] ?? '');
  return {
    ...EMPTY_ITEM_FILTERS,
    query: q.get('q') ?? '',
    categories: (q.get('category') ?? '')
      .split(',')
      .filter((s): s is ItemCategory => categories.includes(s as ItemCategory)),
    tiers: (q.get('tier') ?? '')
      .split(',')
      .map(Number)
      .filter((n): n is ItemTier => [1, 2, 3, 4].includes(n)),
    activation:
      q.get('activation') === 'active'
        ? 'active'
        : q.get('activation') === 'passive'
          ? 'passive'
          : 'all',
    tags: [
      ...new Set(
        (q.get('tags') ?? '')
          .split(',')
          .filter((id) =>
            ITEM_FILTER_GROUPS.some((group) => group.filters.some((filter) => filter.id === id)),
          ),
      ),
    ],
    tagMode: q.get('mode') === 'any' ? 'any' : 'all',
  };
}
export function filtersHash(filters: ItemFilters) {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.categories.length) params.set('category', filters.categories.join(','));
  if (filters.tiers.length) params.set('tier', filters.tiers.join(','));
  if (filters.activation !== 'all') params.set('activation', filters.activation);
  if (filters.tags.length) params.set('tags', filters.tags.join(','));
  if (filters.tagMode === 'any') params.set('mode', 'any');
  return `#/items${params.size ? '?' + params.toString() : ''}`;
}
export function itemHref(slug: string, returnTo = window.location.hash) {
  return `#/items/${encodeURIComponent(slug)}?returnTo=${encodeURIComponent(safeReturn(returnTo))}`;
}
export function safeReturn(value: string | null) {
  return value && /^#\/items(?:\?|$)/.test(value) ? value : '#/items';
}
export function buyTime(seconds: number | null) {
  if (seconds === null) return '—';
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}
