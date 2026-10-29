import { expect, it } from 'vitest';
import { EMPTY_ITEM_FILTERS } from '../shared/item-filters';
import { readFilters, filtersHash, itemHref, safeReturn } from '../src/features/items/model';

it('recovers the first valid category/property from legacy links and ignores old matching mode', () => {
  const legacy =
    '#/items?q=boots&category=unknown,spirit,weapon&tier=1,3&activation=active&tags=unknown,cleanse,cc-immunity&mode=any';
  const filters = readFilters(legacy);
  expect(filters.categories).toEqual(['spirit']);
  expect(filters.tags).toEqual(['cleanse']);
  expect(filters.tagMode).toBe('all');
  expect(filters.tiers).toEqual([1, 3]);
  expect(filtersHash(filters)).toBe(
    '#/items?q=boots&category=spirit&tier=1%2C3&activation=active&tags=cleanse',
  );
  expect(safeReturn(legacy)).toBe(filtersHash(filters));
  expect(itemHref('alpha', legacy)).toContain(encodeURIComponent(filtersHash(filters)));
});
it('serializes at most one valid category/property even from older in-memory filters', () => {
  expect(
    filtersHash({
      ...EMPTY_ITEM_FILTERS,
      categories: ['weapon', 'spirit'],
      tags: ['unknown', 'bullet-resist', 'anti-heal'],
      tagMode: 'any',
    }),
  ).toBe('#/items?category=weapon&tags=bullet-resist');
});
