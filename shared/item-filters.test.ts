import { describe, expect, it } from 'vitest';
import type { ShopItem } from './item-types';
import { EMPTY_ITEM_FILTERS, filterItems } from './item-filters';

const item = (
  id: number,
  name: string,
  category: ShopItem['category'],
  tier: ShopItem['tier'],
  tags: string[],
): ShopItem => ({
  id,
  slug: name.toLowerCase().replaceAll(' ', '-'),
  name,
  localizedName: { ru: name, en: name },
  category,
  tier,
  cost: [0, 800, 1600, 3200, 6400][tier],
  icon: `assets/items/${id}.webp`,
  activation: 'passive',
  description: { ru: '', en: '' },
  attributes: [],
  effects: [],
  tags,
  components: [],
  upgrades: [],
  advice: [],
});
const items = [
  item(1, 'Healbane', 'vitality', 2, ['anti-heal', 'spirit-power']),
  item(2, 'Toxic Bullets', 'weapon', 3, ['anti-heal']),
  item(3, 'Spirit Shielding', 'vitality', 2, ['spirit-resist', 'barrier']),
];

describe('situational item filters', () => {
  it('intersects dimensions, unions categories/tiers and honors all/any effect selection', () => {
    expect(
      filterItems(items, {
        ...EMPTY_ITEM_FILTERS,
        categories: ['weapon', 'vitality'],
        tiers: [2, 3],
        tags: ['anti-heal', 'spirit-power'],
        tagMode: 'all',
      }).map((i) => i.id),
    ).toEqual([1]);
    expect(
      filterItems(items, {
        ...EMPTY_ITEM_FILTERS,
        tags: ['anti-heal', 'spirit-resist'],
        tagMode: 'any',
      }).map((i) => i.id),
    ).toEqual([1, 2, 3]);
    expect(
      filterItems(items, { ...EMPTY_ITEM_FILTERS, categories: ['weapon'], tiers: [2] }),
    ).toEqual([]);
  });
  it('finds player terminology in both languages including effect aliases', () => {
    expect(
      filterItems(items, { ...EMPTY_ITEM_FILTERS, query: 'антихил' }).map((i) => i.id),
    ).toEqual([1, 2]);
    expect(
      filterItems(items, { ...EMPTY_ITEM_FILTERS, query: 'spirit resist' }).map((i) => i.id),
    ).toEqual([3]);
  });
});
