using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Deadlock.Api.Data;

namespace Deadlock.Api.Sync;

public sealed class PublicSync : IPublicSync
{
    private readonly AppPaths paths;
    private readonly IArchiveStore archive;
    private readonly GitHubPublication github;
    private readonly object mutex = new();
    private JsonObject state;
    private bool working, checking;
    private DateTime checkedAt = DateTime.MinValue, queuedAt = DateTime.MinValue;
    private DateTime lastDispatchAt = DateTime.MinValue;
    private string? lastDispatchCommit, lastDispatchHash;
    private Task<JsonObject>? job;
    public PublicSync(AppPaths paths, IArchiveStore archive, IHttpClientFactory factory)
    {
        this.paths = paths; this.archive = archive; github = new(factory); state = Initial();
        if (!archive.Configured) return;
        try
        {
            var filename = ArchiveJson.SafePath(paths.Root, "work/sync-state.json"); if (new FileInfo(filename).Length > 65536) return; var saved = JsonNode.Parse(File.ReadAllText(filename))!; var commit = saved["commitSha"]?.GetValue<string>() ?? ""; var hash = saved["snapshotHash"]?.GetValue<string>() ?? "";
            if (Regex.IsMatch(commit, "^[a-f0-9]{40}$") && Regex.IsMatch(hash, "^[a-f0-9]{64}$")) { state["commitSha"] = commit; state["snapshotHash"] = hash; state["phase"] = saved["phase"]?.GetValue<string>() is "queued" or "in_progress" ? saved["phase"]!.GetValue<string>() : "idle"; if (saved["queuedAt"] is { } q && long.TryParse(q.ToJsonString(), out var ms)) queuedAt = DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime; }
            var retryCommit = saved["lastDispatchCommit"]?.GetValue<string>() ?? ""; var retryHash = saved["lastDispatchHash"]?.GetValue<string>() ?? "";
            if (Regex.IsMatch(retryCommit, "^[a-f0-9]{40}$") && Regex.IsMatch(retryHash, "^[a-f0-9]{64}$") && saved["lastDispatchAt"] is { } at && long.TryParse(at.ToJsonString(), out var stamp)) { lastDispatchCommit = retryCommit; lastDispatchHash = retryHash; lastDispatchAt = DateTimeOffset.FromUnixTimeMilliseconds(stamp).UtcDateTime; }
        }
        catch {/* Actual remote state is checked before accepting persisted completion. */}
    }
    private JsonObject Initial() => new() { ["available"] = archive.Configured, ["source"] = archive.Configured ? "postgresql" : "json", ["phase"] = "idle", ["localSaved"] = false, ["updatedAt"] = DateTime.UtcNow.ToString("O"), ["message"] = archive.Configured ? "Можно проверить синхронизацию." : "Синхронизация доступна при подключении PostgreSQL." };
    public bool IsBusy { get { lock (mutex) return working || checking || state["phase"]?.GetValue<string>() is "queued" or "in_progress"; } }
    public JsonObject ReadState() { lock (mutex) return state.DeepClone().AsObject(); }
    public async Task<JsonObject> DryRunAsync(CancellationToken ct = default)
    {
        if (!archive.Configured) { var unavailable = ReadState(); unavailable["dryRun"] = true; return unavailable; }
        var snapshot = await PublicSnapshot.CaptureAsync(paths, await archive.ReadBundleAsync(ct), ct); var found = await github.InspectAsync(snapshot, null, ct); var local = await snapshot.MatchesLocalAsync(paths, ct); var same = local && found.RepositoryMatches && found.PagesMatches;
        return new() { ["available"] = true, ["source"] = archive.Configured ? "postgresql" : "json", ["dryRun"] = true, ["snapshotHash"] = snapshot.Hash, ["clientVersion"] = snapshot.ClientVersion, ["localMatches"] = local, ["repositoryMatches"] = found.RepositoryMatches, ["pagesMatches"] = found.PagesMatches, ["repositoryHash"] = found.RepositoryHash, ["pagesHash"] = found.PagesHash, ["commitSha"] = found.CommitSha, ["runId"] = found.RunId, ["url"] = found.Url, ["phase"] = same ? "succeeded" : found.Status is "queued" or "in_progress" ? found.Status : "idle", ["upToDate"] = same };
    }
    private async Task Update(JsonObject patch, CancellationToken ct = default)
    {
        JsonObject copy; lock (mutex) { foreach (var (k, v) in patch) state[k] = v?.DeepClone(); state["updatedAt"] = DateTime.UtcNow.ToString("O"); copy = state.DeepClone().AsObject(); copy["queuedAt"] = queuedAt == DateTime.MinValue ? 0 : new DateTimeOffset(queuedAt).ToUnixTimeMilliseconds(); copy["lastDispatchCommit"] = lastDispatchCommit; copy["lastDispatchHash"] = lastDispatchHash; copy["lastDispatchAt"] = lastDispatchAt == DateTime.MinValue ? 0 : new DateTimeOffset(lastDispatchAt).ToUnixTimeMilliseconds(); }
        var file = ArchiveJson.SafePath(paths.Root, "work/sync-state.json"); Directory.CreateDirectory(Path.GetDirectoryName(file)!); var temp = file + "." + Guid.NewGuid().ToString("N") + ".tmp"; try { await File.WriteAllBytesAsync(temp, ArchiveJson.Bytes(copy), ct); File.Move(temp, file, true); } finally { if (File.Exists(temp)) File.Delete(temp); }
    }
    private async Task<JsonObject> Failed()
    { try { await Update(new() { ["phase"] = "failed", ["upToDate"] = false, ["message"] = "Синхронизация не удалась. Локальные данные сохранены; повторите попытку." }); } catch { lock (mutex) { state["phase"] = "failed"; state["upToDate"] = false; } } return ReadState(); }
    private async Task<JsonObject> Apply(PublicSnapshot snapshot, PublicationInspection found, bool local, bool pending, CancellationToken ct)
    {
        var same = local && found.RepositoryMatches && found.PagesMatches && found.RepositoryHash == snapshot.Hash && found.PagesHash == snapshot.Hash;
        var waiting = pending && DateTime.UtcNow - queuedAt < TimeSpan.FromMinutes(2);
        var phase = same ? "succeeded" : !found.RepositoryMatches && pending ? "failed" : found.RepositoryMatches && found.Status == "in_progress" ? "in_progress" : found.RepositoryMatches && (found.Status == "queued" || waiting) ? "queued" : found.Status == "failure" && found.RepositoryMatches ? "failed" : "idle";
        await Update(new() { ["snapshotHash"] = snapshot.Hash, ["clientVersion"] = snapshot.ClientVersion, ["localMatches"] = local, ["repositoryMatches"] = found.RepositoryMatches, ["pagesMatches"] = found.PagesMatches, ["repositoryHash"] = found.RepositoryHash, ["pagesHash"] = found.PagesHash, ["commitSha"] = found.CommitSha, ["runId"] = found.RunId, ["url"] = found.Url, ["phase"] = phase, ["upToDate"] = same, ["message"] = same ? "Данные архива и GitHub Pages синхронизированы." : phase == "failed" ? "GitHub Pages не подтвердил публикацию. Повторите синхронизацию." : phase == "in_progress" ? "GitHub Pages публикует версию." : phase == "queued" ? "Версия отправлена. Ожидаем публикацию Pages." : "Данные отличаются от опубликованной версии." }, ct); checkedAt = DateTime.UtcNow; return ReadState();
    }
    public async Task<JsonObject> GetStateAsync(bool refresh = false, CancellationToken ct = default)
    {
        if (!archive.Configured) return ReadState();
        lock (mutex) { if (working || checking || !refresh && DateTime.UtcNow - checkedAt < TimeSpan.FromSeconds(5)) return state.DeepClone().AsObject(); checking = true; }
        try { var snapshot = await PublicSnapshot.CaptureAsync(paths, await archive.ReadBundleAsync(ct), ct); var before = ReadState(); var pending = before["snapshotHash"]?.GetValue<string>() == snapshot.Hash && before["phase"]?.GetValue<string>() is "queued" or "in_progress"; var found = await github.InspectAsync(snapshot, pending ? before["commitSha"]?.GetValue<string>() : null, ct); return await Apply(snapshot, found, await snapshot.MatchesLocalAsync(paths, ct), pending, ct); } catch { return await Failed(); } finally { lock (mutex) checking = false; }
    }
    private void Reserve()
    { lock (mutex) { if (!archive.Configured) throw new InvalidOperationException("PostgreSQL is required for public synchronization"); if (working || checking || state["phase"]?.GetValue<string>() is "queued" or "in_progress") throw new InvalidOperationException("Synchronization is already in progress"); working = true; queuedAt = DateTime.MinValue; state = Initial(); state["phase"] = "checking"; state["message"] = "Проверяем данные архива и GitHub Pages."; } }
    public JsonObject Start() { Reserve(); lock (mutex) { job = Task.Run(() => Execute(CancellationToken.None)); return state.DeepClone().AsObject(); } }
    public async Task<JsonObject> PublishAsync(CancellationToken ct = default)
    {
        Reserve(); job = Execute(ct); var done = await job; if (done["phase"]?.GetValue<string>() == "failed") throw new InvalidOperationException("Синхронизация не удалась. Локальные данные сохранены; повторите попытку."); return new() { ["status"] = done["phase"]?.GetValue<string>() == "succeeded" ? "success" : done["phase"]?.GetValue<string>() == "in_progress" ? "in_progress" : "queued", ["url"] = done["url"]?.DeepClone(), ["commitSha"] = done["commitSha"]?.DeepClone(), ["hash"] = done["snapshotHash"]?.DeepClone(), ["runId"] = done["runId"]?.DeepClone() };
    }
    private async Task<JsonObject> Execute(CancellationToken ct)
    {
        try
        {
            await Update(new(), ct); var snapshot = await PublicSnapshot.CaptureAsync(paths, await archive.ReadBundleAsync(ct), ct); await Update(new() { ["snapshotHash"] = snapshot.Hash, ["clientVersion"] = snapshot.ClientVersion }, ct);
            var local = await snapshot.MatchesLocalAsync(paths, ct); var found = await github.InspectAsync(snapshot, null, ct);
            if (local && found.RepositoryMatches && found.PagesMatches) return await Apply(snapshot, found, true, false, ct);
            if (!local) { await Update(new() { ["phase"] = "saving", ["message"] = "Сохраняем данные архива." }, ct); await PublicSnapshot.MirrorFilesAsync(paths, snapshot.Files.Where(f => f.Key.StartsWith("data/")).ToDictionary(), ct); await Update(new() { ["localSaved"] = true, ["localMatches"] = true }, ct); }
            if (found.RepositoryMatches && found.PagesMatches) return await Apply(snapshot, found, true, false, ct);
            await Update(new() { ["phase"] = "publishing", ["message"] = "Отправляем данные в GitHub." }, ct);
            // Persist the dispatch guard before request acceptance, so retries survive a lost response/restart.
            queuedAt = DateTime.UtcNow; await Update(new() { ["phase"] = "queued", ["commitSha"] = found.CommitSha }, ct);
            PublicationResult sent;
            if (!found.RepositoryMatches) sent = await github.PublishAsync(snapshot, ct);
            else if (found.Status is "queued" or "in_progress" || lastDispatchCommit == found.CommitSha && lastDispatchHash == snapshot.Hash && DateTime.UtcNow - lastDispatchAt < TimeSpan.FromMinutes(2)) sent = new(found.CommitSha, found.Url, found.RunId);
            else { lastDispatchCommit = found.CommitSha; lastDispatchHash = snapshot.Hash; lastDispatchAt = DateTime.UtcNow; await Update(new(), ct); sent = await github.RetryAsync(found.CommitSha, snapshot.Hash, ct); }
            await Update(new() { ["phase"] = "queued", ["commitSha"] = sent.CommitSha, ["url"] = sent.Url, ["runId"] = sent.RunId, ["message"] = "Версия отправлена. Ожидаем публикацию Pages." }, ct);
            return await Apply(snapshot, await github.InspectAsync(snapshot, sent.CommitSha, ct), true, true, ct);
        }
        catch { return await Failed(); }
        finally { lock (mutex) working = false; }
    }
}
