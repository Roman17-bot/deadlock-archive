import { describe, expect, it } from 'vitest';
import {
  assertWorldMapCatalogue,
  calculateWorldMapReward,
  calculateWorldMapRoute,
  type WorldMapCatalogue,
} from '../shared/world-map';

const unit = { max_health: 142, gold_reward: 45, gold_reward_bonus_percent_per_minute: 1.08 };
const map: WorldMapCatalogue = {
  meta: { schemaVersion: 1, clientVersion: 6848 },
  radius: 10752,
  images: { mid: '/assets/maps/mid.png' },
  objects: [
    {
      id: 'camp:dock_authority_camp',
      category: 'camps',
      kind: 'weak',
      x: 0.166666,
      y: 0.559524,
      world: [-7168, -1280, 264.008179],
      layer: null,
      firstSpawnSeconds: 120,
      respawnSeconds: 85,
      perUnit: unit,
    },
    {
      id: 'crate',
      category: 'crates',
      x: 0.3,
      y: 0.3,
      layer: null,
      firstSpawnSeconds: null,
      respawnSeconds: null,
    },
    {
      id: 'tough',
      category: 'tough_crates',
      x: 0.4,
      y: 0.3,
      layer: null,
      firstSpawnSeconds: null,
      respawnSeconds: null,
    },
    {
      id: 'statue',
      category: 'golden_statues',
      x: 0.4,
      y: 0.4,
      layer: null,
      firstSpawnSeconds: null,
      respawnSeconds: null,
    },
  ],
  rules: {
    campRules: { weak: { perUnit: unit, firstSpawnSeconds: 120, respawnSeconds: 85 } },
    crates: { dropProbability: 0.6, soulsBase: 23, soulsPerMinute: 1.8 },
    toughCrates: { dropProbability: 1, soulsBase: 46, soulsPerMinute: 3.6 },
    goldenStatues: { dropProbability: 0.5 },
  },
};

describe('world map scenarios', () => {
  it('withholds vault totals because the generic death reward excludes the melee payout model', () => {
    const vault = {
      ...map.objects[0],
      id: 'camp:chinatown_bell_1',
      kind: 'vault',
      firstSpawnSeconds: 480,
      respawnSeconds: 300,
      perUnit: { max_health: 500, gold_reward: 155, gold_reward_bonus_percent_per_minute: 1.08 },
    };
    const withVault = { ...map, objects: [...map.objects, vault] };
    const reward = calculateWorldMapReward(withVault, vault.id, {
      matchSeconds: 600,
      availableConfirmed: true,
      unitCount: 1,
    });
    expect(reward).toEqual({
      expectedSouls: null,
      expectedPermanentBuffs: null,
      reason: 'reward-unknown',
    });
    const route = calculateWorldMapRoute(withVault, {
      startSeconds: 600,
      stops: [
        { objectId: 'crate', travelSeconds: 0, clearSeconds: 0, availableConfirmed: true },
        {
          objectId: vault.id,
          travelSeconds: 0,
          clearSeconds: 0,
          availableConfirmed: true,
          unitCount: 1,
        },
      ],
    });
    expect(route.knownExpectedSouls).toBeCloseTo(24.6);
    expect(route.totalExpectedSouls).toBeNull();
    expect(route.unknownRewardObjectIds).toEqual([vault.id]);
  });

  it('keeps source geometry and rejects corrupt coordinates, duplicate ids and invalid reward probabilities', () => {
    expect(() => assertWorldMapCatalogue(map)).not.toThrow();
    for (const corrupt of [
      { ...map, objects: [{ ...map.objects[0], x: Infinity }] },
      { ...map, objects: [map.objects[0], map.objects[0]] },
      { ...map, rules: { ...map.rules, crates: { ...map.rules.crates, dropProbability: 60 } } },
    ])
      expect(() => assertWorldMapCatalogue(corrupt)).toThrow();
  });

  it('requires explicit availability and per-camp unit counts; does not infer three mobs', () => {
    const reward = (availableConfirmed: boolean, unitCount?: number) =>
      calculateWorldMapReward(map, 'camp:dock_authority_camp', {
        matchSeconds: 600,
        availableConfirmed,
        unitCount,
      });
    expect(reward(false, 3).reason).toBe('availability-unknown');
    expect(reward(true).reason).toBe('unit-count-unknown');
    expect(reward(true, 2).expectedSouls).toBeCloseTo(99.72);
    expect(() => reward(true, 2.5)).toThrow();
    expect(
      calculateWorldMapReward(map, 'crate', { matchSeconds: 600, availableConfirmed: false })
        .expectedSouls,
    ).toBeNull();
  });

  it('keeps random crate expectation and permanent buffs separate', () => {
    const input = { matchSeconds: 600, availableConfirmed: true };
    expect(calculateWorldMapReward(map, 'crate', input).expectedSouls).toBeCloseTo(24.6);
    expect(calculateWorldMapReward(map, 'tough', input).expectedSouls).toBeCloseTo(82);
    expect(calculateWorldMapReward(map, 'statue', input)).toEqual({
      expectedSouls: null,
      expectedPermanentBuffs: 0.5,
      reason: 'buff',
    });
  });

  it('enforces first spawn and complete-clear respawn while using only supplied travel times', () => {
    const stop = {
      objectId: 'camp:dock_authority_camp',
      travelSeconds: 10,
      clearSeconds: 5,
      availableConfirmed: true,
      unitCount: 1,
    };
    const route = calculateWorldMapRoute(map, { startSeconds: 90, stops: [stop, stop] });
    expect(route.stops[0]).toMatchObject({
      arrivalSeconds: 100,
      readySeconds: 120,
      waitSeconds: 20,
      finishSeconds: 125,
    });
    expect(route.stops[1]).toMatchObject({
      arrivalSeconds: 135,
      readySeconds: 210,
      waitSeconds: 75,
      finishSeconds: 215,
    });
    expect(route.elapsedSeconds).toBe(125);
    const stale = calculateWorldMapRoute(map, {
      startSeconds: 90,
      stops: [stop, { ...stop, lastClearedSeconds: 0 }],
    });
    expect(stale.stops[1].readySeconds).toBe(210);
    expect(
      calculateWorldMapReward(map, stop.objectId, {
        matchSeconds: 119,
        availableConfirmed: true,
        unitCount: 1,
      }).reason,
    ).toBe('before-spawn');
  });

  it('does not turn a partial known reward sum into a whole-route total', () => {
    const route = calculateWorldMapRoute(map, {
      startSeconds: 600,
      stops: [
        { objectId: 'crate', travelSeconds: 0, clearSeconds: 0, availableConfirmed: true },
        {
          objectId: 'camp:dock_authority_camp',
          travelSeconds: 0,
          clearSeconds: 0,
          availableConfirmed: true,
        },
      ],
    });
    expect(route.knownExpectedSouls).toBeCloseTo(24.6);
    expect(route.totalExpectedSouls).toBeNull();
    expect(route.unknownRewardObjectIds).toEqual(['camp:dock_authority_camp']);
  });

  it('rejects an invented repeat-spawn for a crate and invalid travel assumptions', () => {
    const stop = { objectId: 'crate', travelSeconds: 1, clearSeconds: 1, availableConfirmed: true };
    expect(() => calculateWorldMapRoute(map, { startSeconds: 600, stops: [stop, stop] })).toThrow(
      /возрождения/,
    );
    expect(() =>
      calculateWorldMapRoute(map, { startSeconds: 600, stops: [{ ...stop, travelSeconds: -1 }] }),
    ).toThrow();
    expect(() =>
      calculateWorldMapRoute(map, {
        startSeconds: 600,
        stops: [{ ...stop, objectId: 'invented' }],
      }),
    ).toThrow();
  });
});
