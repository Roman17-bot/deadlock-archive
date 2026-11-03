import {
  buildScopes,
  buildStatKeys,
  type BuildRules,
  type HeroCalculation,
  type ItemCalculation,
} from './build-types.ts';

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e9;
const integer = (value: unknown): value is number =>
  finite(value) && Number.isSafeInteger(value) && value >= 0;
const heroFields: (keyof HeroCalculation)[] = [
  'debuffResist',
  'bulletLifesteal',
  'bulletResist',
  'spiritResist',
  'bulletResistGrowth',
  'spiritResistGrowth',
  'bulletResistPerSpirit',
  'spiritResistPerSpirit',
  'sprintSpeed',
  'sprintSpeedPerSpirit',
  'moveSpeedPerSpirit',
  'clipSizePerSpirit',
  'staminaRegen',
];

export function validateHeroCalculation(value: unknown): value is HeroCalculation {
  return (
    record(value) &&
    heroFields.every((key) => finite(value[key])) &&
    ['lightMeleeDamage', 'heavyMeleeDamage', 'meleeGrowth', 'heavyMeleePerSpirit'].every(
      (key) => value[key] === undefined || finite(value[key]),
    ) &&
    Number(value.staminaRegen) >= 0
  );
}

export function validateBuildRules(value: unknown): value is BuildRules {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    !integer(value.baseSlots) ||
    value.baseSlots < 1 ||
    !integer(value.maxSlots) ||
    value.maxSlots < value.baseSlots ||
    value.maxSlots > 64 ||
    !integer(value.maxActiveItems) ||
    value.maxActiveItems > value.maxSlots ||
    !record(value.investment)
  )
    return false;
  return ['weapon', 'vitality', 'spirit'].every((category) => {
    const table = (value.investment as Record<string, unknown>)[category];
    if (!Array.isArray(table) || !table.length || table.length > 64) return false;
    let previousSouls = -1,
      previousBonus = -1;
    return table.every((entry) => {
      if (
        !record(entry) ||
        !integer(entry.souls) ||
        !finite(entry.bonus) ||
        entry.bonus < 0 ||
        entry.bonus > 1000 ||
        entry.souls <= previousSouls ||
        entry.bonus < previousBonus ||
        (entry.souls === 0 && entry.bonus !== 0)
      )
        return false;
      previousSouls = entry.souls;
      previousBonus = entry.bonus;
      return true;
    });
  });
}

export function validateItemCalculation(value: unknown): value is ItemCalculation {
  return (
    record(value) &&
    Array.isArray(value.modifiers) &&
    value.modifiers.length <= 100 &&
    value.modifiers.every(
      (modifier) =>
        record(modifier) &&
        typeof modifier.key === 'string' &&
        /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(modifier.key) &&
        (buildStatKeys as readonly unknown[]).includes(modifier.stat) &&
        (buildScopes as readonly unknown[]).includes(modifier.scope) &&
        finite(modifier.value) &&
        (modifier.spiritScale === undefined || finite(modifier.spiritScale)) &&
        (modifier.boonScale === undefined || finite(modifier.boonScale)),
    )
  );
}
