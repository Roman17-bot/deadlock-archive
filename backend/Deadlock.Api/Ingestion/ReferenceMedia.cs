using System.Collections.Concurrent;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Deadlock.Api.Data;

namespace Deadlock.Api.Ingestion;

public static class ReferenceMedia
{
    public static bool Local(string value) => Regex.IsMatch(value, @"^(?:images|portraits|media)/[A-Za-z0-9][A-Za-z0-9_./-]*\.(?:webp|png|jpe?g|avif|mp4|webm)$") && !value.Contains("..", StringComparison.Ordinal) && !value.Split('/').Any(p => p is "." or ".." or "");
    public static IEnumerable<string> Paths(JsonObject bundle)
    {
        if (bundle["heroProfiles"]?["heroes"] is JsonArray heroes) foreach (var hero in heroes)
        {
            if (hero?["art"] is JsonObject art) foreach (var image in art) if (image.Value is JsonValue && Local(ArchiveJson.Text(image.Value))) yield return "public/" + ArchiveJson.Text(image.Value);
            if (hero?["videos"] is JsonArray videos) foreach (var video in videos) foreach (var key in new[] { "url", "poster" }) if (video?[key] is JsonValue && Local(ArchiveJson.Text(video[key]))) yield return "public/" + ArchiveJson.Text(video[key]);
        }
        if (bundle["worldMap"]?["images"] is JsonObject images) foreach (var image in images) if (image.Value is JsonValue && Local(ArchiveJson.Text(image.Value))) yield return "public/" + ArchiveJson.Text(image.Value);
    }
    public static async Task<Dictionary<string, byte[]>> MaterializeAsync(JsonObject bundle, Func<string, int, CancellationToken, Task<byte[]>> fetch, CancellationToken ct, Func<byte[], CancellationToken, Task<byte[]>>? optimize = null)
    {
        var jobs = new List<(string Url, string Path, Action<string> Set, string? Fallback)>();
        if (bundle["heroProfiles"]?["heroes"] is JsonArray profiles) foreach (var profile in profiles)
        {
            var art = profile!["art"]!.AsObject(); var url = ArchiveJson.Text(art["background"]);
            if (!Local(url)) jobs.Add((url, "images/hero-art/" + ArchiveJson.Text(profile["slug"]) + ".webp", path => art["background"] = path, ArchiveJson.Text(art["card"])));
        }
        if (bundle["worldMap"]?["images"] is JsonObject images) foreach (var layer in new[] { "mid", "mid_tunnels", "rat_tunnels" })
        {
            if (images[layer] is not JsonValue) continue; var url = ArchiveJson.Text(images[layer]); if (Local(url)) continue;
            var aliases = images.Where(i => i.Value is JsonValue && ArchiveJson.Text(i.Value) == url).Select(i => i.Key).ToArray();
            jobs.Add((url, "images/map/" + layer + ".png", path => { foreach (var alias in aliases) images[alias] = path; }, null));
        }
        var downloaded = new ConcurrentDictionary<string, byte[]>();
        await Parallel.ForEachAsync(jobs, new ParallelOptions { MaxDegreeOfParallelism = 4, CancellationToken = ct }, async (job, token) =>
        {
            var uri = ArchiveRefresh.ValidateSource(job.Url); if (uri.Host != "assets-bucket.deadlock-api.com") throw new InvalidDataException("Untrusted reference image");
            var bytes = await fetch(job.Url, job.Fallback != null ? 4 * 1024 * 1024 : 2 * 1024 * 1024, token);
            var webp = bytes.Length >= 12 && bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8) && bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8);
            var png = bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
            if (job.Path.EndsWith(".webp") ? !webp : !png) throw new InvalidDataException("Reference image format mismatch: " + job.Path);
            if (job.Fallback != null)
            {
                try { bytes = await (optimize ?? ReferenceImageOptimizer.OptimizeAsync)(bytes, token); }
                catch (PlatformNotSupportedException)
                {
                    var fallback = ArchiveRefresh.ValidateSource(job.Fallback); if (fallback.Host != "assets-bucket.deadlock-api.com") throw new InvalidDataException("Untrusted fallback art");
                    bytes = await fetch(job.Fallback, 2 * 1024 * 1024, token); ReferenceImageOptimizer.Dimensions(bytes);
                }
            }
            if (!downloaded.TryAdd("public/" + job.Path, bytes)) throw new InvalidDataException("Duplicate reference asset");
        });
        // JsonNode mutation is sequential; concurrent downloads must never modify shared objects.
        foreach (var job in jobs) job.Set(job.Path);
        return downloaded.ToDictionary(x => x.Key, x => x.Value);
    }
}
