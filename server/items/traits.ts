export interface RawProperty {
  value?: string | number;
  label?: string;
  prefix?: string;
  postfix?: string;
  display_units?: string;
  disable_value?: string;
  tooltip_section?: string;
  usage_flags?: string[];
  scale_function?: {
    class_name?: string;
    specific_stat_scale_type?: string;
    stat_scale?: number;
    scaling_stats?: string[];
  };
}
export interface RawItem {
  id: number;
  name: string;
  class_name: string;
  type: string;
  shopable?: boolean;
  disabled?: boolean;
  item_slot_type?: string;
  item_tier?: number;
  cost?: number;
  is_active_item?: boolean;
  properties: Record<string, RawProperty>;
  description?: Record<string, string>;
  tooltip_sections?: {
    section_type?: string;
    section_attributes?: {
      loc_string?: string;
      properties?: string[];
      elevated_properties?: string[];
      important_properties?: string[];
    }[];
  }[];
  component_items?: string[];
  shop_image_webp?: string;
  image_webp?: string;
}

/** Recipient and target semantics are explicit where the same property can affect either side. */
export const ENEMY_ANTIHEAL = new Set([
  2037039379, 3884003354, 3696726732, 2603935618, 3144988365, 343572757,
]);
const CLEANSE = new Set([3731635960, 1662311306, 951866250, 3361811174]);

export function itemTags(item: RawItem): string[] {
  const tags = new Set<string>();
  const value = (key: string) => Number.parseFloat(String(item.properties[key]?.value ?? '0')) || 0;
  const any = (expression: RegExp, sign: 'positive' | 'negative' = 'positive') =>
    Object.entries(item.properties).some(
      ([key, p]) =>
        expression.test(key) &&
        (sign === 'positive'
          ? Number.parseFloat(String(p.value)) > 0
          : Number.parseFloat(String(p.value)) < 0),
    );
  const add = (id: string, condition: boolean) => {
    if (condition) tags.add(id);
  };
  const name = item.name;
  add('anti-heal', ENEMY_ANTIHEAL.has(item.id));
  add('cleanse', CLEANSE.has(item.id));
  add('cc-immunity', name === 'Unstoppable');
  add('bullet-immunity', name === 'Metal Skin');
  add('invulnerable', name === 'Ethereal Shift');
  add('death-prevention', name === 'Cheat Death');
  add(
    'damage-reduction',
    value('SpiritDamageReductionProc') > 0 || name === 'Counterspell' || name === 'Plated Armor',
  );
  add(
    'bullet-resist',
    any(/^(?:BulletResist|BuffBulletResist|BulletResistBelowThreshold|BulletResistPerStack)$/),
  );
  add('spirit-resist', any(/^(?:TechResist|BuffTechResist|TechResistBelowThreshold)$/));
  add('melee-resist', value('MeleeResistPercent') > 0);
  add('barrier', any(/^(?:CombatBarrier|GuardianWardCombatBarrier|VexBarrierCombatBarrier)$/));
  add(
    'debuff-resist',
    any(
      /^(?:StatusResistancePercent|InnateStatusResistancePercent|FervorStatusResistancePercent)$/,
    ),
  );
  add('slow-resist', value('SlowResistancePercent') > 0 || name === 'Magic Carpet');
  add('bullet-shred', any(/^(?:BulletResistReduction|BulletArmorReduction)$/, 'negative'));
  add('spirit-shred', any(/^(?:TechArmorDamageReduction|MagicResistReduction)$/, 'negative'));
  add('damage-suppression', name === 'Inhibitor' || name === 'Silencer');
  add('fire-rate-slow', value('FireRateSlow') > 0);
  add(
    'silence',
    value('SilenceDuration') > 0 || ['Silence Wave', 'Cursed Relic', 'Focus Lens'].includes(name),
  );
  add('disarm', ['Disarming Hex', 'Phantom Strike', 'Cursed Relic'].includes(name));
  add('curse', name === 'Cursed Relic');
  add(
    'health-damage',
    any(
      /^(?:DotHealthPercent|CurrentHealthDamage|MaxHealthPercentAsDPS|HealthStealPctHero|DamagePerHealth|DamagePercentMaxHealth|DamageMaxHealthPercent)$/,
    ),
  );
  add('movement-slow', any(/^(?:SlowPercent|MovementSpeedSlow|MaxSlowPercent)$/));
  add('stun', value('StunDuration') > 0);
  add('root', name === 'Arctic Blast');
  add('mobility-lock', ['Vortex Web', 'Slowing Hex', 'Capacitor'].includes(name));
  add('dash-reduction', value('GroundDashReductionPercent') < 0);
  add('forced-movement', ['Vortex Web', 'Phantom Strike'].includes(name));
  add('reveal', name === 'Stalker');
  add(
    'bonus-health',
    any(
      /^(?:BonusHealth|BonusBaseHealth|BonusHealthPercent|MaxHealthPercentBonus|BonusMaxHealthPercent)$/,
    ),
  );
  add(
    'regen',
    any(
      /^(?:BonusHealthRegen|OutOfCombatHealthRegen|HealthRegen|HealthRegenPercent|TotalHealthRegen|RadiantHealthRegen)$/,
    ) ||
      ['Fortitude', 'Mystic Regeneration', 'Radiant Regeneration', 'Healing Rite'].includes(name),
  );
  add(
    'healing',
    any(
      /^(?:HealOnKill|HealOnActivate|HealPerStack|HealOnSuccess|HealAmount|HealPercent|HealPercentPerHeadshot|HealOnVeil|HealingPerCast|HealthRestore|HealOnHit|HeroHeal|BaseHeal)$/,
    ) ||
      [
        'Rescue Beam',
        'Healing Nova',
        'Healing Rite',
        'Restorative Shot',
        'Restorative Locket',
        'Siphon Bullets',
        'Radiant Regeneration',
      ].includes(name),
  );
  add(
    'ally-support',
    [
      'Rescue Beam',
      'Healing Nova',
      'Healing Rite',
      'Divine Barrier',
      'Heroic Aura',
      'Guardian Ward',
      'Healing Tempo',
      'Spirit Shredder',
      'Spirit Rend',
      'Scourge',
    ].includes(name),
  );
  add('bullet-lifesteal', any(/^(?:BulletLifestealPercent|ActiveBonusLifesteal)$/));
  add(
    'spirit-lifesteal',
    any(
      /^(?:AbilityLifestealPercentHero|AbilityLifestealPercentHeroPassive|BonusSpiritLifesteal|ImbueAbilityLifesteal)$/,
    ),
  );
  add(
    'melee-heal',
    any(/^(?:LifestrikeHeal|LifestealHeal|LifestealHealPercent|ParrySuccessHealPercentage)$/),
  );
  add(
    'healing-amp',
    any(/^(?:HealAmpCastPercent|HealAmpReceivePercent|HealAmpRegenPercent|HealAmpPercent)$/),
  );
  add('antiheal-resist', name === 'Leech');
  add(
    'move-speed',
    any(
      /^(?:BonusMoveSpeed|ActiveBonusMoveSpeed|FervorMovespeed|InvisMoveSpeedMod|MovementSpeedBonus)$/,
    ),
  );
  add('sprint', any(/^(?:BonusSprintSpeed|SprintSpeed)$/));
  add(
    'stamina',
    any(
      /^(?:Stamina|BonusStamina|BonusStaminaRegen|StaminaRegen|StaminaRegenIncrease|MaxStaminaRestore|StaminaCooldownReduction|StaminaCooldownReductionPercent)$/,
    ) || ['Extra Stamina', 'Stamina Mastery', 'Kinetic Dash'].includes(name),
  );
  add('teleport', ['Warp Stone', 'Phantom Strike'].includes(name));
  add('flight', ['Majestic Leap', 'Magic Carpet'].includes(name));
  add('stealth', ['Shadow Weave', 'Veil Walker'].includes(name));
  add(
    'weapon-damage',
    any(
      /^(?:BaseAttackDamagePercent|BaseAttackDamagePercentBonus|BaseAttackDamagePercentAtMaxDuration|WeaponDamagePerStack|WeaponPower|WeaponPowerPerStack|CloseRangeBonusWeaponPower|LongRangeBonusWeaponPower|BonusWeaponPower|ActiveBonusWeaponPower|HeadShotBonusDamage)$/,
    ) || name === 'Lucky Shot',
  );
  add(
    'fire-rate',
    any(
      /^(?:BonusFireRate|ActiveBonusFireRate|FervorFireRate|AmbushBonusFireRate|FireRateBonus|BonusFireRatePercent|FireRatePerKill)$/,
    ),
  );
  add(
    'ammo',
    any(
      /^(?:BonusClipSizePercent|BonusClipSize|AmmoRestore|AmmoRestorePercent|ActiveReloadPercent|BonusAmmoPercent|LightMeleeAmmo)$/,
    ) || ['Quicksilver Reload', 'Mercurial Magnum', 'Active Reload', 'Kinetic Dash'].includes(name),
  );
  add(
    'reload',
    value('ReloadSpeedMultipler') < 0 ||
      value('ReloadSpeedMultiplier') < 0 ||
      value('ReloadSpeedBonus') > 0 ||
      ['Active Reload', 'Quicksilver Reload', 'Mercurial Magnum'].includes(name),
  );
  add('headshot', /headshot/i.test(name) || name === 'Headhunter');
  add(
    'melee-damage',
    any(/^(?:BonusMeleeDamagePercent|BonusMeleeDamage|AmbushBonusMeleeDamage)$/) ||
      ['Melee Charge', 'Crushing Fists'].includes(name),
  );
  add('weapon-range', any(/^(?:BonusAttackRangePercent|BonusBulletSpeedPercent)$/));
  add('farming', any(/^(?:NonPlayerBonusWeaponPower|NonPlayerBulletResist)$/));
  add('economy', any(/^(?:BonusGoldPerMinute|StackingGoldPerMinute|BonusSoulsPct)$/));
  add(
    'spirit-power',
    any(
      /^(?:TechPower|SpiritPower|SpiritPowerInnate|BonusSpirit|AmbushBonusTechPower|BonusSpiritPower|ImbuedTechPower|BonusSpiritForChargedAbilities|TechPowerGain)$/,
    ),
  );
  add('spirit-resist', value('TechArmorGain') > 0);
  add(
    'spirit-damage',
    any(
      /^(?:DamagePerChain|TechDamagePercent|SpiritDamage|ProcDamage|Damage|DotDamage|DamagePerPulse|BonusSpiritDamage)$/,
    ) ||
      [
        'Mystic Shot',
        'Mystic Burst',
        'Tankbuster',
        'Spirit Burn',
        'Lightning Scroll',
        'Alchemical Fire',
        'Torment Pulse',
        'Spirit Strike',
        'Spirit Snatch',
        'Mystic Reverb',
        'Scourge',
        'Stalker',
        'Phantom Strike',
        'Decay',
      ].includes(name),
  );
  add(
    'cooldown',
    any(
      /^(?:CooldownReduction|UltimateCooldownReduction|CooldownReductionOnChargedAbilities|CooldownReductionOnProc|TechCooldownReduction|AbilityCooldownReductionPercent|CooldownReductionPercent|ImbuedCooldownReduction)$/,
    ) ||
      [
        'Compress Cooldown',
        'Superior Cooldown',
        'Transcendent Cooldown',
        'Refresher',
        'Echo Shard',
        'Spellslinger',
        'Recharging Rush',
      ].includes(name),
  );
  add(
    'ability-range',
    any(
      /^(?:TechRangeMultiplier|TechRadiusMultiplier|TechRangeMultiplierBuff|TechRadiusMultiplierBuff|StackingTechRangeMultiplier|BonusAbilityRange|BonusAbilityRadius)$/,
    ),
  );
  add(
    'duration',
    any(
      /^(?:TechDurationMultiplier|BonusAbilityDurationPercent|AbilityDurationPercent|ImbuedDurationMultiplier)$/,
    ),
  );
  add(
    'charges',
    any(/^(?:BonusAbilityCharges|AbilityChargeReplenishPercent)$/) ||
      ['Extra Charge', 'Rapid Recharge', 'Refresher', 'Recharging Rush'].includes(name),
  );
  const prose = [
    ...Object.values(item.description ?? {}),
    ...(item.tooltip_sections ?? []).flatMap((s) =>
      (s.section_attributes ?? []).map((a) => a.loc_string ?? ''),
    ),
  ].join(' ');
  add(
    'imbue',
    /\bimbue(?:d)?\b/i.test(prose) ||
      Object.keys(item.properties).some((k) => /^(?:Imbue|Imbued)/.test(k) && value(k) !== 0),
  );
  return [...tags].sort();
}
