using System.Globalization;
using System.Net;
using System.Text.Json.Nodes;

namespace Deadlock.Api.Data;

/// <summary>Independent observational statistics; time cohorts never claim an exact client version.</summary>
public sealed class StatisticsCollector(AppPaths paths, HttpClient http)
{
    public DateTimeOffset LastFetchedAt { get; private set; }
    public static readonly TimeSpan Ttl = TimeSpan.FromHours(6);
    public static string Iso(DateTimeOffset value) => value.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture);
    public static JsonObject[] ScopeDefinitions()
    {
        JsonObject Scope(string id, string mode, string game, string[] matches, int? tier = null) => new()
        {
            ["id"] = id, ["mode"] = mode, ["gameMode"] = game, ["matchModes"] = new JsonArray(matches.Select(x => (JsonNode?)JsonValue.Create(x)).ToArray()),
            ["rankMin"] = tier.HasValue ? tier * 10 + 1 : null, ["rankMax"] = tier.HasValue ? tier * 10 + 6 : null
        };
        return [Scope("normal-all-all", "all", "normal", ["ranked", "unranked"]), Scope("normal-ranked-all", "ranked", "normal", ["ranked"]), Scope("normal-unranked-all", "unranked", "normal", ["unranked"]),
            .. Enumerable.Range(1, 11).Select(t => Scope("normal-ranked-tier-" + t, "ranked", "normal", ["ranked"], t)), Scope("brawl-all", "brawl", "street_brawl", ["ranked", "unranked"])];
    }
    public static bool Due(JsonObject? catalogue, DateTimeOffset now) => catalogue == null || !DateTimeOffset.TryParse(catalogue["updatedAt"]?.GetValue<string>(), CultureInfo.InvariantCulture, DateTimeStyles.None, out var checkedAt) || now - checkedAt >= Ttl || checkedAt > now;
    public async Task<JsonArray> FetchAsync(string endpoint, Dictionary<string, string> query, CancellationToken ct)
    {
        if (endpoint is not ("hero-stats" or "hero-counter-stats" or "hero-synergy-stats")) throw new InvalidDataException("Unsupported statistics endpoint");
        var url = "https://api.deadlock-api.com/v1/analytics/" + endpoint + "?" + string.Join('&', query.OrderBy(q => q.Key).Select(q => Uri.EscapeDataString(q.Key) + "=" + Uri.EscapeDataString(q.Value)));
        var cache = ArchiveJson.SafePath(paths.Root, "work/statistics-cache/" + ArchiveJson.Hash(System.Text.Encoding.UTF8.GetBytes(url)) + ".json");
        if (File.Exists(cache) && DateTimeOffset.UtcNow - File.GetLastWriteTimeUtc(cache) < Ttl)
        {
            var bytes = await File.ReadAllBytesAsync(cache, ct); if (bytes.Length <= 4 * 1024 * 1024 && JsonNode.Parse(bytes) is JsonArray saved) { LastFetchedAt = File.GetLastWriteTimeUtc(cache); return saved; }
        }
        for (var attempt = 0; ; attempt++)
        {
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct); deadline.CancelAfter(TimeSpan.FromSeconds(60));
            using var request = new HttpRequestMessage(HttpMethod.Get, url); request.Headers.UserAgent.ParseAdd("DeadlockArchive-Statistics/1.0");
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, deadline.Token);
            if (response.RequestMessage?.RequestUri?.AbsoluteUri != url) throw new InvalidDataException("Statistics redirect forbidden");
            if (response.StatusCode == HttpStatusCode.TooManyRequests || (int)response.StatusCode is 503 or 504)
            {
                var delay = response.Headers.RetryAfter?.Delta ?? (response.Headers.RetryAfter?.Date - DateTimeOffset.UtcNow) ?? TimeSpan.FromSeconds(5);
                if (attempt > 0 || delay > TimeSpan.FromSeconds(30)) throw new HttpRequestException("Statistics temporarily unavailable; retain saved data", null, response.StatusCode);
                await Task.Delay(delay < TimeSpan.Zero ? TimeSpan.Zero : delay, ct); continue;
            }
            if (!response.IsSuccessStatusCode || response.Content.Headers.ContentLength > 4 * 1024 * 1024) throw new HttpRequestException("Statistics request failed", null, response.StatusCode);
            await using var stream = await response.Content.ReadAsStreamAsync(deadline.Token); using var output = new MemoryStream(); var buffer = new byte[32768]; int size;
            while ((size = await stream.ReadAsync(buffer, deadline.Token)) > 0) { if (output.Length + size > 4 * 1024 * 1024) throw new InvalidDataException("Statistics response too large"); await output.WriteAsync(buffer.AsMemory(0, size), deadline.Token); }
            var bytes = output.ToArray(); var result = JsonNode.Parse(bytes) as JsonArray ?? throw new InvalidDataException("Invalid statistics response");
            Directory.CreateDirectory(Path.GetDirectoryName(cache)!); var temporary = cache + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try { await File.WriteAllBytesAsync(temporary, bytes, ct); File.Move(temporary, cache, true); } finally { if (File.Exists(temporary)) File.Delete(temporary); }
            LastFetchedAt = DateTimeOffset.UtcNow; return result;
        }
    }
    public static JsonArray Days(JsonArray raw, DateTimeOffset from, DateTimeOffset to)
    {
        var rows = new List<(DateTimeOffset Day, JsonObject Row)>();
        foreach (var source in raw)
        {
            var bucket = ArchiveJson.Number(source?["bucket"]); var day = DateTimeOffset.FromUnixTimeSeconds(bucket);
            if (bucket % 86400 != 0) throw new InvalidDataException("Statistics bucket is not a UTC day");
            if (day.Date < from.UtcDateTime.Date || day.Date > to.UtcDateTime.Date) continue;
            rows.Add((day, new JsonObject { ["heroId"] = ArchiveJson.Number(source?["hero_id"]), ["wins"] = ArchiveJson.Number(source?["wins"]), ["losses"] = ArchiveJson.Number(source?["losses"]), ["matches"] = ArchiveJson.Number(source?["matches"]) }));
        }
        return new JsonArray(rows.GroupBy(x => x.Day).OrderBy(g => g.Key).Select(g => (JsonNode)new JsonObject { ["date"] = g.Key.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), ["totalSelections"] = g.Sum(x => ArchiveJson.Number(x.Row["matches"])), ["rows"] = new JsonArray(g.OrderBy(x => ArchiveJson.Number(x.Row["heroId"])).Select(x => (JsonNode)x.Row).ToArray()) }).ToArray());
    }
    public async Task<JsonObject> BuildAsync(int clientVersion, CancellationToken ct, DateTimeOffset? clock = null)
    {
        var now = clock ?? DateTimeOffset.UtcNow; var to = DateTimeOffset.FromUnixTimeSeconds(now.ToUnixTimeSeconds() / 3600 * 3600); var from = new DateTimeOffset(to.UtcDateTime.Date, TimeSpan.Zero).AddDays(-29);
        var scopes = new JsonArray();
        Dictionary<string, string> Query(JsonObject definition) => new()
        {
            ["game_mode"] = ArchiveJson.Text(definition["gameMode"]), ["match_mode"] = string.Join(',', definition["matchModes"]!.AsArray().Select(ArchiveJson.Text)),
            ["min_unix_timestamp"] = from.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture), ["max_unix_timestamp"] = to.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture)
        };
        foreach (var definition in ScopeDefinitions())
        {
            var query = Query(definition); query["bucket"] = "start_time_day";
            if (definition["rankMin"] != null) { query["min_average_badge"] = definition["rankMin"]!.ToJsonString(); query["max_average_badge"] = definition["rankMax"]!.ToJsonString(); }
            var rows = await FetchAsync("hero-stats", query, ct); var scope = definition.DeepClone().AsObject(); scope["updatedAt"] = Iso(clock ?? LastFetchedAt); scope["from"] = Iso(from); scope["to"] = Iso(to); scope["requestedFrom"] = Iso(from); scope["requestedTo"] = Iso(to); scope["days"] = Days(rows, from, to); scopes.Add(scope);
        }
        async Task<JsonObject> Pairs(string endpoint, bool synergy)
        {
            var query = Query(ScopeDefinitions()[0]); query["same_lane_filter"] = "false"; query["min_matches"] = "20";
            var raw = await FetchAsync(endpoint, query, ct); var rows = new JsonArray();
            foreach (var source in raw) rows.Add(new JsonObject { [synergy ? "heroId1" : "heroId"] = ArchiveJson.Number(source?[synergy ? "hero_id1" : "hero_id"]), [synergy ? "heroId2" : "enemyHeroId"] = ArchiveJson.Number(source?[synergy ? "hero_id2" : "enemy_hero_id"]), ["wins"] = ArchiveJson.Number(source?["wins"]), ["matches"] = ArchiveJson.Number(source?["matches_played"]) });
            return new JsonObject { ["from"] = Iso(from), ["to"] = Iso(to), ["updatedAt"] = Iso(clock ?? LastFetchedAt), ["sameLane"] = false, ["minMatches"] = 20, ["rows"] = rows };
        }
        var matchups = await Pairs("hero-counter-stats", false); var synergies = await Pairs("hero-synergy-stats", true);
        var result = new JsonObject { ["schemaVersion"] = 1, ["clientVersion"] = clientVersion, ["sourceClientVersion"] = null, ["updatedAt"] = Iso(clock ?? DateTimeOffset.UtcNow), ["from"] = Iso(from), ["to"] = Iso(to), ["source"] = "deadlock-api", ["timeResolutionSeconds"] = 3600, ["metric"] = "selection-share", ["periods"] = new JsonArray(7, 30), ["scopes"] = scopes, ["matchups"] = matchups, ["synergies"] = synergies, ["patchStatistics"] = new JsonObject { ["available"] = false, ["reason"] = "Analytics have no client-version filter and widen timestamps to hours; exact patch statistics are unavailable." } };
        var observations = scopes.Select(s => DateTimeOffset.Parse(ArchiveJson.Text(s!["updatedAt"]), CultureInfo.InvariantCulture)).Append(DateTimeOffset.Parse(ArchiveJson.Text(matchups["updatedAt"]), CultureInfo.InvariantCulture)).Append(DateTimeOffset.Parse(ArchiveJson.Text(synergies["updatedAt"]), CultureInfo.InvariantCulture));
        result["updatedAt"] = Iso(observations.Min());
        ReferenceCatalogues.Statistics(result); return result;
    }
}
