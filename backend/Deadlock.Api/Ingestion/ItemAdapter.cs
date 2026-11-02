using System.Globalization;
using System.Net;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Deadlock.Api.Ingestion;

public static class ItemAdapter
{
    public static string PlainText(string input)
    {
        var s = Regex.Replace(input, @"<(svg|script|style)\b[^>]*>[\s\S]*?</\1>", "", RegexOptions.IgnoreCase);
        s = Regex.Replace(s, @"<br\s*/?\s*>|</(?:p|div|li)>", "\uE000", RegexOptions.IgnoreCase); s = Regex.Replace(s, "<[^>]*>", "");
        s = s.Replace("&nbsp;", " ", StringComparison.OrdinalIgnoreCase).Replace("&amp;", "&", StringComparison.OrdinalIgnoreCase).Replace("&quot;", "\"", StringComparison.OrdinalIgnoreCase).Replace("&#39;", "'", StringComparison.OrdinalIgnoreCase).Replace("&apos;", "'", StringComparison.OrdinalIgnoreCase).Replace("&lt;", "<", StringComparison.OrdinalIgnoreCase).Replace("&gt;", ">", StringComparison.OrdinalIgnoreCase);
        s = Regex.Replace(s, @"&#(x[0-9a-f]+|\d+);", m => { var n = long.Parse(m.Groups[1].Value.StartsWith('x') ? m.Groups[1].Value[1..] : m.Groups[1].Value, m.Groups[1].Value.StartsWith('x') ? NumberStyles.HexNumber : NumberStyles.Integer, CultureInfo.InvariantCulture); return n <= 0x10ffff && n is not (>= 0xd800 and <= 0xdfff) ? char.ConvertFromUtf32((int)n) : ""; }, RegexOptions.IgnoreCase);
        s = Regex.Replace(s, @"\s+", " ").Replace('\uE000', '\n'); s = Regex.Replace(s, @" *\n *", "\n"); s = Regex.Replace(s, @"\n{3,}", "\n\n"); return Regex.Replace(s, @"([.!?])(?=[A-ZА-ЯЁ])", "$1 ").Trim();
    }
    public static string Slug(string name) => Regex.Replace(name.ToLowerInvariant().Replace("'", "").Replace("’", ""), "[^a-z0-9]+", "-").Trim('-');
    static string Text(JsonNode? value, JsonObject properties)
    {
        var s = Regex.Replace(PlainText(J.Str(value)), @"\{s:([^}]+)\}", m => properties[m.Groups[1].Value]?["value"] is JsonNode v ? J.Scalar(v) : throw new InvalidDataException($"Unresolved item token {m.Value}"));
        if (Regex.IsMatch(s, @"\{[a-z]:[^}]+\}", RegexOptions.IgnoreCase)) throw new InvalidDataException("Unresolved item token"); return Regex.Replace(s, @"\b(\d+(?:\.\d+)?)mm\b", "$1m");
    }
    static JsonObject? Attribute(string key, JsonObject en, JsonObject ru)
    {
        var p = en["properties"]?[key] as JsonObject; var r = ru["properties"]?[key]; if (p is null || p["value"] is null || string.IsNullOrWhiteSpace(J.Scalar(p["value"])) || J.Scalar(p["value"]) == J.Str(p["disable_value"]) || string.IsNullOrEmpty(J.Str(p["label"]))) return null;
        var value = J.Scalar(p["value"]).Trim(); var prefix = J.Str(p["prefix"]); if (prefix == "{s:sign}") prefix = J.ParseFloat(p["value"]) >= 0 && !value.StartsWith('+') ? "+" : "";
        var postfix = PlainText(J.Str(p["postfix"])).Trim(); if (J.Str(p["display_units"]) == "EDisplayUnit_MetersPerSecond" || Regex.IsMatch(key, "(?:MoveSpeed|Movespeed|SprintSpeed)$") && postfix == "m") postfix = "m/s";
        if (postfix != "") { var match = Regex.Match(value, @"^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(?:m(?:/s)?|s|%|HP/s)?$"); if (match.Success) value = match.Groups[1].Value + (postfix == "%" ? "%" : " " + postfix); else if (!value.EndsWith(postfix)) value += (postfix == "%" ? "%" : " " + postfix); }
        value = prefix + value; if (Regex.IsMatch(value, @"\{[a-z]:", RegexOptions.IgnoreCase)) throw new InvalidDataException($"Unresolved attribute {key}");
        var a = new JsonObject { ["key"] = key, ["label"] = J.Local(PlainText(J.Str(r?["label"], J.Str(p["label"]))), PlainText(J.Str(p["label"]))), ["value"] = value }; var scale = p["scale_function"]; var n = J.ParseFloat(scale?["stat_scale"]);
        if (n != 0 && double.IsFinite(n)) { var coefficient = (n > 0 ? "+" : "") + J.Format(n); if (J.Str(scale?["specific_stat_scale_type"]) == "ETechPower" || J.Str(scale?["class_name"]) == "scale_function_healing_spirit_scale") a["scaling"] = J.Local($"{coefficient} за 1 Spirit", $"{coefficient} per 1 Spirit"); else if (J.Str(scale?["specific_stat_scale_type"]) == "ELevelUpBoons") a["scaling"] = J.Local($"{coefficient} за уровень после первого", $"{coefficient} per level after the first"); }
        return a;
    }
    public static JsonObject Catalog(JsonArray english, JsonArray russian, GameVersion version, string updatedAt, JsonObject advice)
    {
        var rows = J.Rows(english, "English items").Where(i => J.Str(i["type"]) == "upgrade" && J.Bool(i["shopable"], "shopable", false) && !J.Bool(i["disabled"], "disabled", false) && new[] { 1d, 2d, 3d, 4d }.Contains(J.Num(i["item_tier"], "tier", 0)) && new[] { "weapon", "vitality", "spirit" }.Contains(J.Str(i["item_slot_type"]))).ToList();
        var translations = new Dictionary<long, JsonObject>(); foreach (var i in J.Rows(russian, "Russian items")) if (!translations.TryAdd(J.Id(i["id"], "item ID"), i)) throw new InvalidDataException("Duplicate translated item ID");
        var classes = new Dictionary<string, long>(); foreach (var i in rows) if (!classes.TryAdd(J.Str(i["class_name"]), J.Id(i["id"], "item ID"))) throw new InvalidDataException("Duplicate item class");
        var items = new JsonArray(); var ids = new HashSet<long>(); var slugs = new HashSet<string>();
        foreach (var en in rows)
        {
            var id = J.Id(en["id"], "item ID"); if (!ids.Add(id)) throw new InvalidDataException("Duplicate item ID"); var name = J.Str(en["name"]); var slug = Slug(name); if (!slugs.Add(slug) || !Regex.IsMatch(slug, "^[a-z0-9]+(?:-[a-z0-9]+)*$")) throw new InvalidDataException("Invalid item slug");
            if (!translations.TryGetValue(id, out var ru) || J.Str(ru["class_name"]) != J.Str(en["class_name"]) || string.IsNullOrEmpty(J.Str(ru["name"]))) throw new InvalidDataException($"Missing Russian item {id}");
            var ep = J.Obj(en["properties"], "English properties"); var rp = J.Obj(ru["properties"], "Russian properties"); var innate = new JsonArray(); var effects = new JsonArray(); var descEn = new List<string>(); var descRu = new List<string>();
            var sections = en["tooltip_sections"] as JsonArray ?? new JsonArray(); var ruSections = ru["tooltip_sections"] as JsonArray;
            for (var index = 0; index < sections.Count; index++)
            {
                var section = J.Obj(sections[index], "section"); var rs = ruSections is not null && index < ruSections.Count ? ruSections[index] : null; var attributes = new JsonArray(); var pe = new List<string>(); var pr = new List<string>(); var used = new HashSet<string>(); var attr = section["section_attributes"] as JsonArray ?? new JsonArray();
                for (var ai = 0; ai < attr.Count; ai++)
                {
                    var a = J.Obj(attr[ai], "section attribute"); if (J.Str(a["loc_string"]) != "") { pe.Add(Text(a["loc_string"], ep)); var ra = rs?["section_attributes"] as JsonArray; pr.Add(Text(ra is not null && ai < ra.Count ? ra[ai]?["loc_string"] ?? a["loc_string"] : a["loc_string"], rp)); }
                    foreach (var key in new[] { "elevated_properties", "properties", "important_properties" }.SelectMany(k => (a[k] as JsonArray ?? new JsonArray()).Select(v => J.Str(v)))) if (used.Add(key) && Attribute(key, en, ru) is JsonObject at) attributes.Add(at);
                }
                if (J.Str(section["section_type"]) == "innate") { foreach (var a in attributes) innate.Add(a?.DeepClone()); }
                else if (attributes.Count > 0 || pe.Count > 0) { descEn.AddRange(pe); descRu.AddRange(pr); effects.Add(new JsonObject { ["kind"] = J.Str(section["section_type"]) == "active" || J.Str(section["section_type"]) == "" && J.Bool(en["is_active_item"], "active", false) ? "active" : "passive", ["description"] = J.Local(string.Join("\n\n", pr), string.Join("\n\n", pe)), ["attributes"] = attributes }); }
            }
            if (innate.Count == 0) foreach (var (key, p) in ep) if (J.Str(p?["tooltip_section"]) == "innate" && Attribute(key, en, ru) is JsonObject a) innate.Add(a);
            var displayed = innate.Concat(effects.SelectMany(e => J.Arr(e?["attributes"], "effect attributes"))).Select(a => J.Str(a?["key"])).ToHashSet();
            var active = J.Bool(en["is_active_item"], "active", false); var fallback = new List<string> { "AbilityCooldown" }; if (active) fallback.AddRange(["AbilityDuration", "AbilityCastRange", "AbilityChannelTime", "AbilityCastDelay"]); if (name == "Cultist Sacrifice") fallback.AddRange(["BonusSoulsPct", "BonusAbilityCharges", "TechRadiusMultiplier"]);
            foreach (var key in fallback) if (!displayed.Contains(key) && J.ParseFloat(ep[key]?["value"]) > 0 && Attribute(key, en, ru) is JsonObject a) { var kind = active ? "active" : "passive"; var effect = effects.OfType<JsonObject>().FirstOrDefault(e => J.Str(e["kind"]) == kind); if (effect is null) { effect = new JsonObject { ["kind"] = kind, ["description"] = J.Local("", ""), ["attributes"] = new JsonArray() }; effects.Add(effect); } J.Arr(effect["attributes"], "attributes").Add(a); displayed.Add(key); }
            IEnumerable<string> Fallback(JsonObject i, JsonObject p) => (i["description"] as JsonObject ?? new JsonObject()).Select(pair => Text(pair.Value, p)).Where(s => s != "");
            var tier = (int)J.Id(en["item_tier"], "tier"); var cost = J.Id(en["cost"], "cost"); if (cost != new[] { 0, 800, 1600, 3200, 6400 }[tier]) throw new InvalidDataException($"Unknown tier/cost {name}");
            items.Add(new JsonObject { ["id"] = id, ["slug"] = slug, ["name"] = PlainText(name), ["localizedName"] = J.Local(PlainText(J.Str(ru["name"])), PlainText(name)), ["category"] = J.Str(en["item_slot_type"]), ["tier"] = tier, ["cost"] = cost, ["icon"] = $"assets/items/{slug}.webp", ["activation"] = active ? "active" : "passive", ["description"] = J.Local(string.Join("\n\n", (descRu.Count > 0 ? descRu : Fallback(ru, rp)).Distinct()), string.Join("\n\n", (descEn.Count > 0 ? descEn : Fallback(en, ep)).Distinct())), ["attributes"] = innate, ["effects"] = effects, ["tags"] = ItemTraits.Tags(en), ["components"] = J.List((en["component_items"] as JsonArray ?? new JsonArray()).Select(c => (JsonNode?)JsonValue.Create(classes.TryGetValue(J.Str(c), out var component) ? component : throw new InvalidDataException($"Missing component {c}")))), ["upgrades"] = new JsonArray(), ["advice"] = advice[name]?.DeepClone() ?? new JsonArray() });
        }
        if (items.Count is < 1 or > 300) throw new InvalidDataException("Invalid catalog size");
        foreach (var item in items.OfType<JsonObject>()) foreach (var id in J.Arr(item["components"], "components")) { var component = items.OfType<JsonObject>().Single(i => J.Id(i["id"], "ID") == J.Id(id, "component")); if (ReferenceEquals(component, item)) throw new InvalidDataException("Self item component"); J.Arr(component["upgrades"], "upgrades").Add(item["id"]!.DeepClone()); }
        return new JsonObject { ["meta"] = new JsonObject { ["schemaVersion"] = 1, ["clientVersion"] = version.Version, ["sourceRevision"] = version.Revision, ["updatedAt"] = updatedAt, ["itemCount"] = items.Count }, ["items"] = items };
    }
    public static JsonObject Statistics(JsonArray overall, JsonArray byHero, JsonObject catalog, int version, string updatedAt, string from, string to)
    {
        if (DateTimeOffset.Parse(from) >= DateTimeOffset.Parse(to) || DateTimeOffset.Parse(to) > DateTimeOffset.Parse(updatedAt)) throw new InvalidDataException("Invalid statistics period");
        var known = J.Rows(catalog["items"], "catalog").Select(i => J.Id(i["id"], "ID")).ToHashSet(); var grouped = new Dictionary<long, List<JsonObject>>();
        JsonObject Purchase(JsonObject row) { var matches = J.Num(row["matches"], "matches"); var wins = J.Num(row["wins"], "wins"); var losses = J.Num(row["losses"], "losses"); double? average = matches == 0 ? null : J.Num(row["avg_buy_time_s"], "buy time"); if (new[] { matches, wins, losses }.Any(n => n < 0 || n != Math.Truncate(n) || n > 9007199254740991) || wins + losses != matches || average is < 0 or > 7000) throw new InvalidDataException("Invalid purchase observation"); return new JsonObject { ["matches"] = matches, ["wins"] = wins, ["losses"] = losses, ["averageBuyTimeSeconds"] = average }; }
        foreach (var row in J.Rows(byHero, "hero statistics")) { var id = J.Id(row["item_id"], "item ID"); if (!known.Contains(id)) continue; var hero = J.Id(row["bucket"], "hero bucket"); var observation = Purchase(row); observation["heroId"] = hero; if (!grouped.TryGetValue(id, out var list)) grouped[id] = list = []; if (list.Any(o => J.Id(o["heroId"], "hero") == hero)) throw new InvalidDataException("Duplicate hero observation"); list.Add(observation); }
        var items = new JsonArray(); var seen = new HashSet<long>(); foreach (var row in J.Rows(overall, "overall statistics")) { var id = J.Id(row["item_id"], "item ID"); if (!known.Contains(id)) continue; if (!seen.Add(id)) throw new InvalidDataException("Duplicate item observation"); var p = Purchase(row); p["itemId"] = id; p["heroes"] = J.List(grouped.GetValueOrDefault(id, []).OrderByDescending(h => J.Num(h["matches"], "matches")).ThenBy(h => J.Id(h["heroId"], "hero"))); items.Add(p); }
        return new JsonObject { ["meta"] = new JsonObject { ["schemaVersion"] = 1, ["clientVersion"] = version, ["updatedAt"] = updatedAt, ["from"] = from, ["to"] = to, ["gameMode"] = "normal", ["matchModes"] = new JsonArray("ranked", "unranked"), ["minAverageBadge"] = null, ["corruptedItems"] = "exclude", ["source"] = "deadlock-api" }, ["items"] = items };
    }
}
