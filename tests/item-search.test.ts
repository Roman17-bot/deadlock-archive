import { describe, expect, it } from 'vitest';
import catalog from '../data/items.json';
import { EMPTY_ITEM_FILTERS, filterItems, searchItemProperties } from '../shared/item-filters';
import type { ShopItem } from '../shared/item-types';

describe('player vocabulary in item search', () => {
  it.each([
    ['стан', ['stun']],
    ['дэш', ['stamina', 'dash-reduction']],
    ['антидэш', ['dash-reduction']],
    ['блинк', ['teleport']],
    ['фарм', ['farming']],
    ['хилл', ['healing']],
    ['реген', ['regen']],
    ['шред', ['bullet-shred', 'spirit-shred']],
    ['СПИРИТ-ШРЕД', ['spirit-shred']],
    ['анти хилл', ['anti-heal']],
    ['диспелл', ['cleanse']],
    ['кд', ['cooldown']],
  ])('finds precise properties for %s', (query, expected) => {
    expect(
      searchItemProperties(query)
        .map((f) => f.id)
        .sort(),
    ).toEqual([...expected].sort());
  });
  it('does not confuse healing with enemy healing reduction', () => {
    const items = filterItems(catalog.items as ShopItem[], {
      ...EMPTY_ITEM_FILTERS,
      query: 'хилл',
    });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.tags.includes('healing'))).toBe(true);
  });
  it('returns only stun-tagged items for slang, not mentions of resisting stuns', () => {
    const items = filterItems(catalog.items as ShopItem[], {
      ...EMPTY_ITEM_FILTERS,
      query: 'стан',
    });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.tags.includes('stun'))).toBe(true);
  });
  it('keeps bilingual item-name prefixes and whitespace tolerant search', () => {
    expect(
      filterItems(catalog.items as ShopItem[], {
        ...EMPTY_ITEM_FILTERS,
        query: '  EXTENDED   MAG  ',
      }).map((i) => i.name),
    ).toEqual(['Extended Magazine']);
    expect(searchItemProperties('неизвестноесвойство')).toEqual([]);
    expect(searchItemProperties('')).toHaveLength(59);
  });
});
