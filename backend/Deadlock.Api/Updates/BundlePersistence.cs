using System.Text.Json.Nodes;
using Deadlock.Api.Data;
using Deadlock.Api.Sync;

namespace Deadlock.Api.Updates;

public sealed class BundlePersistence(AppPaths paths, IArchiveStore store)
{
    public async Task SaveAsync(JsonObject bundle, Dictionary<string, byte[]> assets, string reason, CancellationToken ct, JsonObject? expected = null)
    {
        ArchiveJson.Validate(bundle);
        var previous = await store.ReadBundleAsync(ct);
        if (expected is not null && !JsonNode.DeepEquals(previous, expected)) throw new InvalidOperationException("Archive changed during refresh; rebuild from current data");
        var before = await PublicSnapshot.CaptureAsync(paths, previous, ct);
        var staging = new AppPaths(Path.Combine(paths.Work, "candidates", Guid.NewGuid().ToString("N")));
        Directory.CreateDirectory(staging.Root);
        try
        {
            foreach (var file in before.Files.Where(f => f.Key.StartsWith("public/")))
            {
                var target = ArchiveJson.SafePath(staging.Root, file.Key);
                Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                await File.WriteAllBytesAsync(target, file.Value, ct);
            }
            foreach (var file in assets)
            {
                if (!file.Key.StartsWith("public/") || !PublicSnapshot.Approved(file.Key)) throw new InvalidDataException("Unexpected candidate asset");
                var target = ArchiveJson.SafePath(staging.Root, file.Key);
                Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                await File.WriteAllBytesAsync(target, file.Value, ct);
            }
            var candidate = await PublicSnapshot.CaptureAsync(staging, bundle, ct);
            var added = new Dictionary<string, byte[]?>();
            foreach (var path in candidate.Files.Keys.Except(before.Files.Keys))
            {
                var file = ArchiveJson.SafePath(paths.Root, path);
                added[path] = File.Exists(file) ? await File.ReadAllBytesAsync(file, ct) : null;
            }
            await PublicSnapshot.MirrorFilesAsync(paths, candidate.Files, ct);
            try
            {
                if (store.Configured && store is IOptimisticArchiveStore optimistic) await optimistic.ImportIfUnchangedAsync(bundle, reason, expected ?? previous, ct);
                else await store.ImportAsync(bundle, reason, ct);
            }
            catch
            {
                if (await candidate.MatchesLocalAsync(paths, CancellationToken.None))
                {
                    await PublicSnapshot.MirrorFilesAsync(paths, before.Files, CancellationToken.None);
                    // Optional catalogues may introduce paths absent from the preceding manifest.
                    // Restore pre-existing unlisted files and remove only our own unchanged additions.
                    foreach (var (path, previousBytes) in added)
                    {
                        var file = ArchiveJson.SafePath(paths.Root, path);
                        if (!File.Exists(file) || !File.ReadAllBytes(file).AsSpan().SequenceEqual(candidate.Files[path])) continue;
                        if (previousBytes is null) File.Delete(file);
                        else await PublicSnapshot.MirrorFilesAsync(paths, new() { [path] = previousBytes }, CancellationToken.None);
                    }
                }
                throw;
            }
        }
        finally
        {
            // Staging is an owned GUID child, never a path supplied by an upstream payload.
            if (Path.GetDirectoryName(staging.Root) == Path.Combine(paths.Work, "candidates")) Directory.Delete(staging.Root, true);
        }
    }
}
