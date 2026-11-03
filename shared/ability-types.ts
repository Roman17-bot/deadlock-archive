export interface AbilityText {
  ru: string;
  en: string;
}
export interface AbilityScale {
  className: string;
  stat?: string;
  stats?: string[];
  coefficient?: number;
  disabled?: boolean;
  metadata?: Record<string, unknown>;
}
export interface AbilityParameter {
  id: string;
  label: AbilityText;
  value: number | string;
  unit?: string;
  displayUnits?: string;
  disableValue?: number | string;
  cssClass?: string;
  display: boolean;
  scale?: AbilityScale;
  metadata?: Record<string, unknown>;
}
export type AbilityOperationType =
  'add' | 'addBase' | 'multiplyBase' | 'addScale' | 'multiplyScale' | 'set';
export interface AbilityOperation {
  property: string;
  type: AbilityOperationType;
  value: number | string;
  scaleStat?: string;
}
export interface AbilityUpgrade {
  tier: 1 | 2 | 3;
  cost: 1 | 2 | 5;
  description: AbilityText;
  operations: AbilityOperation[];
}
export interface AbilitySection {
  description: AbilityText;
  properties: string[];
  blocks: { title: AbilityText; properties: string[]; metadata?: Record<string, unknown> }[];
  metadata?: Record<string, unknown>;
}
export interface AbilityDetails {
  id: number;
  className: string;
  name: AbilityText;
  description: AbilityText;
  icon: string;
  parameters: AbilityParameter[];
  upgrades: AbilityUpgrade[];
  sections: AbilitySection[];
  metadata?: Record<string, unknown>;
}
export interface HeroAbilityVariant extends AbilityDetails {
  linkedAbilityId: number;
  linkUpgrades: boolean;
  linkImbues: boolean;
}
export interface HeroAbility extends AbilityDetails {
  slot: 1 | 2 | 3 | 4;
  variants: HeroAbilityVariant[];
}
export interface AbilityCatalog {
  meta: {
    schemaVersion: 1;
    clientVersion: number;
    sourceRevision: number;
    gameCommit: string;
    updatedAt: string;
  };
  heroes: { heroId: number; abilities: HeroAbility[] }[];
}
