using System.Text.Json.Nodes;
using Deadlock.Api;
using Deadlock.Api.Data;
using Deadlock.Api.Sync;
using Deadlock.Api.Updates;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Deadlock.Tests;

public sealed class UpdateLifecycleTests
{
    sealed class Store(JsonObject bundle) : IArchiveStore
    {
        public JsonObject Bundle = bundle;
        public bool Configured => true;
        public bool FailImport;
        public Task InitializeAsync(CancellationToken ct = default) => Task.CompletedTask;
        public Task<JsonObject> ReadBundleAsync(CancellationToken ct = default) => Task.FromResult(Bundle.DeepClone().AsObject());
        public Task ImportAsync(JsonObject next, string reason, CancellationToken ct = default) { if (FailImport) throw new IOException("Simulated failed transaction"); Bundle = next.DeepClone().AsObject(); return Task.CompletedTask; }
        public Task<JsonObject> StatusAsync(CancellationToken ct = default) => Task.FromResult(new JsonObject());
    }
    sealed class Refresh(int version) : IArchiveRefresh
    {
        public int Checks, Builds;
        public Action? BeforeReturn;
        public Task<GameVersion> LatestAsync(CancellationToken ct = default) { Checks++; return Task.FromResult(new GameVersion(version, 1, "2026-10-31")); }
        public Task<RefreshCandidate> BuildAsync(JsonObject current, GameVersion expected, CancellationToken ct = default)
        {
            Builds++; var next = current.DeepClone().AsObject();
            next["heroes"]!["meta"]!["clientVersion"] = version;
            next["items"]!["meta"]!["clientVersion"] = version;
            next["itemStatistics"]!["meta"]!["clientVersion"] = version;
            if (next["abilities"] != null) next["abilities"]!["meta"]!["clientVersion"] = version;
            BeforeReturn?.Invoke();
            return Task.FromResult(new RefreshCandidate(next, [], new(), next["heroes"]!["meta"]!["gameCommit"]!.GetValue<string>()));
        }
    }
    sealed class History : IPatchHistoryService, IPatchHistoryProgress
    {
        public int Calls;
        public int Batches = 1;
        public bool HasPending => Calls < Batches;
        public bool LastCheckFailed => false;
        public Task<JsonObject> EnrichAsync(JsonObject history, int currentVersion, CancellationToken ct = default) { Calls++; return Task.FromResult(history.DeepClone().AsObject()); }
    }
    sealed class Sync : IPublicSync
    {
        public bool IsBusy { get; set; }
        public int Publications, Reconciles;
        public JsonObject ReadState() => new() { ["phase"] = IsBusy ? "queued" : "succeeded" };
        public Task<JsonObject> GetStateAsync(bool refresh = false, CancellationToken ct = default) { Reconciles++; IsBusy = false; return Task.FromResult(ReadState()); }
        public JsonObject Start() => throw new NotSupportedException();
        public Task<JsonObject> PublishAsync(CancellationToken ct = default) { Publications++; return Task.FromResult(new JsonObject { ["status"] = "success", ["hash"] = new string('a', 64), ["url"] = "https://github.com/Roman17-bot/deadlock-archive/actions" }); }
    }
    sealed class Lifetime : IHostApplicationLifetime
    {
        public CancellationToken ApplicationStarted => new(true);
        public CancellationToken ApplicationStopping => CancellationToken.None;
        public CancellationToken ApplicationStopped => CancellationToken.None;
        public void StopApplication() { }
    }
    sealed class Workspace : IAsyncDisposable
    {
        public AppPaths Paths = new(Path.Combine(Path.GetTempPath(), "deadlock-lifecycle-" + Guid.NewGuid().ToString("N")));
        public Store Store = null!;
        public int Version => (int)ArchiveJson.Number(Store.Bundle["heroes"]!["meta"]!["clientVersion"]);
        public static async Task<Workspace> Create()
        {
            var w = new Workspace(); Directory.CreateDirectory(w.Paths.Root);
            var original = new AppPaths(AppEnvironment.ResolveRoot([]));
            var bundle = await ArchiveJson.ReadFilesAsync(original, CancellationToken.None);
            w.Store = new(bundle);
            var snapshot = await PublicSnapshot.CaptureAsync(original, bundle);
            await PublicSnapshot.MirrorFilesAsync(w.Paths, snapshot.Files);
            return w;
        }
        public UpdateCoordinator Coordinator(Refresh refresh, History history, Sync sync) => new(Store, refresh, history, sync, new(Paths, Store), Paths, NullLogger<UpdateCoordinator>.Instance);
        public ValueTask DisposeAsync()
        {
            if (Path.GetDirectoryName(Paths.Root) != Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) || !Path.GetFileName(Paths.Root).StartsWith("deadlock-lifecycle-")) throw new InvalidOperationException("Unexpected test path");
            Directory.Delete(Paths.Root, true); return ValueTask.CompletedTask;
        }
    }
    [Fact]
    public async Task FailedCatalogueEnrichmentRemovesOnlyNewCandidateFiles()
    {
        await using var w = await Workspace.Create();
        w.Store.Bundle.Remove("abilities");
        var abilitiesFile = Path.Combine(w.Paths.Data, "abilities.json");
        if (File.Exists(abilitiesFile)) File.Delete(abilitiesFile);
        var before = await PublicSnapshot.CaptureAsync(w.Paths, w.Store.Bundle);
        var candidate = w.Store.Bundle.DeepClone().AsObject(); candidate["abilities"] = AbilityTests.CatalogFixture(candidate["heroes"]!.AsObject());
        var assets = Deadlock.Api.Ingestion.AbilityAdapter.All(candidate["abilities"]!.AsObject()).ToDictionary(a => "public/" + ArchiveJson.Text(a["icon"]), _ => "RIFF0000WEBP"u8.ToArray());
        w.Store.FailImport = true;
        await Assert.ThrowsAsync<IOException>(() => new BundlePersistence(w.Paths,w.Store).SaveAsync(candidate,assets,"failed-enrichment",default));
        Assert.False(File.Exists(abilitiesFile));
        Assert.Equal(before.Hash,(await PublicSnapshot.CaptureAsync(w.Paths,w.Store.Bundle)).Hash);
    }
    [Fact]
    public async Task VersionAdvanceMaterializesCompanionsAndReportsActualPublicationHash()
    {
        await using var w = await Workspace.Create(); var version = w.Version + 1;
        var history = new History(); var sync = new Sync();
        await using var coordinator = w.Coordinator(new(version), history, sync);
        await coordinator.InitializeAsync(default); coordinator.Start(true); await coordinator.WaitAsync();
        var state = coordinator.ReadState();
        Assert.Equal("succeeded", state["phase"]!.GetValue<string>());
        Assert.Equal(version, state["clientVersion"]!.GetValue<int>());
        Assert.True(state["databaseSaved"]!.GetValue<bool>());
        Assert.Equal("success", state["publication"]!["status"]!.GetValue<string>());
        Assert.Equal(new string('a', 64), state["publication"]!["hash"]!.GetValue<string>());
        Assert.Equal(1, sync.Publications);
        Assert.True(JsonNode.DeepEquals(w.Store.Bundle["heroes"]!["meta"], w.Store.Bundle["provenance"]!["meta"]));
        Assert.Contains(w.Store.Bundle["history"]!["versions"]!.AsArray(), e => ArchiveJson.Number(e!["clientVersion"]) == version);
        ArchiveJson.Validate(w.Store.Bundle);
    }
    [Fact]
    public async Task OwnerEditDuringNetworkRefreshIsPreservedAndCandidateRejected()
    {
        await using var w = await Workspace.Create(); var version = w.Version;
        var refresh = new Refresh(version + 1) { BeforeReturn = () => w.Store.Bundle["mechanics"]!["ru"]!["formulas"]![0]!["explanation"]!.AsArray().Add("Owner edit") };
        await using var coordinator = w.Coordinator(refresh, new(), new());
        await coordinator.InitializeAsync(default); coordinator.Start(false); await coordinator.WaitAsync();
        Assert.Equal("failed", coordinator.ReadState()["phase"]!.GetValue<string>());
        Assert.False(coordinator.ReadState()["localSaved"]!.GetValue<bool>());
        Assert.Equal("Owner edit", w.Store.Bundle["mechanics"]!["ru"]!["formulas"]![0]!["explanation"]!.AsArray().Last()!.GetValue<string>());
        var files = await ArchiveJson.ReadFilesAsync(w.Paths, default);
        Assert.Equal(version, ArchiveJson.Number(files["heroes"]!["meta"]!["clientVersion"]));
    }
    [Fact]
    public async Task FailedDatabaseImportRestoresPreviousPublicFiles()
    {
        await using var w = await Workspace.Create(); var version = w.Version; w.Store.FailImport = true;
        await using var coordinator = w.Coordinator(new(version + 1), new(), new());
        await coordinator.InitializeAsync(default); coordinator.Start(false); await coordinator.WaitAsync();
        Assert.Equal("failed", coordinator.ReadState()["phase"]!.GetValue<string>());
        var files = await ArchiveJson.ReadFilesAsync(w.Paths, default);
        Assert.Equal(version, ArchiveJson.Number(files["heroes"]!["meta"]!["clientVersion"]));
    }
    [Fact]
    public async Task ExplicitItemRefreshFetchesStatisticsWithinTheSameClient()
    {
        await using var w = await Workspace.Create(); var refresh = new Refresh(w.Version);
        await using var coordinator = w.Coordinator(refresh, new(), new());
        using var services = new ServiceCollection().AddSingleton(w.Paths).AddSingleton<IArchiveStore>(w.Store).AddSingleton(coordinator).BuildServiceProvider();
        Assert.Equal(0, await ArchiveCommands.RunAsync("items:refresh", ["items:refresh"], services));
        Assert.Equal(1, refresh.Builds);
    }
    [Fact]
    public async Task ExpectedClientMismatchRejectsTheUpdateWithoutSavingOrPublishing()
    {
        await using var w = await Workspace.Create(); var refresh = new Refresh(w.Version + 1); var sync = new Sync();
        await using var coordinator = w.Coordinator(refresh, new(), sync);
        using var services = new ServiceCollection().AddSingleton(w.Paths).AddSingleton<IArchiveStore>(w.Store).AddSingleton<IArchiveRefresh>(refresh).AddSingleton(coordinator).BuildServiceProvider();
        await Assert.ThrowsAsync<InvalidDataException>(() => ArchiveCommands.RunAsync("update", ["update", "--expected-version", w.Version.ToString()], services));
        Assert.Equal(0, refresh.Builds); Assert.Equal(0, sync.Publications);
        Assert.Equal(w.Version, ArchiveJson.Number((await ArchiveJson.ReadFilesAsync(w.Paths, default))["heroes"]!["meta"]!["clientVersion"]));
    }
    [Fact]
    public async Task StartupReconcilesRestoredPublicationThenBackfillsAllBatchesWithoutAssets()
    {
        await using var w = await Workspace.Create(); var refresh = new Refresh(w.Version); var history = new History { Batches = 4 }; var sync = new Sync { IsBusy = true };
        await using var coordinator = w.Coordinator(refresh, history, sync); await coordinator.InitializeAsync(default);
        using var service = new StartupRefresh(coordinator, w.Store, sync, new Lifetime(), NullLogger<StartupRefresh>.Instance);
        await service.StartAsync(default); await service.ExecuteTask!.WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Equal(1, sync.Reconciles); Assert.Equal(1, refresh.Checks); Assert.Equal(0, refresh.Builds); Assert.Equal(4, history.Calls);
        Assert.Equal("succeeded", coordinator.ReadState()["phase"]!.GetValue<string>());
    }
}
