using System.Text.Json.Nodes;
using Deadlock.Api;
using Deadlock.Api.Ingestion;

namespace Deadlock.Tests;

public sealed class AbilityTests
{
    internal static JsonObject CatalogFixture(JsonObject heroes)
    {
        JsonObject Text(string s) => new() { ["ru"] = s, ["en"] = s };
        var rows = new JsonArray();
        foreach (var hero in heroes["heroes"]!.AsArray())
        {
            var abilities = new JsonArray();
            for (var slot = 1; slot <= 4; slot++)
            {
                var id = (long)hero!["id"]!.GetValue<int>() * 10 + slot;
                var upgrades = new JsonArray();
                for (var tier = 1; tier <= 3; tier++) upgrades.Add(new JsonObject { ["tier"] = tier, ["cost"] = new[] { 1, 2, 5 }[tier - 1], ["description"] = Text("Upgrade"), ["operations"] = new JsonArray(new JsonObject { ["property"] = "Damage", ["type"] = "addBase", ["value"] = tier }) });
                abilities.Add(new JsonObject { ["id"] = id, ["className"] = "fixture_" + id, ["slot"] = slot, ["name"] = Text("Ability"), ["description"] = Text("Deal damage"), ["icon"] = $"assets/abilities/{id}.webp", ["parameters"] = new JsonArray(new JsonObject { ["id"] = "Damage", ["label"] = Text("Damage"), ["value"] = 30, ["display"] = true, ["scale"] = new JsonObject { ["className"] = "scale_function_tech_damage", ["stat"] = "ETechPower", ["coefficient"] = 0.6, ["disabled"] = true }, ["metadata"] = new JsonObject { ["m_nRequiredUpgradeBits"] = "CITADEL_UPGRADE_TIER_TRAINED | CITADEL_UPGRADE_TIER_BIT_4" } }), ["upgrades"] = upgrades, ["sections"] = new JsonArray(), ["variants"] = new JsonArray() });
            }
            rows.Add(new JsonObject { ["heroId"] = hero!["id"]!.DeepClone(), ["abilities"] = abilities });
        }
        return new JsonObject { ["meta"] = new JsonObject { ["schemaVersion"] = 1, ["clientVersion"] = heroes["meta"]!["clientVersion"]!.DeepClone(), ["sourceRevision"] = heroes["meta"]!["sourceRevision"]!.DeepClone(), ["gameCommit"] = heroes["meta"]!["gameCommit"]!.DeepClone(), ["updatedAt"] = "2026-11-03T00:00:00Z" }, ["heroes"] = rows };
    }
    [Fact]
    public void TextRemovesEmbeddedSvgAndMarkupButRetainsReadableConditions()
    {
        Assert.Equal("Deal damage & heal\nNext", AbilityAdapter.Plain("<svg><text>bad</text></svg>Deal <b>damage</b> &amp; heal<br>Next"));
    }
    [Fact]
    public void TextNormalizesBindingsAndImageSpacingWithoutLosingParagraphs()
    {
        Assert.Equal("Empower (1): Deal spirit damage\n\nDraw: Paint", AbilityAdapter.Plain("Empower ( a b i l i t y1 ): Deal <svg>icon</svg>\n<span>spirit damage</span><br><br>Draw (<svg>mouse</svg>\n): Paint"));
    }
    [Theory]
    [InlineData("unit")]
    [InlineData("displayUnits")]
    [InlineData("cssClass")]
    public void OptionalParameterFieldsMustRemainStrings(string field)
    {
        var heroes = JsonNode.Parse("""{"meta":{"clientVersion":6842,"sourceRevision":1,"gameCommit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"heroes":[{"id":6}]}""")!.AsObject();
        var catalog = CatalogFixture(heroes);
        catalog["heroes"]![0]!["abilities"]![0]!["parameters"]![0]![field] = new JsonObject { ["bad"] = "value" };
        Assert.Throws<InvalidDataException>(() => AbilityAdapter.Validate(catalog, heroes));
    }
    [Theory]
    [InlineData("", "addBase")]
    [InlineData("EAddToScale", "addScale")]
    [InlineData("EMultiplyScale", "multiplyScale")]
    [InlineData("EMultiplyBase", "multiplyBase")]
    [InlineData("EAddToBase", "addBase")]
    public void OperationTypesPreserveTheirDistinctMeaning(string source, string target)
        => Assert.Equal(target, AbilityAdapter.OperationType(source));

    [Fact]
    public void UnknownOperationsFailClosed() => Assert.Throws<InvalidDataException>(() => AbilityAdapter.OperationType("EGuess"));

    [Fact]
    public void NormalizationRetainsRawDisabledScaleGatesUnitsAndTooltipHierarchy()
    {
        var meta = JsonNode.Parse("""{"schemaVersion":1,"clientVersion":6842,"sourceRevision":11196939,"gameCommit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}""");
        var heroes = new JsonObject { ["meta"] = meta, ["heroes"] = new JsonArray(new JsonObject { ["id"] = 6 }) };
        var bindings = new JsonObject(); var apiBindings = new JsonObject(); var raw = new JsonObject(); var en = new JsonArray();
        for (var slot=1;slot<=4;slot++)
        {
            var name = "fixture_" + slot; bindings[$"ESlot_Signature_{slot}"] = name; apiBindings[$"signature{slot}"] = name;
            raw[name] = JsonNode.Parse("""{"m_mapAbilityProperties":{"Damage":{"m_strValue":"22","m_nRequiredUpgradeBits":"TRAINED | BIT_4","m_subclassScaleFunction":{"_class":"scale_function_tech_damage","m_flStatScale":0.6,"m_eSpecificStatScaleType":"ETechPower","m_bFunctionDisabled":true,"m_flMinValue":0}}},"m_vecAbilityUpgrades":[{"m_vecPropertyUpgrades":[{"m_strPropertyName":"Damage","m_strBonus":"33.33","m_eUpgradeType":"EMultiplyBase"}]},{"m_vecPropertyUpgrades":[]},{"m_vecPropertyUpgrades":[{"m_strPropertyName":"Damage","m_strBonus":0.12,"m_eUpgradeType":"EAddToScale","m_eScaleStatFilter":"ETechPower"}]}]}""");
            var api = JsonNode.Parse("""{"name":"Example","properties":{"Damage":{"value":22,"label":"Damage","postfix":"m","display_units":"EDisplayUnit_Meters","scale_function":{"class_name":"scale_function_tech_damage","stat_scale":0.6,"specific_stat_scale_type":"ETechPower"}}},"description":{"desc":"<b>Damage</b>"},"upgrades":[{"property_upgrades":[{"name":"Damage","bonus":33.33,"upgrade_type":"EMultiplyBase"}]},{"property_upgrades":[]},{"property_upgrades":[{"name":"Damage","bonus":0.12,"upgrade_type":"EAddToScale","scale_stat_filter":"ETechPower"}]}],"tooltip_details":{"additional_header_properties":["Damage"],"info_sections":[{"loc_string":"<b>Section</b>","property_upgrade_required":"Damage","properties_block":[{"loc_string":"On hit","properties":[{"important_property":"Damage","status_effect_value":"DebuffDuration"}]}]}]}}""")!.AsObject();
            api["id"] = slot; api["class_name"] = name; en.Add(api);
        }
        var rawHeroes = new JsonObject { ["hero"] = new JsonObject { ["m_HeroID"] = 6, ["m_mapBoundAbilities"] = bindings } };
        var apiHeroes = new JsonArray(new JsonObject { ["id"] = 6, ["items"] = apiBindings });
        var result = AbilityAdapter.Build(heroes,rawHeroes,raw,apiHeroes,en,en.DeepClone().AsArray(),new(6842,11196939,"2026-11-03"),new string('a',40),"2026-11-03T00:00:00Z");
        var ability = result["heroes"]![0]!["abilities"]![0]!; var parameter = ability["parameters"]![0]!;
        Assert.True(parameter["scale"]!["disabled"]!.GetValue<bool>());
        Assert.Equal(0.6,parameter["scale"]!["coefficient"]!.GetValue<double>());
        Assert.Equal("TRAINED | BIT_4",parameter["metadata"]!["m_nRequiredUpgradeBits"]!.GetValue<string>());
        Assert.Equal("m",parameter["unit"]!.GetValue<string>());
        Assert.Equal("multiplyBase",ability["upgrades"]![0]!["operations"]![0]!["type"]!.GetValue<string>());
        Assert.Equal(33.33,ability["upgrades"]![0]!["operations"]![0]!["value"]!.GetValue<double>());
        Assert.Equal("Damage",ability["sections"]![0]!["metadata"]!["property_upgrade_required"]!.GetValue<string>());
        Assert.Equal("DebuffDuration",ability["sections"]![0]!["blocks"]![0]!["metadata"]!["properties"]![0]!["status_effect_value"]!.GetValue<string>());
        ability["description"]!["en"] = "<script>bad</script>";
        Assert.Throws<InvalidDataException>(()=>AbilityAdapter.Validate(result,heroes));
    }

    [Fact]
    public void SlotMappingUsesRawBindingsAndRejectsApiMismatch()
    {
        var heroes = JsonNode.Parse("""{"heroes":[{"id":6}]}""")!.AsObject();
        var rawHeroes = JsonNode.Parse("""{"hero":{"m_HeroID":6,"m_mapBoundAbilities":{"ESlot_Signature_1":"a","ESlot_Signature_2":"a","ESlot_Signature_3":"a","ESlot_Signature_4":"a"}}}""")!.AsObject();
        var apiHeroes = JsonNode.Parse("""[{"id":6,"items":{"signature1":"different"}}]""")!.AsArray();
        Assert.Throws<InvalidDataException>(() => AbilityAdapter.Build(heroes, rawHeroes, new(), apiHeroes, new(), new(), new(6842, 11196939, "2026-11-03"), new string('a',40), "2026-11-03T00:00:00Z"));
    }

    [Fact]
    public void PinnedFullRosterAuditWhenExplicitPrivateEvidenceIsProvided()
    {
        var archive = Environment.GetEnvironmentVariable("DEADLOCK_ABILITY_AUDIT_ROOT"); if (archive is null) return;
        var run = Path.Combine(archive, "knowledge/agents/heroes/runs/ccfd9150-4d1d-4599-a7ec-6cf7611f69ce");
        var heroes = JsonNode.Parse(File.ReadAllText(Path.Combine(archive,"data/heroes.json")))!.AsObject();
        var result = AbilityAdapter.Build(heroes,
            Kv3.Parse(File.ReadAllText(Path.Combine(archive,"knowledge/agents/data/runs/hero-calculator-metadata-2026-11-03/heroes6842.vdata"))),
            Kv3.Parse(File.ReadAllText(Path.Combine(run,"abilities6842.vdata"))),
            JsonNode.Parse(File.ReadAllText(Path.Combine(run,"api-heroes6842.json")))!.AsArray(),
            JsonNode.Parse(File.ReadAllText(Path.Combine(archive,"knowledge/current/data/all_ability_item_assets_6842.json")))!.AsArray(),
            JsonNode.Parse(File.ReadAllText(Path.Combine(run,"ru-assets6842.json")))!.AsArray(),
            new(6842,11196939,"2026-11-02"), "fc53d8b267db6949b03d3fdb975dff4c9028f77b", "2026-11-03T00:00:00Z");
        Assert.Equal(44,result["heroes"]!.AsArray().Count);
        var all = AbilityAdapter.All(result).ToList(); Assert.Equal(180,all.Count);
        Assert.True(all.SelectMany(a=>a["parameters"]!.AsArray()).Count(p=>p!["scale"]?["disabled"]?.GetValue<bool>() == true) >= 22);
        Assert.Contains(all.SelectMany(a=>a["parameters"]!.AsArray()),p=>p!["metadata"]?["m_nRequiredUpgradeBits"]?.ToString().Contains("BIT_4") == true);
        var output = Environment.GetEnvironmentVariable("DEADLOCK_ABILITY_AUDIT_OUTPUT"); if (output is not null) File.WriteAllBytes(output, Deadlock.Api.Data.ArchiveJson.Bytes(result));
    }
}
