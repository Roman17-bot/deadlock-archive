using System.Globalization;
using System.Net;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Deadlock.Api.Data;

namespace Deadlock.Api.Ingestion;

/// <summary>Curated ability facts from one pinned API/raw version. No engine evaluation occurs here.</summary>
public static class AbilityAdapter
{
    public static string Plain(string source)
    {
        var text = Regex.Replace(source, @"<(svg|script|style)\b[^>]*>.*?</\1\s*>\s*", "", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        text = Regex.Replace(text, @"<br\s*/?>|</p\s*>", "\n", RegexOptions.IgnoreCase);
        text = WebUtility.HtmlDecode(Regex.Replace(text, "<[^>]*>", ""));
        text = Regex.Replace(text, @"\(\s*a\s*b\s*i\s*l\s*i\s*t\s*y\s*([1-4])\s*\)", "($1)", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"\s*\(\s*\)", "");
        return Regex.Replace(text, @"[^\S\n]+", " ").Trim();
    }
    static JsonObject Local(JsonNode? ru, JsonNode? en) => J.Local(Plain(J.Str(ru)), Plain(J.Str(en)));
    static JsonNode Scalar(JsonNode? source)
    {
        if (source is JsonValue v && v.GetValueKind() == System.Text.Json.JsonValueKind.Number) return JsonValue.Create(J.Num(v, "ability scalar"))!;
        var text = J.Scalar(source); return double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var n) && double.IsFinite(n) ? JsonValue.Create(n)! : JsonValue.Create(Plain(text))!;
    }
    static JsonNode? Safe(JsonNode? node) => node switch
    {
        JsonObject o => new JsonObject(o.Select(p => KeyValuePair.Create(p.Key, Safe(p.Value)))),
        JsonArray a => new JsonArray(a.Select(Safe).ToArray()),
        JsonValue v when v.TryGetValue<string>(out var text) => JsonValue.Create(Plain(text)),
        _ => node?.DeepClone()
    };
    public static string OperationType(string source) => source switch
    {
        "EAdd" => "add", "" or "EAddToBase" => "addBase", "EMultiplyBase" => "multiplyBase",
        "EAddToScale" => "addScale", "EMultiplyScale" => "multiplyScale", "ESet" or "ESetValue" => "set",
        _ => throw new InvalidDataException("Unknown ability upgrade operation " + source)
    };
    static JsonObject? Scale(JsonObject property, JsonObject raw)
    {
        var r = raw["m_subclassScaleFunction"] as JsonObject; var a = property["scale_function"] as JsonObject;
        if (r == null && a == null) return null;
        var result = new JsonObject { ["className"] = J.Str(r?["_class"], J.Str(a?["class_name"])) };
        var stat = r?["m_eSpecificStatScaleType"] ?? a?["specific_stat_scale_type"]; if (stat != null) result["stat"] = stat.DeepClone();
        var stats = r?["m_vecScalingStats"] ?? a?["scaling_stats"]; if (stats != null) result["stats"] = stats.DeepClone();
        var coefficient = r?["m_flStatScale"] ?? a?["stat_scale"]; if (coefficient != null) result["coefficient"] = Scalar(coefficient);
        if (r?["m_bFunctionDisabled"] != null) result["disabled"] = J.Bool(r["m_bFunctionDisabled"], "scale disabled");
        var metadata = (JsonObject)(Safe(r ?? a) ?? new JsonObject());
        foreach (var key in new[] { "_class", "_my_subclass_name", "class_name", "subclass_name", "m_eSpecificStatScaleType", "specific_stat_scale_type", "m_vecScalingStats", "scaling_stats", "m_flStatScale", "stat_scale", "m_bFunctionDisabled" }) metadata.Remove(key);
        if (metadata.Count > 0) result["metadata"] = metadata;
        return result;
    }
    public static JsonObject Build(JsonObject heroes, JsonObject rawHeroes, JsonObject rawAbilities, JsonArray apiHeroes, JsonArray english, JsonArray russian, GameVersion version, string commit, string updatedAt)
    {
        var en = J.Rows(english, "English abilities").ToDictionary(a => J.Str(a["class_name"]));
        var ru = J.Rows(russian, "Russian abilities").ToDictionary(a => J.Str(a["class_name"]));
        var ah = J.Rows(apiHeroes, "API heroes").ToDictionary(h => J.Id(h["id"], "hero"));
        var rh = rawHeroes.Select(p => p.Value).OfType<JsonObject>().Where(h => h["m_HeroID"] != null && J.Num(h["m_HeroID"], "hero") > 0).ToDictionary(h => J.Id(h["m_HeroID"], "hero"));
        JsonObject Detail(string className, bool variantAbility = false)
        {
            if (!en.TryGetValue(className, out var e) || !ru.TryGetValue(className, out var r)) throw new InvalidDataException("Missing localized ability " + className);
            var raw = J.Obj(rawAbilities[className], className); J.Equal(e["id"], r["id"], "localized ability ID");
            var properties = J.Obj(e["properties"], "ability properties"); var rawProperties = J.Obj(raw["m_mapAbilityProperties"], "raw ability properties");
            var parameters = new JsonArray();
            foreach (var (id, node) in properties)
            {
                var p = J.Obj(node, id); var rp = rawProperties[id] as JsonObject ?? new();
                if (rp["m_strValue"] != null) J.Equal(Scalar(rp["m_strValue"]), Scalar(p["value"]), "ability property " + id);
                var label = Local(r["properties"]?[id]?["label"], p["label"]);
                var parameter = new JsonObject { ["id"] = id, ["label"] = label, ["value"] = Scalar(p["value"]), ["display"] = J.Str(label["en"]) != "" && !J.Bool(rp["m_bIsHidden"], "hidden property", false) };
                foreach (var (from, to) in new[] { ("postfix", "unit"), ("display_units", "displayUnits"), ("css_class", "cssClass") }) if (p[from] != null) parameter[to] = Safe(p[from]);
                if (p["disable_value"] != null) parameter["disableValue"] = Scalar(p["disable_value"]);
                if (Scale(p, rp) is { } scale) parameter["scale"] = scale;
                var metadata = (JsonObject)Safe(rp)!;
                foreach (var key in new[] { "m_strValue", "m_strDisableValue", "m_strCSSClass", "m_eDisplayUnits", "m_subclassScaleFunction", "m_bCanSetTokenOverride" }) metadata.Remove(key);
                foreach (var field in new[] { "m_bIsHidden", "m_bRoundDown", "m_nMaxDecimalsDisplayed", "m_bIsAbilityDamageProperty", "m_eApplyFilter" }) if (rp[field] != null) metadata[field] = Safe(rp[field]);
                foreach (var field in new[] { "prefix", "can_set_token_override", "provided_property_type", "postvalue_label" }) if (p[field] != null) metadata[field] = Safe(p[field]);
                if (metadata.Count > 0) parameter["metadata"] = metadata;
                parameters.Add(parameter);
            }
            var upgrades = new JsonArray(); var tiers = e["upgrades"] as JsonArray ?? new();
            if (tiers.Count != 3 && !(variantAbility && tiers.Count == 0)) throw new InvalidDataException("Ability must have three upgrade tiers");
            for (var i = 0; i < tiers.Count; i++)
            {
                var ops = new JsonArray(); foreach (var op in J.Rows(tiers[i]?["property_upgrades"] ?? new JsonArray(), "ability upgrades"))
                {
                    var operation = new JsonObject { ["property"] = J.Str(op["name"]), ["type"] = OperationType(J.Str(op["upgrade_type"])), ["value"] = Scalar(op["bonus"]) };
                    if (op["scale_stat_filter"] != null) operation["scaleStat"] = op["scale_stat_filter"]!.DeepClone(); ops.Add(operation);
                }
                var rawOps = J.Rows(raw["m_vecAbilityUpgrades"]?[i]?["m_vecPropertyUpgrades"] ?? new JsonArray(), "raw upgrades").ToList();
                if (rawOps.Count != ops.Count) throw new InvalidDataException("API/raw ability upgrade count disagreement");
                for (var j = 0; j < rawOps.Count; j++)
                {
                    J.Equal(rawOps[j]["m_strPropertyName"], ops[j]?["property"], "upgrade property");
                    J.Equal(Scalar(rawOps[j]["m_strBonus"]), ops[j]?["value"], "upgrade value");
                    J.Equal(JsonValue.Create(OperationType(J.Str(rawOps[j]["m_eUpgradeType"]))), ops[j]?["type"], "upgrade operation");
                    J.Equal(rawOps[j]["m_eScaleStatFilter"], ops[j]?["scaleStat"], "upgrade scale stat");
                }
                upgrades.Add(new JsonObject { ["tier"] = i + 1, ["cost"] = new[] { 1, 2, 5 }[i], ["description"] = Local(r["description"]?[$"t{i + 1}_desc"], e["description"]?[$"t{i + 1}_desc"]), ["operations"] = ops });
            }
            var sections = new JsonArray(); var es = e["tooltip_details"]?["info_sections"] as JsonArray ?? new(); var rs = r["tooltip_details"]?["info_sections"] as JsonArray ?? new();
            for (var i = 0; i < es.Count; i++)
            {
                var s = J.Obj(es[i], "tooltip section"); var t = i < rs.Count ? rs[i] : null; var blocks = new JsonArray(); var eb = s["properties_block"] as JsonArray ?? new(); var rb = t?["properties_block"] as JsonArray ?? new();
                for (var b = 0; b < eb.Count; b++)
                {
                    var block = J.Obj(eb[b], "tooltip block"); var bp = block["properties"] as JsonArray ?? new();
                    blocks.Add(new JsonObject { ["title"] = Local(b < rb.Count ? rb[b]?["loc_string"] : null, block["loc_string"]), ["properties"] = new JsonArray(bp.Select(x => JsonValue.Create(J.Str(x?["important_property"]))).ToArray()), ["metadata"] = new JsonObject { ["properties"] = Safe(bp) } });
                }
                var meta = (JsonObject)Safe(s)!; meta.Remove("loc_string"); meta.Remove("properties_block"); meta.Remove("basic_properties");
                sections.Add(new JsonObject { ["description"] = Local(t?["loc_string"], s["loc_string"]), ["properties"] = Safe(s["basic_properties"] ?? new JsonArray()), ["blocks"] = blocks, ["metadata"] = meta });
            }
            var details = new JsonObject { ["id"] = e["id"]!.DeepClone(), ["className"] = className, ["name"] = Local(r["name"], e["name"]), ["description"] = Local(r["description"]?["desc"], e["description"]?["desc"]), ["icon"] = $"assets/abilities/{J.Id(e["id"], "ability ID")}.webp", ["parameters"] = parameters, ["upgrades"] = upgrades, ["sections"] = sections };
            var extra = new JsonObject();
            foreach (var key in new[] { "additional_header_properties", "additional_header_properties_from_down", "show_channel_time", "show_cast_delay" }) if (e["tooltip_details"]?[key] != null) extra[key] = Safe(e["tooltip_details"]![key]);
            if (e["dependent_abilities"] != null) extra["dependentAbilities"] = Safe(e["dependent_abilities"]);
            if (e["behaviours"] != null) extra["behaviours"] = Safe(e["behaviours"]);
            if (extra.Count > 0) details["metadata"] = extra;
            return details;
        }
        var rows = new JsonArray();
        foreach (var h in J.Rows(heroes["heroes"], "curated heroes"))
        {
            var id = J.Id(h["id"], "hero"); var signatures = new JsonArray();
            for (var slot = 1; slot <= 4; slot++)
            {
                var name = J.Str(rh[id]["m_mapBoundAbilities"]?[$"ESlot_Signature_{slot}"]); if (name == "") throw new InvalidDataException("Missing signature binding");
                J.Equal(JsonValue.Create(name), ah[id]["items"]?[$"signature{slot}"], "signature slot mapping");
                var ability = Detail(name); ability["slot"] = slot; var variants = new JsonArray();
                foreach (var (variantName, flagsNode) in en[name]["dependent_abilities"] as JsonObject ?? new())
                {
                    var flags = (flagsNode?["flags"] as JsonArray ?? new()).Select(x => J.Str(x)).ToHashSet();
                    if (!flags.Contains("DisplayAsSubAbility") && !flags.Contains("AssignAsAltFire")) continue;
                    if (!en.ContainsKey(variantName) || !ru.ContainsKey(variantName)) continue;
                    var variant = Detail(variantName, true); variant["linkedAbilityId"] = ability["id"]!.DeepClone(); variant["linkUpgrades"] = flags.Contains("LinkUpgrades"); variant["linkImbues"] = flags.Contains("LinkImbues"); variants.Add(variant);
                }
                ability["variants"] = variants; signatures.Add(ability);
            }
            rows.Add(new JsonObject { ["heroId"] = id, ["abilities"] = signatures });
        }
        var catalog = new JsonObject { ["meta"] = new JsonObject { ["schemaVersion"] = 1, ["clientVersion"] = version.Version, ["sourceRevision"] = version.Revision, ["gameCommit"] = commit, ["updatedAt"] = updatedAt }, ["heroes"] = rows };
        Validate(catalog, heroes); return catalog;
    }
    public static IEnumerable<JsonObject> All(JsonObject catalog) => J.Rows(catalog["heroes"], "ability heroes").SelectMany(h => J.Rows(h["abilities"], "signatures")).SelectMany(a => new[] { a }.Concat(J.Rows(a["variants"], "variants")));
    public static void Validate(JsonObject catalog, JsonObject heroes)
    {
        if (ArchiveJson.Bytes(catalog).Length > 4 * 1024 * 1024) throw new InvalidDataException("Ability catalogue exceeds public file limit");
        var meta = J.Obj(catalog["meta"], "ability metadata"); if (J.Num(meta["schemaVersion"], "ability schema") != 1) throw new InvalidDataException("Unknown ability schema");
        foreach (var key in new[] { "clientVersion", "sourceRevision", "gameCommit" }) J.Equal(meta[key], heroes["meta"]?[key], "ability version " + key);
        if (!DateTimeOffset.TryParse(J.Str(meta["updatedAt"]), CultureInfo.InvariantCulture, DateTimeStyles.None, out _)) throw new InvalidDataException("Invalid ability timestamp");
        var ids = J.Rows(heroes["heroes"], "heroes").Select(h => J.Id(h["id"], "hero")).Order().ToArray(); var rows = J.Rows(catalog["heroes"], "ability heroes").ToList();
        if (!rows.Select(h => J.Id(h["heroId"], "hero")).Order().SequenceEqual(ids)) throw new InvalidDataException("Incomplete ability roster");
        foreach (var h in rows) if (!J.Rows(h["abilities"], "signatures").Select(a => J.Num(a["slot"], "slot")).SequenceEqual(new double[] { 1, 2, 3, 4 })) throw new InvalidDataException("Invalid signature order");
        var all = All(catalog).ToList(); if (all.Count > 256 || all.Select(a => J.Id(a["id"], "ability")).Distinct().Count() != all.Count) throw new InvalidDataException("Duplicate or excessive abilities");
        static bool IsScalar(JsonNode? n) => n is JsonValue v && (v.GetValueKind() == System.Text.Json.JsonValueKind.String || v.GetValueKind() == System.Text.Json.JsonValueKind.Number && double.IsFinite(J.Num(v, "ability scalar")));
        static void LocalText(JsonNode? n) { if (n is not JsonObject o || o["ru"]?.GetValueKind() != System.Text.Json.JsonValueKind.String || o["en"]?.GetValueKind() != System.Text.Json.JsonValueKind.String) throw new InvalidDataException("Invalid localized ability text"); }
        static void Strings(JsonNode? n) { if (n is not JsonArray a || a.Any(x => x?.GetValueKind() != System.Text.Json.JsonValueKind.String)) throw new InvalidDataException("Invalid ability property order"); }
        foreach (var ability in all)
        {
            if (!Regex.IsMatch(J.Str(ability["icon"]), "^assets/abilities/[0-9]+\\.webp$") || J.Str(ability["name"]?["en"]) == "" || J.Str(ability["name"]?["ru"]) == "") throw new InvalidDataException("Invalid ability identity");
            if (J.Str(ability["className"]) == "") throw new InvalidDataException("Missing ability class");
            LocalText(ability["name"]); LocalText(ability["description"]);
            var ps = J.Rows(ability["parameters"], "parameters").ToList(); if (ps.Count > 150 || ps.Select(p => J.Str(p["id"])).Distinct().Count() != ps.Count) throw new InvalidDataException("Duplicate ability parameters");
            foreach (var p in ps) { LocalText(p["label"]); if (J.Str(p["id"]) == "" || !IsScalar(p["value"]) || p["disableValue"] != null && !IsScalar(p["disableValue"])) throw new InvalidDataException("Invalid ability parameter"); foreach (var field in new[] { "unit", "displayUnits", "cssClass" }) if (p.ContainsKey(field) && p[field]?.GetValueKind() != System.Text.Json.JsonValueKind.String) throw new InvalidDataException("Invalid optional ability field " + field); if (p["display"]?.GetValueKind() is not (System.Text.Json.JsonValueKind.True or System.Text.Json.JsonValueKind.False)) throw new InvalidDataException("Invalid ability display flag"); }
            foreach (var p in ps) if (p["scale"] is { } n)
            {
                var scale = J.Obj(n, "ability scale"); if (scale["className"]?.GetValueKind() != System.Text.Json.JsonValueKind.String) throw new InvalidDataException("Missing scale class");
                if (scale["coefficient"] != null) J.Num(scale["coefficient"], "scale coefficient");
                if (scale["disabled"] != null) J.Bool(scale["disabled"], "scale disabled");
                if (scale["stat"] != null && scale["stat"]!.GetValueKind() != System.Text.Json.JsonValueKind.String) throw new InvalidDataException("Invalid scale stat");
                if (scale["stats"] != null) Strings(scale["stats"]);
            }
            foreach (var section in J.Rows(ability["sections"], "ability sections"))
            {
                LocalText(section["description"]); Strings(section["properties"]);
                foreach (var block in J.Rows(section["blocks"], "ability blocks")) { LocalText(block["title"]); Strings(block["properties"]); }
            }
            var upgrades = J.Rows(ability["upgrades"], "upgrades").ToList(); if (!(ability["linkedAbilityId"] != null && upgrades.Count == 0) && (!upgrades.Select(u => J.Num(u["tier"], "tier")).SequenceEqual(new double[] { 1, 2, 3 }) || !upgrades.Select(u => J.Num(u["cost"], "cost")).SequenceEqual(new double[] { 1, 2, 5 }))) throw new InvalidDataException("Invalid ability tiers");
            foreach (var u in upgrades) LocalText(u["description"]);
            foreach (var u in upgrades) foreach (var op in J.Rows(u["operations"], "operations")) if (!new[] { "add", "addBase", "multiplyBase", "addScale", "multiplyScale", "set" }.Contains(J.Str(op["type"])) || J.Str(op["property"]) == "" || !IsScalar(op["value"]) || op["scaleStat"] != null && op["scaleStat"]!.GetValueKind() != System.Text.Json.JsonValueKind.String) throw new InvalidDataException("Invalid ability operation");
            foreach (var variant in J.Rows(ability["variants"] ?? new JsonArray(), "variants")) { J.Equal(variant["linkedAbilityId"], ability["id"], "linked signature"); J.Bool(variant["linkImbues"], "linked imbue"); J.Bool(variant["linkUpgrades"], "linked upgrades"); }
        }
        void Text(JsonNode? n, int depth = 0)
        {
            if (depth > 32) throw new InvalidDataException("Ability metadata nesting limit");
            if (n is JsonObject o) foreach (var (key, value) in o) { if (key is "__proto__" or "constructor" or "prototype") throw new InvalidDataException("Unsafe ability metadata key"); Text(value, depth + 1); }
            else if (n is JsonArray a) foreach (var value in a) Text(value, depth + 1);
            else if (n is JsonValue v)
            {
                if (v.TryGetValue<string>(out var s) && (s.Length > 12000 || Regex.IsMatch(s, "<[^>]+>|javascript:", RegexOptions.IgnoreCase))) throw new InvalidDataException("Unsafe ability text");
                if (v.GetValueKind() == System.Text.Json.JsonValueKind.Number) J.Num(v, "ability metadata number");
            }
        }
        Text(catalog);
    }
}
