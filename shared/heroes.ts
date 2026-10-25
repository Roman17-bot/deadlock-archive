import type { Hero, HeroSnapshot, HeroStats, SortDirection, SortKey } from './types';

export function statsAtLevel(hero: Hero, level: number): HeroStats {
  if (!Number.isInteger(level) || level < 1 || level > 36)
    throw new RangeError('Level must be an integer from 1 to 36');
  const boons = level - 1;
  const spirit = hero.base.spirit + boons * hero.growth.spirit;
  const bulletDamage =
    hero.base.bulletDamage +
    boons * hero.growth.bulletDamage +
    spirit * hero.scaling.bulletDamagePerSpirit;
  const damagePaths = hero.weapon.hitOnce ? 1 : hero.weapon.projectiles;
  const shotDamage = bulletDamage * damagePaths;
  const fireRateMultiplier = 1 + (spirit * hero.scaling.fireRatePercentPerSpirit) / 100;
  return {
    health: hero.base.health + boons * hero.growth.health,
    spirit,
    regen: hero.base.regen + boons * hero.growth.regen + spirit * hero.scaling.regenPerSpirit,
    bulletDamage,
    shotDamage,
    dps: shotDamage * hero.weapon.shotsPerSecond * fireRateMultiplier,
    damageGrowth:
      (hero.growth.bulletDamage + hero.growth.spirit * hero.scaling.bulletDamagePerSpirit) *
      damagePaths,
    healthGrowth: hero.growth.health,
    spiritGrowth: hero.growth.spirit,
    regenGrowth: hero.growth.regen + hero.growth.spirit * hero.scaling.regenPerSpirit,
  };
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export function selectHeroes(
  heroes: Hero[],
  query: string,
  sortKey: SortKey,
  direction: SortDirection,
  level: number,
): Hero[] {
  const term = query.trim().toLocaleLowerCase().replaceAll('ё', 'е');
  const matching = heroes.filter((hero) =>
    `${hero.name} ${hero.aliases}`.toLocaleLowerCase().replaceAll('ё', 'е').includes(term),
  );
  return matching.sort((a, b) => {
    const comparison =
      sortKey === 'name'
        ? collator.compare(a.name, b.name)
        : statsAtLevel(a, level)[sortKey] - statsAtLevel(b, level)[sortKey];
    return comparison
      ? comparison * (direction === 'asc' ? 1 : -1)
      : collator.compare(a.name, b.name);
  });
}

export function validateSnapshot(value: unknown): value is HeroSnapshot {
  if (!value || typeof value !== 'object') return false;
  const data = value as HeroSnapshot;
  const text = (input: unknown): input is string => typeof input === 'string' && input.length > 0;
  const strings = (input: unknown): input is string[] => Array.isArray(input) && input.every(text);
  const https = (input: unknown) => {
    if (!text(input)) return false;
    try {
      return new URL(input).protocol === 'https:';
    } catch {
      return false;
    }
  };
  if (
    !data.meta ||
    data.meta.schemaVersion !== 1 ||
    !Number.isInteger(data.meta.clientVersion) ||
    !text(data.meta.snapshotDate) ||
    !text(data.meta.checkedAt) ||
    !text(data.meta.buildDate) ||
    !Number.isInteger(data.meta.sourceRevision) ||
    !text(data.meta.gameCommit) ||
    !/^[a-f0-9]{40}$/.test(data.meta.gameCommit) ||
    !Array.isArray(data.meta.levelRange) ||
    data.meta.levelRange.length !== 2 ||
    data.meta.levelRange[0] !== 1 ||
    data.meta.levelRange[1] !== 36 ||
    !Array.isArray(data.meta.sources) ||
    !data.meta.sources.every((source) => source && text(source.label) && https(source.url)) ||
    !strings(data.meta.methodology)
  )
    return false;
  if (
    !Array.isArray(data.heroes) ||
    !data.heroes.length ||
    data.meta.heroCount !== data.heroes.length
  )
    return false;
  const ids = new Set<number>();
  try {
    for (const hero of data.heroes) {
      if (
        !Number.isInteger(hero.id) ||
        ids.has(hero.id) ||
        !text(hero.name) ||
        !text(hero.slug) ||
        !text(hero.portrait) ||
        typeof hero.aliases !== 'string' ||
        !strings(hero.tags) ||
        typeof hero.isNew !== 'boolean' ||
        !hero.source ||
        !https(hero.source.heroUrl) ||
        !https(hero.source.weaponUrl) ||
        !Number.isInteger(hero.source.heroLine) ||
        !Number.isInteger(hero.source.weaponLine)
      )
        return false;
      ids.add(hero.id);
      if (
        !hero.base ||
        !hero.growth ||
        !hero.scaling ||
        !hero.weapon ||
        !strings(hero.weapon.notes) ||
        !text(hero.weapon.className) ||
        typeof hero.weapon.spinsUp !== 'boolean' ||
        typeof hero.weapon.hitOnce !== 'boolean'
      )
        return false;
      if (
        !Number.isInteger(hero.weapon.projectiles) ||
        hero.weapon.projectiles < 1 ||
        !Number.isFinite(hero.weapon.shotsPerSecond) ||
        hero.weapon.shotsPerSecond <= 0 ||
        !Number.isInteger(hero.weapon.burst) ||
        hero.weapon.burst < 1 ||
        !Number.isFinite(hero.weapon.cycleTime) ||
        hero.weapon.cycleTime <= 0 ||
        !Number.isFinite(hero.weapon.intraBurstTime) ||
        hero.weapon.intraBurstTime < 0 ||
        !Number.isFinite(hero.weapon.clipSize) ||
        !Number.isFinite(hero.weapon.reloadSeconds) ||
        (hero.weapon.fullSpinCycle !== null &&
          (!Number.isFinite(hero.weapon.fullSpinCycle) || hero.weapon.fullSpinCycle <= 0))
      )
        return false;
      if (
        !Object.values(hero.base).every(Number.isFinite) ||
        !Object.values(hero.growth).every(Number.isFinite) ||
        !Object.values(hero.scaling).every(Number.isFinite)
      )
        return false;
      if (!Object.values(statsAtLevel(hero, 36)).every(Number.isFinite) || hero.base.health <= 0)
        return false;
    }
  } catch {
    return false;
  }
  return true;
}

export function toCsv(heroes: Hero[], level: number): string {
  const columns: (keyof HeroStats)[] = [
    'shotDamage',
    'bulletDamage',
    'dps',
    'health',
    'spirit',
    'regen',
    'damageGrowth',
    'healthGrowth',
    'spiritGrowth',
    'regenGrowth',
  ];
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const rows = heroes.map((hero) => {
    const stats = statsAtLevel(hero, level);
    return [quote(hero.name), level, ...columns.map((key) => Number(stats[key].toFixed(6)))].join(
      ',',
    );
  });
  return [['Hero', 'Level', ...columns].join(','), ...rows].join('\r\n');
}
