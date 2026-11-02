using System.Text.Json.Nodes;
using Deadlock.Api.Data;

namespace Deadlock.Api.Updates;

public static class RefreshMaterializer
{
    public static JsonObject Complete(RefreshCandidate candidate)
    {
        var bundle = (JsonObject)candidate.Bundle.DeepClone();
        var meta = bundle["heroes"]!["meta"]!;
        var version = ArchiveJson.Number(meta["clientVersion"]);
        var provenance = bundle["provenance"]!.AsObject();
        provenance["meta"] = meta.DeepClone();
        if (provenance["verification"] is JsonObject verification)
        {
            verification["clientVersion"] = version;
            verification["sourceCommit"] = candidate.SourceCommit;
            verification["heroCount"] = bundle["heroes"]!["heroes"]!.AsArray().Count;
            verification["checkedAt"] = meta["checkedAt"]!.DeepClone();
        }
        var history = bundle["history"]!.AsObject();
        var entries = history["versions"]!.AsArray();
        if (entries.Any(v => ArchiveJson.Number(v!["clientVersion"]) > version)) throw new InvalidDataException("History downgrade refused");
        var entry = entries.FirstOrDefault(v => ArchiveJson.Number(v!["clientVersion"]) == version);
        if (entry is not null)
        {
            if (!JsonNode.DeepEquals(entry["buildDate"], meta["buildDate"])) throw new InvalidDataException("History build date conflict");
        }
        else
        {
            var now = DateTimeOffset.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
            entries.Insert(0, new JsonObject
            {
                ["clientVersion"] = version,
                ["buildDate"] = meta["buildDate"]!.DeepClone(),
                ["firstPublishedAt"] = now,
                ["provenance"] = new JsonObject { ["kind"] = "snapshot-save", ["reference"] = now },
                ["patch"] = new JsonObject { ["source"] = "game-tracking", ["url"] = $"https://github.com/SteamTracking/GameTracking-Deadlock/commit/{candidate.SourceCommit}", ["gameCommit"] = candidate.SourceCommit, ["notes"] = "unknown", ["checkedAt"] = now }
            });
        }
        ArchiveJson.Validate(bundle);
        return bundle;
    }

    public static async Task<(JsonObject History, bool Incomplete)> BackfillAsync(IPatchHistoryService service, JsonObject history, int version, CancellationToken ct)
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct);
        deadline.CancelAfter(TimeSpan.FromMinutes(5));
        var latest = (JsonObject)history.DeepClone();
        try
        {
            do
            {
                latest = await service.EnrichAsync(latest, version, deadline.Token);
                if (service is not IPatchHistoryProgress progress) return (latest, false);
                if (progress.LastCheckFailed) return (latest, true);
                if (!progress.HasPending) return (latest, false);
            } while (!deadline.IsCancellationRequested);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch { return (latest, true); }
        return (latest, true);
    }
}
