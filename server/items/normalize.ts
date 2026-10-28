import type {
  ItemAttribute,
  ItemCatalog,
  ItemEffect,
  ItemStatistics,
  LocalizedText,
  PurchaseSummary,
} from '../../shared/item-types';
import { validateItemCatalog, validateItemStatistics } from '../../shared/items';
import { itemAdvice, itemTags, type RawItem, type RawProperty } from './traits';

export function plainText(input: string): string {
  return input
    .replace(/<(svg|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\uE000')
    .replace(/<\/(?:p|div|li)>/gi, '\uE000')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => {
      const code = Number.parseInt(n.startsWith('x') ? n.slice(1) : n, n.startsWith('x') ? 16 : 10);
      return code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/\s+/g, ' ')
    .replace(/\uE000/g, '\n')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/([.!?])(?=[A-ZА-ЯЁ])/g, '$1 ')
    .trim();
}
const local = (ru: string, en: string): LocalizedText => ({ ru, en });
const text = (value: string | undefined, properties: Record<string, RawProperty>) => {
  const output = plainText(value ?? '').replace(/\{s:([^}]+)\}/g, (_token, key: string) => {
    const value = properties[key]?.value;
    if (value === undefined) throw new Error(`Unresolved item token: ${key}`);
    return String(value);
  });
  if (/\{[a-z]:[^}]+\}/i.test(output)) throw new Error('Unresolved item token');
  return output.replace(/\b(\d+(?:\.\d+)?)mm\b/g, '$1m');
};
const normal = (item: RawItem) =>
  item.type === 'upgrade' &&
  item.shopable === true &&
  item.disabled !== true &&
  [1, 2, 3, 4].includes(item.item_tier ?? 0) &&
  ['weapon', 'vitality', 'spirit'].includes(item.item_slot_type ?? '');
export const itemSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function attribute(key: string, en: RawItem, ru: RawItem): ItemAttribute | null {
  const p = en.properties[key],
    r = ru.properties[key];
  if (
    !p ||
    p.value === undefined ||
    p.value === null ||
    String(p.value).trim() === '' ||
    String(p.value) === p.disable_value ||
    !p.label
  )
    return null;
  let value = String(p.value).trim();
  const prefix =
    p.prefix === '{s:sign}'
      ? Number.parseFloat(value) >= 0 && !value.startsWith('+')
        ? '+'
        : ''
      : (p.prefix ?? '');
  let postfix = plainText(p.postfix ?? '').trim();
  if (
    p.display_units === 'EDisplayUnit_MetersPerSecond' ||
    (/(?:MoveSpeed|Movespeed|SprintSpeed)$/.test(key) && postfix === 'm')
  )
    postfix = 'm/s';
  if (postfix) {
    const numeric = value.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(?:m(?:\/s)?|s|%|HP\/s)?$/);
    if (numeric) value = numeric[1] + (postfix === '%' ? '%' : ` ${postfix}`);
    else if (!value.endsWith(postfix)) value += postfix === '%' ? '%' : ` ${postfix}`;
  }
  value = prefix + value;
  if (/\{[a-z]:/i.test(value)) throw new Error(`Unresolved attribute token: ${key}`);
  const result: ItemAttribute = {
    key,
    label: local(plainText(r?.label ?? p.label), plainText(p.label)),
    value,
  };
  const scale = p.scale_function;
  if (scale?.stat_scale && Number.isFinite(scale.stat_scale)) {
    const n = scale.stat_scale,
      coefficient = `${n > 0 ? '+' : ''}${n}`;
    if (
      scale.specific_stat_scale_type === 'ETechPower' ||
      scale.class_name === 'scale_function_healing_spirit_scale'
    )
      result.scaling = local(`${coefficient} за 1 Spirit`, `${coefficient} per 1 Spirit`);
    else if (scale.specific_stat_scale_type === 'ELevelUpBoons')
      result.scaling = local(
        `${coefficient} за уровень после первого`,
        `${coefficient} per level after the first`,
      );
  }
  return result;
}

export function normalizeCatalog(
  english: unknown,
  russian: unknown,
  meta: { clientVersion: number; sourceRevision: number; updatedAt: string },
): ItemCatalog {
  if (!Array.isArray(english) || !Array.isArray(russian)) throw new Error('Invalid item assets');
  const rows = (english as RawItem[]).filter(normal);
  const translated = new Map((russian as RawItem[]).map((i) => [i.id, i]));
  const classes = new Map(rows.map((i) => [i.class_name, i.id]));
  const items = rows.map((en) => {
    const ru = translated.get(en.id);
    if (!ru || ru.class_name !== en.class_name || !ru.name)
      throw new Error(`Missing Russian item: ${en.id}`);
    if (!en.properties || !ru.properties) throw new Error('Missing item properties');
    const innate: ItemAttribute[] = [],
      effects: ItemEffect[] = [];
    const descriptions: { ru: string[]; en: string[] } = { ru: [], en: [] };
    for (const [index, section] of (en.tooltip_sections ?? []).entries()) {
      const ruSection = ru.tooltip_sections?.[index];
      const attributes: ItemAttribute[] = [],
        paragraphs: { ru: string[]; en: string[] } = { ru: [], en: [] };
      const used = new Set<string>();
      for (const [aIndex, a] of (section.section_attributes ?? []).entries()) {
        if (a.loc_string) {
          paragraphs.en.push(text(a.loc_string, en.properties));
          paragraphs.ru.push(
            text(
              ruSection?.section_attributes?.[aIndex]?.loc_string ?? a.loc_string,
              ru.properties,
            ),
          );
        }
        for (const key of [
          ...(a.elevated_properties ?? []),
          ...(a.properties ?? []),
          ...(a.important_properties ?? []),
        ]) {
          if (used.has(key)) continue;
          used.add(key);
          const value = attribute(key, en, ru);
          if (value) attributes.push(value);
        }
      }
      if (section.section_type === 'innate') innate.push(...attributes);
      else if (attributes.length || paragraphs.en.length) {
        descriptions.en.push(...paragraphs.en);
        descriptions.ru.push(...paragraphs.ru);
        effects.push({
          kind:
            section.section_type === 'active' || (!section.section_type && en.is_active_item)
              ? 'active'
              : 'passive',
          description: local(paragraphs.ru.join('\n\n'), paragraphs.en.join('\n\n')),
          attributes,
        });
      }
    }
    // Some releases expose property sections without a matching tooltip section.
    if (!innate.length)
      for (const [key, p] of Object.entries(en.properties))
        if (p.tooltip_section === 'innate') {
          const a = attribute(key, en, ru);
          if (a) innate.push(a);
        }
    const displayed = new Set(
      [...innate, ...effects.flatMap((e) => e.attributes)].map((a) => a.key),
    );
    const fallbackKeys = [
      'AbilityCooldown',
      ...(en.is_active_item
        ? ['AbilityDuration', 'AbilityCastRange', 'AbilityChannelTime', 'AbilityCastDelay']
        : []),
      ...(en.name === 'Cultist Sacrifice'
        ? ['BonusSoulsPct', 'BonusAbilityCharges', 'TechRadiusMultiplier']
        : []),
    ];
    for (const key of fallbackKeys)
      if (!displayed.has(key) && Number.parseFloat(String(en.properties[key]?.value)) > 0) {
        const a = attribute(key, en, ru);
        if (!a) continue;
        let effect = effects.find((e) => e.kind === (en.is_active_item ? 'active' : 'passive'));
        if (!effect) {
          effect = {
            kind: en.is_active_item ? 'active' : 'passive',
            description: local('', ''),
            attributes: [],
          };
          effects.push(effect);
        }
        effect.attributes.push(a);
        displayed.add(key);
      }
    const fallbackEn = Object.values(en.description ?? {})
      .map((s) => text(s, en.properties))
      .filter(Boolean);
    const fallbackRu = Object.values(ru.description ?? {})
      .map((s) => text(s, ru.properties))
      .filter(Boolean);
    const description = local(
      [...new Set(descriptions.ru.length ? descriptions.ru : fallbackRu)].join('\n\n'),
      [...new Set(descriptions.en.length ? descriptions.en : fallbackEn)].join('\n\n'),
    );
    const tags = itemTags(en);
    return {
      id: en.id,
      slug: itemSlug(en.name),
      name: plainText(en.name),
      localizedName: local(plainText(ru.name), plainText(en.name)),
      category: en.item_slot_type as 'weapon' | 'vitality' | 'spirit',
      tier: en.item_tier as 1 | 2 | 3 | 4,
      cost: en.cost!,
      icon: `assets/items/${itemSlug(en.name)}.webp`,
      activation: en.is_active_item ? ('active' as const) : ('passive' as const),
      description,
      attributes: innate,
      effects,
      tags,
      components: (en.component_items ?? []).map((c) => {
        const id = classes.get(c);
        if (!id) throw new Error(`Missing component: ${c}`);
        return id;
      }),
      upgrades: [] as number[],
      advice: itemAdvice(en, tags),
    };
  });
  for (const item of items)
    for (const id of item.components) items.find((i) => i.id === id)!.upgrades.push(item.id);
  const result: ItemCatalog = {
    meta: { schemaVersion: 1, ...meta, itemCount: items.length },
    items,
  };
  if (!validateItemCatalog(result)) throw new Error('Invalid normalized item catalog');
  return result;
}

interface RawObservation {
  item_id: number;
  bucket: number;
  wins: number;
  losses: number;
  matches: number;
  avg_buy_time_s: number;
}
function purchase(raw: RawObservation): PurchaseSummary {
  const value = {
    matches: raw.matches,
    wins: raw.wins,
    losses: raw.losses,
    averageBuyTimeSeconds: raw.matches === 0 ? null : raw.avg_buy_time_s,
  };
  if (
    ![value.matches, value.wins, value.losses].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    value.wins + value.losses !== value.matches ||
    (value.averageBuyTimeSeconds !== null &&
      (!Number.isFinite(value.averageBuyTimeSeconds) ||
        value.averageBuyTimeSeconds < 0 ||
        value.averageBuyTimeSeconds > 7000))
  )
    throw new Error('Invalid purchase observation');
  return value;
}
export function normalizeStatistics(
  overall: unknown,
  byHero: unknown,
  meta: { clientVersion: number; updatedAt: string; from: string; to: string },
  catalog: ItemCatalog,
): ItemStatistics {
  if (!Array.isArray(overall) || !Array.isArray(byHero))
    throw new Error('Invalid purchase statistics');
  const known = new Set(catalog.items.map((i) => i.id));
  const grouped = new Map<number, RawObservation[]>();
  for (const row of byHero as RawObservation[])
    if (known.has(row.item_id)) {
      if (!Number.isSafeInteger(row.bucket) || row.bucket <= 0)
        throw new Error('Invalid hero bucket');
      const list = grouped.get(row.item_id) ?? [];
      list.push(row);
      grouped.set(row.item_id, list);
    }
  const result: ItemStatistics = {
    meta: {
      schemaVersion: 1,
      ...meta,
      gameMode: 'normal',
      matchModes: ['ranked', 'unranked'],
      minAverageBadge: null,
      corruptedItems: 'exclude',
      source: 'deadlock-api',
    },
    items: (overall as RawObservation[])
      .filter((r) => known.has(r.item_id))
      .map((row) => ({
        itemId: row.item_id,
        ...purchase(row),
        heroes: (grouped.get(row.item_id) ?? [])
          .map((h) => ({ heroId: h.bucket, ...purchase(h) }))
          .sort((a, b) => b.matches - a.matches || a.heroId - b.heroId),
      })),
  };
  if (!validateItemStatistics(result, catalog))
    throw new Error('Invalid normalized item statistics or cohort dates');
  return result;
}
