import type { WorldMapObject } from '../../../shared/world-map';
export const categories: Record<string, { ru: string; en: string; glyph: string; color: string }> =
  {
    camps: { ru: 'Кемпы', en: 'Camps', glyph: '◆', color: '#b6d292' },
    crates: { ru: 'Обычные ящики', en: 'Normal crates', glyph: '□', color: '#d8bf8c' },
    tough_crates: { ru: 'Крепкие ящики', en: 'Tough crates', glyph: '▣', color: '#eca56b' },
    golden_statues: { ru: 'Золотые статуи', en: 'Golden statues', glyph: '✦', color: '#f0d783' },
    bridge_buffs: { ru: 'Усиления на мостах', en: 'Bridge buffs', glyph: '✚', color: '#a8d6df' },
    healing_snacks: { ru: 'Лечение', en: 'Healing pickups', glyph: '+', color: '#badbb5' },
    soul_urn_spawns: { ru: 'Появление урны', en: 'Urn spawn points', glyph: 'U', color: '#d1b5ef' },
    soul_urn_pads: { ru: 'Сдача урны', en: 'Urn delivery', glyph: '◎', color: '#d1b5ef' },
    objectives: { ru: 'Постройки', en: 'Objectives', glyph: '▲', color: '#f0e6ce' },
    shops: { ru: 'Магазины', en: 'Shops', glyph: 'S', color: '#a8c9be' },
    teleporters: { ru: 'Телепорты', en: 'Teleporters', glyph: '↔', color: '#abbce9' },
    bounce_pads: { ru: 'Трамплины', en: 'Bounce pads', glyph: '↑', color: '#9cc2d7' },
    steam_vents: { ru: 'Паровые потоки', en: 'Steam vents', glyph: '≋', color: '#9cc2d7' },
    climb_ropes: { ru: 'Верёвки', en: 'Climb ropes', glyph: '↟', color: '#d0c5a5' },
    cosmic_veils: { ru: 'Космические завесы', en: 'Cosmic veils', glyph: '◌', color: '#c2b5df' },
    unstable_rifts: {
      ru: 'Нестабильные разломы',
      en: 'Unstable rifts',
      glyph: '◇',
      color: '#c2b5df',
    },
    base_sentries: { ru: 'Стражи базы', en: 'Base sentries', glyph: '△', color: '#f0e6ce' },
    bells: { ru: 'Колокола', en: 'Bells', glyph: '♧', color: '#d6be8d' },
  };
const kinds: Record<string, [string, string]> = {
  weak: ['Слабый кемп', 'Weak camp'],
  medium: ['Средний кемп', 'Medium camp'],
  strong: ['Сильный кемп', 'Strong camp'],
  vault: ['Жертвенный автомат', "Sinner's Sacrifice"],
};
export const clockTime = (seconds: number | null) =>
  seconds === null
    ? '—'
    : `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
export const gridCell = (object: WorldMapObject) =>
  `${String.fromCharCode(65 + Math.min(7, Math.floor(object.x * 8)))}${Math.min(8, Math.floor(object.y * 8) + 1)}`;
export function objectName(object: WorldMapObject, language: 'ru' | 'en') {
  let name =
    object.category === 'camps' ? kinds[object.kind ?? '']?.[language === 'ru' ? 0 : 1] : undefined;
  if (object.category === 'objectives') {
    const key = object.id.includes('core')
      ? ['Патрон', 'Patron']
      : object.id.includes('walker')
        ? ['Шагоход', 'Walker']
        : object.id.includes('guardian')
          ? ['Страж', 'Guardian']
          : ['Постройка', 'Objective'];
    name = key[language === 'ru' ? 0 : 1];
  }
  return `${name || categories[object.category]?.[language] || (language === 'ru' ? 'Объект' : 'Object')} · ${gridCell(object)}`;
}
