import { describe, expect, it } from 'vitest';
import { chooseBuildItem, validateBuildInventory } from './build-inventory';
import { calculateBuild } from './build-stats';
import { buildHero, buildItem, buildRules, bonus } from '../tests/fixtures/hero-build';

const slots = (...ids: number[]) => [...ids, ...Array<number | null>(12 - ids.length).fill(null)];

it('targets imbued bonuses by owning item and returns separate recharge reduction', () => {
  const spirit = buildItem(1, 'spirit', 800, [bonus('spirit', 20, 'imbuedAbility')]);
  const cooldown = buildItem(2, 'spirit', 800, [bonus('cooldownReduction', 25, 'imbuedAbility')]);
  const charges = buildItem(3, 'spirit', 800, [
    bonus('chargeCooldownReduction', 15, 'chargedAbilities'),
  ]);
  const result = calculateBuild(buildHero(), 1, [spirit, cooldown, charges], buildRules, {
    imbuedItemIds: [1],
    charged: true,
  });
  expect(result.ability.spirit).toBe(result.stats.spirit + 20);
  expect(result.ability.cooldownReduction).toBe(0);
  expect(result.ability.chargeCooldownReduction).toBeCloseTo(15);
  expect(result.stats.spirit).toBe(
    buildRules.investment.spirit.find((x) => x.souls === 2400)?.bonus,
  );
});

describe('legal build inventories', () => {
  const base = buildItem(1, 'spirit');
  const improved = buildItem(2, 'spirit', 1600, [], [1]);
  const boundless = buildItem(3, 'spirit', 6400, [], [2]);
  const second = buildItem(4);
  const multi = buildItem(5, 'spirit', 6400, [], [2, 4]);
  const sibling = buildItem(6, 'spirit', 3200, [], [1]);
  const catalog = [base, improved, boundless, second, multi, sibling];

  it('upgrades and downgrades replace transitive related items in both directions', () => {
    const upgraded = chooseBuildItem(slots(1), 1, 3, catalog, buildRules);
    expect(upgraded.slots.slice(0, 2)).toEqual([null, 3]);
    expect(upgraded.removed).toEqual([1]);
    const downgraded = chooseBuildItem(upgraded.slots, 1, 1, catalog, buildRules);
    expect(downgraded.slots[1]).toBe(1);
    expect(downgraded.slots.filter(Boolean)).toEqual([1]);
  });
  it('consumes all owned components but does not prohibit sibling upgrades', () => {
    expect(chooseBuildItem(slots(2, 4), 2, 5, catalog, buildRules).slots.filter(Boolean)).toEqual([
      5,
    ]);
    expect(() => validateBuildInventory(slots(2, 6), catalog, buildRules)).not.toThrow();
  });
  it('rejects duplicates and ancestor coexistence without mutating the draft', () => {
    const before = slots(1);
    expect(() => chooseBuildItem(before, 1, 1, catalog, buildRules)).toThrow();
    expect(before).toEqual(slots(1));
    expect(() => validateBuildInventory(slots(1, 3), catalog, buildRules)).toThrow();
  });
  it('allows at most four active items and counts a replaced item before rejecting', () => {
    const actives = Array.from({ length: 5 }, (_, i) => ({
      ...buildItem(i + 10),
      activation: 'active' as const,
    }));
    const before = slots(10, 11, 12, 13);
    expect(() => chooseBuildItem(before, 4, 14, actives, buildRules)).toThrow();
    expect(chooseBuildItem(before, 0, 14, actives, buildRules).slots[0]).toBe(14);
    expect(before[0]).toBe(10);
  });
  it('enforces nine initial and twelve maximum slots without a per-category cap', () => {
    const items = Array.from({ length: 13 }, (_, i) => buildItem(i + 20));
    expect(() =>
      validateBuildInventory(slots(...items.slice(0, 12).map((i) => i.id)), items, buildRules),
    ).not.toThrow();
    expect(() => chooseBuildItem(slots(), 9, 20, items, buildRules, 0)).toThrow();
    expect(() => validateBuildInventory([...slots(), 32], items, buildRules)).toThrow();
    expect(() => chooseBuildItem(slots(), 12, 20, items, buildRules)).toThrow();
  });
  it('rejects an unknown item, malformed slot and cyclic recipe', () => {
    expect(() => chooseBuildItem(slots(), 0, 999, catalog, buildRules)).toThrow();
    expect(() => chooseBuildItem(slots(), 0.5, 1, catalog, buildRules)).toThrow();
    expect(() => validateBuildInventory(Array(12), catalog, buildRules)).toThrow();
    expect(() =>
      chooseBuildItem(
        slots(),
        0,
        1,
        [{ ...base, components: [3] }, improved, boundless],
        buildRules,
      ),
    ).toThrow();
  });
});

describe('build investments and final stats', () => {
  it('matches level-only HP/Spirit/gun damage and rejects invalid levels or missing metadata', () => {
    const hero = buildHero();
    const result = calculateBuild(hero, 11, [], buildRules);
    expect(result.stats.health).toBe(1290);
    expect(result.stats.spirit).toBe(10);
    expect(result.stats.shotDamage).toBe(20);
    expect(result.stats.dps).toBe(40);
    expect(result.stats).toEqual(result.baseline);
    expect(() => calculateBuild(hero, 0, [], buildRules)).toThrow();
    expect(() => calculateBuild({ ...hero, calculation: undefined }, 1, [], buildRules)).toThrow();
    expect(() =>
      calculateBuild(hero, 1, [{ ...buildItem(1), calculation: undefined }], buildRules),
    ).toThrow();
  });
  it('uses only the reached threshold and counts final item cost without ancestor costs', () => {
    const hero = buildHero();
    for (const [cost, expected] of [
      [800, 9],
      [1600, 12],
      [3200, 18],
      [6400, 54],
    ] as const) {
      const result = calculateBuild(hero, 1, [buildItem(1, 'weapon', cost)], buildRules);
      expect(result.investments.weapon.bonus).toBe(expected);
      expect(result.stats.shotDamage).toBeCloseTo(10 * (1 + expected / 100));
      expect(result.totalCost).toBe(cost);
    }
    const result = calculateBuild(
      hero,
      1,
      [buildItem(1, 'weapon', 3200), buildItem(2, 'weapon', 1600)],
      buildRules,
    );
    expect(result.investments.weapon.bonus).toBe(46);
    expect(result.investments.weapon.next).toEqual({ souls: 6400, bonus: 54 });
  });
  it('adds flat HP after investment and base-health bonus, then applies max-HP penalty before final rounding', () => {
    const hero = buildHero();
    const flat = buildItem(1, 'vitality', 800, [bonus('health', 210)]);
    expect(calculateBuild(hero, 11, [flat], buildRules).stats.health).toBe(1617);
    const colossus = buildItem(2, 'vitality', 6400, [bonus('baseHealthPercent', 25)]);
    const glass = buildItem(3, 'weapon', 6400, [bonus('maxHealthPercent', -13)]);
    const result = calculateBuild(hero, 11, [flat, colossus, glass], buildRules);
    expect(result.stats.health).toBe(Math.ceil((1290 * (1 + 0.42 + 0.25) + 210) * 0.87));
  });
  it('applies Spirit percent after level, investment and flat Spirit, then scales gun and regen once', () => {
    const hero = buildHero();
    hero.scaling.bulletDamagePerSpirit = 0.14;
    hero.scaling.regenPerSpirit = 0.1;
    const item = buildItem(1, 'spirit', 6400, [bonus('spirit', 30), bonus('spiritPercent', 15)]);
    const result = calculateBuild(hero, 11, [item], buildRules);
    expect(result.stats.spirit).toBeCloseTo((10 + 45 + 30) * 1.15);
    expect(result.stats.bulletDamage).toBeCloseTo(20 + result.stats.spirit * 0.14);
    expect(result.stats.regen).toBeCloseTo(2 + result.stats.spirit * 0.1);
  });
  it('keeps negative innate resistance separate from positive pools and derives real EHP', () => {
    const hero = buildHero();
    hero.calculation!.spiritResist = -15;
    const result = calculateBuild(
      hero,
      1,
      [buildItem(1, 'spirit', 800, [bonus('spiritResist', 30)])],
      buildRules,
    );
    expect(result.stats.spiritResist).toBeCloseTo(15);
    expect(result.stats.spiritEhp).toBeCloseTo(800 / 0.85);
    const resist = calculateBuild(
      buildHero(),
      1,
      [
        buildItem(1, 'weapon', 800, [bonus('bulletResist', 40)]),
        buildItem(2, 'weapon', 800, [bonus('bulletResist', 20)]),
      ],
      buildRules,
    );
    expect(resist.stats.bulletResist).toBeCloseTo(52);
  });
  it('includes innate boon/Spirit resist growth and Spirit-based fire rate without double counting', () => {
    const hero = buildHero();
    hero.calculation!.bulletResistGrowth = 0.625;
    hero.calculation!.spiritResistPerSpirit = 0.07;
    hero.scaling.fireRatePercentPerSpirit = 0.21;
    const result = calculateBuild(
      hero,
      11,
      [buildItem(1, 'spirit', 800, [bonus('fireRatePercent', 10)])],
      buildRules,
    );
    expect(result.stats.bulletResist).toBeCloseTo(6.25);
    expect(result.stats.spiritResist).toBeCloseTo(17 * 0.07);
    expect(result.stats.shotsPerSecond).toBeCloseTo(2 * (1 + (10 + 17 * 0.21) / 100));
  });
  it('treats stamina modifiers as regeneration rate and keeps out-of-combat healing distinct', () => {
    const item = buildItem(1, 'vitality', 800, [
      bonus('staminaRegenPercent', 12),
      bonus('healthRegen', 2.5),
      bonus('outOfCombatRegen', 1.5, 'outOfCombat'),
      bonus('regenAmp', 20),
    ]);
    const result = calculateBuild(buildHero(), 1, [item], buildRules);
    expect(result.stats.staminaRegen).toBeCloseTo((1 / 4.5) * 1.12);
    expect(result.stats.regen).toBeCloseTo(4.5 * 1.2);
    expect(result.stats.outOfCombatRegen).toBeCloseTo(6 * 1.2);
  });
  it('keeps imbued and charged bonuses out of general Spirit/CDR', () => {
    const item = buildItem(1, 'spirit', 1600, [
      bonus('spirit', 7, 'chargedAbilities'),
      bonus('spirit', 28, 'imbuedAbility'),
      bonus('cooldownReduction', 18, 'imbuedAbility'),
      bonus('cooldownReduction', 10),
      bonus('durationPercent', 22, 'imbuedAbility'),
    ]);
    const plain = calculateBuild(buildHero(), 1, [item], buildRules);
    const selected = calculateBuild(buildHero(), 1, [item], buildRules, {
      charged: true,
      imbued: true,
    });
    expect(plain.stats.spirit).toBe(11);
    expect(plain.stats.cooldownReduction).toBeCloseTo(10);
    expect(selected.stats).toEqual(plain.stats);
    expect(selected.ability.spirit).toBe(46);
    expect(selected.ability.cooldownReduction).toBeCloseTo(26.2);
    expect(selected.ability.durationPercent).toBeCloseTo(22);
  });
  it('applies distance and NPC bonuses only in the chosen target context', () => {
    const item = buildItem(1, 'weapon', 800, [
      bonus('npcWeaponDamagePercent', 35, 'versusNPC'),
      bonus('closeRangeThreshold', 15),
      bonus('closeRangeWeaponDamagePercent', 20, 'closeRange'),
    ]);
    const neutral = calculateBuild(buildHero(), 1, [item], buildRules);
    expect(neutral.stats.weaponDamagePercent).toBe(9);
    const contextual = calculateBuild(buildHero(), 1, [item], buildRules, {
      distance: 10,
      versusNPC: true,
    });
    expect(contextual.stats.weaponDamagePercent).toBe(64);
    expect(contextual.stats.shotDamage).toBeCloseTo(16.4);
  });
  it('models ammo Spirit scaling before percentage and hit-once pellets once', () => {
    const hero = buildHero();
    hero.calculation!.clipSizePerSpirit = 0.5;
    hero.weapon.projectiles = 9;
    hero.weapon.hitOnce = true;
    const result = calculateBuild(
      hero,
      11,
      [buildItem(1, 'spirit', 800, [bonus('clipSizePercent', 30)])],
      buildRules,
    );
    expect(result.stats.clipSize).toBe(Math.ceil((10 + 17 * 0.5) * 1.3));
    expect(result.stats.shotDamage).toBe(20);
    expect(result.stats.sustainedDps).toBeLessThan(result.stats.dps);
  });
  it('uses per-item distance thresholds even when threshold metadata is itself scoped', () => {
    const first = buildItem(1, 'weapon', 800, [
      bonus('closeRangeThreshold', 15, 'closeRange'),
      bonus('closeRangeWeaponDamagePercent', 20, 'closeRange'),
    ]);
    const second = buildItem(2, 'weapon', 800, [
      bonus('longRangeThreshold', 20, 'longRange'),
      bonus('longRangeWeaponDamagePercent', 30, 'longRange'),
    ]);
    expect(
      calculateBuild(buildHero(), 1, [first, second], buildRules, { distance: 18 }).stats
        .weaponDamagePercent,
    ).toBe(12);
    expect(
      calculateBuild(buildHero(), 1, [first, second], buildRules, { distance: 22 }).stats
        .weaponDamagePercent,
    ).toBe(42);
    expect(() =>
      calculateBuild(buildHero(), 1, [first], buildRules, { distance: Number.NaN }),
    ).toThrow();
  });
  it('keeps all-damage penalties available to both weapon and ability examples', () => {
    const result = calculateBuild(
      buildHero(),
      1,
      [buildItem(1, 'spirit', 800, [bonus('damagePercent', -12)])],
      buildRules,
    );
    expect(result.stats.shotDamage).toBeCloseTo(8.8);
    expect(result.ability.damagePercent).toBe(-12);
  });
  it('supports intrinsic fire-rate penalties using the reciprocal branch', () => {
    const result = calculateBuild(
      buildHero(),
      1,
      [buildItem(1, 'weapon', 800, [bonus('fireRatePercent', -12)])],
      buildRules,
    );
    expect(result.stats.shotsPerSecond).toBeCloseTo(2 / 1.12);
  });
  it('retains Mina negative innate debuff resist and Graves innate bullet lifesteal', () => {
    const mina = buildHero();
    Object.assign(mina.calculation!, { debuffResist: -8, bulletLifesteal: 0 });
    expect(calculateBuild(mina, 1, [], buildRules).stats.debuffResist).toBeCloseTo(-8);
    const graves = buildHero();
    Object.assign(graves.calculation!, { debuffResist: 0, bulletLifesteal: 8 });
    expect(calculateBuild(graves, 1, [], buildRules).stats.bulletLifesteal).toBeCloseTo(8);
    const result = calculateBuild(
      graves,
      1,
      [buildItem(1, 'weapon', 800, [bonus('bulletLifesteal', 20)])],
      buildRules,
    );
    expect(result.stats.bulletLifesteal).toBeCloseTo(26.4);
  });
});
