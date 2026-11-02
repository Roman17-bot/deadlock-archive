using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Deadlock.Api.Ingestion;

/// <summary>Public shape checks retained from the original TypeScript validators, independent of persistence.</summary>
public static class ArchiveValidation
{
    static void Need(bool condition, string message) { if (!condition) throw new InvalidDataException(message); }
    static bool Text(JsonNode? n, int max = 20000, bool nonempty = false) => n is JsonValue v && v.TryGetValue<string>(out var s) && s.Length <= max && (!nonempty || !string.IsNullOrWhiteSpace(s));
    static bool Integer(JsonNode? n, double min = 0, double max = 9007199254740991) => Finite(n) && J.Num(n, "integer") >= min && J.Num(n, "integer") <= max && J.Num(n, "integer") == Math.Truncate(J.Num(n, "integer"));
    static bool Finite(JsonNode? n) => n is JsonValue v && v.GetValueKind() == JsonValueKind.Number && double.TryParse(v.ToJsonString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var number) && double.IsFinite(number);
    static bool Bool(JsonNode? n) => n?.GetValueKind() is JsonValueKind.True or JsonValueKind.False;
    static bool Pattern(JsonNode? n, string regex) => Text(n) && Regex.IsMatch(J.Str(n), regex);
    static bool Strings(JsonNode? n, bool nonempty = true) => n is JsonArray a && a.All(v => Text(v, 20000, nonempty));
    static bool Local(JsonNode? n, bool nonempty = false) => n is JsonObject o && Text(o["ru"], 20000, nonempty) && Text(o["en"], 20000, nonempty);
    static bool Date(JsonNode? n) => Pattern(n, @"^\d{4}-\d{2}-\d{2}$") && DateOnly.TryParseExact(J.Str(n), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
    static bool Timestamp(JsonNode? n) => Pattern(n, @"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$") && DateTimeOffset.TryParse(J.Str(n), CultureInfo.InvariantCulture, DateTimeStyles.None, out _) && Date(JsonValue.Create(J.Str(n)[..10]));
    static bool AssetDate(JsonNode? n) => Pattern(n, @"^\d{4}-\d{2}-\d{2}T") && DateTimeOffset.TryParse(J.Str(n), CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
    static bool Commit(JsonNode? n) => Pattern(n, "^[a-f0-9]{40}$");
    static bool Https(JsonNode? n) => Text(n, 20000, true) && Uri.TryCreate(J.Str(n), UriKind.Absolute, out var uri) && uri.Scheme == "https";
    static bool Ids(JsonNode? n) => n is JsonArray a && a.All(v => Integer(v, 1)) && a.Select(v => J.Num(v, "ID")).Distinct().Count() == a.Count;
    public static void ValidatePublicShapes(JsonObject bundle)
    {
        Heroes(J.Obj(bundle["heroes"], "heroes snapshot")); History(J.Obj(bundle["history"], "history"));
        Need((bundle["items"] is null) == (bundle["itemStatistics"] is null), "Items and statistics must be paired");
        if (bundle["items"] is JsonObject catalog) { Catalog(catalog); Statistics(J.Obj(bundle["itemStatistics"], "item statistics"), catalog); Need(J.Num(catalog["meta"]?["clientVersion"], "item client") == J.Num(bundle["heroes"]?["meta"]?["clientVersion"], "hero client"), "Item/hero version mismatch"); }
    }
    public static void Heroes(JsonObject snapshot)
    {
        var meta = J.Obj(snapshot["meta"], "hero metadata"); var heroes = J.Arr(snapshot["heroes"], "heroes");
        Need(J.Num(meta["schemaVersion"], "hero schema") == 1 && Integer(meta["clientVersion"], 1) && Integer(meta["sourceRevision"], 1) && Date(meta["snapshotDate"]) && Timestamp(meta["checkedAt"]) && Date(meta["buildDate"]) && Commit(meta["gameCommit"]) && Strings(meta["methodology"]) && meta["sources"] is JsonArray sources && sources.All(s => s is JsonObject && Text(s["label"], 20000, true) && Https(s["url"])) && meta["levelRange"] is JsonArray range && range.Count == 2 && J.Num(range[0], "level min") == 1 && J.Num(range[1], "level max") == 36 && J.Num(meta["heroCount"], "hero count") == heroes.Count && heroes.Count > 0, "Invalid hero metadata");
        var ids = new HashSet<double>(); var slugs = new HashSet<string>();
        foreach (var hero in J.Rows(heroes, "hero"))
        {
            Need(Integer(hero["id"], 1) && ids.Add(J.Num(hero["id"], "ID")) && Pattern(hero["slug"], "^[a-z0-9]+(?:-[a-z0-9]+)*$") && slugs.Add(J.Str(hero["slug"])) && Text(hero["name"], 20000, true) && Text(hero["aliases"]) && Strings(hero["tags"]) && Bool(hero["isNew"]) && Pattern(hero["portrait"], "^assets/heroes/[a-z0-9-]+\\.webp$") && hero["source"] is JsonObject s && Https(s["heroUrl"]) && Https(s["weaponUrl"]) && Integer(s["heroLine"], 1) && Integer(s["weaponLine"], 1), "Invalid hero identity/source");
            var b = J.Obj(hero["base"], "hero base"); var g = J.Obj(hero["growth"], "hero growth"); var scale = J.Obj(hero["scaling"], "hero scaling"); var w = J.Obj(hero["weapon"], "hero weapon");
            foreach (var key in new[] { "health", "spirit", "regen", "bulletDamage", "moveSpeed", "stamina" }) Need(Finite(b[key]), "Missing hero base " + key);
            foreach (var key in new[] { "health", "spirit", "regen", "bulletDamage" }) Need(Finite(g[key]), "Missing hero growth " + key);
            foreach (var key in new[] { "bulletDamagePerSpirit", "regenPerSpirit", "fireRatePercentPerSpirit" }) Need(Finite(scale[key]), "Missing hero scaling " + key);
            foreach (var map in new[] { b, g, scale }) Need(map.All(v => Finite(v.Value)), "Invalid extra hero number");
            Need(Text(w["className"], 20000, true) && Strings(w["notes"]) && Integer(w["projectiles"], 1) && Integer(w["burst"], 1) && Bool(w["spinsUp"]) && Bool(w["hitOnce"]), "Invalid weapon properties");
            foreach (var key in new[] { "shotsPerSecond", "cycleTime", "intraBurstTime", "clipSize", "reloadSeconds" }) Need(Finite(w[key]), "Missing weapon number " + key);
            Need(J.Num(w["shotsPerSecond"], "SPS") > 0 && J.Num(w["cycleTime"], "cycle") > 0 && J.Num(w["intraBurstTime"], "intra") >= 0 && w.ContainsKey("fullSpinCycle") && (w["fullSpinCycle"] is null || Finite(w["fullSpinCycle"]) && J.Num(w["fullSpinCycle"], "spin") > 0) && J.Num(b["health"], "health") > 0, "Invalid hero weapon timing/health");
            var spirit = J.Num(b["spirit"], "spirit") + 35 * J.Num(g["spirit"], "spirit growth"); var bullet = J.Num(b["bulletDamage"], "damage") + 35 * J.Num(g["bulletDamage"], "damage growth") + spirit * J.Num(scale["bulletDamagePerSpirit"], "damage scale"); var paths = J.Bool(w["hitOnce"], "hitOnce") ? 1 : J.Num(w["projectiles"], "projectiles");
            Need(new[] { spirit, bullet, bullet * paths, bullet * paths * J.Num(w["shotsPerSecond"], "SPS") * (1 + spirit * J.Num(scale["fireRatePercentPerSpirit"], "fire scale") / 100), J.Num(b["health"], "health") + 35 * J.Num(g["health"], "health growth"), J.Num(b["regen"], "regen") + 35 * J.Num(g["regen"], "regen growth") + spirit * J.Num(scale["regenPerSpirit"], "regen scale") }.All(double.IsFinite), "Non-finite level 36 hero calculation");
        }
    }
    static bool Attributes(JsonNode? node) => node is JsonArray a && a.Count <= 80 && a.All(n => n is JsonObject o && Text(o["key"]) && Local(o["label"], true) && Text(o["value"], 20000, true) && (o["scaling"] is null || Local(o["scaling"])));
    public static void Catalog(JsonObject catalog)
    {
        var meta = J.Obj(catalog["meta"], "item metadata"); var items = J.Arr(catalog["items"], "items");
        Need(J.Num(meta["schemaVersion"], "item schema") == 1 && Integer(meta["clientVersion"], 1) && Integer(meta["sourceRevision"], 1) && AssetDate(meta["updatedAt"]) && J.Num(meta["itemCount"], "item count") == items.Count && items.Count is >= 1 and <= 300, "Invalid item metadata");
        var ids = new HashSet<double>(); var slugs = new HashSet<string>();
        foreach (var i in J.Rows(items, "item"))
        {
            Need(Integer(i["id"], 1) && ids.Add(J.Num(i["id"], "item ID")) && Pattern(i["slug"], "^[a-z0-9]+(?:-[a-z0-9]+)*$") && slugs.Add(J.Str(i["slug"])) && Text(i["name"], 20000, true) && Local(i["localizedName"], true) && new[] { "weapon", "vitality", "spirit" }.Contains(J.Str(i["category"])) && Integer(i["tier"], 1, 4) && Integer(i["cost"], 1) && J.Num(i["cost"], "cost") == new[] { 0, 800, 1600, 3200, 6400 }[(int)J.Num(i["tier"], "tier")] && Pattern(i["icon"], "^assets/items/[a-z0-9]+(?:-[a-z0-9]+)*\\.webp$") && new[] { "active", "passive" }.Contains(J.Str(i["activation"])) && Local(i["description"]) && Attributes(i["attributes"]) && i["effects"] is JsonArray effects && effects.Count <= 12 && effects.All(e => e is JsonObject && new[] { "active", "passive" }.Contains(J.Str(e["kind"])) && Local(e["description"]) && Attributes(e["attributes"])) && i["tags"] is JsonArray tags && tags.Count <= 80 && tags.All(t => Pattern(t, "^[a-z][a-z0-9-]{0,39}$")) && tags.Select(t => J.Str(t)).Distinct().Count() == tags.Count && Ids(i["components"]) && Ids(i["upgrades"]) && i["advice"] is JsonArray advice && advice.Count <= 12 && advice.All(a => Local(a)), "Invalid item " + J.Str(i["name"]));
        }
        foreach (var i in J.Rows(items, "items")) Need(new[] { "components", "upgrades" }.SelectMany(k => J.Arr(i[k], k)).All(id => ids.Contains(J.Num(id, "reference")) && J.Num(id, "reference") != J.Num(i["id"], "ID")), "Invalid item relationship");
    }
    static bool Purchase(JsonObject p) => Integer(p["matches"]) && Integer(p["wins"]) && Integer(p["losses"]) && J.Num(p["wins"], "wins") + J.Num(p["losses"], "losses") == J.Num(p["matches"], "matches") && p.ContainsKey("averageBuyTimeSeconds") && (p["averageBuyTimeSeconds"] is null || Finite(p["averageBuyTimeSeconds"]) && J.Num(p["averageBuyTimeSeconds"], "buy time") is >= 0 and <= 7000);
    public static void Statistics(JsonObject statistics, JsonObject catalog)
    {
        var m = J.Obj(statistics["meta"], "statistics metadata"); var items = J.Arr(statistics["items"], "statistics items");
        Need(J.Num(m["schemaVersion"], "statistics schema") == 1 && Integer(m["clientVersion"], 1) && J.Num(m["clientVersion"], "statistics client") == J.Num(catalog["meta"]?["clientVersion"], "catalog client") && AssetDate(m["updatedAt"]) && AssetDate(m["from"]) && AssetDate(m["to"]) && DateTimeOffset.Parse(J.Str(m["from"])) < DateTimeOffset.Parse(J.Str(m["to"])) && DateTimeOffset.Parse(J.Str(m["to"])) <= DateTimeOffset.Parse(J.Str(m["updatedAt"])) && J.Str(m["gameMode"]) == "normal" && m["matchModes"] is JsonArray modes && modes.Count == 2 && J.Str(modes[0]) == "ranked" && J.Str(modes[1]) == "unranked" && J.Str(m["corruptedItems"]) == "exclude" && J.Str(m["source"]) == "deadlock-api" && (m["minAverageBadge"] is null || Integer(m["minAverageBadge"], 0, 116)) && items.Count <= 300, "Invalid item statistics metadata/cohort");
        var known = J.Rows(catalog["items"], "catalog").Select(i => J.Num(i["id"], "ID")).ToHashSet(); var seen = new HashSet<double>();
        foreach (var i in J.Rows(items, "statistics item")) Need(Integer(i["itemId"], 1) && seen.Add(J.Num(i["itemId"], "item ID")) && known.Contains(J.Num(i["itemId"], "item ID")) && Purchase(i) && i["heroes"] is JsonArray heroes && heroes.Count <= 100 && heroes.All(h => h is JsonObject o && Integer(o["heroId"], 1) && Purchase(o)) && heroes.Select(h => J.Num(h?["heroId"], "hero ID")).Distinct().Count() == heroes.Count, "Invalid item purchase observation");
    }
    public static void History(JsonObject history)
    {
        Need(J.Num(history["schemaVersion"], "history schema") == 1, "Invalid history schema"); var seen = new HashSet<double>();
        foreach (var v in J.Rows(history["versions"], "versions"))
        {
            Need(Integer(v["clientVersion"], 1) && seen.Add(J.Num(v["clientVersion"], "version")) && Date(v["buildDate"]) && Timestamp(v["firstPublishedAt"]) && v["provenance"] is JsonObject p && (J.Str(p["kind"]) == "repository-commit" ? Commit(p["reference"]) : J.Str(p["kind"]) == "snapshot-save" && Timestamp(p["reference"])), "Invalid history entry provenance/date");
            if (v["patch"] is JsonObject patch) { Need(Commit(patch["gameCommit"]) && Timestamp(patch["checkedAt"]) && new[] { "unknown", "published", "unpublished" }.Contains(J.Str(patch["notes"])) && (patch["title"] is null || Text(patch["title"], 240, true)) && (patch["summary"] is null || patch["summary"] is JsonObject summary && Text(summary["ru"], 600, true) && Text(summary["en"], 600, true)), "Invalid version patch metadata"); Need(J.Str(patch["source"]) == "steamdb" ? Integer(patch["steamBuildId"], 1) && J.Str(patch["url"]) == $"https://steamdb.info/patchnotes/{J.Scalar(patch["steamBuildId"])}/" : J.Str(patch["source"]) == "game-tracking" && J.Str(patch["notes"]) == "unknown" && patch["steamBuildId"] is null && J.Str(patch["url"]) == $"https://github.com/SteamTracking/GameTracking-Deadlock/commit/{J.Str(patch["gameCommit"])}", "Invalid version patch URL/build binding"); }
            else Need(v["patch"] is null, "Invalid version patch shape");
        }
        if (history["patches"] is not null) { var ids = new HashSet<string>(); foreach (var p in J.Rows(history["patches"], "official patches")) { var id = J.Str(p["id"]); Need(Pattern(p["id"], @"^\d{1,24}$") && ids.Add(id) && J.Str(p["source"]) == "steam" && J.Str(p["url"]) == $"https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/{id}" && Timestamp(p["publishedAt"]) && (p["clientVersion"] is null || Integer(p["clientVersion"], 1)), "Invalid official patch provenance"); foreach (var key in new[] { "title", "body" }) { var local = J.Obj(p[key], "official patch " + key); var max = key == "title" ? 240 : 200000; Need(Text(local["en"], max, true) && (local["ru"] is null || Text(local["ru"], max, true)), "Invalid official patch text"); } } }
    }
}
