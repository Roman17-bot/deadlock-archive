import type { AbilityDetails, HeroAbility } from './ability-types';
import type { Hero } from './types';
import type { ShopItem } from './item-types';
import type { BuildContext, BuildRules } from './build-types';
import { calculateBuild } from './build-stats.ts';
import { evaluateAbility } from './ability-calculation.ts';

export function meleeDamageAtLevel(hero: Hero, level: number, spirit: number, multiplier = 1) {
  const base = hero.calculation;
  const light = base?.lightMeleeDamage;
  const heavy = base?.heavyMeleeDamage;
  if (light === undefined || light <= 0 || heavy === undefined || base?.meleeGrowth === undefined)
    return undefined;
  const growth = base.meleeGrowth * (level - 1);
  return {
    lightMeleeDamage: (light + growth) * multiplier,
    heavyMeleeDamage:
      (heavy + (growth * heavy) / light + (base.heavyMeleePerSpirit ?? 0) * spirit) * multiplier,
  };
}

export function calculateHeroAbility(
  ability: AbilityDetails,
  rank: number,
  hero: Hero,
  level: number,
  items: readonly ShopItem[],
  rules: BuildRules,
  context: BuildContext = {},
) {
  const charges = ability.parameters.find((parameter) => parameter.id === 'AbilityCharges');
  const baseCharges =
    typeof charges?.value === 'number' ? charges.value : Number(charges?.value ?? 0);
  const behaviours = ability.metadata?.behaviours;
  const charged =
    baseCharges > 0 ||
    (Array.isArray(behaviours) &&
      behaviours.some((value) => typeof value === 'string' && /CHARGES/.test(value)));
  const build = calculateBuild(hero, level, items, rules, {
    ...context,
    charged,
    ultimate: 'slot' in ability ? (ability as HeroAbility).slot === 4 : !!context.ultimate,
  });
  const boons = level - 1;
  const sum = (stat: string) =>
    items
      .flatMap((item) => item.calculation?.modifiers ?? [])
      .filter((modifier) => modifier.scope === 'self' && modifier.stat === stat)
      .reduce(
        (total, modifier) =>
          total +
          modifier.value +
          (modifier.spiritScale ?? 0) * build.stats.spirit +
          (modifier.boonScale ?? 0) * boons,
        0,
      );
  const weaponDamagePercent = build.investments.weapon.bonus + sum('weaponDamagePercent');
  const naturalBullet =
    hero.base.bulletDamage +
    boons * hero.growth.bulletDamage +
    build.stats.spirit * hero.scaling.bulletDamagePerSpirit;
  const meleeBonus = 1 + (weaponDamagePercent / 2 + sum('meleeDamagePercent')) / 100;
  return evaluateAbility(ability, rank, {
    ...build.ability,
    boons,
    healingAmp: build.stats.healingAmp,
    weaponDamagePercent,
    baseBulletDamage: naturalBullet,
    ...meleeDamageAtLevel(hero, level, build.stats.spirit, meleeBonus),
  });
}
