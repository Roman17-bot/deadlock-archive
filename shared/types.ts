export interface Hero {
  id: number;
  slug: string;
  name: string;
  aliases: string;
  tags: string[];
  isNew: boolean;
  portrait: string;
  base: {
    health: number;
    spirit: number;
    regen: number;
    bulletDamage: number;
    moveSpeed: number;
    stamina: number;
  };
  growth: { health: number; spirit: number; regen: number; bulletDamage: number };
  scaling: {
    bulletDamagePerSpirit: number;
    regenPerSpirit: number;
    fireRatePercentPerSpirit: number;
  };
  weapon: {
    className: string;
    projectiles: number;
    burst: number;
    cycleTime: number;
    intraBurstTime: number;
    shotsPerSecond: number;
    spinsUp: boolean;
    fullSpinCycle: number | null;
    hitOnce: boolean;
    clipSize: number;
    reloadSeconds: number;
    notes: string[];
  };
  source: { heroUrl: string; weaponUrl: string; heroLine: number; weaponLine: number };
}

export interface HeroSnapshot {
  meta: {
    schemaVersion: number;
    snapshotDate: string;
    checkedAt: string;
    clientVersion: number;
    sourceRevision: number;
    gameCommit: string;
    buildDate: string;
    heroCount: number;
    levelRange: number[];
    sources: { label: string; url: string }[];
    methodology: string[];
  };
  heroes: Hero[];
}

export interface HeroStats {
  health: number;
  spirit: number;
  regen: number;
  bulletDamage: number;
  shotDamage: number;
  dps: number;
  damageGrowth: number;
  healthGrowth: number;
  spiritGrowth: number;
  regenGrowth: number;
}
export type SortKey = 'name' | keyof HeroStats;
export type SortDirection = 'asc' | 'desc';
