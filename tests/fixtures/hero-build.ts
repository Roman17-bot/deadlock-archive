import type { BuildModifier, BuildRules } from '../../shared/build-types';
import type { ShopItem, ItemCategory } from '../../shared/item-types';
import type { Hero } from '../../shared/types';

const thresholds = [0, 800, 1600, 2400, 3200, 4800, 6400, 8000, 11200, 16000, 22400, 28800];
export const buildRules: BuildRules = {
  schemaVersion: 1,
  baseSlots: 9,
  maxSlots: 12,
  maxActiveItems: 4,
  investment: {
    weapon: thresholds.map((souls, i) => ({
      souls,
      bonus: [0, 9, 12, 15, 18, 46, 54, 62, 74, 86, 100, 115][i],
    })),
    vitality: thresholds.map((souls, i) => ({
      souls,
      bonus: [0, 9, 12, 15, 20, 38, 42, 46, 50, 54, 60, 66][i],
    })),
    spirit: thresholds.map((souls, i) => ({
      souls,
      bonus: [0, 7, 11, 15, 19, 38, 45, 52, 59, 66, 75, 100][i],
    })),
  },
};

/** Deliberately simple hero for independently checkable arithmetic. */
export function buildHero(): Hero {
  return {
    id: 1,
    slug: 'example',
    name: 'Example',
    aliases: '',
    tags: [],
    isNew: false,
    portrait: 'assets/heroes/abrams.webp',
    base: { health: 800, spirit: 0, regen: 2, bulletDamage: 10, moveSpeed: 6, stamina: 3 },
    growth: { health: 49, spirit: 1, regen: 0, bulletDamage: 1 },
    scaling: { bulletDamagePerSpirit: 0, regenPerSpirit: 0, fireRatePercentPerSpirit: 0 },
    weapon: {
      className: 'example',
      projectiles: 1,
      burst: 1,
      cycleTime: 0.5,
      intraBurstTime: 0,
      shotsPerSecond: 2,
      spinsUp: false,
      fullSpinCycle: null,
      hitOnce: false,
      clipSize: 10,
      reloadSeconds: 2,
      notes: [],
    },
    source: {
      heroUrl: 'https://example.test/hero',
      weaponUrl: 'https://example.test/weapon',
      heroLine: 1,
      weaponLine: 1,
    },
    calculation: {
      debuffResist: 0,
      bulletLifesteal: 0,
      bulletResist: 0,
      spiritResist: 0,
      bulletResistGrowth: 0,
      spiritResistGrowth: 0,
      bulletResistPerSpirit: 0,
      spiritResistPerSpirit: 0,
      sprintSpeed: 2,
      sprintSpeedPerSpirit: 0,
      moveSpeedPerSpirit: 0,
      clipSizePerSpirit: 0,
      staminaRegen: 1 / 4.5,
    },
  };
}

export function buildItem(
  id: number,
  category: ItemCategory = 'weapon',
  cost = 800,
  modifiers: BuildModifier[] = [],
  components: number[] = [],
): ShopItem {
  return {
    id,
    slug: `item-${id}`,
    name: `Item ${id}`,
    localizedName: { ru: `Предмет ${id}`, en: `Item ${id}` },
    category,
    tier: ({ 800: 1, 1600: 2, 3200: 3, 6400: 4 } as const)[cost as 800] ?? 1,
    cost,
    icon: 'assets/items/extra-health.webp',
    activation: 'passive',
    description: { ru: '', en: '' },
    attributes: [],
    effects: [],
    tags: [],
    components,
    upgrades: [],
    advice: [],
    calculation: { modifiers },
  };
}

export const bonus = (
  stat: BuildModifier['stat'],
  value: number,
  scope: BuildModifier['scope'] = 'self',
): BuildModifier => ({ key: stat, stat, value, scope });
