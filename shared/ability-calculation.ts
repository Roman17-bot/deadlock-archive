import type { AbilityDetails, AbilityParameter, AbilityScale } from './ability-types';

export interface AbilityCalculationContext {
  spirit: number;
  boons: number;
  cooldownReduction: number;
  durationPercent: number;
  rangePercent: number;
  radiusPercent: number;
  charges: number;
  chargeCooldownReduction: number;
  healingAmp: number;
  damagePercent: number;
  weaponDamagePercent?: number;
  baseBulletDamage?: number;
  lightMeleeDamage?: number;
  heavyMeleeDamage?: number;
}
export interface EvaluatedAbilityParameter extends AbilityParameter {
  baseValue: number | string;
  available: boolean;
  dependency?: 'weapon' | 'melee' | 'range' | 'boons' | 'custom' | 'units';
  spiritCoefficient?: number;
}

const numeric = (value: number | string): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const clean = value.trim();
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?\s*(?:m|s|%)?$/i.test(clean)
    ? Number.parseFloat(clean)
    : undefined;
};
function requiredBits(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string' || !raw.trim()) return 0;
  if (/^\d+$/.test(raw)) return Number(raw);
  let result = 0;
  for (const bit of raw.split('|').map((x) => x.trim())) {
    if (/TRAINED$/.test(bit)) result |= 1;
    else if (/TIER_1$/.test(bit)) result |= 2;
    else if (/TIER_2$/.test(bit)) result |= 4;
    else if (/TIER_3$/.test(bit)) result |= 8;
    else if (/FULLY_UPGRADED$/.test(bit)) result |= 15;
    else if (/BIT_4$/.test(bit)) result |= 16;
    else if (!/NONE$/.test(bit)) result |= 16;
  }
  return result;
}
function defaultStat(scale: AbilityScale): string | undefined {
  if (scale.stat && scale.stat !== 'EStatsCount') return scale.stat;
  if (scale.stat === 'EStatsCount') return undefined;
  if (
    scale.className === 'scale_function_tech_damage' ||
    scale.className === 'scale_function_healing_spirit_scale'
  )
    return 'ETechPower';
  if (scale.className === 'scale_function_tech_duration') return 'ETechDuration';
  if (
    scale.className === 'scale_function_tech_range' ||
    scale.className === 'scale_function_tech_range_rounded'
  )
    return 'ETechRange';
  return undefined;
}

function damageOutput(parameter: AbilityParameter): boolean {
  // A damage scale can also drive barriers, slows, healing or buff percentages.
  if (
    /(?:DamageAmp|DamageThreshold|OutgoingDamage|DamageBonus|WeaponDmgPer|BaseAttackDamagePercent|BonusSpiritDamagePercent|BonusPerChain|BonusShockDamage)/.test(
      parameter.id,
    )
  )
    return false;
  return (
    parameter.metadata?.m_bIsAbilityDamageProperty === true ||
    ['tech_damage', 'bullet_damage', 'melee_damage'].includes(parameter.cssClass ?? '') ||
    /^(?:Damage|DPS)$|(?:Damage|DPS)(?:Per|Over)|(?:Min|Max|Impact|Swap|Fixed|Explosion|Explode|BarrageMax)Damage$/.test(
      parameter.id,
    )
  );
}

/** Resolve supported source functions; complex functions retain their base and a useful dependency. */
export function evaluateAbility(
  ability: AbilityDetails,
  rank: number,
  context: AbilityCalculationContext,
) {
  if (
    !Number.isInteger(rank) ||
    rank < 0 ||
    rank > 3 ||
    Object.values(context).some((value) => !Number.isFinite(value)) ||
    context.spirit < 0 ||
    context.boons < 0 ||
    context.boons > 35
  )
    throw new RangeError('Некорректные параметры способности.');
  const selectedBits = (1 << (rank + 1)) - 1;
  const operations = ability.upgrades
    .filter((upgrade) => upgrade.tier <= rank)
    .flatMap((upgrade) => upgrade.operations);
  const parameters: EvaluatedAbilityParameter[] = ability.parameters.map((parameter) => {
    let base: number | string = numeric(parameter.value) ?? parameter.value;
    const spatial =
      parameter.displayUnits === 'EDisplayUnit_Meters' ||
      parameter.displayUnits === 'EDisplayUnit_MetersPerSecond';
    const metres = (value: number | string) =>
      spatial && !(typeof value === 'string' && /m\s*$/.test(value)) ? 0.0254 : 1;
    if (typeof base === 'number') base *= metres(parameter.value);
    const scale = parameter.scale;
    const primary = scale ? defaultStat(scale) : undefined;
    const coefficients = new Map<string, number>();
    const coefficient =
      scale?.coefficient ?? (primary === 'ETechPower' || primary === 'ELevelUpBoons' ? 0 : 1);
    if (primary) coefficients.set(primary, coefficient);
    for (const stat of scale?.stats ?? [])
      if (!coefficients.has(stat))
        coefficients.set(stat, stat === 'ETechPower' || stat === 'ELevelUpBoons' ? 0 : 1);
    for (const operation of operations.filter((operation) => operation.property === parameter.id)) {
      const amount = numeric(operation.value);
      if (operation.type === 'set') {
        base = amount ?? operation.value;
        continue;
      }
      if (amount === undefined) continue;
      if (operation.type === 'add' || operation.type === 'addBase') {
        if (typeof base === 'number') base += amount * metres(operation.value);
      } else if (operation.type === 'multiplyBase') {
        if (typeof base === 'number') base *= 1 + amount / 100;
      } else {
        const targets =
          operation.scaleStat && operation.scaleStat !== 'EStatsCount'
            ? [operation.scaleStat]
            : primary
              ? [primary]
              : [...coefficients.keys()];
        for (const target of targets) {
          const current = coefficients.get(target) ?? 0;
          coefficients.set(
            target,
            operation.type === 'multiplyScale' ? current * amount : current + amount,
          );
        }
      }
    }
    const required = requiredBits(parameter.metadata?.m_nRequiredUpgradeBits);
    const result: EvaluatedAbilityParameter = {
      ...parameter,
      baseValue: parameter.value,
      value: base,
      available: (required & selectedBits) === required,
    };
    const outputMultiplier = damageOutput(parameter) ? 1 + context.damagePercent / 100 : 1;
    if (typeof base !== 'number') return result;
    if (
      !scale ||
      scale.disabled ||
      (!scale.className &&
        !scale.stat &&
        !scale.stats?.length &&
        !scale.coefficient &&
        !Object.keys(scale.metadata ?? {}).length)
    ) {
      result.value = base * outputMultiplier;
      return result;
    }
    const className = scale.className;
    if (
      className === 'scale_function_kinetic_carbine_damage' &&
      context.baseBulletDamage !== undefined &&
      context.weaponDamagePercent !== undefined
    ) {
      result.value =
        base *
        context.baseBulletDamage *
        (1 + (coefficients.get('EWeaponPower') ?? scale.coefficient ?? 0) / 100) *
        (1 + context.weaponDamagePercent / 100) *
        outputMultiplier;
      return result;
    }
    if (
      (className === 'scale_function_ability_weapon_damage' ||
        primary === 'EBaseWeaponDamageIncrease') &&
      context.weaponDamagePercent !== undefined
    ) {
      result.value =
        (base +
          (coefficients.get('EBaseWeaponDamageIncrease') ?? coefficient) *
            context.weaponDamagePercent) *
        outputMultiplier;
      return result;
    }
    if (
      className === 'scale_function_kinetic_carbine_damage' ||
      className === 'scale_function_ability_weapon_damage' ||
      primary === 'EBaseWeaponDamageIncrease' ||
      primary === 'EWeaponPower'
    ) {
      result.dependency = 'weapon';
      return result;
    }
    if (
      primary === 'ELightMeleeDamage' ||
      primary === 'EHeavyMeleeDamage' ||
      primary === 'EMeleeRange'
    ) {
      const damage =
        primary === 'ELightMeleeDamage'
          ? context.lightMeleeDamage
          : primary === 'EHeavyMeleeDamage'
            ? context.heavyMeleeDamage
            : undefined;
      if (damage !== undefined) {
        result.value =
          (base + (coefficients.get(primary) ?? coefficient) * damage) * outputMultiplier;
        return result;
      }
      result.dependency = 'melee';
      return result;
    }
    if (className === 'scale_function_healing_boon_scale') {
      result.dependency = 'boons';
      return result;
    }
    const ordinary = [
      'scale_function_single_stat',
      'scale_function_multi_stats',
      'scale_function_tech_damage',
      'scale_function_tech_duration',
      'scale_function_tech_range',
      'scale_function_tech_range_rounded',
      'scale_function_healing_spirit_scale',
    ];
    if (className === 'scale_function_ability_charges')
      result.value = base > 0 ? base + context.charges : base;
    else if (className === 'scale_function_ability_recharge_time')
      result.value = base >= 0 ? base * (1 - context.chargeCooldownReduction / 100) : base;
    else if (!ordinary.includes(className)) {
      result.dependency = 'custom';
      return result;
    } else {
      let value = base;
      const additive = new Map([
        ['ETechPower', context.spirit],
        ['ELevelUpBoons', context.boons],
      ]);
      const multiplicative = new Map([
        ['ETechCooldown', -context.cooldownReduction],
        ['ETechDuration', context.durationPercent],
        ['ETechRange', context.rangePercent],
        ['ETechRadius', context.radiusPercent],
        ['EHealingOutput', context.healingAmp],
        ['EChannelDuration', 0],
      ]);
      for (const [stat, factor] of coefficients)
        if (additive.has(stat)) value += additive.get(stat)! * factor;
      for (const [stat, factor] of coefficients) {
        if (multiplicative.has(stat)) value *= 1 + (multiplicative.get(stat)! * factor) / 100;
        else if (!additive.has(stat)) {
          result.dependency = 'custom';
          return result;
        }
      }
      if (
        className === 'scale_function_healing_spirit_scale' &&
        !coefficients.has('EHealingOutput')
      )
        value *= 1 + context.healingAmp / 100;
      value *= outputMultiplier;
      if (className === 'scale_function_tech_range_rounded') value = Math.round(value);
      result.value = parameter.id === 'AbilityCooldown' ? Math.max(0, value) : value;
      if (coefficients.has('ETechPower')) result.spiritCoefficient = coefficients.get('ETechPower');
    }
    if (typeof result.value === 'number' && !Number.isFinite(result.value))
      throw new RangeError('Результат способности вне диапазона.');
    return result;
  });
  return { ...ability, rank, parameters };
}
