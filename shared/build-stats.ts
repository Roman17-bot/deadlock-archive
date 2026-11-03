import type { Hero } from './types';
import type { ItemCategory, ShopItem } from './item-types';
import type {
  BuildContext,
  BuildModifier,
  BuildResult,
  BuildRules,
  BuildStat,
  BuildStats,
  InvestmentState,
} from './build-types';
import { statsAtLevel } from './heroes.ts';
import {
  validateBuildRules,
  validateHeroCalculation,
  validateItemCalculation,
} from './build-validation.ts';
import {
  calculateDefense,
  calculateDamage,
  calculateFireRate,
  calculateMaxHealth,
  diminishing,
} from './mechanics.ts';

const categories: ItemCategory[] = ['weapon', 'vitality', 'spirit'];

export function buildInvestments(
  items: readonly ShopItem[],
  rules: BuildRules,
): Record<ItemCategory, InvestmentState> {
  return Object.fromEntries(
    categories.map((category) => {
      const souls = items
        .filter((item) => item.category === category)
        .reduce((sum, item) => sum + item.cost, 0);
      const table = rules.investment[category];
      const previous = table.findLast((entry) => entry.souls <= souls) ?? { souls: 0, bonus: 0 };
      return [
        category,
        {
          souls,
          bonus: previous.bonus,
          previous,
          next: table.find((entry) => entry.souls > souls) ?? null,
        },
      ];
    }),
  ) as Record<ItemCategory, InvestmentState>;
}

function positivePool(values: number[]) {
  return (
    diminishing(values.filter((v) => v >= 0)) -
    diminishing(values.filter((v) => v < 0).map((v) => -v))
  );
}

export function calculateBuild(
  hero: Hero,
  level: number,
  items: readonly ShopItem[],
  rules: BuildRules,
  context: BuildContext = {},
): BuildResult {
  if (
    context.distance !== undefined &&
    (!Number.isFinite(context.distance) || context.distance < 0 || context.distance > 10000)
  )
    throw new RangeError('Некорректная дистанция.');
  const natural = statsAtLevel(hero, level);
  const extra = hero.calculation;
  if (!validateBuildRules(rules)) throw new RangeError('Некорректные правила сборки.');
  if (
    !extra ||
    !validateHeroCalculation(extra) ||
    items.some((item) => !validateItemCalculation(item.calculation))
  )
    throw new RangeError('Для расчёта нужны обновлённые данные героев и предметов.');
  if (new Set(items.map((item) => item.id)).size !== items.length || items.length > rules.maxSlots)
    throw new RangeError('Некорректный состав предметов.');
  if (items.filter((item) => item.activation === 'active').length > rules.maxActiveItems)
    throw new RangeError('Слишком много активных предметов.');
  const boons = level - 1;
  const investments = buildInvestments(items, rules);
  const modifiers = items.flatMap((item) => item.calculation!.modifiers);
  const owners = new Map(
    items.flatMap((item) =>
      item.calculation!.modifiers.map((modifier) => [modifier, item] as const),
    ),
  );
  const global = modifiers.filter((m) => m.scope === 'self');
  const value = (m: BuildModifier, spirit = 0) =>
    m.value + (m.spiritScale ?? 0) * spirit + (m.boonScale ?? 0) * boons;
  const values = (list: BuildModifier[], stat: BuildStat, spirit = 0) =>
    list.filter((m) => m.stat === stat).map((m) => value(m, spirit));
  const sum = (list: BuildModifier[], stat: BuildStat, spirit = 0) =>
    values(list, stat, spirit).reduce((a, b) => a + b, 0);
  const spirit =
    (natural.spirit + investments.spirit.bonus + sum(global, 'spirit')) *
    (1 + sum(global, 'spiritPercent') / 100);
  if (!Number.isFinite(spirit) || spirit < 0)
    throw new RangeError('Некорректная спиритическая мощь.');

  const contextual = modifiers.filter((m) => {
    if (m.scope === 'self') return true;
    if (m.scope === 'versusNPC') return !!context.versusNPC;
    if (m.scope === 'closeRange' && context.distance !== undefined) {
      const thresholds = values(
        owners.get(m)!.calculation!.modifiers,
        'closeRangeThreshold',
        spirit,
      );
      return thresholds.length > 0 && context.distance <= Math.max(...thresholds);
    }
    if (m.scope === 'longRange' && context.distance !== undefined) {
      const thresholds = values(
        owners.get(m)!.calculation!.modifiers,
        'longRangeThreshold',
        spirit,
      );
      return thresholds.length > 0 && context.distance >= Math.min(...thresholds);
    }
    return false;
  });
  const weaponDamagePercent =
    investments.weapon.bonus +
    sum(contextual, 'weaponDamagePercent', spirit) +
    sum(contextual, 'npcWeaponDamagePercent', spirit) +
    sum(contextual, 'closeRangeWeaponDamagePercent', spirit) +
    sum(contextual, 'longRangeWeaponDamagePercent', spirit);
  const health = calculateMaxHealth({
    base: hero.base.health,
    boons,
    growth: hero.growth.health,
    baseBonus: investments.vitality.bonus + sum(global, 'baseHealthPercent', spirit),
    flat: sum(global, 'health', spirit),
    finalBonus: sum(global, 'maxHealthPercent', spirit),
  });
  if (health <= 0) throw new RangeError('Максимальное здоровье должно быть положительным.');
  const bulletDamage = calculateDamage({
    base:
      hero.base.bulletDamage +
      boons * hero.growth.bulletDamage +
      spirit * hero.scaling.bulletDamagePerSpirit,
    weaponBonus: weaponDamagePercent,
    additiveAmp: 0,
    flat: 0,
    multipliers: [sum(global, 'damagePercent', spirit)],
    falloff: 100,
    crit: 1,
    resistance: 0,
  });
  const shotDamage = bulletDamage * (hero.weapon.hitOnce ? 1 : hero.weapon.projectiles);
  const rateBonuses = [
    spirit * hero.scaling.fireRatePercentPerSpirit,
    ...values(global, 'fireRatePercent', spirit),
  ];
  const shotsPerSecond = calculateFireRate(hero.weapon.shotsPerSecond, rateBonuses, []).rate;
  const clipSize = Math.max(
    1,
    Math.ceil(
      (hero.weapon.clipSize + spirit * extra.clipSizePerSpirit) *
        (1 + sum(global, 'clipSizePercent', spirit) / 100),
    ),
  );
  const reloadSeconds =
    hero.weapon.reloadSeconds / (1 + sum(global, 'reloadSpeedPercent', spirit) / 100);
  const bulletResist = positivePool([
    extra.bulletResist + boons * extra.bulletResistGrowth + spirit * extra.bulletResistPerSpirit,
    ...values(global, 'bulletResist', spirit),
    ...values(contextual, 'npcBulletResist', spirit),
  ]);
  const spiritResist = positivePool([
    extra.spiritResist + boons * extra.spiritResistGrowth + spirit * extra.spiritResistPerSpirit,
    ...values(global, 'spiritResist', spirit),
  ]);
  const regenAmp = sum(global, 'regenAmp', spirit);
  const regenBase =
    hero.base.regen +
    boons * hero.growth.regen +
    spirit * hero.scaling.regenPerSpirit +
    sum(global, 'healthRegen', spirit);
  const regen = regenBase * (1 + regenAmp / 100);
  const outOfCombatRegen =
    (regenBase +
      sum(
        modifiers.filter((m) => m.scope === 'self' || m.scope === 'outOfCombat'),
        'outOfCombatRegen',
        spirit,
      )) *
    (1 + regenAmp / 100);
  const moveSpeed =
    hero.base.moveSpeed + spirit * extra.moveSpeedPerSpirit + sum(global, 'moveSpeed', spirit);
  const stats: BuildStats = {
    health,
    spirit,
    regen,
    outOfCombatRegen,
    bulletDamage,
    shotDamage,
    shotsPerSecond,
    dps: shotDamage * shotsPerSecond,
    sustainedDps: (shotDamage * clipSize) / (clipSize / shotsPerSecond + reloadSeconds),
    clipSize,
    reloadSeconds,
    weaponDamagePercent,
    bulletResist,
    spiritResist,
    bulletEhp: calculateDefense({
      health,
      damage: 0,
      resists: bulletResist >= 0 ? [bulletResist] : [],
      shred: bulletResist < 0 ? [-bulletResist] : [],
    }).ehp,
    spiritEhp: calculateDefense({
      health,
      damage: 0,
      resists: spiritResist >= 0 ? [spiritResist] : [],
      shred: spiritResist < 0 ? [-spiritResist] : [],
    }).ehp,
    moveSpeed,
    sprintSpeed:
      moveSpeed +
      extra.sprintSpeed +
      spirit * extra.sprintSpeedPerSpirit +
      sum(global, 'sprintSpeed', spirit),
    stamina: hero.base.stamina + sum(global, 'stamina', spirit),
    staminaRegen: extra.staminaRegen * (1 + sum(global, 'staminaRegenPercent', spirit) / 100),
    cooldownReduction: positivePool(values(global, 'cooldownReduction', spirit)),
    itemCooldownReduction: positivePool(values(global, 'itemCooldownReduction', spirit)),
    durationPercent: positivePool(values(global, 'durationPercent', spirit)),
    rangePercent: positivePool(values(global, 'rangePercent', spirit)),
    radiusPercent: positivePool(values(global, 'radiusPercent', spirit)),
    debuffResist: positivePool([extra.debuffResist, ...values(global, 'debuffResist', spirit)]),
    slowResist: Math.min(100, sum(global, 'slowResist', spirit)),
    bulletLifesteal: positivePool([
      extra.bulletLifesteal,
      ...values(global, 'bulletLifesteal', spirit),
    ]),
    spiritLifesteal: positivePool(values(global, 'spiritLifesteal', spirit)),
    healingAmp: sum(global, 'healingAmp', spirit),
    regenAmp,
  };
  const abilityModifiers = modifiers.filter(
    (m) =>
      m.scope === 'self' ||
      (m.scope === 'imbuedAbility' && context.imbued) ||
      ((m.scope === 'chargedAbilities' || m.scope === 'chargeEligibleAbilities') &&
        context.charged) ||
      (m.scope === 'ultimate' && context.ultimate),
  );
  const abilitySpirit =
    (natural.spirit + investments.spirit.bonus + sum(abilityModifiers, 'spirit')) *
    (1 + sum(abilityModifiers, 'spiritPercent') / 100);
  const ability = {
    spirit: abilitySpirit,
    damagePercent: sum(abilityModifiers, 'damagePercent', abilitySpirit),
    cooldownReduction: positivePool([
      ...values(abilityModifiers, 'cooldownReduction', abilitySpirit),
      ...values(abilityModifiers, 'ultimateCooldownReduction', abilitySpirit),
    ]),
    durationPercent: positivePool(values(abilityModifiers, 'durationPercent', abilitySpirit)),
    rangePercent: positivePool(values(abilityModifiers, 'rangePercent', abilitySpirit)),
    radiusPercent: positivePool(values(abilityModifiers, 'radiusPercent', abilitySpirit)),
    charges: sum(abilityModifiers, 'charges', abilitySpirit),
  };
  if (
    Object.values(stats).some((n) => !Number.isFinite(n)) ||
    Object.values(ability).some((n) => !Number.isFinite(n))
  )
    throw new RangeError('Результат вне поддерживаемого диапазона.');
  // The baseline uses the same selected level and target conditions, with no purchased items.
  const baseline = items.length
    ? calculateBuild(hero, level, [], rules, context).stats
    : { ...stats };
  return {
    baseline,
    stats,
    ability,
    investments,
    totalCost: items.reduce((total, item) => total + item.cost, 0),
  };
}
