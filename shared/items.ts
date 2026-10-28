import type {
  ItemCatalog,
  ItemStatistics,
  LocalizedText,
  PurchaseSummary,
  ShopItem,
} from './item-types';

const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length <= 20000;
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;
const nonnegative = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const date = (v: unknown): v is string =>
  text(v) && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
const localized = (v: unknown): v is LocalizedText => record(v) && text(v.ru) && text(v.en);
const uniqueIds = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every(positive) && new Set(v).size === v.length;

export function validateItemCatalog(value: unknown): value is ItemCatalog {
  if (!record(value) || !record(value.meta) || !Array.isArray(value.items)) return false;
  const { meta, items } = value;
  if (
    meta.schemaVersion !== 1 ||
    !positive(meta.clientVersion) ||
    !positive(meta.sourceRevision) ||
    !date(meta.updatedAt) ||
    meta.itemCount !== items.length ||
    items.length < 1 ||
    items.length > 300
  )
    return false;
  const ids = new Set<number>(),
    slugs = new Set<string>();
  const attributes = (list: unknown): boolean =>
    Array.isArray(list) &&
    list.length <= 80 &&
    list.every(
      (a) =>
        record(a) &&
        text(a.key) &&
        localized(a.label) &&
        !!a.label.ru &&
        !!a.label.en &&
        text(a.value) &&
        !!a.value &&
        (a.scaling === undefined || localized(a.scaling)),
    );
  for (const i of items) {
    if (
      !record(i) ||
      !positive(i.id) ||
      ids.has(i.id) ||
      !text(i.slug) ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(i.slug) ||
      slugs.has(i.slug) ||
      !text(i.name) ||
      !i.name ||
      !localized(i.localizedName) ||
      !i.localizedName.ru ||
      !i.localizedName.en ||
      !['weapon', 'vitality', 'spirit'].includes(String(i.category)) ||
      ![1, 2, 3, 4].includes(Number(i.tier)) ||
      !positive(i.cost) ||
      i.cost !== [0, 800, 1600, 3200, 6400][Number(i.tier)] ||
      !text(i.icon) ||
      !/^assets\/items\/[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/.test(i.icon) ||
      !['active', 'passive'].includes(String(i.activation)) ||
      !localized(i.description) ||
      !attributes(i.attributes) ||
      !Array.isArray(i.effects) ||
      i.effects.length > 12 ||
      !i.effects.every(
        (e) =>
          record(e) &&
          ['active', 'passive'].includes(String(e.kind)) &&
          localized(e.description) &&
          attributes(e.attributes),
      ) ||
      !Array.isArray(i.tags) ||
      i.tags.length > 80 ||
      !i.tags.every((t) => text(t) && /^[a-z][a-z0-9-]{0,39}$/.test(t)) ||
      new Set(i.tags).size !== i.tags.length ||
      !uniqueIds(i.components) ||
      !uniqueIds(i.upgrades) ||
      !Array.isArray(i.advice) ||
      i.advice.length > 12 ||
      !i.advice.every(localized)
    )
      return false;
    ids.add(i.id);
    slugs.add(i.slug);
  }
  return (items as unknown as ShopItem[]).every((i) =>
    [...i.components, ...i.upgrades].every((id) => ids.has(id) && id !== i.id),
  );
}

function summary(value: unknown): value is PurchaseSummary {
  return (
    record(value) &&
    nonnegative(value.matches) &&
    nonnegative(value.wins) &&
    nonnegative(value.losses) &&
    value.wins + value.losses === value.matches &&
    (value.averageBuyTimeSeconds === null ||
      (typeof value.averageBuyTimeSeconds === 'number' &&
        Number.isFinite(value.averageBuyTimeSeconds) &&
        value.averageBuyTimeSeconds >= 0 &&
        value.averageBuyTimeSeconds <= 7000))
  );
}

export function validateItemStatistics(
  value: unknown,
  catalog?: ItemCatalog,
): value is ItemStatistics {
  if (!record(value) || !record(value.meta) || !Array.isArray(value.items)) return false;
  const { meta, items } = value;
  if (
    meta.schemaVersion !== 1 ||
    !positive(meta.clientVersion) ||
    !date(meta.updatedAt) ||
    !date(meta.from) ||
    !date(meta.to) ||
    Date.parse(meta.from) >= Date.parse(meta.to) ||
    Date.parse(meta.to) > Date.parse(meta.updatedAt) ||
    meta.gameMode !== 'normal' ||
    !Array.isArray(meta.matchModes) ||
    meta.matchModes.join(',') !== 'ranked,unranked' ||
    meta.corruptedItems !== 'exclude' ||
    meta.source !== 'deadlock-api' ||
    (meta.minAverageBadge !== null &&
      (!nonnegative(meta.minAverageBadge) || meta.minAverageBadge > 116)) ||
    items.length > 300 ||
    (catalog && meta.clientVersion !== catalog.meta.clientVersion)
  )
    return false;
  const known = catalog ? new Set(catalog.items.map((i) => i.id)) : null;
  const ids = new Set<number>();
  for (const i of items) {
    if (
      !record(i) ||
      !positive(i.itemId) ||
      ids.has(i.itemId) ||
      (known && !known.has(i.itemId)) ||
      !summary(i) ||
      !Array.isArray(i.heroes) ||
      i.heroes.length > 100 ||
      !i.heroes.every((h) => record(h) && positive(h.heroId) && summary(h)) ||
      new Set(i.heroes.map((h) => h.heroId)).size !== i.heroes.length
    )
      return false;
    ids.add(i.itemId);
  }
  return true;
}
