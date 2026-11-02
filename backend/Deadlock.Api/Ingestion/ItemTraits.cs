using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Deadlock.Api.Ingestion;

public static class ItemTraits
{
    public static JsonArray Tags(JsonObject item)
    {
        var tags = new HashSet<string>(); var p = J.Obj(item["properties"], "properties"); var name = J.Str(item["name"]); var id = J.Id(item["id"], "item id");
        double V(string key) => J.ParseFloat(p[key]?["value"]);
        bool Any(string pattern, bool negative = false) => p.Any(pair => Regex.IsMatch(pair.Key, "^(?:" + pattern + ")$") && (negative ? J.ParseFloat(pair.Value?["value"]) < 0 : J.ParseFloat(pair.Value?["value"]) > 0));
        bool Is(params string[] names) => names.Contains(name);
        void Add(string tag, bool condition) { if (condition) tags.Add(tag); }
        Add("anti-heal", new long[] { 2037039379, 3884003354, 3696726732, 2603935618, 3144988365, 343572757 }.Contains(id));
        Add("cleanse", new long[] { 3731635960, 1662311306, 951866250, 3361811174 }.Contains(id));
        Add("cc-immunity", Is("Unstoppable")); Add("bullet-immunity", Is("Metal Skin")); Add("invulnerable", Is("Ethereal Shift")); Add("death-prevention", Is("Cheat Death"));
        Add("damage-reduction", V("SpiritDamageReductionProc") > 0 || Is("Counterspell", "Plated Armor"));
        Add("bullet-resist", Any("BulletResist|BuffBulletResist|BulletResistBelowThreshold|BulletResistPerStack")); Add("spirit-resist", Any("TechResist|BuffTechResist|TechResistBelowThreshold") || V("TechArmorGain") > 0); Add("melee-resist", V("MeleeResistPercent") > 0);
        Add("barrier", Any("CombatBarrier|GuardianWardCombatBarrier|VexBarrierCombatBarrier")); Add("debuff-resist", Any("StatusResistancePercent|InnateStatusResistancePercent|FervorStatusResistancePercent")); Add("slow-resist", V("SlowResistancePercent") > 0 || Is("Magic Carpet"));
        Add("bullet-shred", Any("BulletResistReduction|BulletArmorReduction", true)); Add("spirit-shred", Any("TechArmorDamageReduction|MagicResistReduction", true)); Add("damage-suppression", Is("Inhibitor", "Silencer")); Add("fire-rate-slow", V("FireRateSlow") > 0);
        Add("silence", V("SilenceDuration") > 0 || Is("Silence Wave", "Cursed Relic", "Focus Lens")); Add("disarm", Is("Disarming Hex", "Phantom Strike", "Cursed Relic")); Add("curse", Is("Cursed Relic"));
        Add("health-damage", Any("DotHealthPercent|CurrentHealthDamage|MaxHealthPercentAsDPS|HealthStealPctHero|DamagePerHealth|DamagePercentMaxHealth|DamageMaxHealthPercent")); Add("movement-slow", Any("SlowPercent|MovementSpeedSlow|MaxSlowPercent")); Add("stun", V("StunDuration") > 0); Add("root", Is("Arctic Blast")); Add("mobility-lock", Is("Vortex Web", "Slowing Hex", "Capacitor")); Add("dash-reduction", V("GroundDashReductionPercent") < 0); Add("forced-movement", Is("Vortex Web", "Phantom Strike")); Add("reveal", Is("Stalker"));
        Add("bonus-health", Any("BonusHealth|BonusBaseHealth|BonusHealthPercent|MaxHealthPercentBonus|BonusMaxHealthPercent"));
        Add("regen", Any("BonusHealthRegen|OutOfCombatHealthRegen|HealthRegen|HealthRegenPercent|TotalHealthRegen|RadiantHealthRegen") || Is("Fortitude", "Mystic Regeneration", "Radiant Regeneration", "Healing Rite"));
        Add("healing", Any("HealOnKill|HealOnActivate|HealPerStack|HealOnSuccess|HealAmount|HealPercent|HealPercentPerHeadshot|HealOnVeil|HealingPerCast|HealthRestore|HealOnHit|HeroHeal|BaseHeal") || Is("Rescue Beam", "Healing Nova", "Healing Rite", "Restorative Shot", "Restorative Locket", "Siphon Bullets", "Radiant Regeneration"));
        Add("ally-support", Is("Rescue Beam", "Healing Nova", "Healing Rite", "Divine Barrier", "Heroic Aura", "Guardian Ward", "Healing Tempo", "Spirit Shredder", "Spirit Rend", "Scourge"));
        Add("bullet-lifesteal", Any("BulletLifestealPercent|ActiveBonusLifesteal")); Add("spirit-lifesteal", Any("AbilityLifestealPercentHero|AbilityLifestealPercentHeroPassive|BonusSpiritLifesteal|ImbueAbilityLifesteal")); Add("melee-heal", Any("LifestrikeHeal|LifestealHeal|LifestealHealPercent|ParrySuccessHealPercentage")); Add("healing-amp", Any("HealAmpCastPercent|HealAmpReceivePercent|HealAmpRegenPercent|HealAmpPercent")); Add("antiheal-resist", Is("Leech"));
        Add("move-speed", Any("BonusMoveSpeed|ActiveBonusMoveSpeed|FervorMovespeed|InvisMoveSpeedMod|MovementSpeedBonus")); Add("sprint", Any("BonusSprintSpeed|SprintSpeed")); Add("stamina", Any("Stamina|BonusStamina|BonusStaminaRegen|StaminaRegen|StaminaRegenIncrease|MaxStaminaRestore|StaminaCooldownReduction|StaminaCooldownReductionPercent") || Is("Extra Stamina", "Stamina Mastery", "Kinetic Dash"));
        Add("teleport", Is("Warp Stone", "Phantom Strike")); Add("flight", Is("Majestic Leap", "Magic Carpet")); Add("stealth", Is("Shadow Weave", "Veil Walker"));
        Add("weapon-damage", Any("BaseAttackDamagePercent|BaseAttackDamagePercentBonus|BaseAttackDamagePercentAtMaxDuration|WeaponDamagePerStack|WeaponPower|WeaponPowerPerStack|CloseRangeBonusWeaponPower|LongRangeBonusWeaponPower|BonusWeaponPower|ActiveBonusWeaponPower|HeadShotBonusDamage") || Is("Lucky Shot"));
        Add("fire-rate", Any("BonusFireRate|ActiveBonusFireRate|FervorFireRate|AmbushBonusFireRate|FireRateBonus|BonusFireRatePercent|FireRatePerKill")); Add("ammo", Any("BonusClipSizePercent|BonusClipSize|AmmoRestore|AmmoRestorePercent|ActiveReloadPercent|BonusAmmoPercent|LightMeleeAmmo") || Is("Quicksilver Reload", "Mercurial Magnum", "Active Reload", "Kinetic Dash")); Add("reload", V("ReloadSpeedMultipler") < 0 || V("ReloadSpeedMultiplier") < 0 || V("ReloadSpeedBonus") > 0 || Is("Active Reload", "Quicksilver Reload", "Mercurial Magnum"));
        Add("headshot", Regex.IsMatch(name, "headshot", RegexOptions.IgnoreCase) || Is("Headhunter")); Add("melee-damage", Any("BonusMeleeDamagePercent|BonusMeleeDamage|AmbushBonusMeleeDamage") || Is("Melee Charge", "Crushing Fists")); Add("weapon-range", Any("BonusAttackRangePercent|BonusBulletSpeedPercent")); Add("farming", Any("NonPlayerBonusWeaponPower|NonPlayerBulletResist")); Add("economy", Any("BonusGoldPerMinute|StackingGoldPerMinute|BonusSoulsPct"));
        Add("spirit-power", Any("TechPower|SpiritPower|SpiritPowerInnate|BonusSpirit|AmbushBonusTechPower|BonusSpiritPower|ImbuedTechPower|BonusSpiritForChargedAbilities|TechPowerGain"));
        Add("spirit-damage", Any("DamagePerChain|TechDamagePercent|SpiritDamage|ProcDamage|Damage|DotDamage|DamagePerPulse|BonusSpiritDamage") || Is("Mystic Shot", "Mystic Burst", "Tankbuster", "Spirit Burn", "Lightning Scroll", "Alchemical Fire", "Torment Pulse", "Spirit Strike", "Spirit Snatch", "Mystic Reverb", "Scourge", "Stalker", "Phantom Strike", "Decay"));
        Add("cooldown", Any("CooldownReduction|UltimateCooldownReduction|CooldownReductionOnChargedAbilities|CooldownReductionOnProc|TechCooldownReduction|AbilityCooldownReductionPercent|CooldownReductionPercent|ImbuedCooldownReduction") || Is("Compress Cooldown", "Superior Cooldown", "Transcendent Cooldown", "Refresher", "Echo Shard", "Spellslinger", "Recharging Rush"));
        Add("ability-range", Any("TechRangeMultiplier|TechRadiusMultiplier|TechRangeMultiplierBuff|TechRadiusMultiplierBuff|StackingTechRangeMultiplier|BonusAbilityRange|BonusAbilityRadius")); Add("duration", Any("TechDurationMultiplier|BonusAbilityDurationPercent|AbilityDurationPercent|ImbuedDurationMultiplier")); Add("charges", Any("BonusAbilityCharges|AbilityChargeReplenishPercent") || Is("Extra Charge", "Rapid Recharge", "Refresher", "Recharging Rush"));
        var prose = string.Join(" ", (item["description"] as JsonObject ?? new JsonObject()).Select(x => J.Str(x.Value)).Concat((item["tooltip_sections"] as JsonArray ?? new JsonArray()).OfType<JsonObject>().SelectMany(s => (s["section_attributes"] as JsonArray ?? new JsonArray()).Select(a => J.Str(a?["loc_string"])))));
        Add("imbue", Regex.IsMatch(prose, @"\bimbue(?:d)?\b", RegexOptions.IgnoreCase) || p.Any(pair => Regex.IsMatch(pair.Key, "^(?:Imbue|Imbued)") && V(pair.Key) != 0));
        return J.List(tags.Order(StringComparer.Ordinal).Select(t => (JsonNode?)JsonValue.Create(t)));
    }
}
