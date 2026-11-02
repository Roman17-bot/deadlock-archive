using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Globalization;

namespace Deadlock.Api.Data;

public static class ArchiveJson
{
    public static readonly JsonSerializerOptions Options = new() { WriteIndented = true, Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
    public static string Hash(byte[] bytes) => Convert.ToHexStringLower(SHA256.HashData(bytes));
    public static string Canonical(JsonNode? node)
    {
        string Quote(string text) { var b = new StringBuilder("\""); foreach (var c in text) b.Append(c switch { '"' => "\\\"", '\\' => "\\\\", '\b' => "\\b", '\f' => "\\f", '\n' => "\\n", '\r' => "\\r", '\t' => "\\t", < ' ' => "\\u" + ((int)c).ToString("x4"), _ => c.ToString() }); return b.Append('"').ToString(); }
        string Numeric(JsonValue n)
        {
            var value = double.Parse(n.ToJsonString(), CultureInfo.InvariantCulture); if (!double.IsFinite(value)) throw new InvalidDataException("Non-finite JSON number"); if (value == 0) return "0";
            var raw = value.ToString("R", CultureInfo.InvariantCulture).ToLowerInvariant(); var index = raw.IndexOf('e'); if (index < 0) return raw;
            var exponent = int.Parse(raw[(index + 1)..], CultureInfo.InvariantCulture); var mantissa = raw[..index];
            if (exponent is >= -6 and < 21) { var sign = mantissa.StartsWith('-') ? "-" : ""; var digits = mantissa.TrimStart('-').Replace(".", ""); var point = exponent + 1; return sign + (point <= 0 ? "0." + new string('0', -point) + digits : point >= digits.Length ? digits + new string('0', point - digits.Length) : digits[..point] + "." + digits[point..]); }
            return mantissa + "e" + (exponent >= 0 ? "+" : "") + exponent.ToString(CultureInfo.InvariantCulture);
        }
        string Serialize(JsonNode? n, int depth)
        {
            var indent = new string(' ', depth * 2); var child = indent + "  ";
            if (n is JsonObject o) return o.Count == 0 ? "{}" : "{\n" + string.Join(",\n", o.OrderBy(x => x.Key, StringComparer.Ordinal).Select(x => child + Quote(x.Key) + ": " + Serialize(x.Value, depth + 1))) + "\n" + indent + "}";
            if (n is JsonArray a) return a.Count == 0 ? "[]" : "[\n" + string.Join(",\n", a.Select(x => child + Serialize(x, depth + 1))) + "\n" + indent + "]";
            if (n == null) return "null"; var v = n.AsValue(); return v.GetValueKind() switch { JsonValueKind.String => Quote(v.GetValue<string>()), JsonValueKind.Number => Numeric(v), _ => v.ToJsonString() };
        }
        return Serialize(node, 0) + "\n";
    }
    public static byte[] Bytes(JsonNode? node) => Encoding.UTF8.GetBytes(Canonical(node));
    public static long Number(JsonNode? n) => n != null && long.TryParse(n.ToJsonString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value) ? value : throw new InvalidDataException("Required integer missing");
    public static string Text(JsonNode? n) => n?.GetValue<string>() ?? throw new InvalidDataException("Required text missing");
    private static bool Nonempty(JsonNode? n) => n is JsonValue v && v.GetValueKind() == JsonValueKind.String && v.GetValue<string>().Length > 0;
    private static bool Strings(JsonNode? n) => n is JsonArray a && a.All(Nonempty);
    private static bool Https(JsonNode? n) => Nonempty(n) && Uri.TryCreate(Text(n), UriKind.Absolute, out var u) && u.Scheme == "https";
    private static bool Timestamp(JsonNode? n) => Nonempty(n) && System.Text.RegularExpressions.Regex.IsMatch(Text(n), @"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$") && DateTimeOffset.TryParse(Text(n), CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
    private static bool Finite(JsonNode? n) => n != null && n.GetValueKind() == JsonValueKind.Number && double.TryParse(n.ToJsonString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var v) && double.IsFinite(v);
    public static double Real(JsonNode? n) => n != null ? double.Parse(n.ToJsonString(), CultureInfo.InvariantCulture) : throw new InvalidDataException("Required number missing");
    private static bool Positive(JsonNode? n) => n != null && long.TryParse(n.ToJsonString(), out var v) && v > 0;
    private static bool Commit(JsonNode? n) => Nonempty(n) && System.Text.RegularExpressions.Regex.IsMatch(Text(n), "^[a-f0-9]{40}$");
    private static bool Short(JsonNode? n, int max) => Nonempty(n) && !string.IsNullOrWhiteSpace(Text(n)) && Text(n).Length <= max;
    private static bool Day(JsonNode? n) => Nonempty(n) && DateOnly.TryParseExact(Text(n), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
    private static bool UtcTimestamp(JsonNode? n) => Timestamp(n) && System.Text.RegularExpressions.Regex.IsMatch(Text(n), @"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$") && DateOnly.TryParseExact(Text(n)[..10], "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
    private static void Require(bool valid, string message) { if (!valid) throw new InvalidDataException(message); }
    public static void Validate(JsonObject b)
    {
        Ingestion.ArchiveValidation.ValidatePublicShapes(b);
        var h = b["heroes"]?.AsObject() ?? throw new InvalidDataException("Heroes missing");
        var version = Number(h["meta"]?["clientVersion"]);
        if (version < 1 || h["heroes"] is not JsonArray { Count: > 0 }) throw new InvalidDataException("Invalid heroes");
        var meta = h["meta"]!;
        Require(Number(meta["schemaVersion"]) == 1 && Positive(meta["sourceRevision"]) && Commit(meta["gameCommit"]) && Nonempty(meta["snapshotDate"]) && Timestamp(meta["checkedAt"]) && Nonempty(meta["buildDate"]) && Strings(meta["methodology"]) && meta["sources"] is JsonArray hs && hs.All(s => Nonempty(s?["label"]) && Https(s?["url"])) && meta["levelRange"] is JsonArray lr && lr.Count == 2 && Number(lr[0]) == 1 && Number(lr[1]) == 36 && Number(meta["heroCount"]) == h["heroes"]!.AsArray().Count, "Invalid hero metadata");
        var heroIds = new HashSet<long>(); var slugs = new HashSet<string>();
        foreach (var hero in h["heroes"]!.AsArray())
        {
            Require(Positive(hero?["id"]) && heroIds.Add(Number(hero!["id"])) && Nonempty(hero["slug"]) && slugs.Add(Text(hero["slug"])) && Nonempty(hero["name"]) && hero["aliases"]?.GetValueKind() == JsonValueKind.String && Strings(hero["tags"]) && hero["isNew"]?.GetValueKind() is JsonValueKind.True or JsonValueKind.False && Nonempty(hero["portrait"]) && Https(hero["source"]?["heroUrl"]) && Https(hero["source"]?["weaponUrl"]) && Positive(hero["source"]?["heroLine"]) && Positive(hero["source"]?["weaponLine"]), "Invalid hero");
            foreach (var part in new[] { "base", "growth", "scaling" }) Require(hero![part] is JsonObject numbers && numbers.All(n => Finite(n.Value)), "Invalid hero statistics");
            var w = hero!["weapon"]!; Require(Nonempty(w["className"]) && Strings(w["notes"]) && Positive(w["projectiles"]) && Positive(w["burst"]) && w["spinsUp"]?.GetValueKind() is JsonValueKind.True or JsonValueKind.False && w["hitOnce"]?.GetValueKind() is JsonValueKind.True or JsonValueKind.False, "Invalid weapon");
            foreach (var key in new[] { "cycleTime", "intraBurstTime", "shotsPerSecond", "clipSize", "reloadSeconds" }) Require(Finite(w[key]), "Invalid weapon number");
            Require(Real(w["cycleTime"]) > 0 && Real(w["shotsPerSecond"]) > 0 && Real(w["intraBurstTime"]) >= 0 && (w["fullSpinCycle"] == null || Finite(w["fullSpinCycle"]) && Real(w["fullSpinCycle"]) > 0) && Real(hero["base"]!["health"]) > 0, "Invalid weapon timing or health");
        }
        if (!JsonNode.DeepEquals(b["provenance"]?["meta"], h["meta"])) throw new InvalidDataException("Provenance mismatch");
        JsonObject? ru = null;
        foreach (var language in new[] { "ru", "en" })
        {
            var c = b["mechanics"]?[language]?.AsObject() ?? throw new InvalidDataException("Mechanics missing");
            if (Number(c["meta"]?["schemaVersion"]) != 1 || Number(c["meta"]?["reviewedClientVersion"]) > version || c["sources"] is not JsonArray { Count: > 0 } sources || c["formulas"] is not JsonArray { Count: > 0 } formulas) throw new InvalidDataException("Invalid mechanics");
            Require(Positive(c["meta"]?["reviewedClientVersion"]) && Positive(c["meta"]?["sourceRevision"]) && Commit(c["meta"]?["gameCommit"]) && Timestamp(c["meta"]?["checkedAt"]) && Nonempty(c["meta"]?["title"]) && Nonempty(c["meta"]?["policy"]), "Invalid mechanics metadata");
            if (Number(c["meta"]!["reviewedClientVersion"]) == version) Require(JsonNode.DeepEquals(c["meta"]!["sourceRevision"], meta["sourceRevision"]) && JsonNode.DeepEquals(c["meta"]!["gameCommit"], meta["gameCommit"]), "Mechanics and heroes mismatch");
            var ids = sources.Select(s => Text(s?["id"])).ToHashSet();
            if (ids.Count != sources.Count || formulas.Select(f => Text(f?["id"])).Distinct().Count() != formulas.Count) throw new InvalidDataException("Duplicate mechanics IDs");
            foreach (var f in formulas) if (f?["sourceIds"] is not JsonArray { Count: > 0 } links || links.Any(s => !ids.Contains(Text(s)))) throw new InvalidDataException("Formula evidence missing");
            foreach (var s in sources) Require(Nonempty(s?["id"]) && Nonempty(s?["label"]) && Https(s?["url"]) && Text(s?["kind"]) is "raw" or "official" or "community", "Invalid source");
            foreach (var f in formulas) Require(new[] { "id", "category", "title", "expression", "example", "confidence" }.All(k => Nonempty(f?[k])) && Strings(f?["variables"]) && Strings(f?["explanation"]) && f!["explanation"]!.AsArray().Count > 0 && Strings(f?["caveats"]), "Invalid formula");
            if (ru != null) foreach (var k in new[] { "reviewedClientVersion", "sourceRevision", "gameCommit", "checkedAt" }) if (!JsonNode.DeepEquals(ru["meta"]?[k], c["meta"]?[k])) throw new InvalidDataException("Mechanics language mismatch");
            if (ru != null) { Require(ru["sources"]!.AsArray().Select(s => string.Join('|', new[] { "id", "url", "kind" }.Select(k => s![k]!.ToJsonString()))).SequenceEqual(sources.Select(s => string.Join('|', new[] { "id", "url", "kind" }.Select(k => s![k]!.ToJsonString())))), "Mechanics evidence languages mismatch"); Require(ru["formulas"]!.AsArray().Select(f => Text(f!["id"]) + "|" + f["sourceIds"]!.ToJsonString() + "|" + Text(f["confidence"]) + "|" + f["variables"]!.AsArray().Count + "|" + f["explanation"]!.AsArray().Count + "|" + f["caveats"]!.AsArray().Count).SequenceEqual(formulas.Select(f => Text(f!["id"]) + "|" + f["sourceIds"]!.ToJsonString() + "|" + Text(f["confidence"]) + "|" + f["variables"]!.AsArray().Count + "|" + f["explanation"]!.AsArray().Count + "|" + f["caveats"]!.AsArray().Count)), "Mechanics formula language mismatch"); }
            ru = c;
        }
        if (b["history"]?["versions"] is not JsonArray versions || !versions.Any(v => Number(v?["clientVersion"]) == version && JsonNode.DeepEquals(v?["buildDate"], h["meta"]?["buildDate"]))) throw new InvalidDataException("History missing current version");
        Require(Number(b["history"]!["schemaVersion"]) == 1 && versions.Select(v => Number(v?["clientVersion"])).Distinct().Count() == versions.Count, "Invalid history schema");
        foreach (var v in versions) { Require(Positive(v?["clientVersion"]) && Day(v?["buildDate"]) && UtcTimestamp(v?["firstPublishedAt"]) && (Text(v?["provenance"]?["kind"]) == "repository-commit" ? Commit(v?["provenance"]?["reference"]) : Text(v?["provenance"]?["kind"]) == "snapshot-save" && UtcTimestamp(v?["provenance"]?["reference"])), "Invalid history entry"); if (v?["patch"] is { } p) { Require(Commit(p["gameCommit"]) && UtcTimestamp(p["checkedAt"]) && Text(p["notes"]) is "unknown" or "published" or "unpublished" && (p["title"] == null || Short(p["title"], 240)) && (p["summary"] == null || Short(p["summary"]?["ru"], 600) && Short(p["summary"]?["en"], 600)), "Invalid version patch"); Require(Text(p["source"]) == "steamdb" ? Positive(p["steamBuildId"]) && Text(p["url"]) == $"https://steamdb.info/patchnotes/{Number(p["steamBuildId"])}/" : Text(p["source"]) == "game-tracking" && Text(p["notes"]) == "unknown" && p["steamBuildId"] == null && Text(p["url"]) == "https://github.com/SteamTracking/GameTracking-Deadlock/commit/" + Text(p["gameCommit"]), "Invalid version patch provenance"); } }
        if (b["history"]!["patches"] is { } patchNode)
        {
            Require(patchNode is JsonArray, "Invalid official patches"); var ids = new HashSet<string>(); foreach (var p in patchNode.AsArray())
            {
                var id = Text(p?["id"]); Require(System.Text.RegularExpressions.Regex.IsMatch(id, "^[0-9]{1,24}$") && ids.Add(id) && Text(p?["source"]) == "steam" && Text(p?["url"]) == "https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/" + id && UtcTimestamp(p?["publishedAt"]) && (p?["clientVersion"] == null || Positive(p["clientVersion"])), "Invalid official patch provenance"); foreach (var key in new[] { "title", "body" }) Require(p?[key] is JsonObject localized && localized["en"] is { } en && Short(en, key == "body" ? 200000 : 240) && localized.All(x => x.Key is "en" or "ru" && Short(x.Value, key == "body" ? 200000 : 240)), "Invalid official patch text");
            }
        }
        if ((b["items"] == null) != (b["itemStatistics"] == null)) throw new InvalidDataException("Items must be paired");
        if (b["items"] is JsonObject items)
        {
            if (Number(items["meta"]?["clientVersion"]) != version || Number(b["itemStatistics"]?["meta"]?["clientVersion"]) != version) throw new InvalidDataException("Item version mismatch");
            var ids = items["items"]!.AsArray().Select(i => Number(i?["id"])).ToHashSet();
            if (ids.Count != items["items"]!.AsArray().Count || b["itemStatistics"]!["items"]!.AsArray().Any(i => !ids.Contains(Number(i?["itemId"])))) throw new InvalidDataException("Invalid item references");
            ValidateItems(items, b["itemStatistics"]!.AsObject());
        }
    }
    private static void ValidateItems(JsonObject catalog, JsonObject statistics)
    {
        bool TextValue(JsonNode? n) => n?.GetValueKind() == JsonValueKind.String && Text(n).Length <= 20000;
        bool Localized(JsonNode? n) => n is JsonObject && TextValue(n["ru"]) && TextValue(n["en"]);
        bool Nonnegative(JsonNode? n) => n != null && long.TryParse(n.ToJsonString(), out var v) && v >= 0;
        bool Ids(JsonNode? n) => n is JsonArray list && list.All(Positive) && list.Select(Number).Distinct().Count() == list.Count;
        bool Attributes(JsonNode? n) => n is JsonArray list && list.Count <= 80 && list.All(a => a is JsonObject && TextValue(a["key"]) && Localized(a["label"]) && Nonempty(a["label"]?["ru"]) && Nonempty(a["label"]?["en"]) && TextValue(a["value"]) && Nonempty(a["value"]) && (a["scaling"] == null || Localized(a["scaling"])));
        bool Summary(JsonNode? n) => n is JsonObject && Nonnegative(n["matches"]) && Nonnegative(n["wins"]) && Nonnegative(n["losses"]) && Number(n["wins"]) + Number(n["losses"]) == Number(n["matches"]) && (n["averageBuyTimeSeconds"] == null || Finite(n["averageBuyTimeSeconds"]) && Real(n["averageBuyTimeSeconds"]) >= 0 && Real(n["averageBuyTimeSeconds"]) <= 7000);
        var meta = catalog["meta"]!; var list = catalog["items"]!.AsArray(); Require(Number(meta["schemaVersion"]) == 1 && Positive(meta["sourceRevision"]) && Timestamp(meta["updatedAt"]) && Number(meta["itemCount"]) == list.Count && list.Count is > 0 and <= 300, "Invalid item metadata"); var ids = new HashSet<long>(); var slugs = new HashSet<string>();
        foreach (var item in list)
        {
            Require(item is JsonObject && Positive(item["id"]) && ids.Add(Number(item["id"])) && TextValue(item["slug"]) && System.Text.RegularExpressions.Regex.IsMatch(Text(item["slug"]), "^[a-z0-9]+(?:-[a-z0-9]+)*$") && slugs.Add(Text(item["slug"])) && Nonempty(item["name"]) && Localized(item["localizedName"]) && Nonempty(item["localizedName"]?["ru"]) && Nonempty(item["localizedName"]?["en"]) && Text(item["category"]) is "weapon" or "vitality" or "spirit" && Number(item["tier"]) is >= 1 and <= 4 && Positive(item["cost"]), "Invalid shop item");
            Require(Number(item!["cost"]) == new[] { 0, 800, 1600, 3200, 6400 }[(int)Number(item["tier"])] && System.Text.RegularExpressions.Regex.IsMatch(Text(item["icon"]), @"^assets/items/[a-z0-9]+(?:-[a-z0-9]+)*\.webp$") && Text(item["activation"]) is "active" or "passive" && Localized(item["description"]) && Attributes(item["attributes"]) && Ids(item["components"]) && Ids(item["upgrades"]) && item["effects"] is JsonArray effects && effects.Count <= 12 && effects.All(e => e is JsonObject && Text(e["kind"]) is "active" or "passive" && Localized(e["description"]) && Attributes(e["attributes"])) && item["tags"] is JsonArray tags && tags.Count <= 80 && tags.All(t => TextValue(t) && System.Text.RegularExpressions.Regex.IsMatch(Text(t), "^[a-z][a-z0-9-]{0,39}$")) && tags.Select(Text).Distinct().Count() == tags.Count && item["advice"] is JsonArray advice && advice.Count <= 12 && advice.All(Localized), "Invalid item attributes");
        }
        foreach (var item in list) Require(item!["components"]!.AsArray().Concat(item["upgrades"]!.AsArray()).All(i => ids.Contains(Number(i)) && Number(i) != Number(item["id"])), "Unknown or circular item link");
        var sm = statistics["meta"]!; Require(Number(sm["schemaVersion"]) == 1 && Timestamp(sm["updatedAt"]) && Timestamp(sm["from"]) && Timestamp(sm["to"]) && DateTimeOffset.Parse(Text(sm["from"]), CultureInfo.InvariantCulture) < DateTimeOffset.Parse(Text(sm["to"]), CultureInfo.InvariantCulture) && DateTimeOffset.Parse(Text(sm["to"]), CultureInfo.InvariantCulture) <= DateTimeOffset.Parse(Text(sm["updatedAt"]), CultureInfo.InvariantCulture) && Text(sm["gameMode"]) == "normal" && sm["matchModes"] is JsonArray modes && modes.Select(Text).SequenceEqual(new[] { "ranked", "unranked" }) && Text(sm["corruptedItems"]) == "exclude" && Text(sm["source"]) == "deadlock-api" && (sm["minAverageBadge"] == null || Nonnegative(sm["minAverageBadge"]) && Number(sm["minAverageBadge"]) <= 116), "Invalid purchase statistics metadata");
        var seen = new HashSet<long>(); var rows = statistics["items"]!.AsArray(); Require(rows.Count <= 300, "Too many statistics rows"); foreach (var row in rows) Require(row is JsonObject && Positive(row["itemId"]) && ids.Contains(Number(row["itemId"])) && seen.Add(Number(row["itemId"])) && Summary(row) && row["heroes"] is JsonArray heroes && heroes.Count <= 100 && heroes.All(h => h is JsonObject && Positive(h["heroId"]) && Summary(h)) && heroes.Select(h => Number(h!["heroId"])).Distinct().Count() == heroes.Count, "Invalid purchase statistics");
    }
    public static readonly Dictionary<string, string[]> Files = new()
    {
        ["heroes.json"] = ["heroes"],
        ["mechanics.json"] = ["mechanics", "ru"],
        ["mechanics.en.json"] = ["mechanics", "en"],
        ["provenance.json"] = ["provenance"],
        ["version-history.json"] = ["history"],
        ["items.json"] = ["items"],
        ["item-statistics.json"] = ["itemStatistics"]
    };
    public static JsonNode? At(JsonNode n, IEnumerable<string> path) => path.Aggregate<string, JsonNode?>(n, (v, k) => v?[k]);
    public static async Task<JsonObject> ReadFilesAsync(AppPaths paths, CancellationToken ct)
    {
        var b = new JsonObject { ["mechanics"] = new JsonObject() };
        foreach (var (name, keys) in Files)
        {
            var file = Path.Combine(paths.Data, name);
            if (!File.Exists(file) && name is "items.json" or "item-statistics.json") continue;
            var value = JsonNode.Parse(await File.ReadAllTextAsync(file, ct));
            if (keys.Length == 1) b[keys[0]] = value; else b[keys[0]]![keys[1]] = value;
        }
        Validate(b); return b;
    }
    public static string SafePath(string root, string relative)
    {
        var absoluteRoot = Path.GetFullPath(root);
        var target = Path.GetFullPath(Path.Combine(absoluteRoot, relative));
        if (!target.StartsWith(absoluteRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Path escapes archive");
        var part = absoluteRoot;
        foreach (var component in new[] { "" }.Concat(Path.GetRelativePath(absoluteRoot, target).Split(Path.DirectorySeparatorChar)))
        {
            part = Path.Combine(part, component);
            if ((File.Exists(part) || Directory.Exists(part)) && File.GetAttributes(part).HasFlag(FileAttributes.ReparsePoint)) throw new InvalidDataException("Archive path contains a link");
        }
        return target;
    }
}
