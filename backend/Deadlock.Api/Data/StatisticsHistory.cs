using System.Globalization;
using System.Text.Json.Nodes;

namespace Deadlock.Api.Data;

/// <summary>Rolling daily observations, sharded by cohort. CSV rows avoid repeating JSON keys in year files.</summary>
public static class StatisticsHistory
{
    public const int MaxDays = 365;
    const long MaxInteger = 9007199254740991;
    static readonly string[] CohortKeys = ["id", "mode", "gameMode", "matchModes", "rankMin", "rankMax"];
    static DateTimeOffset Time(JsonNode? value) => DateTimeOffset.Parse(ArchiveJson.Text(value), CultureInfo.InvariantCulture);
    static DateOnly Day(JsonNode? value) => DateOnly.ParseExact(ArchiveJson.Text(value), "yyyy-MM-dd", CultureInfo.InvariantCulture);
    static void Need(bool valid, string message) { if (!valid) throw new InvalidDataException(message); }
    static JsonObject Definitions => new(StatisticsCollector.ScopeDefinitions().Select(s => KeyValuePair.Create<string, JsonNode?>(ArchiveJson.Text(s["id"]), s)));
    static JsonObject? Scope(JsonObject? stats, string id) => stats?["scopes"]?.AsArray().OfType<JsonObject>().FirstOrDefault(s => ArchiveJson.Text(s["id"]) == id);
    static string Pack(JsonNode day) => string.Join(';', day["rows"]!.AsArray().OrderBy(r => ArchiveJson.Number(r!["heroId"])).Select(r => string.Join(',', new[] { "heroId", "wins", "losses", "matches" }.Select(k => ArchiveJson.Number(r![k]).ToString(CultureInfo.InvariantCulture)))));

    public static JsonArray Unpack(string packed)
    {
        Need(packed.Length <= 16000, "Statistics history day too large");
        var rows = new JsonArray(); var ids = new HashSet<long>(); long total = 0;
        if (packed.Length == 0) return rows;
        foreach (var record in packed.Split(';'))
        {
            var fields = record.Split(','); Need(fields.Length == 4 && rows.Count < 100, "Invalid packed statistics row");
            var values = new long[4];
            for (var i = 0; i < 4; i++) Need(fields[i].Length is > 0 and <= 16 && fields[i].All(char.IsAsciiDigit) && (fields[i].Length == 1 || fields[i][0] != '0') && long.TryParse(fields[i], NumberStyles.None, CultureInfo.InvariantCulture, out values[i]) && values[i] <= MaxInteger, "Invalid statistics count");
            Need(values[0] > 0 && ids.Add(values[0]) && values[1] + values[2] == values[3], "Inconsistent statistics counts");
            total = checked(total + values[3]); Need(total <= MaxInteger, "Statistics denominator overflow");
            rows.Add(new JsonObject { ["heroId"] = values[0], ["wins"] = values[1], ["losses"] = values[2], ["matches"] = values[3] });
        }
        return rows;
    }

    public static JsonObject Expand(JsonObject shard)
    {
        var scope = shard.DeepClone().AsObject();
        foreach (var key in new[] { "schemaVersion", "clientVersion", "source", "metric" }) scope.Remove(key);
        scope["days"] = new JsonArray(shard["days"]!.AsArray().Select(d =>
        {
            var rows = Unpack(ArchiveJson.Text(d!["rows"]));
            return (JsonNode)new JsonObject { ["date"] = d["date"]!.DeepClone(), ["totalSelections"] = rows.Sum(r => ArchiveJson.Number(r!["matches"])), ["rows"] = rows };
        }).ToArray());
        return scope;
    }

    public static void Validate(JsonObject history, long clientVersion)
    {
        var definitions = Definitions; Need(history.Count is > 0 and <= 15, "Invalid history cohorts");
        foreach (var (id, value) in history)
        {
            Need(value is JsonObject && definitions[id] is JsonObject, "Unknown history cohort"); var shard = value!.AsObject();
            foreach (var key in CohortKeys) Need(JsonNode.DeepEquals(shard[key], definitions[id]![key]), "History cohort mismatch");
            Need(ArchiveJson.Number(shard["schemaVersion"]) == 1 && ArchiveJson.Number(shard["clientVersion"]) is > 0 && ArchiveJson.Number(shard["clientVersion"]) <= clientVersion && ArchiveJson.Text(shard["source"]) == "deadlock-api" && ArchiveJson.Text(shard["metric"]) == "selection-share", "Invalid history source");
            var from = Time(shard["from"]); var to = Time(shard["to"]); var updated = Time(shard["updatedAt"]);
            Need(from < to && to <= updated && Time(shard["requestedFrom"]) < Time(shard["requestedTo"]) && shard["days"] is JsonArray { Count: <= MaxDays }, "Invalid history window");
            var cutoff = DateOnly.FromDateTime(to.UtcDateTime).AddDays(1 - MaxDays); DateOnly? previous = null;
            foreach (var day in shard["days"]!.AsArray())
            {
                Need(day is JsonObject, "Invalid history day"); var date = Day(day!["date"]);
                Need(date >= cutoff && date >= DateOnly.FromDateTime(from.UtcDateTime) && date <= DateOnly.FromDateTime(to.UtcDateTime) && (previous == null || date > previous), "Unordered or out-of-range history day");
                Unpack(ArchiveJson.Text(day["rows"])); previous = date;
            }
            Need(ArchiveJson.Bytes(shard).Length <= Sync.PublicSnapshot.MaxFileBytes, "Statistics history file too large");
        }
    }

    public static JsonObject Merge(JsonObject? previousHistory, JsonObject? previousStats, JsonObject fresh)
    {
        var version = ArchiveJson.Number(fresh["clientVersion"]); if (previousHistory != null) Validate(previousHistory, version);
        var result = new JsonObject();
        foreach (var definition in StatisticsCollector.ScopeDefinitions())
        {
            var id = ArchiveJson.Text(definition["id"]); var current = Scope(fresh, id) ?? throw new InvalidDataException("Missing current history cohort");
            var days = new SortedDictionary<DateOnly, string>();
            if (previousHistory?[id] is JsonObject saved) foreach (var day in saved["days"]!.AsArray()) days[Day(day!["date"])] = ArchiveJson.Text(day["rows"]);
            void Apply(JsonObject? scope)
            {
                if (scope == null) return;
                foreach (var key in CohortKeys) Need(JsonNode.DeepEquals(scope[key], definition[key]), "Cannot merge different statistics cohorts");
                var first = DateOnly.FromDateTime(Time(scope["from"]).UtcDateTime); var last = DateOnly.FromDateTime(Time(scope["to"]).UtcDateTime);
                // A refreshed interval is authoritative, including missing days and corrected counts.
                foreach (var date in days.Keys.Where(d => d >= first && d <= last).ToArray()) days.Remove(date);
                foreach (var day in scope["days"]!.AsArray()) days[Day(day!["date"])] = Pack(day);
            }
            var old = Scope(previousStats, id);
            var watermarks = new[] { previousHistory?[id]?["updatedAt"], old?["updatedAt"] }.Where(v => v != null).Select(Time);
            Need(!watermarks.Any() || Time(current["updatedAt"]) >= watermarks.Max(), "Refusing older statistics observations");
            Apply(old); Apply(current);
            var cutoff = DateOnly.FromDateTime(Time(current["to"]).UtcDateTime).AddDays(1 - MaxDays);
            var retained = days.Where(d => d.Key >= cutoff && d.Key <= DateOnly.FromDateTime(Time(current["to"]).UtcDateTime)).ToArray();
            var shard = current.DeepClone().AsObject(); shard["schemaVersion"] = 1; shard["clientVersion"] = version; shard["source"] = "deadlock-api"; shard["metric"] = "selection-share";
            if (retained.Length > 0) shard["from"] = StatisticsCollector.Iso(new DateTimeOffset(retained[0].Key.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
            shard["days"] = new JsonArray(retained.Select(d => (JsonNode)new JsonObject { ["date"] = d.Key.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), ["rows"] = d.Value }).ToArray());
            result[id] = shard;
        }
        Validate(result, version); return result;
    }
}
