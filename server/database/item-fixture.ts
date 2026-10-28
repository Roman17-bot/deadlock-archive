import type { ItemCatalog, ItemStatistics } from '../../shared/item-types';

export function itemFixture(clientVersion: number): {
  items: ItemCatalog;
  itemStatistics: ItemStatistics;
} {
  return {
    items: {
      meta: {
        schemaVersion: 1,
        clientVersion,
        sourceRevision: 1,
        updatedAt: '2026-10-28T00:00:00Z',
        itemCount: 1,
      },
      items: [
        {
          id: 1,
          slug: 'test-item',
          name: 'Test Item',
          localizedName: { ru: 'Предмет', en: 'Test Item' },
          category: 'weapon',
          tier: 1,
          cost: 800,
          icon: 'assets/items/test-item.webp',
          activation: 'passive',
          description: { ru: 'Описание', en: 'Description' },
          attributes: [],
          effects: [],
          tags: [],
          components: [],
          upgrades: [],
          advice: [{ ru: 'Совет', en: 'Advice' }],
        },
      ],
    },
    itemStatistics: {
      meta: {
        schemaVersion: 1,
        clientVersion,
        updatedAt: '2026-10-28T00:00:00Z',
        from: '2026-10-21T00:00:00Z',
        to: '2026-10-28T00:00:00Z',
        gameMode: 'normal',
        matchModes: ['ranked', 'unranked'],
        minAverageBadge: null,
        corruptedItems: 'exclude',
        source: 'deadlock-api',
      },
      items: [
        {
          itemId: 1,
          matches: 10,
          wins: 6,
          losses: 4,
          averageBuyTimeSeconds: 123,
          heroes: [{ heroId: 1, matches: 10, wins: 6, losses: 4, averageBuyTimeSeconds: 123 }],
        },
      ],
    },
  };
}
