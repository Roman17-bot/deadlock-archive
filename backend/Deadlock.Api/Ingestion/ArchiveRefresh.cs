using System.Collections.Concurrent;
using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Deadlock.Api.Ingestion;

/// <summary>Builds a complete version candidate entirely in memory. Persistence belongs to the owner orchestrator.</summary>
public sealed class ArchiveRefresh : IArchiveRefresh
{
    const string Api = "https://api.deadlock-api.com/v1";
    static readonly HashSet<string> Allowed = ["api.deadlock-api.com", "api.github.com", "raw.githubusercontent.com", "assets-bucket.deadlock-api.com"];
    static readonly UTF8Encoding Utf8 = new(false, true);
    readonly AppPaths paths;
    readonly HttpClient http;
    public ArchiveRefresh(AppPaths paths) : this(paths, new HttpClient(new SocketsHttpHandler { AllowAutoRedirect = false, AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate, ConnectTimeout = TimeSpan.FromSeconds(15) }) { Timeout = Timeout.InfiniteTimeSpan }) { }
    public ArchiveRefresh(AppPaths paths, HttpClient http) { this.paths = paths; this.http = http; }
    public static Uri ValidateSource(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != "https" || !Allowed.Contains(uri.Host) || !uri.IsDefaultPort || uri.UserInfo != "" || uri.Fragment != "") throw new InvalidDataException("Untrusted source URL"); return uri;
    }
    async Task<byte[]> RequestAsync(string url, int limit, CancellationToken ct)
    {
        var uri = ValidateSource(url);
        for (var attempt = 0; ; attempt++)
        {
            ct.ThrowIfCancellationRequested(); using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromSeconds(45));
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, uri); request.Headers.UserAgent.ParseAdd("DeadlockArchive-Updater/2.0"); request.Headers.Accept.ParseAdd("application/json,text/plain,image/webp,*/*");
                using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
                if (response.RequestMessage?.RequestUri != uri) throw new InvalidDataException("Upstream redirect is forbidden");
                if ((response.StatusCode == HttpStatusCode.TooManyRequests || (int)response.StatusCode >= 500) && attempt < 2) { var delay = response.Headers.RetryAfter?.Delta ?? TimeSpan.FromMilliseconds(500 * (attempt + 1)); await Task.Delay(delay > TimeSpan.FromSeconds(5) ? TimeSpan.FromSeconds(5) : delay, ct); continue; }
                if (!response.IsSuccessStatusCode) throw new HttpRequestException($"Upstream {uri.Host}: HTTP {(int)response.StatusCode}", null, response.StatusCode);
                if (response.Content.Headers.ContentLength > limit) throw new InvalidDataException("Upstream body too large");
                await using var body = await response.Content.ReadAsStreamAsync(timeout.Token); using var bytes = new MemoryStream(); var buffer = new byte[32768]; int count;
                while ((count = await body.ReadAsync(buffer, timeout.Token)) > 0) { if (bytes.Length + count > limit) throw new InvalidDataException("Upstream body too large"); bytes.Write(buffer, 0, count); }
                if (bytes.Length == 0) throw new InvalidDataException("Empty upstream body"); return bytes.ToArray();
            }
            catch (HttpRequestException error) when (attempt < 2 && error.StatusCode is null) { await Task.Delay(500 * (attempt + 1), ct); }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested && attempt < 2) { await Task.Delay(500 * (attempt + 1), ct); }
        }
    }
    async Task<JsonNode> JsonAsync(string url, CancellationToken ct, int limit = 16_000_000) => JsonNode.Parse(Utf8.GetString(await RequestAsync(url, limit, ct)), documentOptions: new() { MaxDepth = 128 }) ?? throw new InvalidDataException("Empty upstream JSON");
    public static GameVersion ParseVersion(JsonNode node)
    {
        var o = J.Obj(node, "steam version"); var version = J.Id(o["client_version"], "client version"); var revision = J.Id(o["source_revision"], "source revision"); if (version > int.MaxValue || J.Id(o["server_version"], "server version") != version) throw new InvalidDataException("Mismatched steam version");
        if (!DateTimeOffset.TryParse(J.Str(o["version_date"]) + " " + J.Str(o["version_time"], "00:00:00") + " +00:00", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var date)) throw new InvalidDataException("Invalid build date");
        return new((int)version, revision, date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
    }
    static (GameVersion Version, DateTimeOffset BuildTime) RawVersion(string source)
    {
        var values = new Dictionary<string, string>(); foreach (var line in source.Split('\n')) { if (string.IsNullOrWhiteSpace(line)) continue; var i = line.IndexOf('='); if (i < 1 || !values.TryAdd(line[..i], line[(i + 1)..].Trim())) throw new InvalidDataException("Malformed steam.inf"); }
        var json = new JsonObject { ["client_version"] = long.Parse(values["ClientVersion"], CultureInfo.InvariantCulture), ["server_version"] = long.Parse(values["ServerVersion"], CultureInfo.InvariantCulture), ["source_revision"] = long.Parse(values["SourceRevision"], CultureInfo.InvariantCulture), ["version_date"] = values["VersionDate"], ["version_time"] = values.GetValueOrDefault("VersionTime", "00:00:00") };
        return (ParseVersion(json), DateTimeOffset.Parse(values["VersionDate"] + " " + values.GetValueOrDefault("VersionTime", "00:00:00") + " +00:00", CultureInfo.InvariantCulture));
    }
    public async Task<GameVersion> LatestAsync(CancellationToken ct = default) => ParseVersion(await JsonAsync(Api + "/assets/steam-info", ct, 100_000));
    static string SourceCommit(JsonNode? node)
    {
        var commit = J.Str(node?["sha"]); if (!Regex.IsMatch(commit, "^[a-f0-9]{40}$")) throw new InvalidDataException("Invalid GameTracking commit"); return commit;
    }
    static string SourceRoot(string commit) => $"https://raw.githubusercontent.com/SteamTracking/GameTracking-Deadlock/{commit}/game/citadel";
    async Task<(string Commit, DateTimeOffset BuildTime)> ResolveSourceAsync(string head, GameVersion expected, CancellationToken ct)
    {
        // The extracted API assets can lag the game. Search only steam.inf history at this
        // immutable head, then require the complete version identity before using its scripts.
        using var budget = CancellationTokenSource.CreateLinkedTokenSource(ct); budget.CancelAfter(TimeSpan.FromMinutes(2));
        try
        {
            var raw = RawVersion(Utf8.GetString(await RequestAsync(SourceRoot(head) + "/steam.inf", 100_000, budget.Token)));
            if (raw.Version == expected) return (head, raw.BuildTime);
            const int pageSize = 10, maxPages = 3; var seen = new HashSet<string> { head };
            for (var page = 1; page <= maxPages; page++)
            {
                var url = $"https://api.github.com/repos/SteamTracking/GameTracking-Deadlock/commits?sha={head}&path=game%2Fcitadel%2Fsteam.inf&per_page={pageSize}&page={page}";
                var history = J.Arr(await JsonAsync(url, budget.Token, 1_000_000), "GameTracking steam.inf history");
                if (history.Count > pageSize) throw new InvalidDataException("Invalid GameTracking history page size");
                foreach (var entry in history)
                {
                    var commit = SourceCommit(entry); if (!seen.Add(commit)) continue;
                    raw = RawVersion(Utf8.GetString(await RequestAsync(SourceRoot(commit) + "/steam.inf", 100_000, budget.Token)));
                    if (raw.Version == expected) return (commit, raw.BuildTime);
                }
                if (history.Count < pageSize) break;
            }
            throw new InvalidDataException("No exact API version, revision and build date in bounded GameTracking steam.inf history");
        }
        catch (OperationCanceledException error) when (!ct.IsCancellationRequested) { throw new InvalidDataException("GameTracking source history search timed out", error); }
    }
    public async Task<RefreshCandidate> BuildAsync(JsonObject current, GameVersion expected, CancellationToken ct = default)
    {
        var currentHeroes = J.Obj(current["heroes"], "current hero snapshot"); if (expected.Version < J.Id(currentHeroes["meta"]?["clientVersion"], "current client")) throw new InvalidDataException("Refusing client version downgrade");
        var latestTask = LatestAsync(ct); var headTask = JsonAsync("https://api.github.com/repos/SteamTracking/GameTracking-Deadlock/commits/master", ct); await Task.WhenAll(latestTask, headTask);
        if (await latestTask != expected) throw new InvalidDataException("Client version changed before refresh"); var head = SourceCommit(await headTask); var query = $"client_version={expected.Version}";
        if (ParseVersion(await JsonAsync(Api + "/assets/steam-info?" + query, ct, 100_000)) != expected) throw new InvalidDataException("Pinned API version or revision disagreement");
        var resolved = await ResolveSourceAsync(head, expected, ct); var commit = resolved.Commit; var pinned = SourceRoot(commit);
        var heroTask = JsonAsync(Api + "/assets/heroes?" + query + "&language=english", ct); var activeTask = JsonAsync(Api + "/assets/heroes?" + query + "&only_active=true", ct); var enTask = JsonAsync(Api + "/assets/items?" + query + "&language=english", ct); var ruTask = JsonAsync(Api + "/assets/items?" + query + "&language=russian", ct); var heroesTextTask = RequestAsync(pinned + "/pak01_dir/scripts/heroes.vdata", 16_000_000, ct); var abilitiesTextTask = RequestAsync(pinned + "/pak01_dir/scripts/abilities.vdata", 16_000_000, ct);
        await Task.WhenAll(heroTask, activeTask, enTask, ruTask, heroesTextTask, abilitiesTextTask);
        var heroesText = Utf8.GetString(await heroesTextTask); var abilitiesText = Utf8.GetString(await abilitiesTextTask); var en = J.Arr(await enTask, "English items"); var ru = J.Arr(await ruTask, "Russian items"); var apiHeroes = J.Arr(await heroTask, "heroes");
        var checkedAt = DateTimeOffset.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture);
        var policy = J.Obj(JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(paths.Data, "updater-policy.json"), ct)), "updater policy");
        var heroes = HeroAdapter.Build(currentHeroes, Kv3.Parse(heroesText), Kv3.Parse(abilitiesText), apiHeroes, J.Arr(await activeTask, "active heroes"), en, policy, expected, commit, heroesText, abilitiesText, checkedAt);
        ArchiveValidation.Heroes(heroes);
        var end = DateTimeOffset.FromUnixTimeSeconds(DateTimeOffset.UtcNow.ToUnixTimeSeconds()); var from = resolved.BuildTime > end.AddDays(-14) ? resolved.BuildTime : end.AddDays(-14); if (from >= end) throw new InvalidDataException("Invalid item statistics period");
        static string Iso(DateTimeOffset value) => value.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture);
        var catalog = ItemAdapter.Catalog(en, ru, expected, Iso(end), EditorialAdvice.Read());
        ArchiveValidation.Catalog(catalog);
        var cohort = $"game_mode=normal&match_mode=ranked%2Cunranked&min_unix_timestamp={from.ToUnixTimeSeconds()}&max_unix_timestamp={end.ToUnixTimeSeconds()}&min_matches=1&corrupted_items=exclude";
        var overall = await JsonAsync(Api + "/analytics/item-stats?bucket=no_bucket&" + cohort, ct); var byHero = await JsonAsync(Api + "/analytics/item-stats?bucket=hero&" + cohort, ct);
        var statistics = ItemAdapter.Statistics(J.Arr(overall, "overall statistics"), J.Arr(byHero, "hero statistics"), catalog, expected.Version, Iso(end), Iso(from), Iso(end));
        ArchiveValidation.Statistics(statistics, catalog);
        var assets = new ConcurrentDictionary<string, byte[]>(); var downloads = new List<(string Path, string Url)>();
        foreach (var h in J.Rows(heroes["heroes"], "candidate heroes"))
        {
            var relative = J.Str(h["portrait"]); if (!Regex.IsMatch(relative, "^assets/heroes/[a-z0-9-]+\\.webp$")) throw new InvalidDataException("Unsafe portrait path");
            var file = Path.Combine(paths.Public, relative); if (File.Exists(file) && new FileInfo(file).Length > 0) continue;
            var source = J.Rows(apiHeroes, "API heroes").Single(a => J.Id(a["id"], "ID") == J.Id(h["id"], "ID")); downloads.Add(("public/" + relative, J.Str(source["images"]?["icon_image_small_webp"])));
        }
        var upstream = J.Rows(en, "API items").ToDictionary(i => J.Id(i["id"], "ID")); foreach (var item in J.Rows(catalog["items"], "catalog items")) { var source = upstream[J.Id(item["id"], "ID")]; var relative = J.Str(item["icon"]); if (!Regex.IsMatch(relative, "^assets/items/[a-z0-9-]+\\.webp$")) throw new InvalidDataException("Unsafe item icon path"); downloads.Add(("public/" + relative, J.Str(source["shop_image_webp"], J.Str(source["image_webp"])))); }
        await Parallel.ForEachAsync(downloads, new ParallelOptions { MaxDegreeOfParallelism = 4, CancellationToken = ct }, async (download, token) => { var uri = ValidateSource(download.Url); if (uri.Host != "assets-bucket.deadlock-api.com") throw new InvalidDataException("Missing trusted WebP icon"); var bytes = await RequestAsync(download.Url, download.Path.StartsWith("public/assets/heroes/") ? 2_000_000 : 1_000_000, token); if (bytes.Length < 12 || !bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8) || !bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8)) throw new InvalidDataException("Invalid WebP icon"); if (!assets.TryAdd(download.Path, bytes)) throw new InvalidDataException("Duplicate asset path"); });
        if (await LatestAsync(ct) != expected) throw new InvalidDataException("Client version changed during refresh");
        var candidate = (JsonObject)current.DeepClone(); candidate["heroes"] = heroes; candidate["items"] = catalog; candidate["itemStatistics"] = statistics;
        var old = J.Rows(currentHeroes["heroes"], "previous heroes").ToDictionary(h => J.Id(h["id"], "ID")); var next = J.Rows(heroes["heroes"], "heroes").ToList(); var nextIds = next.Select(h => J.Id(h["id"], "ID")).ToHashSet();
        bool SameHero(JsonObject a, JsonObject b) { var x = (JsonObject)a.DeepClone(); var y = (JsonObject)b.DeepClone(); x.Remove("source"); y.Remove("source"); return JsonNode.DeepEquals(x, y); }
        var added = next.Count(h => !old.ContainsKey(J.Id(h["id"], "ID"))); var removed = old.Keys.Count(id => !nextIds.Contains(id)); var updated = next.Count(h => old.TryGetValue(J.Id(h["id"], "ID"), out var previous) && !SameHero(h, previous));
        var summary = new JsonObject { ["heroCount"] = next.Count, ["added"] = added, ["removed"] = removed, ["updated"] = updated, ["itemCount"] = J.Arr(catalog["items"], "items").Count, ["statisticsItems"] = J.Arr(statistics["items"], "statistics").Count, ["text"] = $"Клиент {expected.Version}: {next.Count} героев; +{added}, −{removed}, изменено {updated}. Кандидат проверен." };
        return new(candidate, assets.ToDictionary(x => x.Key, x => x.Value), summary, commit);
    }
}
