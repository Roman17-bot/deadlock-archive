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
  const shotDamage = bulletDamage * hero.weapon.projectiles;
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
      hero.weapon.projectiles,
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
  if (
    !data.meta ||
    !Number.isInteger(data.meta.clientVersion) ||
    !data.meta.snapshotDate ||
    !Array.isArray(data.meta.sources) ||
    !Array.isArray(data.meta.methodology)
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
        !hero.name ||
        !hero.slug ||
        !hero.portrait
      )
        return false;
      ids.add(hero.id);
      if (
        !hero.base ||
        !hero.growth ||
        !hero.scaling ||
        !hero.weapon ||
        !Array.isArray(hero.weapon.notes)
      )
        return false;
      if (
        !Number.isInteger(hero.weapon.projectiles) ||
        hero.weapon.projectiles < 1 ||
        !Number.isFinite(hero.weapon.shotsPerSecond) ||
        hero.weapon.shotsPerSecond <= 0
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
