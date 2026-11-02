using System.Globalization;
using System.Net;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Deadlock.Api.Patches;

/// <summary>Official descriptions are news records, never inferred client/build mappings.</summary>
public sealed class PatchHistoryService(AppPaths paths, HttpClient http, ILogger<PatchHistoryService> logger) : IPatchHistoryService, IPatchHistoryProgress
{
    public bool HasPending { get; private set; }
    public bool LastCheckFailed { get; private set; }
    private const int PageSize = 40;
    private const int MaxPages = 8;
    private const int MaxResponseBytes = 8 * 1024 * 1024;
    private static readonly TimeSpan RegexTimeout = TimeSpan.FromSeconds(1);

    public async Task<JsonObject> EnrichAsync(JsonObject history, int currentVersion, CancellationToken ct = default)
    {
        HasPending = true;
        LastCheckFailed = false;
        _ = currentVersion; // News IDs and client numbers are deliberately separate.
        var result = (JsonObject)history.DeepClone();
        var notes = (result["patches"] as JsonArray ?? new JsonArray()).OfType<JsonObject>()
            .ToDictionary(p => Text(p["id"]), p => (JsonObject)p.DeepClone(), StringComparer.Ordinal);
        var cachePath = Path.Combine(paths.Work, "patch-history-backfill.json");
        JsonObject? cache = null;
        try
        {
            if (File.Exists(cachePath)) cache = JsonNode.Parse(await File.ReadAllTextAsync(cachePath, ct)) as JsonObject;
        }
        catch (Exception ex) when (ex is IOException or System.Text.Json.JsonException)
        {
            logger.LogWarning(ex, "Patch history cache unavailable; restarting bounded backfill");
        }
        foreach (var cached in (cache?["patches"] as JsonArray ?? new JsonArray()).OfType<JsonObject>())
        {
            var id = Text(cached["id"]);
            if (!Regex.IsMatch(id, @"^\d{1,24}$", RegexOptions.None, RegexTimeout) || Text(cached["source"]) != "steam" ||
                Text(cached["url"]) != $"https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/{id}" ||
                cached["title"] is not JsonObject title || Text(title["en"]).Length is < 1 or > 240 ||
                cached["body"] is not JsonObject body || Text(body["en"]).Length is < 20 or > 200_000 ||
                !DateTimeOffset.TryParse(Text(cached["publishedAt"]), CultureInfo.InvariantCulture, DateTimeStyles.None, out _)) continue;
            var recovered = (JsonObject)cached.DeepClone();
            if (notes.TryGetValue(id, out var current))
            {
                foreach (var field in new[] { "title", "body" })
                    if (current[field]?["ru"] is JsonNode ru) recovered[field]!["ru"] = ru.DeepClone();
                if (current["clientVersion"] is JsonNode version) recovered["clientVersion"] = version.DeepClone();
            }
            notes[id] = recovered;
        }
        var cursor = cache?["cursor"] as JsonObject ?? result["patchBackfill"] as JsonObject;
        var sinceText = Text(cursor?["since"]);
        if (!DateOnly.TryParseExact(sinceText, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var sinceDate))
        {
            var knownDates = (history["versions"] as JsonArray ?? new JsonArray()).OfType<JsonObject>()
                .Select(v => DateOnly.TryParseExact(Text(v["buildDate"]), "yyyy-MM-dd", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var d) ? d : (DateOnly?)null).OfType<DateOnly>().ToArray();
            sinceDate = knownDates.Length > 0 ? knownDates.Min().AddDays(-7) : new DateOnly(2024, 8, 23);
            sinceText = sinceDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }
        var since = new DateTimeOffset(sinceDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc)).ToUnixTimeSeconds();
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds() + 1;
        var backfillBefore = Number(cursor?["before"], now);
        var complete = cursor?["complete"] is JsonValue done && done.TryGetValue<bool>(out var completed) && completed;
        // Always refresh the head, then resume initial backfill or fill a gap after a long offline period.
        var newestKnown = notes.Values.Select(p => DateTimeOffset.TryParse(Text(p["publishedAt"]), out var d)
            ? d.ToUnixTimeSeconds() : 0).DefaultIfEmpty(0).Max();
        var before = now;
        var pendingBefore = Number(cursor?["pendingBefore"], 0);
        var pendingSince = Number(cursor?["pendingSince"], 0);
        var work = "head";
        using var budget = CancellationTokenSource.CreateLinkedTokenSource(ct);
        budget.CancelAfter(TimeSpan.FromSeconds(45));
        try
        {
            for (var pageNumber = 0; pageNumber < MaxPages; pageNumber++)
            {
                var page = await FetchPageAsync(before, budget.Token);
                // Process a page transactionally. A malformed response cannot advance its cursor.
                var accepted = new List<JsonObject>();
                var dates = new List<long>();
                foreach (var node in page)
                {
                    var item = node as JsonObject ?? throw new InvalidDataException("Invalid Steam news item");
                    var timestamp = Number(item["date"], 0);
                    if (timestamp < 1 || timestamp >= before) throw new InvalidDataException("Invalid Steam news pagination date");
                    dates.Add(timestamp);
                    if (timestamp < since) continue;
                    if (Text(item["feedname"]) != "steam_community_announcements" || Number(item["appid"], 0) != 1422450)
                        throw new InvalidDataException("Unexpected Steam news feed");
                    var id = Text(item["gid"]);
                    var title = PlainText(Text(item["title"]));
                    var body = PlainText(Text(item["contents"]));
                    if (!Regex.IsMatch(id, @"^\d{1,24}$", RegexOptions.None, RegexTimeout))
                        throw new InvalidDataException("Invalid Steam news identity");
                    if (title.Length > 240 || body.Length > 200_000) throw new InvalidDataException("Oversized Steam news text");
                    // Image-only/empty announcements are not described updates.
                    if (title.Length == 0 || body.Length < 20) continue;
                    accepted.Add(new JsonObject
                    {
                        ["id"] = id,
                        ["source"] = "steam",
                        ["url"] = $"https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/{id}",
                        ["publishedAt"] = DateTimeOffset.FromUnixTimeSeconds(timestamp).UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture),
                        ["title"] = new JsonObject { ["en"] = title },
                        ["body"] = new JsonObject { ["en"] = body }
                    });
                }
                foreach (var patch in accepted)
                {
                    var id = Text(patch["id"]);
                    // Preserve curated translations and explicitly recorded mappings when refreshing English originals.
                    if (notes.TryGetValue(id, out var previous))
                    {
                        foreach (var field in new[] { "title", "body" })
                            if (previous[field]?["ru"] is JsonNode ru) patch[field]!["ru"] = ru.DeepClone();
                        if (previous["clientVersion"] is JsonNode version) patch["clientVersion"] = version.DeepClone();
                    }
                    notes[id] = patch;
                }
                var oldest = dates.Count > 0 ? dates.Min() : since;
                var reachedBaseline = page.Count == 0 || oldest <= since;
                // Do not treat a short page as exhaustion: upstream can cap page size.
                if (work == "head")
                {
                    if (newestKnown == 0) backfillBefore = oldest;
                    else if (!reachedBaseline && oldest > newestKnown)
                    {
                        pendingBefore = oldest;
                        pendingSince = pendingSince > 0 ? Math.Min(pendingSince, newestKnown) : newestKnown;
                    }
                }
                else if (work == "gap")
                {
                    pendingBefore = oldest;
                    if (reachedBaseline || oldest <= pendingSince) pendingBefore = pendingSince = 0;
                }
                else
                {
                    backfillBefore = oldest;
                }
                if (reachedBaseline) { complete = true; pendingBefore = pendingSince = 0; }
                var nextCursor = new JsonObject { ["since"] = sinceText, ["before"] = Math.Max(1, backfillBefore), ["complete"] = complete };
                if (pendingBefore > 0) { nextCursor["pendingBefore"] = pendingBefore; nextCursor["pendingSince"] = pendingSince; }
                // Checkpoint includes descriptions: a later database-save failure cannot leave an advanced cursor with missing notes.
                var checkpoint = new JsonObject
                {
                    ["cursor"] = nextCursor,
                    ["patches"] = new JsonArray(notes.Values.Select(p => (JsonNode?)p.DeepClone()).ToArray())
                };
                Directory.CreateDirectory(paths.Work);
                var temporary = cachePath + ".tmp";
                await File.WriteAllTextAsync(temporary, checkpoint.ToJsonString(), budget.Token);
                File.Move(temporary, cachePath, true);
                if (pendingBefore > 0) { work = "gap"; before = pendingBefore; }
                else if (!complete) { work = "backfill"; before = backfillBefore; }
                else break;
            }
            if (!complete || pendingBefore > 0)
                logger.LogWarning("Official patch history has more pages; the next check will resume the private cursor");
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            LastCheckFailed = true;
            logger.LogWarning("Official patch history request timed out; preserving successful pages and previous descriptions");
        }
        catch (Exception ex) when (ex is HttpRequestException or IOException or System.Text.Json.JsonException or RegexMatchTimeoutException or InvalidOperationException or ArgumentException)
        {
            LastCheckFailed = true;
            logger.LogWarning(ex, "Official patch history incomplete; preserving successful pages and previous descriptions");
        }
        HasPending = !complete || pendingBefore > 0;
        ct.ThrowIfCancellationRequested();
        if (notes.Count > 0 || result["patches"] is not null)
            result["patches"] = new JsonArray(notes.Values.OrderByDescending(p => Text(p["publishedAt"]), StringComparer.Ordinal)
                .ThenBy(p => Text(p["id"]), StringComparer.Ordinal).Select(p => (JsonNode?)p).ToArray());
        return result;
    }

    private async Task<JsonArray> FetchPageAsync(long before, CancellationToken ct)
    {
        var url = $"https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=1422450&count={PageSize}&maxlength=0&feeds=steam_community_announcements&enddate={before}";
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(12));
        using var response = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
        response.EnsureSuccessStatusCode();
        if (response.Content.Headers.ContentLength > MaxResponseBytes) throw new InvalidDataException("Oversized Steam news response");
        await using var stream = await response.Content.ReadAsStreamAsync(timeout.Token);
        using var buffer = new MemoryStream();
        var bytes = new byte[16 * 1024];
        int read;
        while ((read = await stream.ReadAsync(bytes, timeout.Token)) > 0)
        {
            if (buffer.Length + read > MaxResponseBytes) throw new InvalidDataException("Oversized Steam news response");
            await buffer.WriteAsync(bytes.AsMemory(0, read), timeout.Token);
        }
        buffer.Position = 0;
        var root = await JsonNode.ParseAsync(buffer, cancellationToken: timeout.Token);
        if (root?["appnews"]?["appid"]?.GetValue<int>() != 1422450 || root["appnews"]?["newsitems"] is not JsonArray items)
            throw new InvalidDataException("Invalid Steam news response");
        return items;
    }

    public static string PlainText(string input)
    {
        string Replace(string value, string pattern, string replacement) => Regex.Replace(value, pattern, replacement,
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, RegexTimeout);
        var text = Replace(input, @"\[(img|previewyoutube|video|iframe)[^\]]*\][\s\S]*?\[/\1\]", "");
        text = Replace(text, @"\[h[1-6][^\]]*\]", "\n\n## ");
        text = Replace(text, @"\[/h[1-6]\]", "\n\n");
        text = Replace(text, @"\[\*\]", "\n- ");
        text = Replace(text, @"\[/?(?:p|list|olist|table|tr)[^\]]*\]|<br\s*/?>|</(?:p|div|li|h[1-6])>", "\n");
        text = Replace(text, @"\[/?[a-z][^\]]*\]|<[^>]*>", "");
        text = WebUtility.HtmlDecode(text).Replace("\r", "");
        text = Replace(text, @"[ \t]+\n", "\n");
        return Replace(text, @"\n{3,}", "\n\n").Trim();
    }

    private static string Text(JsonNode? node) => node is JsonValue v && v.TryGetValue<string>(out var s) ? s : "";
    private static long Number(JsonNode? node, long fallback) => node is JsonValue v && v.TryGetValue<long>(out var n) ? n : fallback;
}
