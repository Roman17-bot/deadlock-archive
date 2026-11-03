import type { AbilityCatalog } from './ability-types';

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
const scalar = (v: unknown) =>
  typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));
const text = (v: unknown): boolean =>
  object(v) && typeof v.ru === 'string' && typeof v.en === 'string';
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');
const safe = (v: unknown, depth = 0): boolean => {
  if (depth > 32) return false;
  if (typeof v === 'string') return v.length <= 12000 && !/<[^>]+>|javascript:/i.test(v);
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.every((x) => safe(x, depth + 1));
  if (object(v))
    return Object.entries(v).every(
      ([k, x]) => !['__proto__', 'prototype', 'constructor'].includes(k) && safe(x, depth + 1),
    );
  return v === null || typeof v === 'boolean';
};

/** Optional expected version and roster bind a lazy catalogue to the loaded hero list. */
export function validateAbilityCatalog(
  value: unknown,
  expected?: {
    clientVersion: number;
    sourceRevision?: number;
    gameCommit?: string;
    heroIds?: number[];
  },
): value is AbilityCatalog {
  if (!object(value) || !safe(value) || !object(value.meta) || !Array.isArray(value.heroes))
    return false;
  const { meta, heroes } = value;
  if (
    meta.schemaVersion !== 1 ||
    !integer(meta.clientVersion) ||
    !integer(meta.sourceRevision) ||
    typeof meta.gameCommit !== 'string' ||
    !/^[a-f0-9]{40}$/.test(meta.gameCommit) ||
    typeof meta.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(meta.updatedAt)) ||
    heroes.length < 1 ||
    heroes.length > 100
  )
    return false;
  if (
    expected &&
    (meta.clientVersion !== expected.clientVersion ||
      (expected.sourceRevision !== undefined && meta.sourceRevision !== expected.sourceRevision) ||
      (expected.gameCommit !== undefined && meta.gameCommit !== expected.gameCommit))
  )
    return false;
  const heroIds = new Set<number>();
  const abilityIds = new Set<number>();
  const detail = (a: unknown, parent?: number): boolean => {
    if (
      !object(a) ||
      !integer(a.id) ||
      abilityIds.has(a.id as number) ||
      typeof a.className !== 'string' ||
      !a.className ||
      !text(a.name) ||
      !text(a.description) ||
      !(a.name as { en: string }).en ||
      !(a.name as { ru: string }).ru ||
      typeof a.icon !== 'string' ||
      !/^assets\/abilities\/[0-9]+\.webp$/.test(a.icon) ||
      !Array.isArray(a.parameters) ||
      a.parameters.length > 150 ||
      !Array.isArray(a.upgrades) ||
      !Array.isArray(a.sections)
    )
      return false;
    abilityIds.add(a.id as number);
    if (
      parent !== undefined &&
      (a.linkedAbilityId !== parent ||
        typeof a.linkUpgrades !== 'boolean' ||
        typeof a.linkImbues !== 'boolean')
    )
      return false;
    const params = new Set<string>();
    for (const p of a.parameters) {
      if (
        !object(p) ||
        typeof p.id !== 'string' ||
        !p.id ||
        params.has(p.id) ||
        !text(p.label) ||
        !scalar(p.value) ||
        typeof p.display !== 'boolean' ||
        ['unit', 'displayUnits', 'cssClass'].some(
          (key) => p[key] !== undefined && typeof p[key] !== 'string',
        ) ||
        (p.disableValue !== undefined && !scalar(p.disableValue))
      )
        return false;
      params.add(p.id);
      if (
        p.scale !== undefined &&
        (!object(p.scale) ||
          typeof p.scale.className !== 'string' ||
          (p.scale.coefficient !== undefined &&
            (typeof p.scale.coefficient !== 'number' || !Number.isFinite(p.scale.coefficient))) ||
          (p.scale.stat !== undefined && typeof p.scale.stat !== 'string') ||
          (p.scale.stats !== undefined && !strings(p.scale.stats)) ||
          (p.scale.disabled !== undefined && typeof p.scale.disabled !== 'boolean'))
      )
        return false;
    }
    if (!(parent !== undefined && a.upgrades.length === 0) && a.upgrades.length !== 3) return false;
    for (const [i, u] of a.upgrades.entries()) {
      if (
        !object(u) ||
        u.tier !== i + 1 ||
        u.cost !== [1, 2, 5][i] ||
        !text(u.description) ||
        !Array.isArray(u.operations)
      )
        return false;
      if (
        !u.operations.every(
          (op: unknown) =>
            object(op) &&
            typeof op.property === 'string' &&
            !!op.property &&
            ['add', 'addBase', 'multiplyBase', 'addScale', 'multiplyScale', 'set'].includes(
              String(op.type),
            ) &&
            scalar(op.value) &&
            (op.scaleStat === undefined || typeof op.scaleStat === 'string'),
        )
      )
        return false;
    }
    return a.sections.every(
      (s: unknown) =>
        object(s) &&
        text(s.description) &&
        strings(s.properties) &&
        Array.isArray(s.blocks) &&
        s.blocks.every((b: unknown) => object(b) && text(b.title) && strings(b.properties)),
    );
  };
  for (const h of heroes) {
    if (
      !object(h) ||
      !integer(h.heroId) ||
      heroIds.has(h.heroId as number) ||
      !Array.isArray(h.abilities) ||
      h.abilities.length !== 4
    )
      return false;
    heroIds.add(h.heroId as number);
    for (const [i, a] of h.abilities.entries())
      if (
        !object(a) ||
        a.slot !== i + 1 ||
        !detail(a) ||
        !Array.isArray(a.variants) ||
        !a.variants.every((v: unknown) => detail(v, a.id as number))
      )
        return false;
  }
  return (
    abilityIds.size <= 256 &&
    (!expected?.heroIds ||
      (heroIds.size === expected.heroIds.length && expected.heroIds.every((id) => heroIds.has(id))))
  );
}
