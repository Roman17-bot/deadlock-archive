using System.Globalization;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Deadlock.Api.Data;

/// <summary>Optional public catalogues; historical archives remain readable without them.</summary>
public static class ReferenceCatalogues
{
    public static readonly Dictionary<string, string[]> Collections = new()
    {
        ["heroProfiles"] = ["heroes"], ["heroStatistics"] = ["scopes", "matchups.rows", "synergies.rows"],
        ["worldMap"] = ["objects", "routeExamples"]
    };
    static void Need(bool valid, string message) { if (!valid) throw new InvalidDataException(message); }
    static bool Text(JsonNode? value, int max = 20000) => value is JsonValue v && v.TryGetValue<string>(out var s) && !string.IsNullOrWhiteSpace(s) && s.Length <= max && !s.Any(c => char.IsControl(c) && c is not ('\n' or '\r' or '\t'));
    static bool Local(JsonNode? value) => value is JsonObject && Text(value["ru"]) && Text(value["en"]);
    static bool Integer(JsonNode? value, long min = 0, long max = 9007199254740991) => value != null && long.TryParse(value.ToJsonString(), out var n) && n >= min && n <= max;
    static bool Real(JsonNode? value, double min, double max) => value != null && double.TryParse(value.ToJsonString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var n) && double.IsFinite(n) && n >= min && n <= max;
    static bool Time(JsonNode? value) => Text(value, 64) && DateTimeOffset.TryParse(ArchiveJson.Text(value), CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
    static bool Day(JsonNode? value) => Text(value, 10) && DateOnly.TryParseExact(ArchiveJson.Text(value), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
    static bool Asset(JsonNode? value) => Text(value, 2048) && (Ingestion.ReferenceMedia.Local(ArchiveJson.Text(value)) || Uri.TryCreate(ArchiveJson.Text(value), UriKind.Absolute, out var uri) && uri.Scheme == "https" && uri.Host == "assets-bucket.deadlock-api.com" && uri.IsDefaultPort && uri.UserInfo == "" && uri.Fragment == "");
    static long N(JsonNode? value) => ArchiveJson.Number(value);
    static string S(JsonNode? value) => ArchiveJson.Text(value);
    public static void Validate(JsonObject bundle)
    {
        foreach (var key in Collections.Keys)
            if (bundle.ContainsKey(key)) { Need(bundle[key] is JsonObject, "Invalid reference catalogue " + key); Need(ArchiveJson.Bytes(bundle[key]).Length <= Sync.PublicSnapshot.MaxFileBytes, "Reference catalogue too large"); }
        if (bundle["heroProfiles"] is JsonObject profiles) Profiles(profiles, bundle["heroes"]!.AsObject());
        if (bundle["heroStatistics"] is JsonObject stats) { Statistics(stats); Need(N(stats["clientVersion"]) <= N(bundle["heroes"]?["meta"]?["clientVersion"]), "Statistics context is newer than the archive"); }
        if (bundle["worldMap"] is JsonObject map) { WorldMap(map); Need(N(map["meta"]?["clientVersion"]) <= N(bundle["heroes"]?["meta"]?["clientVersion"]), "Map is newer than the archive"); }
    }
    public static void Profiles(JsonObject profiles, JsonObject heroes)
    {
        Need(N(profiles["schemaVersion"]) == 1 && Integer(profiles["clientVersion"], 1) && N(profiles["clientVersion"]) <= N(heroes["meta"]?["clientVersion"]) && Time(profiles["updatedAt"]), "Invalid profile metadata");
        var roster = heroes["heroes"]!.AsArray().ToDictionary(h => N(h!["id"]), h => S(h!["slug"]));
        Need(profiles["heroes"] is JsonArray { Count: > 0 and <= 100 }, "Invalid profile roster"); var seen = new HashSet<long>();
        foreach (var row in profiles["heroes"]!.AsArray())
        {
            Need(row is JsonObject && Integer(row["heroId"], 1) && seen.Add(N(row["heroId"])) && Text(row["slug"], 80) && Regex.IsMatch(S(row["slug"]), "^[a-z0-9]+(?:-[a-z0-9]+)*$") && Local(row["summary"]) && Local(row["lore"]), "Invalid profile content");
            if (N(profiles["clientVersion"]) == N(heroes["meta"]?["clientVersion"])) Need(roster.TryGetValue(N(row!["heroId"]), out var slug) && slug == S(row["slug"]), "Profile/hero identity mismatch");
            Need(row!["art"] is JsonObject art && art.All(a => a.Key is "background" or "card" && Asset(a.Value)), "Untrusted profile art");
            Need(row["tips"] is JsonArray { Count: <= 20 } tips && tips.All(Local) && row["relationships"] is JsonArray { Count: <= 100 } && row["videos"] is JsonArray { Count: <= 20 } videos && videos.All(v => v is JsonObject && (v["abilityId"]?.ToJsonString() == "\"weapon\"" || Integer(v["abilityId"], 1)) && (v["clientVersion"] == null || Integer(v["clientVersion"], 1)) && Local(v["title"]) && Asset(v["url"]) && Asset(v["poster"]) && Text(v["sourceUrl"], 2048) && Uri.TryCreate(S(v["sourceUrl"]), UriKind.Absolute, out var u) && u.Scheme == "https" && Time(v["checkedAt"]) && Real(v["startSeconds"], 0, 86400) && Real(v["endSeconds"], 0, 86400) && ArchiveJson.Real(v["endSeconds"]) > ArchiveJson.Real(v["startSeconds"])), "Invalid profile advice/media");
            if (row.AsObject().ContainsKey("reviewedClientVersion")) Need(row["reviewedClientVersion"] == null || Integer(row["reviewedClientVersion"], 1, N(profiles["clientVersion"])), "Invalid editorial review version");
            foreach (var relation in row["relationships"]!.AsArray()) Need(relation is JsonObject && Integer(relation["heroId"], 1) && roster.ContainsKey(N(relation["heroId"])) && Local(relation["description"]), "Invalid profile relationship");
        }
        if (N(profiles["clientVersion"]) == N(heroes["meta"]?["clientVersion"])) Need(seen.SetEquals(roster.Keys), "Incomplete profile roster");
    }
    public static void Statistics(JsonObject stats)
    {
        Need(N(stats["schemaVersion"]) == 1 && Integer(stats["clientVersion"], 1) && stats.ContainsKey("sourceClientVersion") && stats["sourceClientVersion"] == null && S(stats["source"]) == "deadlock-api" && S(stats["metric"]) == "selection-share" && N(stats["timeResolutionSeconds"]) == 3600 && Time(stats["updatedAt"]) && Time(stats["from"]) && Time(stats["to"]), "Invalid hero statistics metadata");
        Need(stats["periods"] is JsonArray periods && periods.Select(N).SequenceEqual(new long[] { 7, 30 }), "Invalid statistics periods");
        var expected = StatisticsCollector.ScopeDefinitions().ToDictionary(s => S(s["id"]));
        Need(stats["scopes"] is JsonArray scopes && scopes.Count == expected.Count, "Incomplete statistics scopes"); var seenScopes = new HashSet<string>();
        foreach (var scope in stats["scopes"]!.AsArray())
        {
            Need(scope is JsonObject && Text(scope["id"], 80) && seenScopes.Add(S(scope["id"])) && expected.ContainsKey(S(scope["id"])), "Invalid statistics scope");
            var definition = expected[S(scope!["id"])]; foreach (var key in new[] { "mode", "gameMode", "matchModes", "rankMin", "rankMax" }) Need(JsonNode.DeepEquals(scope[key], definition[key]), "Statistics cohort mismatch");
            Window(scope.AsObject()); Need(Time(scope["requestedFrom"]) && Time(scope["requestedTo"]) && scope["days"] is JsonArray { Count: <= 31 }, "Invalid statistics days"); var days = new HashSet<string>();
            foreach (var day in scope["days"]!.AsArray())
            {
                Need(day is JsonObject && Day(day["date"]) && days.Add(S(day["date"])) && Integer(day["totalSelections"]) && day["rows"] is JsonArray { Count: <= 100 }, "Invalid statistics day");
                var seen = new HashSet<long>(); long total = 0;
                foreach (var row in day!["rows"]!.AsArray()) { Need(row is JsonObject && Integer(row["heroId"], 1) && seen.Add(N(row["heroId"])) && Integer(row["wins"]) && Integer(row["losses"]) && Integer(row["matches"]) && N(row["wins"]) + N(row["losses"]) == N(row["matches"]), "Invalid hero statistics row"); total = checked(total + N(row!["matches"])); }
                Need(total == N(day["totalSelections"]), "Selection denominator mismatch");
                var date = DateOnly.ParseExact(S(day["date"]), "yyyy-MM-dd", CultureInfo.InvariantCulture); Need(date >= DateOnly.FromDateTime(DateTimeOffset.Parse(S(scope["from"]), CultureInfo.InvariantCulture).UtcDateTime) && date <= DateOnly.FromDateTime(DateTimeOffset.Parse(S(scope["to"]), CultureInfo.InvariantCulture).UtcDateTime), "Statistics day outside cohort");
            }
        }
        foreach (var key in new[] { "matchups", "synergies" })
        {
            Need(stats[key] is JsonObject, "Missing pair observations"); var pairs = stats[key]!.AsObject(); Window(pairs); Need(pairs["sameLane"]?.ToJsonString() == "false" && Integer(pairs["minMatches"], 1) && pairs["rows"] is JsonArray { Count: <= 10000 }, "Invalid pair cohort"); var seen = new HashSet<string>();
            foreach (var row in pairs["rows"]!.AsArray()) { var a = key == "matchups" ? "heroId" : "heroId1"; var b = key == "matchups" ? "enemyHeroId" : "heroId2"; Need(row is JsonObject && Integer(row[a], 1) && Integer(row[b], 1) && N(row[a]) != N(row[b]) && (key == "matchups" || N(row[a]) < N(row[b])) && seen.Add(N(row[a]) + ":" + N(row[b])) && Integer(row["wins"]) && Integer(row["matches"]) && N(row["wins"]) <= N(row["matches"]), "Invalid pair observation"); }
        }
    }
    static void Window(JsonObject value) { Need(Time(value["from"]) && Time(value["to"]) && Time(value["updatedAt"]) && DateTimeOffset.Parse(S(value["from"]), CultureInfo.InvariantCulture) < DateTimeOffset.Parse(S(value["to"]), CultureInfo.InvariantCulture) && DateTimeOffset.Parse(S(value["to"]), CultureInfo.InvariantCulture) <= DateTimeOffset.Parse(S(value["updatedAt"]), CultureInfo.InvariantCulture), "Invalid statistics window"); }
    public static void WorldMap(JsonObject map)
    {
        var meta = map["meta"]; Need(meta is JsonObject && N(meta["schemaVersion"]) == 1 && Integer(meta["clientVersion"], 1) && Integer(meta["sourceRevision"], 1) && Time(meta["checkedAt"]) && Text(meta["sourceCommit"], 40) && Regex.IsMatch(S(meta["sourceCommit"]), "^[a-f0-9]{40}$"), "Invalid map metadata");
        Need(Real(map["radius"], 1, 1000000) && map["images"] is JsonObject images && images.Count is > 0 and <= 20 && Asset(images["mid"]) && images.All(i => Asset(i.Value)) && map["objects"] is JsonArray { Count: > 0 and <= 5000 } && map["rules"] is JsonObject && map["ziplinePaths"] is JsonArray { Count: <= 20 }, "Invalid map catalogue");
        var rules = map["rules"]!.AsObject();
        Need(rules["campRules"] is JsonObject { Count: > 0 and <= 20 }, "Missing camp rules");
        void Unit(JsonNode? value) => Need(value is JsonObject && Real(value["max_health"], double.Epsilon, 1e12) && Real(value["gold_reward"], 0, 1e12) && Real(value["gold_reward_bonus_percent_per_minute"], 0, 1e12), "Invalid camp unit reward");
        foreach (var rule in rules["campRules"]!.AsObject()) { Need(rule.Value is JsonObject && Real(rule.Value["firstSpawnSeconds"], 0, 86400) && Real(rule.Value["respawnSeconds"], 0, 86400), "Invalid camp rules"); Unit(rule.Value!["perUnit"]); }
        foreach (var category in new[] { "crates", "toughCrates" }) Need(rules[category] is JsonObject && Real(rules[category]!["dropProbability"], 0, 1) && Real(rules[category]!["soulsBase"], 0, 1e12) && Real(rules[category]!["soulsPerMinute"], 0, 1e12), "Invalid breakable rules");
        Need(rules["goldenStatues"] is JsonObject && Real(rules["goldenStatues"]!["dropProbability"], 0, 1), "Invalid statue rules");
        var ids = new HashSet<string>();
        foreach (var point in map["objects"]!.AsArray())
        {
            Need(point is JsonObject && Text(point["id"], 160) && ids.Add(S(point["id"])) && Text(point["category"], 80) && (point["world"] is JsonArray world && world.Count == 3 && world.All(v => Real(v, -1000000, 1000000)) || S(point["category"]) == "objectives" && point["world"] == null) && Real(point["x"], 0, 1) && Real(point["y"], 0, 1) && point["layer"] == null, "Invalid map point");
            foreach (var key in new[] { "firstSpawnSeconds", "respawnSeconds" }) Need(point!.AsObject().ContainsKey(key) && (point[key] == null || Real(point[key], 0, 86400)), "Invalid map timer");
            if (point!["perUnit"] != null) Unit(point["perUnit"]);
            if (point["target"] != null) Need(point["target"] is JsonArray target && target.Count == 3 && target.All(v => Real(v, -1000000, 1000000)), "Invalid target coordinates");
            Need(point!["unitCount"] == null, "Unverified camp unit count");
        }
        if (map["routeExamples"] is JsonArray routes) foreach (var route in routes) Need(route is JsonObject && Text(route["id"], 80) && route["stopIds"] is JsonArray stops && stops.All(p => ids.Contains(S(p))) && route["legs"] is JsonArray legs && legs.All(l => l?["traversalVerified"]?.ToJsonString() == "false"), "Invalid map route model");
        else Need(!map.ContainsKey("routeExamples"), "Invalid map routes");
    }
}
