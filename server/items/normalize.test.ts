import { describe, expect, it } from 'vitest';
import { normalizeCatalog, normalizeStatistics, plainText } from './normalize';

const meta = {
  clientVersion: 6821,
  sourceRevision: 11170534,
  updatedAt: '2026-10-28T12:00:00.000Z',
};
const raw = (name: string, className: string, id: number, extra = {}) => ({
  id,
  name,
  class_name: className,
  type: 'upgrade',
  shopable: true,
  item_slot_type: 'vitality',
  item_tier: 2,
  cost: 1600,
  is_active_item: false,
  properties: {},
  description: {},
  tooltip_sections: [],
  ...extra,
});
const healbane = raw('Healbane', 'upgrade_healbane', 2603935618, {
  properties: {
    TechPower: { value: '7', label: 'Spirit Power', prefix: '{s:sign}' },
    HealAmpReceivePenaltyPercent: { value: '-35', label: 'Incoming Healing', postfix: '%' },
    AbilityDuration: { value: '8', label: 'Duration', postfix: 's' },
  },
  tooltip_sections: [
    { section_type: 'innate', section_attributes: [{ elevated_properties: ['TechPower'] }] },
    {
      section_type: 'passive',
      section_attributes: [
        {
          loc_string: 'Spirit damage reduces healing.',
          properties: ['AbilityDuration'],
          important_properties: ['HealAmpReceivePenaltyPercent'],
        },
      ],
    },
  ],
  upgrades: [{ property_upgrades: [{ name: 'TechPower', bonus: '11' }] }],
});

describe('normal shop normalization', () => {
  it('retains real normal values and tooltip-only effects without adding enhanced bonuses', () => {
    const ru = structuredClone(healbane);
    ru.name = 'Подавитель лечения';
    (ru.properties as Record<string, { label: string }>).TechPower.label = 'Спиритическая мощь';
    const item = normalizeCatalog([healbane], [ru], meta).items[0];
    expect(item.attributes[0]).toMatchObject({
      value: '+7',
      label: { ru: 'Спиритическая мощь', en: 'Spirit Power' },
    });
    expect(item.effects[0].description.en).toBe('Spirit damage reduces healing.');
    expect(item.effects[0].attributes.map((a) => a.value)).toEqual(['8 s', '-35%']);
    expect(item.tags).toContain('anti-heal');
  });

  it('excludes disabled, prototype and legendary items and resolves components by class name', () => {
    const base = raw('Base', 'upgrade_base', 1);
    const upgrade = raw('Upgrade', 'upgrade_next', 2, {
      item_tier: 3,
      cost: 3200,
      component_items: ['upgrade_base'],
    });
    const rows = [
      base,
      upgrade,
      raw('Disabled', 'upgrade_old', 3, { disabled: true }),
      raw('Legendary', 'upgrade_legend', 4, { item_tier: 5, cost: 9999 }),
    ];
    const result = normalizeCatalog(rows, rows, meta);
    expect(result.items.map((i) => i.id)).toEqual([1, 2]);
    expect(result.items[0].upgrades).toEqual([2]);
    expect(result.items[1].components).toEqual([1]);
  });

  it('distinguishes self penalties, enemy antiheal, cleansing and conditional resistance', () => {
    const cheat = raw('Cheat Death', 'upgrade_cheat_death', 3361811174, {
      properties: { HealAmpReceivePenaltyPercent: { value: '-60', label: 'Incoming Healing' } },
    });
    const reducer = raw('Debuff Reducer', 'upgrade_debuff_reducer', 1047818222, {
      properties: { StatusResistancePercent: { value: '25', label: 'Debuff Resist' } },
    });
    const dispel = raw('Dispel Magic', 'upgrade_dispel_magic', 3731635960, {
      is_active_item: true,
    });
    const monster = raw('Monster Rounds', 'upgrade_non_player_bonus', 465336330, {
      properties: { NonPlayerBulletResist: { value: '25', label: 'NPC Bullet Resist' } },
    });
    const warp = raw('Warp Stone', 'upgrade_warp_stone', 3270001687, {
      is_active_item: true,
      properties: {
        BulletResist: {
          value: '30',
          label: 'Bullet Resist',
          usage_flags: ['ConditionallyApplied'],
        },
      },
    });
    const items = normalizeCatalog(
      [cheat, reducer, dispel, monster, warp],
      [cheat, reducer, dispel, monster, warp],
      meta,
    ).items;
    expect(items[0].tags).not.toContain('anti-heal');
    expect(items[1].tags).toContain('debuff-resist');
    expect(items[1].tags).not.toContain('cleanse');
    expect(items[2].tags).toContain('cleanse');
    expect(items[3].tags).not.toContain('bullet-resist');
    expect(items[4].tags).toContain('bullet-resist');
  });

  it('renders plain descriptions and rejects an unresolved property token', () => {
    expect(plainText('<svg><path d="M1 2"/></svg><span>Damage</span><br>3 &amp; 4')).toBe(
      'Damage\n3 & 4',
    );
    expect(plainText('Your \n spirit damage.Heal the target.')).toBe(
      'Your spirit damage. Heal the target.',
    );
    const broken = raw('Broken', 'upgrade_broken', 1, {
      description: { desc: 'Deal {s:Missing} damage.' },
    });
    expect(() => normalizeCatalog([broken], [broken], meta)).toThrow(/token/i);
  });

  it('does not turn self penalties or quiet footsteps into enemy control or stealth', () => {
    const goose = raw('Golden Goose Egg', 'upgrade_golden_goose', 2462046703, {
      properties: { OutgoingDamagePenaltyPercent: { value: '-30', label: 'Outgoing Damage' } },
    });
    const curse = raw('Cursed Relic', 'upgrade_curse', 2617435668, {
      properties: { OutgoingDamagePenaltyPercent: { value: '-30', label: 'Outgoing Damage' } },
    });
    const cheat = raw('Cheat Death', 'upgrade_cheat_death', 3361811174, {
      properties: { DeathImmunityDamageReduction: { value: '-60', label: 'Outgoing Damage' } },
    });
    const stalker = raw('Stalker', 'upgrade_stalker', 4);
    const weighted = raw('Weighted Shots', 'upgrade_weighted_shots', 5);
    const express = raw('Express Shot', 'upgrade_express_shot', 6);
    const rows = [goose, curse, cheat, stalker, weighted, express];
    const result = normalizeCatalog(rows, rows, meta).items;
    expect(result[0].tags).not.toContain('damage-suppression');
    expect(result[1].tags).not.toContain('damage-suppression');
    expect(result[2].tags).not.toContain('damage-reduction');
    expect(result[2].tags).toContain('cleanse');
    expect(result[3].tags).not.toContain('stealth');
    expect(result[4].tags).not.toContain('root');
    expect(result[5].tags).not.toContain('reload');
    expect(result[5].tags).not.toContain('ammo');
  });

  it('shows a nonzero base cooldown even when the upstream tooltip omits it', () => {
    const shard = raw('Echo Shard', 'upgrade_echo_shard', 630839635, {
      is_active_item: true,
      properties: { AbilityCooldown: { value: '30', label: 'Cooldown', postfix: 's' } },
      tooltip_sections: [
        {
          section_type: 'active',
          section_attributes: [{ loc_string: 'Reset the imbued ability.' }],
        },
      ],
    });
    const item = normalizeCatalog([shard], [shard], meta).items[0];
    expect(item.effects[0].attributes).toContainEqual(
      expect.objectContaining({ key: 'AbilityCooldown', value: '30 s' }),
    );
  });

  it('keeps Spirit healing scaling, signed negative scaling and one correct speed unit', () => {
    const sample = raw('Example', 'upgrade_example', 1, {
      properties: {
        FervorMovespeed: { value: '4m', label: 'Move Speed', postfix: 'm/s' },
        Regeneration: {
          value: '4',
          label: 'Regeneration',
          postfix: 'HP/s',
          scale_function: { class_name: 'scale_function_healing_spirit_scale', stat_scale: 0.035 },
        },
        BulletArmorReduction: {
          value: '-7',
          label: 'Bullet Resist',
          postfix: '%',
          scale_function: { specific_stat_scale_type: 'ETechPower', stat_scale: -0.055 },
        },
      },
      tooltip_sections: [
        {
          section_type: 'passive',
          section_attributes: [
            { properties: ['FervorMovespeed', 'Regeneration', 'BulletArmorReduction'] },
          ],
        },
      ],
    });
    const attrs = normalizeCatalog([sample], [sample], meta).items[0].effects[0].attributes;
    expect(attrs[0].value).toBe('4 m/s');
    expect(attrs[1].scaling?.en).toContain('+0.035');
    expect(attrs[2].scaling?.en).toBe('-0.055 per 1 Spirit');
  });
});

describe('purchase observations', () => {
  const statMeta = {
    clientVersion: 6821,
    updatedAt: meta.updatedAt,
    from: '2026-10-26T11:14:53.000Z',
    to: meta.updatedAt,
  };
  const observation = {
    item_id: 2603935618,
    bucket: 0,
    wins: 6,
    losses: 4,
    matches: 10,
    players: 8,
    avg_buy_time_s: 525,
    avg_sell_time_s: 0,
    avg_buy_time_relative: 25,
    avg_sell_time_relative: 0,
  };
  it('preserves counts and mean purchase timing, joining hero IDs rather than averaging rates', () => {
    const catalog = normalizeCatalog([healbane], [healbane], meta);
    const result = normalizeStatistics(
      [observation],
      [{ ...observation, bucket: 4, wins: 2, losses: 3, matches: 5 }],
      statMeta,
      catalog,
    );
    expect(result.items[0]).toMatchObject({
      itemId: 2603935618,
      matches: 10,
      wins: 6,
      losses: 4,
      averageBuyTimeSeconds: 525,
    });
    expect(result.items[0].heroes[0]).toMatchObject({ heroId: 4, matches: 5, wins: 2 });
  });
  it('rejects invalid count totals, nonfinite means and wrong cohort dates', () => {
    const catalog = normalizeCatalog([healbane], [healbane], meta);
    for (const row of [
      { ...observation, wins: 11 },
      { ...observation, avg_buy_time_s: Infinity },
    ])
      expect(() => normalizeStatistics([row], [], statMeta, catalog)).toThrow();
    expect(() =>
      normalizeStatistics(
        [observation],
        [],
        { ...statMeta, from: '2026-10-29T00:00:00Z' },
        catalog,
      ),
    ).toThrow();
  });
});
