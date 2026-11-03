import type { ItemCategory } from './item-types';

/** Percentage bonuses use percentage points (20 means 20%), not fractions. */
export const buildStatKeys = [
  'health',
  'baseHealthPercent',
  'maxHealthPercent',
  'spirit',
  'spiritPercent',
  'weaponDamagePercent',
  'npcWeaponDamagePercent',
  'closeRangeWeaponDamagePercent',
  'closeRangeThreshold',
  'longRangeWeaponDamagePercent',
  'longRangeThreshold',
  'damagePercent',
  'healthRegen',
  'outOfCombatRegen',
  'regenAmp',
  'healingAmp',
  'fireRatePercent',
  'bulletResist',
  'spiritResist',
  'npcBulletResist',
  'clipSizePercent',
  'reloadSpeedPercent',
  'bulletSpeedPercent',
  'weaponRangePercent',
  'moveSpeed',
  'sprintSpeed',
  'stamina',
  'staminaRegenPercent',
  'debuffResist',
  'slowResist',
  'meleeResist',
  'bulletLifesteal',
  'spiritLifesteal',
  'cooldownReduction',
  'itemCooldownReduction',
  'ultimateCooldownReduction',
  'durationPercent',
  'rangePercent',
  'radiusPercent',
  'charges',
  'chargeCooldownReduction',
  'meleeDamagePercent',
  'parryCooldownReduction',
] as const;
export type BuildStat = (typeof buildStatKeys)[number];

export const buildScopes = [
  'self',
  'outOfCombat',
  'versusNPC',
  'closeRange',
  'longRange',
  'imbuedAbility',
  'chargedAbilities',
  'chargeEligibleAbilities',
  'ultimate',
] as const;
export type BuildScope = (typeof buildScopes)[number];

export interface BuildModifier {
  key: string;
  stat: BuildStat;
  value: number;
  scope: BuildScope;
  spiritScale?: number;
  boonScale?: number;
}

export interface ItemCalculation {
  modifiers: BuildModifier[];
}

export interface InvestmentThreshold {
  souls: number;
  bonus: number;
}

export interface BuildRules {
  schemaVersion: 1;
  baseSlots: number;
  maxSlots: number;
  maxActiveItems: number;
  investment: Record<ItemCategory, InvestmentThreshold[]>;
}

/** Base weapon/HP/Spirit fields remain in Hero; these extend its calculator inputs. */
export interface HeroCalculation {
  lightMeleeDamage?: number;
  heavyMeleeDamage?: number;
  meleeGrowth?: number;
  heavyMeleePerSpirit?: number;
  debuffResist: number;
  bulletLifesteal: number;
  bulletResist: number;
  spiritResist: number;
  bulletResistGrowth: number;
  spiritResistGrowth: number;
  bulletResistPerSpirit: number;
  spiritResistPerSpirit: number;
  sprintSpeed: number;
  sprintSpeedPerSpirit: number;
  moveSpeedPerSpirit: number;
  clipSizePerSpirit: number;
  staminaRegen: number;
}

export interface BuildContext {
  outOfCombat?: boolean;
  versusNPC?: boolean;
  distance?: number;
  imbued?: boolean;
  imbuedItemIds?: readonly number[];
  charged?: boolean;
  ultimate?: boolean;
}

export interface InvestmentState {
  souls: number;
  bonus: number;
  next: InvestmentThreshold | null;
  previous: InvestmentThreshold;
}

export interface BuildStats {
  health: number;
  spirit: number;
  regen: number;
  outOfCombatRegen: number;
  bulletDamage: number;
  shotDamage: number;
  dps: number;
  sustainedDps: number;
  shotsPerSecond: number;
  clipSize: number;
  reloadSeconds: number;
  weaponDamagePercent: number;
  bulletResist: number;
  spiritResist: number;
  bulletEhp: number;
  spiritEhp: number;
  moveSpeed: number;
  sprintSpeed: number;
  stamina: number;
  staminaRegen: number;
  cooldownReduction: number;
  itemCooldownReduction: number;
  durationPercent: number;
  rangePercent: number;
  radiusPercent: number;
  debuffResist: number;
  slowResist: number;
  bulletLifesteal: number;
  spiritLifesteal: number;
  healingAmp: number;
  regenAmp: number;
}

export interface BuildResult {
  baseline: BuildStats;
  stats: BuildStats;
  ability: {
    spirit: number;
    damagePercent: number;
    cooldownReduction: number;
    durationPercent: number;
    rangePercent: number;
    radiusPercent: number;
    charges: number;
    chargeCooldownReduction: number;
  };
  investments: Record<ItemCategory, InvestmentState>;
  totalCost: number;
}
