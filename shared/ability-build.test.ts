import { expect, it } from 'vitest';
import { calculateHeroAbility } from './ability-build';
import { abilityFixture } from '../tests/fixtures/hero-abilities';
import { bonus, buildHero, buildItem, buildRules } from '../tests/fixtures/hero-build';

it('uses real level, item investment and cumulative upgrades and targets each imbued item', () => {
  const spirit = buildItem(1, 'spirit', 800, [bonus('spirit', 20, 'imbuedAbility')]);
  const cooldown = buildItem(2, 'spirit', 800, [bonus('cooldownReduction', 25, 'imbuedAbility')]);
  const result = calculateHeroAbility(
    abilityFixture(),
    2,
    buildHero(),
    11,
    [spirit, cooldown],
    buildRules,
    { imbuedItemIds: [1] },
  );
  expect(result.parameters.find((p) => p.id === 'Damage')?.value).toBe(161);
  expect(result.parameters.find((p) => p.id === 'AbilityCooldown')?.value).toBe(30);
  const second = calculateHeroAbility(
    abilityFixture(),
    2,
    buildHero(),
    11,
    [spirit, cooldown],
    buildRules,
    { imbuedItemIds: [2] },
  );
  expect(second.parameters.find((p) => p.id === 'Damage')?.value).toBe(141);
  expect(second.parameters.find((p) => p.id === 'AbilityCooldown')?.value).toBe(22.5);
});

it('infers ultimate and charged scopes without global toggles', () => {
  const a = abilityFixture(4, 4);
  a.parameters.push({
    id: 'AbilityCharges',
    label: { ru: 'Заряды', en: 'Charges' },
    value: 1,
    display: true,
    scale: { className: 'scale_function_ability_charges' },
  });
  const items = [
    buildItem(1, 'spirit', 800, [
      bonus('ultimateCooldownReduction', 20, 'ultimate'),
      bonus('charges', 1, 'chargedAbilities'),
    ]),
  ];
  const result = calculateHeroAbility(a, 0, buildHero(), 1, items, buildRules);
  expect(result.parameters.find((p) => p.id === 'AbilityCooldown')?.value).toBeCloseTo(32);
  expect(result.parameters.find((p) => p.id === 'AbilityCharges')?.value).toBe(2);
});

it('computes level/Spirit melee and half ordinary weapon damage using exact hero inputs', () => {
  const hero = buildHero();
  Object.assign(hero.calculation!, {
    lightMeleeDamage: 50,
    heavyMeleeDamage: 116,
    meleeGrowth: 1.58,
    heavyMeleePerSpirit: 0,
  });
  const a = abilityFixture();
  a.parameters = [
    {
      id: 'Heavy',
      label: { ru: 'Тяжёлый', en: 'Heavy' },
      value: 0,
      display: true,
      scale: { className: 'scale_function_single_stat', stat: 'EHeavyMeleeDamage', coefficient: 1 },
    },
  ];
  const items = [buildItem(1, 'weapon', 800, [bonus('weaponDamagePercent', 41)])];
  expect(calculateHeroAbility(a, 0, hero, 11, items, buildRules).parameters[0].value).toBeCloseTo(
    190.82,
  );
});
