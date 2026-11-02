import type { Hero } from '../../../../../shared/types';
import type { ShopItem } from '../../../../../shared/item-types';

export interface PatchEntity {
  kind: 'hero' | 'item';
  image: string;
  category?: ShopItem['category'];
}
export type EntityLookup = (name: string) => PatchEntity | undefined;
export interface NoteBlock {
  kind: 'heading' | 'list' | 'paragraph';
  lines: string[];
}

const normalize = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/(^|\s)(?:and|и)(?=\s|$)/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function entityLookup(heroes: Hero[], items: ShopItem[]): EntityLookup {
  const names = new Map<string, PatchEntity>();
  const aliases = heroes.map((hero) => {
    const entity: PatchEntity = { kind: 'hero', image: hero.portrait };
    names.set(normalize(hero.name), entity);
    // Valve also uses this short form in the official notes.
    if (hero.slug === 'nurse-harrow') names.set('nurse', entity);
    return { words: ` ${normalize(hero.aliases)} `, entity };
  });
  for (const item of items) {
    const entity: PatchEntity = { kind: 'item', image: item.icon, category: item.category };
    for (const name of [item.name, item.localizedName.en, item.localizedName.ru])
      names.set(normalize(name), entity);
  }
  return (value) => {
    const key = normalize(value);
    const exact = names.get(key);
    if (exact || key.length < 3) return exact;
    const matches = aliases.filter((alias) => alias.words.includes(` ${key} `));
    return matches.length === 1 ? matches[0].entity : undefined;
  };
}

export function parseNote(text: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) {
      blocks.push({ kind: 'paragraph', lines: [] });
      continue;
    }
    const heading = line.startsWith('## ') || (line.length < 65 && /^[\p{L} &/]+:$/u.test(line));
    const kind = heading ? 'heading' : /^[-•]\s/.test(line) ? 'list' : 'paragraph';
    const content = line.replace(heading ? /^##\s+/ : /^[-•]\s+/, '');
    const previous = blocks.at(-1);
    if (kind !== 'heading' && previous?.kind === kind && previous.lines.length)
      previous.lines.push(content);
    else blocks.push({ kind, lines: [content] });
  }
  return blocks.filter((block) => block.lines.length);
}

export function changeLabel(line: string) {
  const colon = line.indexOf(':');
  if (colon < 1 || colon > 80 || /[<>]/.test(line.slice(0, colon))) return undefined;
  return { name: line.slice(0, colon), rest: line.slice(colon + 1) };
}

export function needsItemIcons(text: string, lookup: EntityLookup) {
  return parseNote(text).some(
    (block) =>
      block.kind === 'list' &&
      block.lines.some((line) => {
        const label = changeLabel(line);
        return label && !lookup(label.name);
      }),
  );
}

export function numberSegments(text: string): { text: string; number: boolean }[] {
  const segments: { text: string; number: boolean }[] = [];
  const pattern = /[-+−]?\d+(?:[.,]\d+)?(?:%|m\/s|HP\/s|DPS|HP|s|m)?/giu;
  let position = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    const end = start + match[0].length;
    // Identifiers and tier markers (T3, Mk1, etc.) are ordinary text.
    if (/[\p{L}\p{N}_]/u.test(text[start - 1] ?? '') || /[\p{L}\p{N}_]/u.test(text[end] ?? ''))
      continue;
    if (start > position) segments.push({ text: text.slice(position, start), number: false });
    segments.push({ text: match[0], number: true });
    position = end;
  }
  if (position < text.length) segments.push({ text: text.slice(position), number: false });
  return segments;
}
