import { describe, expect, it } from 'vitest';
import { validateAbilityCatalog } from './abilities';

const text = { ru: 'Текст', en: 'Text' };
const fixture = () => ({
  meta: {
    schemaVersion: 1,
    clientVersion: 6842,
    sourceRevision: 11196939,
    gameCommit: 'a'.repeat(40),
    updatedAt: '2026-11-03T00:00:00Z',
  },
  heroes: [
    {
      heroId: 6,
      abilities: Array.from({ length: 4 }, (_, i) => ({
        id: i + 1,
        className: `ability${i}`,
        slot: i + 1,
        name: text,
        description: text,
        icon: `assets/abilities/${i + 1}.webp`,
        parameters: [
          {
            id: 'Damage',
            label: text,
            value: 10,
            display: true,
            scale: {
              className: 'scale_function_tech_damage',
              stat: 'ETechPower',
              coefficient: 0.6,
              disabled: true,
            },
          },
        ],
        upgrades: [1, 2, 3].map((tier) => ({
          tier,
          cost: [1, 2, 5][tier - 1],
          description: text,
          operations: [
            { property: 'Damage', type: 'addScale', value: 0.12, scaleStat: 'ETechPower' },
          ],
        })),
        sections: [],
        variants: [],
      })),
    },
  ],
});
describe('ability catalogue contract', () => {
  it.each(['unit', 'displayUnits', 'cssClass'])('rejects malformed optional %s', (field) => {
    const data = fixture();
    Object.assign(data.heroes[0].abilities[0].parameters[0], { [field]: { bad: 'value' } });
    expect(validateAbilityCatalog(data)).toBe(false);
  });
  it('binds exact roster and version and accepts retained disabled scales', () => {
    expect(validateAbilityCatalog(fixture(), { clientVersion: 6842, heroIds: [6] })).toBe(true);
    expect(validateAbilityCatalog(fixture(), { clientVersion: 6841 })).toBe(false);
    expect(validateAbilityCatalog(fixture(), { clientVersion: 6842, heroIds: [6, 7] })).toBe(false);
  });
  it('rejects broken slots, duplicate ids, unsafe text and unknown operations', () => {
    const slot = fixture();
    slot.heroes[0].abilities[1].slot = 1;
    expect(validateAbilityCatalog(slot)).toBe(false);
    const id = fixture();
    id.heroes[0].abilities[1].id = 1;
    expect(validateAbilityCatalog(id)).toBe(false);
    const html = fixture();
    html.heroes[0].abilities[0].description = { ru: '<script>x</script>', en: 'x' };
    expect(validateAbilityCatalog(html)).toBe(false);
    const op = fixture();
    op.heroes[0].abilities[0].upgrades[0].operations[0].type = 'guess';
    expect(validateAbilityCatalog(op)).toBe(false);
  });
});
