using System.Text.Json.Nodes;
using Deadlock.Api.Data;
using Deadlock.Api.Ingestion;

namespace Deadlock.Api.Updates;

public sealed class ReferenceUpdateService(AppPaths paths, IArchiveStore store, BundlePersistence persistence, StatisticsCollector statistics, IHttpClientFactory factory, UpdateCoordinator updates, IPublicSync sync)
{
    public static void ValidateReviewedArchive(JsonNode? review, JsonObject current)
    {
        if (review?["expectedArchiveHash"]?.GetValue<string>() != ArchiveJson.Hash(ArchiveJson.Bytes(current))) throw new InvalidOperationException("Archive changed since reference review; rebuild the review before applying");
    }
    FileStream Lease()
    {
        if (updates.IsBusy || sync.IsBusy) throw new UpdateBusyException();
        Directory.CreateDirectory(paths.Work); return new FileStream(Path.Combine(paths.Work, "update.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
    }
    async Task<JsonObject> ReviewOrSave(JsonObject previous, JsonObject next, Dictionary<string, byte[]> assets, string reason, bool dryRun, CancellationToken ct)
    {
        ArchiveJson.Validate(next);
        var staging = new AppPaths(Path.Combine(paths.Work, "reference-review", Guid.NewGuid().ToString("N"))); Directory.CreateDirectory(staging.Root);
        var before = await Sync.PublicSnapshot.CaptureAsync(paths, previous, ct);
        foreach (var existing in before.Files.Where(f => f.Key.StartsWith("public/"))) { var file = ArchiveJson.SafePath(staging.Root, existing.Key); Directory.CreateDirectory(Path.GetDirectoryName(file)!); await File.WriteAllBytesAsync(file, existing.Value, ct); }
        foreach (var asset in assets) { var target = ArchiveJson.SafePath(staging.Root, asset.Key); Directory.CreateDirectory(Path.GetDirectoryName(target)!); await File.WriteAllBytesAsync(target, asset.Value, ct); }
        await File.WriteAllBytesAsync(Path.Combine(staging.Root, "candidate.json"), ArchiveJson.Bytes(next), ct);
        await File.WriteAllBytesAsync(Path.Combine(staging.Root, "review.json"), ArchiveJson.Bytes(new JsonObject { ["expectedArchiveHash"] = ArchiveJson.Hash(ArchiveJson.Bytes(previous)) }), ct);
        var snapshot = await Sync.PublicSnapshot.CaptureAsync(staging, next, ct);
        var changed = !JsonNode.DeepEquals(previous, next);
        if (!dryRun && changed) await persistence.SaveAsync(next, assets, reason, ct, previous);
        return new JsonObject { ["dryRun"] = dryRun, ["changed"] = changed, ["saved"] = !dryRun && changed, ["reviewDirectory"] = staging.Root, ["clientVersion"] = next["heroes"]!["meta"]!["clientVersion"]!.DeepClone(), ["publicFiles"] = snapshot.Files.Count, ["publicBytes"] = snapshot.Files.Sum(f => (long)f.Value.Length), ["publicHash"] = snapshot.Hash, ["assetCount"] = assets.Count, ["assetBytes"] = assets.Sum(a => (long)a.Value.Length), ["statisticsUpdatedAt"] = next["heroStatistics"]?["updatedAt"]?.DeepClone() };
    }
    public async Task<JsonObject> StatisticsAsync(bool force, bool dryRun, CancellationToken ct)
    {
        using var lease = Lease(); var previous = await store.ReadBundleAsync(ct);
        if (!force && !StatisticsCollector.Due(previous["heroStatistics"] as JsonObject, DateTimeOffset.UtcNow)) return new JsonObject { ["upToDate"] = true, ["saved"] = false, ["updatedAt"] = previous["heroStatistics"]!["updatedAt"]!.DeepClone() };
        var next = previous.DeepClone().AsObject(); using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct); deadline.CancelAfter(TimeSpan.FromMinutes(5)); next["heroStatistics"] = await statistics.BuildAsync((int)ArchiveJson.Number(previous["heroes"]!["meta"]!["clientVersion"]), deadline.Token);
        return await ReviewOrSave(previous, next, [], "independent-statistics-refresh", dryRun, ct);
    }
    public async Task<JsonObject> ReferencesAsync(string? profilesPath, string? mapPath, bool dryRun, CancellationToken ct, string? reviewPath = null)
    {
        using var lease = Lease(); var previous = await store.ReadBundleAsync(ct); var next = previous.DeepClone().AsObject();
        async Task<JsonObject> Read(string path)
        {
            var file = Path.GetFullPath(path, paths.Root); if (!file.StartsWith(paths.Root + Path.DirectorySeparatorChar, StringComparison.Ordinal) || new FileInfo(file).Length > 4 * 1024 * 1024) throw new InvalidDataException("Reference input must be a bounded archive-local JSON file");
            return JsonNode.Parse(await File.ReadAllBytesAsync(file, ct))?.AsObject() ?? throw new InvalidDataException("Invalid reference input");
        }
        string? reviewed = null;
        if (reviewPath != null)
        {
            reviewed = Path.GetFullPath(reviewPath, paths.Root);
            if (!reviewed.StartsWith(Path.Combine(paths.Work, "reference-review") + Path.DirectorySeparatorChar, StringComparison.Ordinal) || new FileInfo(Path.Combine(reviewed, "candidate.json")).Length > 32 * 1024 * 1024) throw new InvalidDataException("Invalid reference review directory");
            var review = JsonNode.Parse(await File.ReadAllBytesAsync(Path.Combine(reviewed, "review.json"), ct));
            ValidateReviewedArchive(review, previous);
            var candidate = JsonNode.Parse(await File.ReadAllBytesAsync(Path.Combine(reviewed, "candidate.json"), ct))!.AsObject();
            foreach (var key in new[] { "heroProfiles", "worldMap" }) if (candidate[key] != null) next[key] = candidate[key]!.DeepClone();
        }
        if (profilesPath != null) next["heroProfiles"] = await Read(profilesPath);
        if (mapPath != null) next["worldMap"] = await Read(mapPath);
        if (profilesPath == null && mapPath == null && reviewed == null) throw new InvalidDataException("Supply --profiles and/or --map for curated reference import");
        if (next["heroProfiles"] is JsonObject profiles && ArchiveJson.Number(profiles["clientVersion"]) != ArchiveJson.Number(next["heroes"]!["meta"]!["clientVersion"])) throw new InvalidDataException("Curated profile candidate is not the current client");
        if (next["worldMap"] is JsonObject map && ArchiveJson.Number(map["meta"]?["clientVersion"]) != ArchiveJson.Number(next["heroes"]!["meta"]!["clientVersion"])) throw new InvalidDataException("Curated map candidate is not the current client");
        ArchiveJson.Validate(next);
        var upstream = new ArchiveRefresh(paths, factory.CreateClient("reference-assets"));
        var assets = await ReferenceMedia.MaterializeAsync(next, upstream.FetchMediaAsync, ct);
        if (reviewed != null) foreach (var media in ReferenceMedia.Paths(next).Distinct())
        {
            var source = ArchiveJson.SafePath(reviewed, media); if (new FileInfo(source).Length > Sync.PublicSnapshot.MaxFileBytes || !Sync.PublicSnapshot.Approved(media)) throw new InvalidDataException("Invalid reviewed asset");
            var bytes = await File.ReadAllBytesAsync(source, ct);
            if (media.EndsWith(".webp")) ReferenceImageOptimizer.Dimensions(bytes);
            else if (media.EndsWith(".png") && (bytes.Length < 8 || !bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }))) throw new InvalidDataException("Invalid reviewed PNG");
            assets[media] = bytes;
        }
        return await ReviewOrSave(previous, next, assets, "curated-reference-refresh", dryRun, ct);
    }
}
