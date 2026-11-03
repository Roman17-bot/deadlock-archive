import type { AbilityCatalog, HeroAbility } from '../../shared/ability-types';
import type { HeroSnapshot } from '../../shared/types';
const text = (value: string) => ({ ru: value, en: value });
export function abilityFixture(id = 1, slot: 1 | 2 | 3 | 4 = 1): HeroAbility {
  return {
    id,
    slot,
    className: `ability_example_${id}`,
    name: text(`Ability ${slot}`),
    description: { ru: 'Описание способности.', en: 'Ability description.' },
    icon: `assets/abilities/${id}.webp`,
    variants: [],
    parameters: [
      {
        id: 'Damage',
        label: { ru: 'Урон способности', en: 'Ability damage' },
        value: 100,
        display: true,
        scale: { className: 'scale_function_tech_damage', stat: 'ETechPower', coefficient: 1 },
      },
      {
        id: 'AbilityCooldown',
        label: { ru: 'Перезарядка способности', en: 'Ability cooldown' },
        value: 40,
        unit: 's',
        display: true,
        scale: { className: 'scale_function_single_stat', stat: 'ETechCooldown' },
      },
    ],
    sections: [],
    upgrades: [
      {
        tier: 1,
        cost: 1,
        description: { ru: '+20 урона', en: '+20 damage' },
        operations: [{ property: 'Damage', type: 'addBase', value: 20 }],
      },
      {
        tier: 2,
        cost: 2,
        description: { ru: '−10 с перезарядки', en: '−10s cooldown' },
        operations: [{ property: 'AbilityCooldown', type: 'addBase', value: -10 }],
      },
      {
        tier: 3,
        cost: 5,
        description: { ru: '+0,5 к множителю спирита', en: '+0.5 Spirit scaling' },
        operations: [{ property: 'Damage', type: 'addScale', value: 0.5, scaleStat: 'ETechPower' }],
      },
    ],
  };
}
export function abilityCatalogFixture(snapshot: HeroSnapshot): AbilityCatalog {
  return {
    meta: {
      schemaVersion: 1,
      clientVersion: snapshot.meta.clientVersion,
      sourceRevision: snapshot.meta.sourceRevision,
      gameCommit: snapshot.meta.gameCommit,
      updatedAt: '2026-11-03T00:00:00.000Z',
    },
    heroes: snapshot.heroes.map((hero, index) => ({
      heroId: hero.id,
      abilities: ([1, 2, 3, 4] as const).map((slot) => abilityFixture(index * 4 + slot, slot)),
    })),
  };
}
