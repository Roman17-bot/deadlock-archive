import { describe, expect, it } from 'vitest';
import { normalizeCatalog } from './normalize';

function advice(name: string, properties = {}) {
  const raw = {
    id: 1,
    name,
    class_name: 'upgrade_advice_test',
    type: 'upgrade',
    shopable: true,
    item_slot_type: 'weapon',
    item_tier: 2,
    cost: 1600,
    properties,
  };
  return normalizeCatalog([raw], [raw], {
    clientVersion: 6821,
    sourceRevision: 11170534,
    updatedAt: '2026-10-29T00:00:00.000Z',
  }).items[0].advice;
}

describe('item-specific purchase advice during normalization', () => {
  it('explains the magazine benefit instead of giving generic shooting advice', () => {
    const result = advice('Extended Magazine', { BonusClipSizePercent: { value: '30' } });
    expect(result.map((tip) => tip.en).join(' ')).toMatch(/magazine/i);
    expect(result.map((tip) => tip.ru).join(' ')).toMatch(/магазин|боезапас|патроны/);
  });

  it('keeps Fury Trance restrictions instead of selecting its incidental resistance tag', () => {
    const result = advice('Fury Trance', { TechResist: { value: '40' } });
    const text = result.map((tip) => tip.en).join(' ');
    expect(text).toMatch(/silenc/i);
    expect(text).toMatch(/stamina/i);
  });

  it('explains what ability expansion changes', () => {
    const result = advice('Mystic Expansion', { TechRadiusMultiplier: { value: '20' } });
    expect(result.map((tip) => tip.en).join(' ')).toMatch(/radius|area/i);
  });

  it('does not invent a purchase recommendation for an unknown future item', () => {
    expect(advice('Future Shop Item', { BaseAttackDamagePercent: { value: '10' } })).toEqual([]);
  });
});
