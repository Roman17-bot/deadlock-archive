using System.Text.Json.Nodes;

namespace Deadlock.Api;

public sealed record AppPaths(string Root)
{
    public string Data => Path.Combine(Root, "data");
    public string Work => Path.Combine(Root, "work");
    public string Public => Path.Combine(Root, "public");
}

public interface IArchiveStore
{
    bool Configured { get; }
    Task InitializeAsync(CancellationToken ct = default);
    Task<JsonObject> ReadBundleAsync(CancellationToken ct = default);
    Task ImportAsync(JsonObject bundle, string reason, CancellationToken ct = default);
    Task<JsonObject> StatusAsync(CancellationToken ct = default);
}

public sealed record GameVersion(int Version, long Revision, string BuildDate);
public interface IOptimisticArchiveStore : IArchiveStore
{
    Task ImportIfUnchangedAsync(JsonObject bundle, string reason, JsonObject expected, CancellationToken ct = default);
}
public sealed record RefreshCandidate(JsonObject Bundle, Dictionary<string, byte[]> Assets, JsonObject Summary, string SourceCommit);

public interface IArchiveRefresh
{
    Task<GameVersion> LatestAsync(CancellationToken ct = default);
    Task<RefreshCandidate> BuildAsync(JsonObject current, GameVersion expected, CancellationToken ct = default);
}

public interface IPatchHistoryService
{
    Task<JsonObject> EnrichAsync(JsonObject history, int currentVersion, CancellationToken ct = default);
}

public interface IPatchHistoryProgress
{
    bool HasPending { get; }
    bool LastCheckFailed { get; }
}

public interface IPublicSync
{
    bool IsBusy { get; }
    JsonObject ReadState();
    Task<JsonObject> GetStateAsync(bool refresh = false, CancellationToken ct = default);
    JsonObject Start();
    Task<JsonObject> PublishAsync(CancellationToken ct = default);
}
