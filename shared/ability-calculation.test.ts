import { expect, it } from 'vitest';
import type { AbilityDetails, AbilityParameter } from './ability-types';
import { evaluateAbility } from './ability-calculation';

const text = (s: string) => ({ ru: s, en: s });
const param = (
  id: string,
  value: number,
  scale?: AbilityParameter['scale'],
  metadata?: Record<string, unknown>,
): AbilityParameter => ({ id, value, scale, metadata, label: text(id), display: true });
const ability = (
  parameters: AbilityParameter[],
  upgrades: AbilityDetails['upgrades'] = [],
): AbilityDetails => ({
  id: 1,
  className: 'example',
  name: text('Example'),
  description: text('Description'),
  icon: 'assets/abilities/example.webp',
  parameters,
  upgrades,
  sections: [],
});
const context = {
  spirit: 100,
  boons: 10,
  cooldownReduction: 20,
  durationPercent: 25,
  rangePercent: 10,
  radiusPercent: 30,
  charges: 2,
  chargeCooldownReduction: 15,
  healingAmp: 20,
  damagePercent: 0,
};

it('keeps an empty scale descriptor as a constant property instead of inventing a dependency', () => {
  const a = ability(
    [param('MissingHealthDamagePercentage', 6, { className: '' })],
    [
      {
        tier: 1,
        cost: 1,
        description: text('upgrade'),
        operations: [{ property: 'MissingHealthDamagePercentage', type: 'addBase', value: 4 }],
      },
    ],
  );
  const p = evaluateAbility(a, 1, context).parameters[0];
  expect(p.value).toBe(10);
  expect(p.dependency).toBeUndefined();
});

it('applies cumulative base and coefficient upgrades before Spirit and cooldown scaling', () => {
  const a = ability(
    [
      param('DPS', 35, {
        className: 'scale_function_tech_damage',
        stat: 'ETechPower',
        coefficient: 0.6,
      }),
      param('AbilityCooldown', 42, {
        className: 'scale_function_single_stat',
        stat: 'ETechCooldown',
      }),
    ],
    [
      {
        tier: 1,
        cost: 1,
        description: text('−20'),
        operations: [{ property: 'AbilityCooldown', type: 'add', value: -20 }],
      },
      {
        tier: 2,
        cost: 2,
        description: text('+5'),
        operations: [{ property: 'DPS', type: 'addBase', value: 5 }],
      },
      {
        tier: 3,
        cost: 5,
        description: text('+22+0.12'),
        operations: [
          { property: 'DPS', type: 'add', value: 22 },
          { property: 'DPS', type: 'addScale', value: 0.12, scaleStat: 'ETechPower' },
        ],
      },
    ],
  );
  const result = evaluateAbility(a, 3, context);
  expect(result.parameters.find((p) => p.id === 'DPS')?.value).toBeCloseTo(134);
  expect(result.parameters.find((p) => p.id === 'AbilityCooldown')?.value).toBeCloseTo(17.6);
});

it('distinguishes percentage base multiplication from direct coefficient multiplication', () => {
  const a = ability(
    [param('Damage', 100, { className: 'scale_function_tech_damage', coefficient: 1 })],
    [
      {
        tier: 1,
        cost: 1,
        description: text('base'),
        operations: [{ property: 'Damage', type: 'multiplyBase', value: 50 }],
      },
      {
        tier: 2,
        cost: 2,
        description: text('scale'),
        operations: [
          { property: 'Damage', type: 'multiplyScale', value: 1.5, scaleStat: 'ETechPower' },
        ],
      },
    ],
  );
  expect(evaluateAbility(a, 2, context).parameters[0].value).toBe(300);
});

it('uses explicit radius/range stats and leaves disabled functions unchanged', () => {
  const a = ability([
    param('OddName', 8, { className: 'scale_function_single_stat', stat: 'ETechRadius' }),
    param('Radius', 10, { className: 'scale_function_single_stat', stat: 'ETechRange' }),
    param('AbilityDuration', 5, {
      className: 'scale_function_single_stat',
      stat: 'ETechDuration',
      disabled: true,
    }),
  ]);
  expect(evaluateAbility(a, 0, context).parameters.map((p) => p.value)).toEqual([10.4, 11, 5]);
});

it('combines boons and remaining cooldown multipliers, healing and eligible charges', () => {
  const a = ability([
    param('AbilityCooldown', 30, {
      className: 'scale_function_multi_stats',
      stat: 'ELevelUpBoons',
      coefficient: -0.45,
      stats: ['ELevelUpBoons', 'ETechCooldown'],
    }),
    param('Heal', 100, { className: 'scale_function_healing_spirit_scale', coefficient: 0.5 }),
    param('AbilityCharges', 1, { className: 'scale_function_ability_charges' }),
    param('AbilityCooldownBetweenCharge', 10, {
      className: 'scale_function_ability_recharge_time',
    }),
  ]);
  const result = evaluateAbility(a, 0, context).parameters;
  [20.4, 180, 3, 8.5].forEach((value, index) => expect(result[index].value).toBeCloseTo(value));
});

it('does not turn a custom or weapon-dependent function into fabricated Spirit damage', () => {
  const a = ability([
    param('Carbine', 100, {
      className: 'scale_function_kinetic_carbine_damage',
      stat: 'EWeaponPower',
      coefficient: 10,
    }),
    param('Tiles', 2, { className: 'scale_function_tech_range_rounded' }),
    param('Damage', 50, { className: 'scale_function_tech_damage', coefficient: 1 }),
  ]);
  const result = evaluateAbility(a, 0, { ...context, damagePercent: -12 }).parameters;
  expect(result[0].value).toBe(100);
  expect(result[0].dependency).toBe('weapon');
  expect(result[1].value).toBe(2);
  expect(evaluateAbility(a, 0, { ...context, rangePercent: 25 }).parameters[1].value).toBe(3);
  expect(result[2].value).toBe(132);
});

it('keeps extra-feature gates out of ordinary ranks and validates inputs', () => {
  const a = ability([
    param('Extra', 10, undefined, {
      m_nRequiredUpgradeBits: 'ABILITY_UPGRADE_TRAINED | ABILITY_UPGRADE_BIT_4',
    }),
    param('Tier2', 10, undefined, { m_nRequiredUpgradeBits: 5 }),
  ]);
  expect(evaluateAbility(a, 3, context).parameters.map((p) => [p.id, p.available])).toEqual([
    ['Extra', false],
    ['Tier2', true],
  ]);
  expect(evaluateAbility(a, 0, context).parameters[1].available).toBe(false);
  expect(() => evaluateAbility(a, 4, context)).toThrow();
  expect(() => evaluateAbility(a, 0, { ...context, spirit: NaN })).toThrow();
});

it('uses bonus weapon damage points for ordinary abilities and full base burst for Carbine', () => {
  const a = ability(
    [
      param('Explosion', 70, {
        className: 'scale_function_ability_weapon_damage',
        stat: 'EBaseWeaponDamageIncrease',
        coefficient: 1.4,
      }),
      param('Carbine', 5, {
        className: 'scale_function_kinetic_carbine_damage',
        stat: 'EWeaponPower',
        coefficient: 125,
      }),
    ],
    [
      {
        tier: 1,
        cost: 1,
        description: text('scale'),
        operations: [
          {
            property: 'Explosion',
            type: 'addScale',
            value: 0.2,
            scaleStat: 'EBaseWeaponDamageIncrease',
          },
        ],
      },
    ],
  );
  const result = evaluateAbility(a, 1, {
    ...context,
    weaponDamagePercent: 50,
    baseBulletDamage: 6.8,
  });
  expect(result.parameters[0].value).toBe(150);
  expect(result.parameters[1].value).toBeCloseTo(114.75);
});

it('converts bare spatial engine units while retaining explicit metres in base and upgrades', () => {
  const a = ability(
    [
      {
        ...param('Range', 200, { className: 'scale_function_single_stat', stat: 'ETechRange' }),
        displayUnits: 'EDisplayUnit_Meters',
        unit: 'm',
      },
    ],
    [
      {
        tier: 1,
        cost: 1,
        description: text('range'),
        operations: [{ property: 'Range', type: 'addBase', value: '2m' }],
      },
    ],
  );
  expect(evaluateAbility(a, 1, { ...context, rangePercent: 0 }).parameters[0].value).toBeCloseTo(
    7.08,
  );
});

it('uses supplied actual melee damage instead of treating melee as Spirit', () => {
  const a = ability([
    param('Uppercut', 0, {
      className: 'scale_function_single_stat',
      stat: 'ELightMeleeDamage',
      coefficient: 1,
    }),
  ]);
  expect(evaluateAbility(a, 0, { ...context, lightMeleeDamage: 67.38 }).parameters[0].value).toBe(
    67.38,
  );
});

it('applies outgoing damage modifiers to real source-marked damage beyond tech_damage classes', () => {
  const a = ability([
    param(
      'SwapDamage',
      150,
      { className: 'scale_function_single_stat', stat: 'ETechPower', coefficient: 1.1 },
      { m_bIsAbilityDamageProperty: true },
    ),
    param(
      'BarrageMaxDamage',
      450,
      { className: 'scale_function_single_stat', stat: 'ETechPower', coefficient: 1.6 },
      { m_bIsAbilityDamageProperty: true },
    ),
    param('FixedDamage', 50, undefined, { m_bIsAbilityDamageProperty: true }),
    {
      ...param('CombatBarrier', 125, { className: 'scale_function_tech_damage', coefficient: 0.8 }),
      cssClass: 'combat_barrier',
    },
    {
      ...param('SlowPercent', 20, { className: 'scale_function_tech_damage', coefficient: 0.08 }),
      cssClass: 'slow',
    },
  ]);
  expect(
    evaluateAbility(a, 0, { ...context, damagePercent: 50 }).parameters.map((p) => p.value),
  ).toEqual([390, 915, 75, 205, 28]);
});
