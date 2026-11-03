using System.Globalization;
using System.Text.Json.Nodes;

namespace Deadlock.Api.Ingestion;

/// <summary>Normalized calculator inputs from materialized, version-pinned configuration.</summary>
public static class CalculatorMetadata
{
    static readonly Dictionary<string, string> Stats = new()
    {
        ["AMMO_CLIP_SIZE_PERCENT"] = "clipSizePercent", ["WEAPON_DAMAGE_INCREASE"] = "weaponDamagePercent",
        ["WEAPON_DAMAGE_TO_NPC_INCREASE"] = "npcWeaponDamagePercent", ["OUT_OF_COMBAT_HEALTH_REGEN"] = "outOfCombatRegen",
        ["BULLET_RESIST_NON_HERO"] = "npcBulletResist", ["FIRE_RATE"] = "fireRatePercent", ["HEALTH_MAX"] = "health",
        ["BONUS_BULLET_SPEED_PERCENT"] = "bulletSpeedPercent", ["TECH_POWER"] = "spirit", ["MELEE_DAMAGE_INCREASE"] = "meleeDamagePercent",
        ["PARRY_COOLDOWN_REDUCTION_FIXED"] = "parryCooldownReduction", ["MELEE_RESIST"] = "meleeResist", ["STATUS_RESISTANCE"] = "debuffResist",
        ["STAMINA_REGEN_PER_SECOND_PERCENTAGE"] = "staminaRegenPercent", ["MOVEMENT_SPEED_MAX"] = "moveSpeed",
        ["BONUS_WEAPON_DAMAGE_CLOSE_RANGE_MAX_RANGE"] = "closeRangeThreshold", ["CLOSE_RANGE_WEAPON_DAMAGE_INCREASE"] = "closeRangeWeaponDamagePercent",
        ["LONG_RANGE_BULLET_DAMAGE_INCREASE"] = "longRangeWeaponDamagePercent", ["BONUS_BULLET_DAMAGE_LONG_RANGE_MIN_RANGE"] = "longRangeThreshold",
        ["BONUS_ATTACK_RANGE_PERCENT"] = "weaponRangePercent", ["SPRINT_SPEED_BONUS"] = "sprintSpeed", ["TECH_RESIST"] = "spiritResist",
        ["BULLET_ARMOR_DAMAGE_RESIST"] = "bulletResist", ["BULLET_LIFESTEAL"] = "bulletLifesteal", ["TECH_LIFESTEAL"] = "spiritLifesteal",
        ["HEAL_AMP_CAST_PERCENT"] = "healingAmp", ["HEAL_AMP_REGEN_PERCENT"] = "regenAmp", ["MOVEMENT_SLOW_RESISTANCE"] = "slowResist",
        ["STAMINA"] = "stamina", ["BONUS_ABILITY_DURATION_PERCENTAGE"] = "durationPercent", ["TECH_RANGE_PERCENT"] = "rangePercent",
        ["TECH_RADIUS_PERCENT"] = "radiusPercent", ["BONUS_ABILITY_CHARGES"] = "charges", ["COOLDOWN_BETWEEN_CHARGE_REDUCTION_PERCENTAGE"] = "chargeCooldownReduction",
        ["COOLDOWN_REDUCTION_PERCENTAGE"] = "cooldownReduction", ["ITEM_COOLDOWN_REDUCTION_PERCENTAGE"] = "itemCooldownReduction",
        ["BASE_HEALTH_PERCENT"] = "baseHealthPercent", ["HEALTH_MAX_PERCENT"] = "maxHealthPercent", ["ULTIMATE_COOLDOWN_REDUCTION_PERCENTAGE"] = "ultimateCooldownReduction",
        ["TECH_POWER_PERCENT"] = "spiritPercent", ["HEALTH_REGEN_PER_SECOND"] = "healthRegen", ["ALL_DAMAGE_MULTIPLIER"] = "damagePercent",
        ["RELOAD_SPEED"] = "reloadSpeedPercent"
    };
    public static IEnumerable<string> SupportedStats => Stats.Values.Distinct();
    public static readonly string[] Scopes = ["self", "outOfCombat", "versusNPC", "closeRange", "longRange", "imbuedAbility", "chargedAbilities", "chargeEligibleAbilities", "ultimate"];
    public static readonly string[] HeroFields = ["bulletResist", "spiritResist", "bulletResistGrowth", "spiritResistGrowth", "bulletResistPerSpirit", "spiritResistPerSpirit", "sprintSpeed", "sprintSpeedPerSpirit", "moveSpeedPerSpirit", "clipSizePerSpirit", "staminaRegen", "debuffResist", "bulletLifesteal"];
    static double Numeric(JsonNode? node, string label, bool meters = false)
    {
        var text = J.Scalar(node).Trim(); if (meters && text.EndsWith('m')) text = text[..^1];
        if (!double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var n) || !double.IsFinite(n)) throw new InvalidDataException($"Invalid calculator number {label}");
        return n;
    }
    public static JsonObject Hero(JsonObject hero)
    {
        var stats = J.Obj(hero["m_mapStartingStats"], "starting stats"); var boons = J.Obj(hero["m_mapStandardLevelUpUpgrades"], "boons"); var scales = hero["m_mapScalingStats"] as JsonObject ?? new();
        double Stat(string key) => J.Num(stats[key], key, 0);
        double Scale(string key) { var s = scales[key]; if (s is null) return 0; if (J.Str(s["eScalingStat"]) != "ETechPower") throw new InvalidDataException("Unsupported calculator hero scale"); return J.Num(s["flScale"], key); }
        return new() { ["bulletResist"] = Stat("EBulletArmorDamageReduction"), ["spiritResist"] = Stat("ETechArmorDamageReduction"), ["bulletResistGrowth"] = J.Num(boons["MODIFIER_VALUE_BULLET_ARMOR_DAMAGE_RESIST"], "bullet resist growth", 0), ["spiritResistGrowth"] = J.Num(boons["MODIFIER_VALUE_TECH_RESIST"], "spirit resist growth", 0), ["bulletResistPerSpirit"] = Scale("EBulletArmorDamageReduction"), ["spiritResistPerSpirit"] = Scale("ETechArmorDamageReduction"), ["sprintSpeed"] = Stat("ESprintSpeed"), ["sprintSpeedPerSpirit"] = Scale("ESprintSpeed"), ["moveSpeedPerSpirit"] = Scale("EMaxMoveSpeed"), ["clipSizePerSpirit"] = Scale("EClipSize"), ["staminaRegen"] = Stat("EStaminaRegenPerSecond"), ["debuffResist"] = Stat("EDebuffResist"), ["bulletLifesteal"] = Stat("EBulletLifesteal") };
    }
    public static JsonObject Item(string className, JsonObject raw)
    {
        var properties = raw["m_mapAbilityProperties"] as JsonObject ?? new(); var registered = new HashSet<string>();
        // Only direct fields on actual auto-intrinsic modifiers count; nested trigger modifiers do not.
        foreach (var intrinsic in raw["m_AutoIntrinsicModifiers"] as JsonArray ?? new())
            foreach (var key in intrinsic?["m_vecAutoRegisterModifierValueFromAbilityPropertyName"] as JsonArray ?? new()) registered.Add(J.Str(key));
        var exceptions = className switch { "upgrade_tech_purge" => "TechResist", "upgrade_improved_bullet_armor" => "BulletResist", "upgrade_mystic_reverb" => "AbilityLifestealPercentHero", _ => "" };
        bool InnateDisplay(string key) => (raw["m_vecTooltipSectionInfo"] as JsonArray ?? new()).Any(section => J.Str(section?["m_eAbilitySectionType"]) == "EArea_Innate" && (section?["m_vecSectionAttributes"] as JsonArray ?? new()).Any(attribute => new[] { "m_vecAbilityProperties", "m_vecElevatedAbilityProperties" }.Any(field => (attribute?[field] as JsonArray ?? new()).Any(name => J.Str(name) == key)) || (attribute?["m_vecImportantAbilityProperties"] as JsonArray ?? new()).Any(property => J.Str(property?["m_strImportantProperty"]) == key)));
        // Three reviewed custom-class innates; flags alone are unsafe for other custom effects.
        if (exceptions != "" && InnateDisplay(exceptions) && J.Str(properties[exceptions]?["m_eStatsUsageFlags"]).Contains("IntrinsicallyProvidedInAbility", StringComparison.Ordinal)) registered.Add(exceptions);
        var result = new JsonArray();
        foreach (var (key, value) in properties)
        {
            if (!registered.Contains(key) || value is not JsonObject p || J.Str(p["m_eStatsUsageFlags"]).Contains("ConditionallyApplied", StringComparison.Ordinal)) continue;
            var modifier = J.Str(p["m_eProvidedPropertyType"]); if (!modifier.StartsWith("MODIFIER_VALUE_", StringComparison.Ordinal) || !Stats.TryGetValue(modifier[15..], out var stat)) continue;
            var filter = J.Str(p["m_eApplyFilter"]); if (filter is not ("" or "EApplyFilter_None" or "EApplyFilter_OnlyIfImbued" or "EApplyFilter_OnlyIfHasCharges")) continue;
            var scope = stat switch { "outOfCombatRegen" => "outOfCombat", "npcWeaponDamagePercent" or "npcBulletResist" => "versusNPC", "closeRangeWeaponDamagePercent" or "closeRangeThreshold" => "closeRange", "longRangeWeaponDamagePercent" or "longRangeThreshold" => "longRange", "charges" => "chargeEligibleAbilities", "ultimateCooldownReduction" => "ultimate", _ => "self" };
            if (filter == "EApplyFilter_OnlyIfHasCharges" || key is "BonusSpiritForChargedAbilities" or "CooldownBetweenChargeReduction" or "CooldownReductionOnChargedAbilities") scope = "chargedAbilities";
            if (filter == "EApplyFilter_OnlyIfImbued" || key == "ImbuedTechPower")
            {
                if (!J.Str(raw["m_TargetAbilityEffectsToApply"]).Contains("IMBUE", StringComparison.Ordinal)) throw new InvalidDataException("Imbued property without target behavior");
                scope = "imbuedAbility";
            }
            var output = new JsonObject { ["key"] = key, ["stat"] = stat, ["value"] = Numeric(p["m_strValue"], key, stat is "moveSpeed" or "sprintSpeed" or "closeRangeThreshold" or "longRangeThreshold"), ["scope"] = scope };
            if (p["m_subclassScaleFunction"] is JsonObject scale && scale["m_flStatScale"] is not null)
            {
                var coefficient = Numeric(scale["m_flStatScale"], key); var kind = J.Str(scale["m_eSpecificStatScaleType"]);
                if (coefficient != 0) { if (kind == "ETechPower" || J.Str(scale["_class"]) == "scale_function_healing_spirit_scale") output["spiritScale"] = coefficient; else if (kind == "ELevelUpBoons") output["boonScale"] = coefficient; else throw new InvalidDataException($"Unsupported calculator item scaling {key}"); }
            }
            result.Add(output);
        }
        return new() { ["modifiers"] = result };
    }
    public static JsonObject Rules(IEnumerable<JsonObject> heroes)
    {
        JsonObject? investment = null;
        foreach (var hero in heroes)
        {
            var raw = J.Obj(hero["m_MapModCostBonuses"], "investment bonuses"); var candidate = new JsonObject();
            foreach (var (key, category) in new[] { ("EItemSlotType_WeaponMod", "weapon"), ("EItemSlotType_Armor", "vitality"), ("EItemSlotType_Tech", "spirit") })
                candidate[category] = J.List(J.Rows(raw[key], key).Select(row => new JsonObject { ["souls"] = J.Num(row["nGoldThreshold"], "threshold"), ["bonus"] = J.Num(row["flBonus"], "investment bonus") }));
            if (investment is not null && !JsonNode.DeepEquals(investment, candidate)) throw new InvalidDataException("Hero investment tables disagree"); investment = candidate;
        }
        // Valve Shop Rework 2025-11-21: nine universal slots, three Walker unlocks; four active slots.
        var result = new JsonObject { ["schemaVersion"] = 1, ["baseSlots"] = 9, ["maxSlots"] = 12, ["maxActiveItems"] = 4, ["investment"] = investment ?? throw new InvalidDataException("Missing calculator roster") };
        ArchiveValidation.CalculatorRules(result); return result;
    }
}
