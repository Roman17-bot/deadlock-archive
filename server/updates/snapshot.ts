import type { Hero, HeroSnapshot } from '../../shared/types.ts';
import { validateSnapshot } from '../../shared/heroes.ts';

type Data = Record<string, any>;
export interface AdapterPolicy {
  schemaVersion: number;
  adapter: string;
  supportedScaling: string[];
  ignoredBoonModifiers: string[];
  knownChargedWeapons: string[];
  knownWeaponFields: string[];
}
export interface CandidateInput {
  current: HeroSnapshot;
  heroes: Data;
  abilities: Data;
  apiHeroes: Data[];
  activeHeroes: Data[];
  apiItems: Data[];
  heroesText: string;
  abilitiesText: string;
  policy: AdapterPolicy;
  version: number;
  revision: number;
  commit: string;
  checkedAt: string;
  buildDate: string;
}
const object = (v: any, label: string): Data => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`Missing object ${label}`);
  return v;
};
const number = (v: any, label: string): number => {
  if (typeof v !== 'number' || !Number.isFinite(v))
    throw new Error(`Missing/invalid number ${label}`);
  return v;
};
export const boolean = (v: any, label: string): boolean => {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  throw new Error(`Invalid boolean ${label}`);
};
const equal = (a: any, b: any, label: string) => {
  if (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) > 1e-8 : a !== b)
    throw new Error(`API/raw disagreement ${label}: ${a} vs ${b}`);
};
const unique = (items: Data[], key: string) => {
  const map = new Map<any, Data>();
  for (const item of items) {
    if (!item || map.has(item[key])) throw new Error(`Duplicate/malformed ${key}`);
    map.set(item[key], item);
  }
  return map;
};
const line = (source: string, key: string) => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^\\s*"?${escaped}"?\\s*=`, 'm').exec(source);
  if (!match) throw new Error(`Missing source line ${key}`);
  return source.slice(0, match.index).split('\n').length;
};
const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export function buildSnapshot(input: CandidateInput): HeroSnapshot {
  const {
    current,
    heroes,
    abilities,
    apiHeroes,
    activeHeroes,
    apiItems,
    policy,
    version,
    revision,
    commit,
    checkedAt,
  } = input;
  if (policy.schemaVersion !== 1 || policy.adapter !== 'materialized-kv3-v1')
    throw new Error('Unsupported updater policy');
  if (
    heroes.generic_data_type !== 'CitadelHeroData_t' ||
    abilities.generic_data_type !== 'CitadelAbilityVData'
  )
    throw new Error('Unknown raw schema');
  const apiById = unique(apiHeroes, 'id');
  const active = unique(activeHeroes, 'id');
  const items = unique(apiItems, 'class_name');
  const rawById = new Map<number, [string, Data]>();
  const rawReleased = new Map<number, boolean>();
  for (const [name, value] of Object.entries(heroes)) {
    if (!value || typeof value !== 'object' || !('m_HeroID' in value)) continue;
    const id = number(value.m_HeroID, 'hero ID');
    if (id === 0) continue;
    if (!Number.isInteger(id) || id < 0 || rawById.has(id))
      throw new Error('Duplicate/invalid raw hero ID');
    rawById.set(id, [name, value]);
    const state = value.m_eHeroDevelopmentState;
    if (!['EHeroDevState_Release', 'EHeroDevState_DebugOnly', undefined].includes(state))
      throw new Error(`Unknown development state ${state}`);
    const released =
      state === undefined
        ? !boolean(value.m_bDisabled ?? false, 'disabled') &&
          !boolean(value.m_bInDevelopment ?? false, 'in development') &&
          boolean(value.m_bPlayerSelectable, `${name} selectable`)
        : state === 'EHeroDevState_Release';
    rawReleased.set(id, released && !boolean(value.m_bDisabled ?? false, 'disabled'));
    if (rawReleased.get(id) && !active.has(id))
      throw new Error(`Released raw hero absent from API active roster ${id}`);
  }
  const result: Hero[] = [];
  for (const [id, api] of apiById) {
    if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid API hero ID');
    if (
      api.development_state !== undefined &&
      !['release', 'in_development', 'prototype', 'experimental', 'not_in_development'].includes(
        api.development_state,
      )
    )
      throw new Error('Unknown API release state');
    const released =
      api.development_state === undefined
        ? boolean(api.player_selectable, 'selectable') &&
          !boolean(api.in_development ?? false, 'in development')
        : api.development_state === 'release';
    const selected = released && !boolean(api.disabled, 'API disabled');
    if (selected !== active.has(id)) throw new Error(`API active roster disagreement ${id}`);
    if (!selected) continue;
    const raw = rawById.get(id);
    if (!raw) throw new Error(`Missing raw hero ${id}`);
    const [className, h] = raw;
    equal(className, api.class_name, 'hero class');
    equal(rawReleased.get(id), true, 'raw release state');
    if (boolean(h.m_bDisabled ?? false, 'raw disabled'))
      throw new Error('Disabled raw hero in roster');
    const stats = object(h.m_mapStartingStats, `${className} materialized starting stats`);
    const upgrades = object(h.m_mapStandardLevelUpUpgrades, 'standard upgrades');
    const scales = object(h.m_mapScalingStats ?? {}, 'scales');
    const levels = object(h.m_mapLevelInfo, 'levels');
    for (let level = 1; level <= 36; level++) {
      const entry = object(levels[level], `level ${level}`);
      if (boolean(entry.m_bUseStandardUpgrade ?? false, 'standard level upgrade') !== level > 1)
        throw new Error('Unsupported boon schedule');
      for (const key of Object.keys(entry))
        if (!['m_bUseStandardUpgrade', 'm_unRequiredGold', 'm_mapBonusCurrencies'].includes(key))
          throw new Error(`Unknown level modifier ${key}`);
      if (api.level_info) {
        equal(
          boolean(entry.m_bUseStandardUpgrade ?? false, 'raw boon'),
          boolean(api.level_info[level]?.use_standard_upgrade ?? false, 'API boon'),
          'level schedule',
        );
      }
    }
    const consumed = [
      'MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL',
      'MODIFIER_VALUE_TECH_POWER',
      'MODIFIER_VALUE_BASE_BULLET_DAMAGE_FROM_LEVEL',
      'MODIFIER_VALUE_OUT_OF_COMBAT_HEALTH_REGEN',
      'MODIFIER_VALUE_BOON_COUNT',
    ];
    for (const [key, value] of Object.entries(upgrades)) {
      number(value, key);
      if (!consumed.includes(key) && !policy.ignoredBoonModifiers.includes(key))
        throw new Error(`Unsupported boon modifier ${key}`);
      equal(value, api.standard_level_up_upgrades?.[key], `boon ${key}`);
    }
    if (upgrades.MODIFIER_VALUE_BOON_COUNT !== 1) throw new Error('Unsupported boon count');
    // Out-of-combat regeneration is not interchangeable with base regeneration in this model.
    if ((upgrades.MODIFIER_VALUE_OUT_OF_COMBAT_HEALTH_REGEN ?? 0) !== 0)
      throw new Error('Unsupported out-of-combat regen boon');
    if (Object.keys(api.standard_level_up_upgrades ?? {}).some((key) => !(key in upgrades)))
      throw new Error('Extra API boon modifier');
    for (const [key, value] of Object.entries(scales)) {
      if (!policy.supportedScaling.includes(key) || value.eScalingStat !== 'ETechPower')
        throw new Error(`Unsupported scaling ${key}`);
      number(value.flScale, 'scale');
      equal(value.flScale, api.scaling_stats?.[key]?.scale, `scaling ${key}`);
      equal(value.eScalingStat, api.scaling_stats?.[key]?.scaling_stat, `scaling source ${key}`);
    }
    if (Object.keys(api.scaling_stats ?? {}).some((key) => !(key in scales)))
      throw new Error('Extra API scaling');
    const stat = (rawKey: string, apiKey: string, fallback?: number) => {
      const v = number(stats[rawKey] ?? fallback, rawKey);
      equal(v, api.starting_stats?.[apiKey]?.value ?? fallback, rawKey);
      return v;
    };
    const growth = (key: string, fallback?: number) => number(upgrades[key] ?? fallback, key);
    const scale = (key: string) => scales[key]?.flScale ?? 0;
    const weaponName = object(h.m_mapBoundAbilities, 'weapon binding').ESlot_Weapon_Primary;
    equal(weaponName, api.items?.weapon_primary, 'primary binding');
    if (typeof weaponName !== 'string') throw new Error('Missing primary weapon binding');
    const weaponEntry = object(abilities[weaponName], weaponName);
    const weapon = object(
      object(weaponEntry.m_mapWeaponInfos, 'materialized weapon map').primary,
      'primary weapon',
    );
    const apiWeapon = object(items.get(weaponName)?.weapon_info, 'API primary weapon');
    for (const key of Object.keys(weapon))
      if (!policy.knownWeaponFields.includes(key))
        throw new Error(`Unsupported weapon field ${key}`);
    const wn = (rawKey: string, apiKey: string, fallback?: number) => {
      const v = number(weapon[rawKey] ?? fallback, rawKey);
      equal(v, apiWeapon[apiKey] ?? fallback, rawKey);
      return v;
    };
    // API omits several raw special flags (including hit-once and charge); raw remains authoritative.
    const wb = (rawKey: string, apiKey: string) => {
      const v = boolean(weapon[rawKey] ?? false, rawKey);
      if (apiKey in apiWeapon) equal(v, boolean(apiWeapon[apiKey], apiKey), rawKey);
      return v;
    };
    if (wb('m_bChargesUp', 'charges_up') && !policy.knownChargedWeapons.includes(weaponName))
      throw new Error(`Unsupported charged primary ${weaponName}`);
    const damage = wn('m_flBulletDamage', 'bullet_damage');
    const cycle = wn('m_flCycleTime', 'cycle_time');
    const intra = wn('m_flIntraBurstCycleTime', 'intra_burst_cycle_time', 0);
    const burst = wn('m_iBurstShotCount', 'burst_shot_count', 1);
    const sps = burst / (cycle + (burst - 1) * intra);
    const fireScale = scale('EFireRate');
    const roundsScale = scale('ERoundsPerSecond');
    if (Math.abs(roundsScale - (fireScale * sps) / 100) > 1e-8)
      throw new Error('Unsupported Spirit fire-rate representation');
    const previous = current.heroes.find((hero) => hero.id === id);
    if (typeof api.name !== 'string' || !api.name.trim()) throw new Error('Missing hero name');
    const slug = previous?.slug ?? slugify(api.name);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Unsafe hero slug');
    const spinsUp = wb('m_bSpinsUp', 'spins_up');
    const fullSpin =
      weapon.m_flMaxSpinCycleTime === undefined
        ? null
        : wn('m_flMaxSpinCycleTime', 'max_spin_cycle_time');
    if (spinsUp && !(fullSpin && fullSpin > 0)) throw new Error('Missing full-spin timing');
    const hero: Hero = {
      id,
      slug,
      name: api.name,
      aliases: previous?.aliases ?? '',
      tags: Array.isArray(api.tags) ? api.tags : [],
      isNew: previous?.isNew ?? true,
      portrait: previous?.portrait ?? `assets/heroes/${slug}.webp`,
      base: {
        health: stat('EMaxHealth', 'max_health'),
        spirit: stat('ETechPower', 'tech_power', 0),
        regen: stat('EBaseHealthRegen', 'base_health_regen'),
        bulletDamage: damage,
        moveSpeed: stat('EMaxMoveSpeed', 'max_move_speed'),
        stamina: stat('EStamina', 'stamina'),
      },
      growth: {
        health: growth('MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL'),
        spirit: growth('MODIFIER_VALUE_TECH_POWER'),
        regen: growth('MODIFIER_VALUE_OUT_OF_COMBAT_HEALTH_REGEN', 0),
        bulletDamage: growth('MODIFIER_VALUE_BASE_BULLET_DAMAGE_FROM_LEVEL'),
      },
      scaling: {
        bulletDamagePerSpirit: scale('EBulletDamage'),
        regenPerSpirit: scale('EBaseHealthRegen'),
        fireRatePercentPerSpirit: fireScale,
      },
      weapon: {
        className: weaponName,
        projectiles: wn('m_iBullets', 'bullets', 1),
        burst,
        cycleTime: cycle,
        intraBurstTime: intra,
        shotsPerSecond: sps,
        spinsUp,
        fullSpinCycle: fullSpin,
        hitOnce: wb('m_bHitOnceAcrossAllBullets', 'hit_once_across_all_bullets'),
        clipSize: wn('m_iClipSize', 'clip_size'),
        reloadSeconds: wn('m_reloadDuration', 'reload_duration'),
        notes: previous?.weapon.notes ?? [],
      },
      source: {
        heroUrl: `https://github.com/SteamTracking/GameTracking-Deadlock/blob/${commit}/game/citadel/pak01_dir/scripts/heroes.vdata`,
        weaponUrl: `https://github.com/SteamTracking/GameTracking-Deadlock/blob/${commit}/game/citadel/pak01_dir/scripts/abilities.vdata`,
        heroLine: line(input.heroesText, className),
        weaponLine: line(input.abilitiesText, weaponName),
      },
    };
    if (
      hero.base.moveSpeed <= 0 ||
      hero.base.stamina < 0 ||
      hero.base.regen < 0 ||
      hero.base.spirit < 0 ||
      hero.base.bulletDamage <= 0 ||
      hero.weapon.clipSize <= 0 ||
      hero.weapon.reloadSeconds < 0 ||
      Object.values(hero.growth).some((v) => v < 0) ||
      Object.values(hero.scaling).some((v) => v < 0)
    )
      throw new Error('Unsupported negative/out-of-range candidate stats');
    result.push(hero);
  }
  if (result.length !== active.size || !result.length) throw new Error('Incomplete roster');
  if (new Set(result.map((hero) => hero.slug)).size !== result.length)
    throw new Error('Duplicate hero slug');
  result.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const snapshot: HeroSnapshot = {
    meta: {
      ...current.meta,
      checkedAt,
      snapshotDate: checkedAt.slice(0, 10),
      clientVersion: version,
      sourceRevision: revision,
      gameCommit: commit,
      buildDate: input.buildDate,
      heroCount: result.length,
      sources: [
        {
          label: `Параметры героев · клиент ${version}`,
          url: `https://api.deadlock-api.com/v1/assets/heroes?client_version=${version}`,
        },
        {
          label: `Оружие · клиент ${version}`,
          url: `https://api.deadlock-api.com/v1/assets/items?client_version=${version}`,
        },
        {
          label: 'Исходные файлы игры · фиксированная ревизия',
          url: `https://github.com/SteamTracking/GameTracking-Deadlock/tree/${commit}/game/citadel/pak01_dir/scripts`,
        },
      ],
    },
    heroes: result,
  };
  if (!validateSnapshot(snapshot)) throw new Error('Candidate snapshot schema validation failed');
  return snapshot;
}
