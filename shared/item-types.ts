export interface LocalizedText {
  ru: string;
  en: string;
}

export type ItemCategory = 'weapon' | 'vitality' | 'spirit';
export type ItemTier = 1 | 2 | 3 | 4;

export interface ItemAttribute {
  key: string;
  label: LocalizedText;
  value: string;
  /** A player-facing description of any scaling attached to this value. */
  scaling?: LocalizedText;
}

export interface ItemEffect {
  kind: 'active' | 'passive';
  description: LocalizedText;
  attributes: ItemAttribute[];
}

export interface ShopItem {
  id: number;
  slug: string;
  name: string;
  localizedName: LocalizedText;
  category: ItemCategory;
  tier: ItemTier;
  cost: number;
  icon: string;
  activation: 'active' | 'passive';
  description: LocalizedText;
  attributes: ItemAttribute[];
  effects: ItemEffect[];
  tags: string[];
  components: number[];
  upgrades: number[];
  advice: LocalizedText[];
}

export interface ItemCatalog {
  meta: {
    schemaVersion: 1;
    clientVersion: number;
    sourceRevision: number;
    updatedAt: string;
    itemCount: number;
  };
  items: ShopItem[];
}

export interface PurchaseSummary {
  matches: number;
  wins: number;
  losses: number;
  averageBuyTimeSeconds: number | null;
}

export interface ItemPurchaseStats extends PurchaseSummary {
  itemId: number;
  heroes: (PurchaseSummary & { heroId: number })[];
}

export interface ItemStatistics {
  meta: {
    schemaVersion: 1;
    clientVersion: number;
    updatedAt: string;
    from: string;
    to: string;
    gameMode: 'normal';
    matchModes: ['ranked', 'unranked'];
    minAverageBadge: number | null;
    corruptedItems: 'exclude';
    source: 'deadlock-api';
  };
  items: ItemPurchaseStats[];
}
