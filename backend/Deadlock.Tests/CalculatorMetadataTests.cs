using System.Text.Json.Nodes;
using Deadlock.Api.Ingestion;

namespace Deadlock.Tests;

public sealed class CalculatorMetadataTests
{
    [Fact]
    public void MeleeSourceInputsIncludeHeavySpiritScalingAndGrowth()
    {
        var raw = Kv3.Parse("""{m_mapStartingStats={ELightMeleeDamage=42 EHeavyMeleeDamage=120} m_mapStandardLevelUpUpgrades={MODIFIER_VALUE_BASE_MELEE_DAMAGE_FROM_LEVEL=1.2} m_mapScalingStats={EHeavyMeleeDamage={eScalingStat="ETechPower" flScale=0.45}}}""");
        var result = CalculatorMetadata.Hero(raw);
        Assert.Equal(42,result["lightMeleeDamage"]!.GetValue<double>());
        Assert.Equal(120,result["heavyMeleeDamage"]!.GetValue<double>());
        Assert.Equal(1.2,result["meleeGrowth"]!.GetValue<double>());
        Assert.Equal(0.45,result["heavyMeleePerSpirit"]!.GetValue<double>());
    }
    [Fact]
    public void LegacyCalculatorRowsMayOmitMeleeButPresentFieldsMustBeNumeric()
    {
        var snapshot = JsonNode.Parse(File.ReadAllText(Path.Combine(Deadlock.Api.AppEnvironment.ResolveRoot([]),"data/heroes.json")))!.AsObject();
        foreach (var h in snapshot["heroes"]!.AsArray())
            if (h!["calculation"] is JsonObject calculation)
                foreach (var key in new[] { "lightMeleeDamage", "heavyMeleeDamage", "meleeGrowth", "heavyMeleePerSpirit" }) calculation.Remove(key);
        ArchiveValidation.Heroes(snapshot);
        var first = snapshot["heroes"]![0]!;
        if (first["calculation"] is not JsonObject c) { c = new JsonObject(); foreach (var key in CalculatorMetadata.HeroFields) c[key] = 0; first["calculation"] = c; }
        c["heavyMeleePerSpirit"] = "invalid";
        Assert.Throws<InvalidDataException>(()=>ArchiveValidation.Heroes(snapshot));
    }
    [Fact]
    public void MinaAndGravesInnateSecondaryStatsRetainTheirSignedValues()
    {
        var mina = Kv3.Parse("""{m_mapStartingStats={EDebuffResist=-8} m_mapStandardLevelUpUpgrades={}}""");
        var graves = Kv3.Parse("""{m_mapStartingStats={EBulletLifesteal=8} m_mapStandardLevelUpUpgrades={}}""");
        Assert.Equal(-8, CalculatorMetadata.Hero(mina)["debuffResist"]!.GetValue<double>());
        Assert.Equal(8, CalculatorMetadata.Hero(graves)["bulletLifesteal"]!.GetValue<double>());
        var directory = Environment.GetEnvironmentVariable("DEADLOCK_CALCULATOR_AUDIT");
        if (directory is not null)
        {
            var current = Kv3.Parse(File.ReadAllText(Path.Combine(directory, "heroes6842.vdata")));
            Assert.Equal(-8, CalculatorMetadata.Hero(current["hero_vampirebat"]!.AsObject())["debuffResist"]!.GetValue<double>());
            Assert.Equal(8, CalculatorMetadata.Hero(current["hero_necro"]!.AsObject())["bulletLifesteal"]!.GetValue<double>());
        }
    }
    [Fact]
    public void RegisteredHiddenBonusesAreIncludedButStaleAndEnemyPropertiesAreExcluded()
    {
        var raw = Kv3.Parse("""{ m_mapAbilityProperties={ HealAmpRegenPercent={m_strValue="20" m_eProvidedPropertyType="MODIFIER_VALUE_HEAL_AMP_REGEN_PERCENT"} BonusHealth={m_strValue="75" m_eProvidedPropertyType="MODIFIER_VALUE_HEALTH_MAX"} TechResist={m_strValue="-8" m_eProvidedPropertyType="MODIFIER_VALUE_TECH_RESIST" m_eStatsUsageFlags="CondictionallyApplied | ConditionallyApplied"} } m_AutoIntrinsicModifiers=[{m_vecAutoRegisterModifierValueFromAbilityPropertyName=["HealAmpRegenPercent","TechResist"]}] }""");
        var result = CalculatorMetadata.Item("upgrade_example", raw);
        var modifier = Assert.Single(result["modifiers"]!.AsArray());
        Assert.Equal("regenAmp", modifier!["stat"]!.GetValue<string>());
        Assert.Equal(20, modifier["value"]!.GetValue<double>());
    }
    [Fact]
    public void InnateNegativeResistsAndSpiritScalingAreRetained()
    {
        var hero = Kv3.Parse("""{m_mapStartingStats={EBulletArmorDamageReduction=-7 ETechArmorDamageReduction=8 ESprintSpeed=1.6 EStaminaRegenPerSecond=0.222222} m_mapStandardLevelUpUpgrades={MODIFIER_VALUE_TECH_RESIST=0.5} m_mapScalingStats={ETechArmorDamageReduction={eScalingStat="ETechPower" flScale=0.07}}}""");
        var result = CalculatorMetadata.Hero(hero);
        Assert.Equal(-7, result["bulletResist"]!.GetValue<double>());
        Assert.Equal(0.07, result["spiritResistPerSpirit"]!.GetValue<double>());
        Assert.Equal(0.5, result["spiritResistGrowth"]!.GetValue<double>());
    }
    [Fact]
    public void ImbueFilterDoesNotApplyToOtherIntrinsicProperties()
    {
        var raw = Kv3.Parse("""{m_TargetAbilityEffectsToApply="CITADEL_TARGET_ABILITY_BEHAVIOR_IMBUE_MODIFIER_VALUE" m_mapAbilityProperties={TechPower={m_strValue="8" m_eProvidedPropertyType="MODIFIER_VALUE_TECH_POWER"} TechRadiusMultiplier={m_strValue="20" m_eProvidedPropertyType="MODIFIER_VALUE_TECH_RADIUS_PERCENT" m_eApplyFilter="EApplyFilter_OnlyIfImbued"}} m_AutoIntrinsicModifiers=[{m_vecAutoRegisterModifierValueFromAbilityPropertyName=["TechPower","TechRadiusMultiplier"]}]}""");
        var result = CalculatorMetadata.Item("upgrade_example", raw)["modifiers"]!.AsArray();
        Assert.Equal("self", result[0]!["scope"]!.GetValue<string>());
        Assert.Equal("imbuedAbility", result[1]!["scope"]!.GetValue<string>());
    }
    [Fact]
    public void InvalidOptionalMetadataAndMalformedInvestmentTablesAreRejected()
    {
        Assert.Throws<InvalidDataException>(() => ArchiveValidation.ItemCalculation(JsonNode.Parse("""{"modifiers":[{"key":"x","stat":"spirit","scope":"enemy","value":10}]}""")!.AsObject()));
        Assert.Throws<InvalidDataException>(() => ArchiveValidation.ItemCalculation(JsonNode.Parse("""{"modifiers":[{"key":"x","stat":"spirit","scope":"self","value":"NaN"}]}""")!.AsObject()));
        var raw = Kv3.Parse("""{m_MapModCostBonuses={EItemSlotType_WeaponMod=[{nGoldThreshold=800 flBonus=9},{nGoldThreshold=1600 flBonus=12}] EItemSlotType_Armor=[{nGoldThreshold=800 flBonus=9}] EItemSlotType_Tech=[{nGoldThreshold=800 flBonus=7}]}}""");
        var rules = CalculatorMetadata.Rules([raw]); Assert.Equal(12, rules["maxSlots"]!.GetValue<int>());
        var changed = (JsonObject)raw.DeepClone(); changed["m_MapModCostBonuses"]!["EItemSlotType_Tech"]![0]!["flBonus"] = 8;
        Assert.Throws<InvalidDataException>(() => CalculatorMetadata.Rules([raw, changed]));
        raw["m_MapModCostBonuses"]!["EItemSlotType_WeaponMod"]![1]!["nGoldThreshold"] = 800;
        Assert.Throws<InvalidDataException>(() => CalculatorMetadata.Rules([raw]));
    }
    [Fact]
    public void ReviewedPrivateConfigurationMatchesEverySupportedAuditCandidateWhenAvailable()
    {
        var directory = Environment.GetEnvironmentVariable("DEADLOCK_CALCULATOR_AUDIT"); if (directory is null) return;
        var raw = Kv3.Parse(File.ReadAllText(Path.Combine(directory, "abilities.vdata")));
        var audit = JsonNode.Parse(File.ReadAllText(Path.Combine(directory, "supported-intrinsic-modifiers-6839.json")))!.AsObject();
        foreach (var item in audit["items"]!.AsArray())
        {
            var className = item!["className"]!.GetValue<string>();
            var actual = CalculatorMetadata.Item(className, raw[className]!.AsObject())["modifiers"]!.AsArray();
            foreach (var expected in item["modifiers"]!.AsArray())
            {
                var modifier = expected!["modifier"]!.GetValue<string>();
                var unsupported = new[] { "ZOOM_INCREASE_PERCENT", "AIR_MOVE_DISTANCE_INCREASE_PERCENT", "MOVEMENT_SPEED_WHILE_SHOOTING_PENALTY_REDUCTION_PERCENT", "MOVEMENT_SPEED_WHILE_ZOOMED_PENALTY_REDUCTION_PERCENT", "MOVEMENT_SLIDE_DISTANCE_SCALE", "MELEE_TRAVEL_DISTANCE_PERCENTAGE", "AIR_CONTROL_PERCENT", "AIR_CONTROL_ACCEL_PERCENT" };
                if (unsupported.Any(m => modifier == "MODIFIER_VALUE_" + m)) continue;
                var expectedScope = expected["scope"]!.GetValue<string>() switch { "closeRangeThreshold" => "closeRange", "longRangeThreshold" => "longRange", var scope => scope };
                Assert.Contains(actual, m => m!["key"]!.GetValue<string>() == expected["key"]!.GetValue<string>() && m["value"]!.GetValue<double>() == expected["value"]!.GetValue<double>() && m["scope"]!.GetValue<string>() == expectedScope);
            }
            Assert.All(actual, m => Assert.Contains(item["modifiers"]!.AsArray(), e => e!["key"]!.GetValue<string>() == m!["key"]!.GetValue<string>()));
        }
        var heroes = Kv3.Parse(File.ReadAllText(Path.Combine(directory, "heroes.vdata")));
        Assert.Equal(-8, CalculatorMetadata.Hero(heroes["hero_vampirebat"]!.AsObject())["debuffResist"]!.GetValue<double>());
        Assert.Equal(8, CalculatorMetadata.Hero(heroes["hero_necro"]!.AsObject())["bulletLifesteal"]!.GetValue<double>());
        Assert.Equal(-15, CalculatorMetadata.Hero(heroes["hero_synth"]!.AsObject())["spiritResist"]!.GetValue<double>());
        var baba = CalculatorMetadata.Hero(heroes["hero_baba"]!.AsObject());
        Assert.Equal(-7, baba["bulletResist"]!.GetValue<double>()); Assert.Equal(8, baba["spiritResist"]!.GetValue<double>()); Assert.Equal(0.07, baba["spiritResistPerSpirit"]!.GetValue<double>());
        var released = heroes.Where(pair => pair.Value is JsonObject h && h["m_eHeroDevelopmentState"]?.GetValue<string>() == "EHeroDevState_Release").Select(pair => pair.Value!.AsObject()).ToList();
        var rules = CalculatorMetadata.Rules(released); Assert.Equal(11, rules["investment"]!["weapon"]!.AsArray().Count);
    }
}
