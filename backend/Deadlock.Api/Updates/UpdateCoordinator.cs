using System.Security.Cryptography;
using System.Text.Json.Nodes;
using Deadlock.Api.Data;

namespace Deadlock.Api.Updates;

public sealed class UpdateCoordinator : IAsyncDisposable
{
    readonly object gate = new();
    readonly IArchiveStore store;
    readonly IArchiveRefresh refresh;
    readonly IPatchHistoryService patches;
    readonly IPublicSync sync;
    readonly BundlePersistence persistence;
    readonly AppPaths paths;
    readonly ILogger<UpdateCoordinator> logger;
    readonly CancellationTokenSource shutdown = new();
    JsonObject state;
    Task? job;
    bool running;
    public string SessionToken { get; } = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(32));
    public bool IsBusy { get { lock (gate) return running; } }
    public UpdateCoordinator(IArchiveStore store, IArchiveRefresh refresh, IPatchHistoryService patches, IPublicSync sync, BundlePersistence persistence, AppPaths paths, ILogger<UpdateCoordinator> logger)
    {
        this.store = store; this.refresh = refresh; this.patches = patches; this.sync = sync; this.persistence = persistence; this.paths = paths; this.logger = logger;
        state = new() { ["phase"] = "idle", ["clientVersion"] = 0, ["localSaved"] = false, ["changed"] = false, ["message"] = "Готово к проверке обновлений.", ["updatedAt"] = Now() };
    }
    public JsonObject ReadState() { lock (gate) return (JsonObject)state.DeepClone(); }
    static string Now() => DateTimeOffset.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
    void Set(JsonObject patch)
    {
        lock (gate) { foreach (var field in patch) state[field.Key] = field.Value?.DeepClone(); state["updatedAt"] = Now(); }
    }
    public async Task InitializeAsync(CancellationToken ct)
    {
        var current = await store.ReadBundleAsync(ct);
        Set(new() { ["clientVersion"] = current["heroes"]!["meta"]!["clientVersion"]!.DeepClone() });
    }
    public JsonObject Start(bool publish, bool refreshItems = false, int? expectedVersion = null)
    {
        lock (gate)
        {
            if (running || sync.IsBusy) throw new UpdateBusyException();
            running = true;
            state = new() { ["phase"] = "checking", ["clientVersion"] = state["clientVersion"]?.DeepClone(), ["localSaved"] = false, ["changed"] = false, ["message"] = "Проверяем обновления игры и историю патчей…", ["updatedAt"] = Now(), ["jobId"] = Guid.NewGuid().ToString("N") };
            job = Task.Run(() => ExecuteAsync(publish, refreshItems, expectedVersion, shutdown.Token));
            return (JsonObject)state.DeepClone();
        }
    }
    public JsonObject StartSync()
    {
        lock (gate) { if (running || sync.IsBusy) throw new UpdateBusyException(); return sync.Start(); }
    }
    public async Task WaitAsync(CancellationToken ct = default) { Task? pending; lock (gate) pending = job; if (pending is not null) await pending.WaitAsync(ct); }
    async Task ExecuteAsync(bool publish, bool refreshItems, int? expectedVersion, CancellationToken ct)
    {
        try
        {
            Directory.CreateDirectory(paths.Work);
            using var lease = new FileStream(Path.Combine(paths.Work, "update.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
            var current = await store.ReadBundleAsync(ct);
            var version = (int)ArchiveJson.Number(current["heroes"]!["meta"]!["clientVersion"]);
            var latest = await refresh.LatestAsync(ct);
            if (expectedVersion is not null && latest.Version != expectedVersion) throw new InvalidDataException("Latest client does not match the expected version");
            if (latest.Version < version) throw new InvalidDataException("Refusing downgrade");
            JsonObject next = (JsonObject)current.DeepClone();
            Dictionary<string, byte[]> assets = [];
            if (latest.Version > version || refreshItems)
            {
                var candidate = await refresh.BuildAsync(current, latest, ct);
                next = RefreshMaterializer.Complete(candidate); assets = candidate.Assets;
                if (ArchiveJson.Number(next["heroes"]!["meta"]!["clientVersion"]) != latest.Version) throw new InvalidDataException("Refresh version mismatch");
            }
            var historyWarning = false;
            try { var backfill = await RefreshMaterializer.BackfillAsync(patches, next["history"]!.AsObject(), latest.Version, ct); next["history"] = backfill.History; historyWarning = backfill.Incomplete; }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch { historyWarning = true; logger.LogWarning("Patch history could not be refreshed; saved history retained."); }
            var changed = !JsonNode.DeepEquals(current, next);
            if (!changed)
            {
                Set(new() { ["phase"] = "succeeded", ["upToDate"] = true, ["historySaved"] = !historyWarning, ["message"] = historyWarning ? "Данные актуальны. Историю патчей проверить не удалось; сохранённая история доступна." : "Текущая версия актуальна." });
                return;
            }
            Set(new() { ["phase"] = "saving", ["message"] = "Сохраняем характеристики и историю патчей…" });
            await persistence.SaveAsync(next, assets, "game-update", ct, current);
            Set(new() { ["localSaved"] = true, ["databaseSaved"] = true, ["changed"] = true, ["historySaved"] = !historyWarning, ["clientVersion"] = latest.Version });
            await SaveOutcomeAsync(ct);
            await RefreshKnowledgeAsync(ct);
            if (publish && store.Configured)
            {
                Set(new() { ["phase"] = "publishing", ["message"] = "Данные сохранены. Публикуем изменения…" });
                var result = await sync.PublishAsync(ct);
                Set(new() { ["publication"] = result.DeepClone() });
                if (result["status"]?.GetValue<string>() is "failure" or "unknown") throw new IOException("Publication not confirmed");
            }
            Set(new() { ["phase"] = "succeeded", ["message"] = historyWarning ? "Данные обновлены. История патчей сохранена частично; следующая проверка продолжит загрузку." : "Данные и история патчей обновлены." });
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        { Set(new() { ["phase"] = "failed", ["error"] = "Проверка остановлена. Сохранённые данные доступны.", ["message"] = "Проверка остановлена." }); }
        catch
        {
            var saved = ReadState()["localSaved"]?.GetValue<bool>() == true;
            var message = saved ? "Данные сохранены, но публикация не подтверждена. Повторите синхронизацию с Pages." : "Обновление не удалось. Сохранённые данные доступны; можно повторить проверку.";
            Set(new() { ["phase"] = "failed", ["error"] = message, ["message"] = message });
            logger.LogWarning("Archive update failed; existing archive retained.");
        }
        finally { lock (gate) running = false; await SaveOutcomeAsync(CancellationToken.None); }
    }
    async Task SaveOutcomeAsync(CancellationToken ct)
    {
        try { Directory.CreateDirectory(paths.Work); var path = Path.Combine(paths.Work, "update-state.json"); var tmp = path + ".tmp"; await File.WriteAllBytesAsync(tmp, ArchiveJson.Bytes(ReadState()), ct); File.Move(tmp, path, true); }
        catch { logger.LogWarning("Update outcome could not be saved."); }
    }
    async Task RefreshKnowledgeAsync(CancellationToken ct)
    {
        if (!File.Exists(Path.Combine(paths.Root, "knowledge", "archive.sqlite"))) return;
        try
        {
            var info = new System.Diagnostics.ProcessStartInfo("node") { WorkingDirectory = paths.Root, UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
            info.ArgumentList.Add("scripts/knowledge/cli.mjs"); info.ArgumentList.Add("import");
            using var process = System.Diagnostics.Process.Start(info)!;
            var output = process.StandardOutput.ReadToEndAsync(ct); var error = process.StandardError.ReadToEndAsync(ct);
            await process.WaitForExitAsync(ct); await Task.WhenAll(output, error);
            if (process.ExitCode != 0) throw new IOException();
        }
        catch { logger.LogWarning("Private knowledge index not refreshed; public data save is unaffected."); }
    }
    public async ValueTask DisposeAsync() { shutdown.Cancel(); try { await WaitAsync(); } catch { } shutdown.Dispose(); }
}
public sealed class UpdateBusyException : Exception;

public sealed class StartupRefresh(UpdateCoordinator updates, IArchiveStore store, IPublicSync sync, IHostApplicationLifetime lifetime, ILogger<StartupRefresh> logger, ReferenceUpdateService? references = null) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var ready = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        using var registration = lifetime.ApplicationStarted.Register(() => ready.TrySetResult());
        await ready.Task.WaitAsync(stoppingToken);
        if (Environment.GetEnvironmentVariable("DEADLOCK_AUTO_UPDATE") == "0") return;
        try
        {
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            deadline.CancelAfter(TimeSpan.FromMinutes(10));
            while (sync.IsBusy)
            {
                await sync.GetStateAsync(true, deadline.Token);
                if (sync.IsBusy) await Task.Delay(3000, deadline.Token);
            }
            updates.Start(store.Configured && Environment.GetEnvironmentVariable("DEADLOCK_AUTO_PUBLISH") != "0");
            await updates.WaitAsync(stoppingToken);
            if (references != null && Environment.GetEnvironmentVariable("DEADLOCK_AUTO_STATISTICS") != "0")
            {
                var statistics = await references.StatisticsAsync(false, false, stoppingToken);
                if (statistics["saved"]?.GetValue<bool>() == true && store.Configured && Environment.GetEnvironmentVariable("DEADLOCK_AUTO_PUBLISH") != "0") await sync.PublishAsync(stoppingToken);
            }
        }
        catch (UpdateBusyException) { }
        catch (OperationCanceledException) { }
        catch { logger.LogWarning("Automatic update check could not start; saved archive is available."); }
    }
}
