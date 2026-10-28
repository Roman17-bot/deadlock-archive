import type { LocalizedText } from '../../shared/item-types';

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

const note = (ru: string, en: string): LocalizedText => ({ ru, en });
const specific: Record<string, LocalizedText[]> = {
  Healbane: [
    note(
      'Подходит, если ты регулярно наносишь спиритический урон: он накладывает снижение лечения. Следи, чтобы эффект действовал во время лечения врага.',
      'Useful when you deal spirit damage regularly: that damage applies healing reduction. Keep the effect active while the enemy is healing.',
    ),
  ],
  'Toxic Bullets': [
    note(
      'Выбирай для продолжительной стрельбы по одной цели: сначала нужно накопить эффект пулями. Короткий одиночный выстрел не заменяет наложение кровотечения.',
      'Choose it for sustained fire on a target: bullets must first build up the effect. One isolated shot is not a substitute for applying the bleed.',
    ),
  ],
  Decay: [
    note(
      'Позволяет наложить антихил выбранной цели без попаданий пулями. Используй перед её лечением или началом атаки команды.',
      'Applies healing reduction to a chosen target without landing bullets. Use it before the target heals or your team engages.',
    ),
  ],
  Inhibitor: [
    note(
      'Полезен против опасного стрелка или другого героя с большим уроном: попадания ослабляют его урон и лечение.',
      'Useful against a dangerous carry: your hits weaken both their damage output and healing.',
    ),
  ],
  'Crippling Headshot': [
    note(
      'Нужны попадания в голову. Выбирай, если можешь стабильно поддерживать эффект на приоритетной цели.',
      'Requires headshots. Choose it when you can reliably maintain the effect on a priority target.',
    ),
  ],
  'Spirit Burn': [
    note(
      'Для ожога и антихила нужно набрать указанный порог спиритического урона за отведённое время. У каждой цели своя перезарядка эффекта: повторный ожог доступен не сразу.',
      'Triggering the burn and healing reduction requires reaching the spirit-damage threshold within its time window. Each target has its own trigger cooldown, so you cannot immediately reapply the burn.',
    ),
  ],
  Scourge: [
    note(
      'Используй на союзнике, который останется рядом с врагами: аура наносит урон от их максимального здоровья, а усиление даёт защиту от спиритического урона и дебаффов. Можно применить на себя.',
      'Use it on an ally who will stay near enemies: the aura deals damage based on their maximum health while the buff provides spirit and debuff resistance. You can also target yourself.',
    ),
  ],
  'Radiant Regeneration': [
    note(
      'Подходит для героя, который часто применяет способности и наносит спиритический урон. Лечение при применении и накопление регенерации — разные эффекты этого предмета.',
      'Suits heroes who cast frequently and deal spirit damage. Healing on cast and building up regeneration are separate effects of this item.',
    ),
  ],
  'Recharging Rush': [
    note(
      'Выбирай под героя с зарядами способностей. Значительный урон оружием возвращает по заряду каждой такой способности; выносливость предмет не восстанавливает.',
      'Choose it for a hero with charged abilities. Dealing significant weapon damage restores a charge to each such ability; the item does not restore stamina.',
    ),
  ],
  'Spirit Snatch': [
    note(
      'Подходит для сближения и тяжёлых ударов: эффект ослабляет спиритическую защиту врага и усиливает тебя. Учитывай вражеское парирование, прежде чем начинать комбинацию.',
      'Suits close-range heavy melee attacks: the effect weakens enemy spirit resistance and buffs you. Account for enemy parries before starting a combo.',
    ),
  ],
  'Debuff Reducer': [
    note(
      'Сокращает длительность дебаффов, но не снимает их мгновенно. Подходит против частых отрицательных эффектов, когда не требуется активное очищение.',
      'Shortens debuffs but does not remove them immediately. Useful against frequent negative effects when you do not need an active cleanse.',
    ),
  ],
  'Dispel Magic': [
    note(
      'Снимает неультимативные отрицательные эффекты с тебя. Нельзя активировать во время оглушения или сна; учитывай это до начала атаки.',
      'Removes non-ultimate negative effects from you. It cannot be activated while stunned or asleep, so plan its use before engaging.',
    ),
  ],
  'Divine Barrier': [
    note(
      'Снимает дебаффы, кроме оглушения, и даёт барьер выбранному союзнику или тебе. При использовании на союзнике перезарядка вдвое короче.',
      'Removes non-stun debuffs and grants a barrier to an ally or yourself. Casting on an ally halves the cooldown.',
    ),
  ],
  Indomitable: [
    note(
      'Автоматически очищает следующий подходящий эффект контроля. Полезен, когда трудно успеть нажать активный защитный предмет; проверь, какие эффекты запускают его.',
      'Automatically cleanses the next qualifying control effect. Useful when activating a defensive item in time is difficult; check which effects trigger it.',
    ),
  ],
  'Reactive Barrier': [
    note(
      'Барьер появляется после подходящего контроля. Он помогает пережить продолжение атаки, но сам контроль не снимает.',
      'The barrier triggers after qualifying crowd control. It helps absorb follow-up damage but does not cleanse the control effect.',
    ),
  ],
  Unstoppable: [
    note(
      'Включай перед ожидаемым контролем: предмет нельзя нажать во время оглушения или сна. На время действия подавляет дебаффы и защищает от перечисленных видов контроля.',
      'Activate before expected crowd control: you cannot use it while stunned or asleep. It temporarily suppresses debuffs and prevents the listed control effects.',
    ),
  ],
  'Metal Skin': [
    note(
      'Покупай против угрозы от пуль. Во время действия спиритический урон и удары ближнего боя всё ещё опасны.',
      'Buy it against bullet damage. Spirit damage and melee attacks remain dangerous during the active effect.',
    ),
  ],
  'Ethereal Shift': [
    note(
      'Помогает переждать опасный момент. Учитывай окончание неуязвимости и заранее выбирай, куда отступать после неё.',
      'Helps wait out a dangerous moment. Plan for the end of invulnerability and decide where to retreat afterward.',
    ),
  ],
  Leech: [
    note(
      'Подходит для устойчивого урона пулями и способностями. Ослабляет вражеский антихил, но сам не снижает лечение противников.',
      'Suits sustained bullet and ability damage. It resists enemy healing reduction but does not reduce enemy healing itself.',
    ),
  ],
  'Warp Stone': [
    note(
      'Даёт быстрое перемещение и временную защиту от пуль. Сохраняй активацию для смены позиции, если без неё легко оказаться под фокусом.',
      'Provides quick repositioning and temporary bullet resistance. Save the active for escape if you would otherwise be easy to focus.',
    ),
  ],
  Refresher: [
    note(
      'Особенно полезен, если повторное применение нескольких способностей меняет исход боя. Планируй манёвры и ресурсы под второй набор способностей.',
      'Most useful when recasting several abilities changes a fight. Plan your positioning and resources for the second set of casts.',
    ),
  ],
  'Echo Shard': [
    note(
      'Выбери неультимативную способность для усиления при покупке. Применив её, можно сбросить её перезарядку предметом; перезарядка самого предмета зависит от выбранной способности.',
      'Select a non-ultimate ability to imbue when buying. After casting it, reset its cooldown with the item; the item’s own cooldown depends on the chosen ability.',
    ),
  ],
  Spellbreaker: [
    note(
      'Помогает переживать крупные отдельные попадания спиритическим уроном. Следи за порогом срабатывания и перезарядкой защитного эффекта.',
      'Helps survive large individual spirit hits. Watch the trigger threshold and the defensive effect’s cooldown.',
    ),
  ],
};

export function itemAdvice(item: RawItem, tags: string[]): LocalizedText[] {
  const result = [...(specific[item.name] ?? [])];
  const has = (t: string) => tags.includes(t);
  if (!result.length) {
    if (has('spirit-resist'))
      result.push(
        note(
          'Рассматривай против команды, в которой основную угрозу представляет спиритический урон. Условные бонусы действуют только при указанном срабатывании.',
          'Consider it against teams whose main threat is spirit damage. Conditional bonuses apply only when their trigger is met.',
        ),
      );
    else if (has('bullet-resist'))
      result.push(
        note(
          'Полезен, когда опаснее всего обычные выстрелы. Сравни получаемый урон от пуль с другими источниками перед покупкой.',
          'Useful when ordinary shots are the main threat. Compare incoming bullet damage with other damage sources before buying.',
        ),
      );
    else if (has('bullet-lifesteal') || has('spirit-lifesteal'))
      result.push(
        note(
          'Выбирай, если можешь продолжать наносить подходящий тип урона во время боя. Под контролем или при вынужденном отступлении вампиризм приносит меньше пользы.',
          'Choose it when you can keep dealing the relevant damage type during a fight. Lifesteal is less useful while controlled or forced to retreat.',
        ),
      );
    else if (has('ally-support'))
      result.push(
        note(
          'Планируй применение рядом с союзниками: лечение и защита ценнее перед ожидаемым уроном или сразу после него.',
          'Plan to use it near allies: healing and protection are most useful around incoming damage.',
        ),
      );
    else if (has('stun') || has('root') || has('silence') || has('disarm'))
      result.push(
        note(
          'Сохраняй эффект для опасной цели или продолжения контроля союзника. Учитывай задержку, дальность и условия применения из описания.',
          'Save the effect for a dangerous target or to follow allied control. Account for the delay, range and conditions in its description.',
        ),
      );
    else if (has('farming'))
      result.push(
        note(
          'Полезен, если часто зачищаешь бойцов и нейтральные лагеря или атакуешь объекты. Бонусы против таких целей не равны бонусам против героев.',
          'Useful for clearing troopers and neutral camps or attacking objectives. Non-hero bonuses are not the same as bonuses against heroes.',
        ),
      );
    else if (has('headshot'))
      result.push(
        note(
          'Ценность зависит от попаданий в голову. Сравни с более стабильным усилением оружия, если цель трудно удерживать в прицеле.',
          'Value depends on landing headshots. Compare with more consistent weapon upgrades if the target is hard to track.',
        ),
      );
    else if (has('melee-damage') || has('melee-heal'))
      result.push(
        note(
          'Подходит для игры вблизи. Выбирай момент для удара с учётом вражеского парирования и контроля.',
          'Suits close-range play. Time your melee attacks around enemy parries and crowd control.',
        ),
      );
    else if (has('cooldown') || has('charges') || has('duration') || has('ability-range'))
      result.push(
        note(
          'Сравни бонус с ключевой способностью своего героя: чаще применять её, дольше держать эффект или доставать цель с безопасной дистанции.',
          'Compare the bonus with your hero’s key ability: cast it more often, extend its effect or reach a target from a safer distance.',
        ),
      );
    else if (has('move-speed') || has('stamina') || has('flight') || has('teleport'))
      result.push(
        note(
          'Помогает выбирать дистанцию и менять позицию. Используй мобильность, чтобы выйти из опасной зоны или вовремя присоединиться к союзникам.',
          'Helps control distance and positioning. Use the mobility to leave dangerous areas or join allies in time.',
        ),
      );
    else if (has('healing') || has('regen'))
      result.push(
        note(
          'Помогает дольше оставаться на линии и восстанавливаться между атаками. Соблюдай условия лечения: часть эффектов прерывается уроном или работает вне боя.',
          'Helps you stay in lane and recover between engagements. Check the healing conditions: some effects stop on damage or work out of combat.',
        ),
      );
    else if (has('barrier') || has('bonus-health'))
      result.push(
        note(
          'Дополнительный запас защиты полезен против быстрого урона. Учитывай длительность барьера и условие его появления.',
          'Extra durability helps against burst damage. Account for the barrier’s duration and trigger when present.',
        ),
      );
    else if (has('fire-rate') || has('ammo') || has('weapon-damage'))
      result.push(
        note(
          'Подходит для регулярной стрельбы. Сравни урон, время стрельбы до перезарядки и возможность оставаться на нужной дистанции.',
          'Suits sustained shooting. Compare damage, time until reloading and whether you can stay at the required range.',
        ),
      );
    else
      result.push(
        note(
          'Выбирай, когда описанный эффект решает конкретную задачу твоего героя. Учитывай дальность, условия срабатывания и оставшиеся свободные слоты.',
          'Choose it when its described effect addresses a specific need for your hero. Account for range, trigger conditions and available item slots.',
        ),
      );
  }
  if (has('imbue'))
    result.push(
      note(
        'Усиление выбранной способности требует правильно выбрать её при покупке. Не считай этот бонус усилением всех способностей сразу.',
        'An imbued bonus requires selecting an ability. Do not count that bonus as applying to every ability.',
      ),
    );
  if (
    item.is_active_item &&
    ![
      'Dispel Magic',
      'Divine Barrier',
      'Unstoppable',
      'Warp Stone',
      'Refresher',
      'Echo Shard',
    ].includes(item.name)
  )
    result.push(
      note(
        'Это активный предмет: назначь удобную клавишу и учитывай его перезарядку при следующем бою.',
        'This is an active item: use a comfortable key binding and plan the next fight around its cooldown.',
      ),
    );
  return result;
}
