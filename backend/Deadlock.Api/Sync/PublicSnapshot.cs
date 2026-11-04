using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Deadlock.Api.Data;

namespace Deadlock.Api.Sync;

public sealed record PublicSnapshot(JsonObject Manifest, Dictionary<string, byte[]> Files)
{
    public const string ManifestPath = "data/snapshot-manifest.json";
    public const int MaxFileBytes = 4 * 1024 * 1024, MaxTotalBytes = 32 * 1024 * 1024, MaxFiles = 512;
    public string Hash => ArchiveJson.Text(Manifest["hash"]);
    public int ClientVersion => (int)ArchiveJson.Number(Manifest["clientVersion"]);
    public static bool Approved(string path) => (path.StartsWith("public/", StringComparison.Ordinal) && Ingestion.ReferenceMedia.Local(path[7..])) || ArchiveJson.Files.Keys.Any(k => path == "data/" + k) || Regex.IsMatch(path, @"^public/assets/heroes/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:webp|png|jpe?g|avif)$") || Regex.IsMatch(path, @"^public/assets/(?:items|abilities)/[A-Za-z0-9][A-Za-z0-9._-]*\.webp$");
    public static JsonObject ParseManifest(JsonNode? node)
    {
        var m = node?.AsObject() ?? throw new InvalidDataException("Invalid manifest"); var files = m["files"]?.AsObject() ?? throw new InvalidDataException("Invalid manifest files");
        if (ArchiveJson.Number(m["schemaVersion"]) != 1 || ArchiveJson.Number(m["clientVersion"]) < 1 || ArchiveJson.Number(m["reviewedClientVersion"]) < 1 || ArchiveJson.Number(m["reviewedClientVersion"]) > ArchiveJson.Number(m["clientVersion"]) || files.Count < 5 || files.Count >= MaxFiles || files.Any(f => !Approved(f.Key) || !Regex.IsMatch(ArchiveJson.Text(f.Value), "^[a-f0-9]{64}$")) || ArchiveJson.Text(m["hash"]) != ArchiveJson.Hash(ArchiveJson.Bytes(files))) throw new InvalidDataException("Invalid manifest integrity");
        foreach (var p in new[] { "heroes.json", "mechanics.json", "mechanics.en.json", "provenance.json", "version-history.json" }) if (!files.ContainsKey("data/" + p)) throw new InvalidDataException("Incomplete manifest");
        if (files.ContainsKey("data/items.json") != files.ContainsKey("data/item-statistics.json")) throw new InvalidDataException("Unpaired items"); return m;
    }
    public static async Task<PublicSnapshot> CaptureAsync(AppPaths paths, JsonObject bundle, CancellationToken ct = default)
    {
        ArchiveJson.Validate(bundle); var files = new Dictionary<string, byte[]>();
        foreach (var (name, keys) in ArchiveJson.Files) if (ArchiveJson.At(bundle, keys) is { } value) files.Add("data/" + name, ArchiveJson.Bytes(value));
        var assets = bundle["heroes"]!["heroes"]!.AsArray().Select(h => "public/" + ArchiveJson.Text(h!["portrait"])).Concat(bundle["items"]?["items"]?.AsArray().Select(i => "public/" + ArchiveJson.Text(i!["icon"])) ?? []).Concat(bundle["abilities"] is JsonObject abilities ? Ingestion.AbilityAdapter.All(abilities).Select(a => "public/" + ArchiveJson.Text(a["icon"])) : []).Concat(Ingestion.ReferenceMedia.Paths(bundle)).Distinct().Order(StringComparer.Ordinal);
        foreach (var p in assets) { if (!Approved(p)) throw new InvalidDataException("Unapproved asset"); var file = ArchiveJson.SafePath(paths.Root, p); if (new FileInfo(file).Length > MaxFileBytes) throw new InvalidDataException("Asset too large"); files.Add(p, await File.ReadAllBytesAsync(file, ct)); CheckLimits(files); }
        CheckLimits(files); var hashes = new JsonObject(); foreach (var (p, v) in files.OrderBy(x => x.Key, StringComparer.Ordinal)) hashes[p] = ArchiveJson.Hash(v);
        var manifest = new JsonObject { ["schemaVersion"] = 1, ["clientVersion"] = bundle["heroes"]!["meta"]!["clientVersion"]!.DeepClone(), ["reviewedClientVersion"] = bundle["mechanics"]!["ru"]!["meta"]!["reviewedClientVersion"]!.DeepClone(), ["hash"] = ArchiveJson.Hash(ArchiveJson.Bytes(hashes)), ["files"] = hashes };
        ParseManifest(manifest); files.Add(ManifestPath, ArchiveJson.Bytes(manifest)); CheckLimits(files); return new(manifest, files);
    }
    public static void CheckLimits(Dictionary<string, byte[]> files)
    { if (files.Count > MaxFiles || files.Any(f => f.Key != ManifestPath && !Approved(f.Key) || f.Value.Length > MaxFileBytes) || files.Sum(f => (long)f.Value.Length) > MaxTotalBytes) throw new InvalidDataException("Snapshot exceeds approved limits"); }
    public async Task<bool> MatchesLocalAsync(AppPaths paths, CancellationToken ct = default)
    { foreach (var (p, b) in Files.Where(f => f.Key.StartsWith("data/"))) { var file = ArchiveJson.SafePath(paths.Root, p); if (!File.Exists(file)) return false; var local = await File.ReadAllBytesAsync(file, ct); if (!b.AsSpan().SequenceEqual(local)) return false; } return true; }
    public static async Task MirrorFilesAsync(AppPaths paths, Dictionary<string, byte[]> files, CancellationToken ct = default)
    {
        CheckLimits(files); var changes = new List<(string Path, byte[] Next, byte[]? Before, string Temp)>(); var replaced = new List<(string Path, byte[] Next, byte[]? Before, string Temp)>(); var id = Guid.NewGuid().ToString("N");
        foreach (var (p, b) in files) { var target = ArchiveJson.SafePath(paths.Root, p); var before = File.Exists(target) ? await File.ReadAllBytesAsync(target, ct) : null; if (before != null && before.AsSpan().SequenceEqual(b)) continue; changes.Add((p, b, before, target + "." + id + ".tmp")); }
        try
        {
            foreach (var x in changes) { var target = ArchiveJson.SafePath(paths.Root, x.Path); if (x.Before != null) { var backup = ArchiveJson.SafePath(paths.Root, "work/backups/sync/" + id + "/" + x.Path); Directory.CreateDirectory(Path.GetDirectoryName(backup)!); await File.WriteAllBytesAsync(backup, x.Before, ct); } Directory.CreateDirectory(Path.GetDirectoryName(target)!); await using var s = new FileStream(x.Temp, FileMode.CreateNew, FileAccess.Write, FileShare.None); await s.WriteAsync(x.Next, ct); }
            foreach (var x in changes) { var target = ArchiveJson.SafePath(paths.Root, x.Path); var now = File.Exists(target) ? await File.ReadAllBytesAsync(target, ct) : null; if ((now == null) != (x.Before == null) || now != null && !now.AsSpan().SequenceEqual(x.Before)) throw new IOException("Local curated file changed during save"); File.Move(x.Temp, target, true); replaced.Add(x); }
        }
        catch (Exception original)
        {
            var failures = new List<Exception> { original }; foreach (var x in replaced.AsEnumerable().Reverse()) try { var target = ArchiveJson.SafePath(paths.Root, x.Path); if (!File.ReadAllBytes(target).AsSpan().SequenceEqual(x.Next)) throw new IOException("File changed before rollback"); if (x.Before == null) File.Delete(target); else { await File.WriteAllBytesAsync(x.Temp, x.Before, CancellationToken.None); File.Move(x.Temp, target, true); } } catch (Exception e) { failures.Add(e); }
            if (failures.Count > 1) throw new AggregateException("Restore backup work/backups/sync/" + id, failures); throw;
        }
        finally { foreach (var x in changes) if (File.Exists(x.Temp)) File.Delete(x.Temp); }
    }
}
