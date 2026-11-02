using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Deadlock.Api;
using Deadlock.Api.Data;
using Deadlock.Api.Sync;
using Npgsql;
using Microsoft.Extensions.DependencyInjection;

namespace Deadlock.Tests;

public sealed class DataSyncTests
{
    private static string Root
    { get { for (var d = new DirectoryInfo(AppContext.BaseDirectory); d != null; d = d.Parent) if (File.Exists(Path.Combine(d.FullName, "data", "heroes.json"))) return d.FullName; throw new InvalidOperationException("Repository missing"); } }
    private sealed class Workspace : IDisposable
    {
        public AppPaths Paths { get; } = new(Path.Combine(Path.GetTempPath(), "deadlock-csharp-test-" + Guid.NewGuid().ToString("N")));
        public Workspace() { Directory.CreateDirectory(Paths.Data); Directory.CreateDirectory(Path.Combine(Paths.Root, "db", "migrations")); foreach (var file in ArchiveJson.Files.Keys) if (File.Exists(Path.Combine(Root, "data", file))) File.Copy(Path.Combine(Root, "data", file), Path.Combine(Paths.Data, file)); foreach (var file in Directory.GetFiles(Path.Combine(Root, "db", "migrations"), "*.sql")) File.Copy(file, Path.Combine(Paths.Root, "db", "migrations", Path.GetFileName(file))); }
        public async Task<JsonObject> Bundle() { var b = await ArchiveJson.ReadFilesAsync(Paths, default); var assets = b["heroes"]!["heroes"]!.AsArray().Select(h => ArchiveJson.Text(h!["portrait"])).Concat(b["items"]?["items"]?.AsArray().Select(i => ArchiveJson.Text(i!["icon"])) ?? []); foreach (var p in assets.Distinct()) { var filename = ArchiveJson.SafePath(Paths.Root, "public/" + p); Directory.CreateDirectory(Path.GetDirectoryName(filename)!); await File.WriteAllBytesAsync(filename, [1, 2, 3, 4]); } return b; }
        public void Dispose() { var p = Path.GetFullPath(Paths.Root); if (!p.StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase) || !Path.GetFileName(p).StartsWith("deadlock-csharp-test-")) throw new InvalidOperationException("Unsafe test cleanup"); Directory.Delete(p, true); }
    }
    [Fact]
    public void CanonicalMatchesJavaScriptFormatting()
    {
        var input = JsonNode.Parse("{\"z\":1e-6,\"a\":\"Текст \\u2028 <>&\",\"nested\":{\"y\":1.0,\"x\":1e21},\"tiny\":1e-7}");
        Assert.Equal("{\n  \"a\": \"Текст \u2028 <>&\",\n  \"nested\": {\n    \"x\": 1e+21,\n    \"y\": 1\n  },\n  \"tiny\": 1e-7,\n  \"z\": 0.000001\n}\n", ArchiveJson.Canonical(input));
    }
    [Fact]
    public void SetupPreservesExistingOwnershipAndRejectsRoleResets()
    {
        DatabaseOwnerTools.ValidateSetupState(new(false, false, null, null, false));
        DatabaseOwnerTools.ValidateSetupState(new(true, false, DatabaseOwnerTools.AppRole, DatabaseOwnerTools.AppRole, true));
        Assert.Throws<InvalidOperationException>(() => DatabaseOwnerTools.ValidateSetupState(new(true, true, DatabaseOwnerTools.AppRole, null, true)));
        Assert.Throws<InvalidOperationException>(() => DatabaseOwnerTools.ValidateSetupState(new(true, false, "postgres", null, true)));
        Assert.Throws<InvalidOperationException>(() => DatabaseOwnerTools.ValidateSetupState(new(true, false, DatabaseOwnerTools.AppRole, null, false)));
        Assert.Throws<InvalidOperationException>(() => DatabaseOwnerTools.ValidateSetupState(new(false, false, null, null, true)));
    }
    [Fact]
    public async Task SnapshotIncludesPairedItemsAndRejectsTamperingAndUnsafePaths()
    {
        using var w = new Workspace(); var b = await w.Bundle(); var snapshot = await PublicSnapshot.CaptureAsync(w.Paths, b);
        Assert.True(snapshot.Files.ContainsKey("data/items.json")); Assert.True(snapshot.Files.ContainsKey("data/item-statistics.json")); Assert.DoesNotContain(snapshot.Files.Keys, k => k.StartsWith("knowledge/") || k.StartsWith("work/")); Assert.Equal(snapshot.Hash, ArchiveJson.Hash(ArchiveJson.Bytes(snapshot.Manifest["files"])));
        var bad = snapshot.Manifest.DeepClone(); bad["files"]!["data/heroes.json"] = new string('0', 64); Assert.Throws<InvalidDataException>(() => PublicSnapshot.ParseManifest(bad));
        b["heroes"]!["heroes"]![0]!["portrait"] = "../.env.local"; await Assert.ThrowsAsync<InvalidDataException>(() => PublicSnapshot.CaptureAsync(w.Paths, b)); Assert.Throws<InvalidDataException>(() => ArchiveJson.SafePath(w.Paths.Root, "../secret"));
    }
    [Fact]
    public async Task NativeSnapshotMatchesExistingCommittedManifestExactly()
    {
        var paths = new AppPaths(Root); var snapshot = await PublicSnapshot.CaptureAsync(paths, await ArchiveJson.ReadFilesAsync(paths, default)); var committed = JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(paths.Data, "snapshot-manifest.json"))); Assert.True(JsonNode.DeepEquals(snapshot.Manifest, committed));
    }
    [Fact]
    public async Task JsonModeImportsAllFieldsAndMakesPrivateBackup()
    {
        using var w = new Workspace(); var b = await w.Bundle(); b["history"]!["patches"] = new JsonArray(new JsonObject { ["id"] = "123", ["source"] = "steam", ["url"] = "https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/123", ["publishedAt"] = "2026-11-01T00:00:00Z", ["title"] = new JsonObject { ["en"] = "Patch" }, ["body"] = new JsonObject { ["en"] = "Changes" } }); b["history"]!["futureField"] = new JsonObject { ["kept"] = true };
        var store = new ArchiveStore(w.Paths, _ => null); await store.InitializeAsync(); await store.ImportAsync(b, "test"); Assert.Equal(ArchiveJson.Canonical(b), ArchiveJson.Canonical(await store.ReadBundleAsync())); Assert.NotEmpty(Directory.GetFiles(Path.Combine(w.Paths.Work, "backups", "sync"), "*.json", SearchOption.AllDirectories));
        b.Remove("itemStatistics"); await Assert.ThrowsAsync<InvalidDataException>(() => store.ImportAsync(b, "bad"));
    }
    [Fact]
    public async Task JsonOptimisticImportRejectsStaleOwnerChanges()
    {
        using var w = new Workspace(); var original = await w.Bundle(); var store = new ArchiveStore(w.Paths, _ => null); var owner = original.DeepClone().AsObject(); owner["history"]!["futureField"] = "owner edit"; await store.ImportAsync(owner, "owner"); var candidate = original.DeepClone().AsObject(); candidate["heroes"]!["heroes"]![0]!["base"]!["health"] = 4321;
        await Assert.ThrowsAsync<InvalidOperationException>(() => store.ImportIfUnchangedAsync(candidate, "stale", original)); Assert.Equal(ArchiveJson.Canonical(owner), ArchiveJson.Canonical(await store.ReadBundleAsync()));
        await store.ImportIfUnchangedAsync(candidate, "current", owner); Assert.Equal(ArchiveJson.Canonical(candidate), ArchiveJson.Canonical(await store.ReadBundleAsync()));
    }
    private sealed class Factory(Func<HttpRequestMessage, Task<HttpResponseMessage>> action) : IHttpClientFactory
    {
        private sealed class Handler(Func<HttpRequestMessage, Task<HttpResponseMessage>> action) : HttpMessageHandler { protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => action(request); }
        public HttpClient CreateClient(string name) => new(new Handler(action));
    }
    private static HttpResponseMessage Json(JsonNode n) => new(HttpStatusCode.OK) { Content = new StringContent(n.ToJsonString()) };
    private static string Blob(byte[] bytes) => Convert.ToHexStringLower(SHA1.HashData(Encoding.UTF8.GetBytes($"blob {bytes.Length}\0").Concat(bytes).ToArray()));
    [Fact]
    public async Task JsonSyncStatusIsUnavailableWithoutReadingDataOrAcquiringNetworkClient()
    {
        using var w = new Workspace(); Directory.CreateDirectory(w.Paths.Work); await File.WriteAllTextAsync(Path.Combine(w.Paths.Work, "sync-state.json"), new JsonObject { ["commitSha"] = new string('a', 40), ["snapshotHash"] = new string('b', 64), ["phase"] = "queued" }.ToJsonString());
        var before = await File.ReadAllBytesAsync(Path.Combine(w.Paths.Work, "sync-state.json")); var sync = new PublicSync(w.Paths, new UnavailableArchive(), new NeverNetworkFactory());
        foreach (var state in new[] { sync.ReadState(), await sync.GetStateAsync(), await sync.GetStateAsync(true), await sync.DryRunAsync() }) { Assert.False(state["available"]!.GetValue<bool>()); Assert.Equal("json", state["source"]!.GetValue<string>()); Assert.Equal("idle", state["phase"]!.GetValue<string>()); }
        Assert.False(sync.IsBusy); Assert.Throws<InvalidOperationException>(() => sync.Start()); await Assert.ThrowsAsync<InvalidOperationException>(() => sync.PublishAsync()); Assert.Equal(before, await File.ReadAllBytesAsync(Path.Combine(w.Paths.Work, "sync-state.json")));
    }
    private sealed class NeverNetworkFactory : IHttpClientFactory { public HttpClient CreateClient(string name) => throw new InvalidOperationException("Unexpected credential/network initialization"); }
    private sealed class UnavailableArchive : IArchiveStore
    {
        public bool Configured => false;
        public Task InitializeAsync(CancellationToken ct = default) => throw new InvalidOperationException("Unexpected archive access");
        public Task<JsonObject> ReadBundleAsync(CancellationToken ct = default) => throw new InvalidOperationException("Unexpected archive read");
        public Task ImportAsync(JsonObject bundle, string reason, CancellationToken ct = default) => throw new InvalidOperationException("Unexpected import");
        public Task<JsonObject> StatusAsync(CancellationToken ct = default) => throw new InvalidOperationException("Unexpected status");
    }
    [Fact]
    public async Task SuccessfulWorkflowCanRetryOnlyMismatchedPagesAgainstCurrentMain()
    {
        using var w = new Workspace(); var snapshot = await PublicSnapshot.CaptureAsync(w.Paths, await w.Bundle()); var head = new string('a', 40); var tree = new string('b', 40); var manifestBytes = snapshot.Files[PublicSnapshot.ManifestPath]; var manifestBlob = Blob(manifestBytes); var dispatches = 0; var match = false; var missing = false; var advanceAtFinalCheck = false; var headReads = 0;
        var transport = new Factory(async request =>
        {
            await Task.Yield(); var p = request.RequestUri!.AbsolutePath;
            if (request.RequestUri.Host == "roman17-bot.github.io") { if (missing) return new(HttpStatusCode.NotFound); var file = p["/deadlock-archive/".Length..]; if (file.StartsWith("assets/")) file = "public/" + file; return new(HttpStatusCode.OK) { Content = new ByteArrayContent(!match && file == "data/heroes.json" ? [9] : snapshot.Files[file]) }; }
            if (p.EndsWith("/git/ref/heads/main")) { headReads++; return Json(new JsonObject { ["object"] = new JsonObject { ["sha"] = advanceAtFinalCheck && headReads >= 2 ? new string('c', 40) : head } }); }
            if (p.EndsWith("/git/commits/" + head)) return Json(new JsonObject { ["sha"] = head, ["tree"] = new JsonObject { ["sha"] = tree } });
            if (p.Contains("/git/trees/")) return Json(new JsonObject { ["sha"] = tree, ["truncated"] = false, ["tree"] = new JsonArray(new JsonObject { ["path"] = PublicSnapshot.ManifestPath, ["mode"] = "100644", ["type"] = "blob", ["sha"] = manifestBlob }) });
            if (p.EndsWith("/git/blobs/" + manifestBlob)) return Json(new JsonObject { ["sha"] = manifestBlob, ["encoding"] = "base64", ["size"] = manifestBytes.Length, ["content"] = Convert.ToBase64String(manifestBytes) });
            if (p.EndsWith("/actions/workflows/pages.yml/runs")) return Json(new JsonObject { ["total_count"] = 1, ["workflow_runs"] = new JsonArray(new JsonObject { ["id"] = 1, ["head_sha"] = head, ["head_branch"] = "main", ["path"] = ".github/workflows/pages.yml", ["status"] = "completed", ["conclusion"] = "success", ["html_url"] = $"https://github.com/{GitHubPublication.Repository}/actions/runs/1" }) });
            if (request.Method == HttpMethod.Post && p.EndsWith("/actions/workflows/pages.yml/dispatches")) { var body = JsonNode.Parse(await request.Content!.ReadAsStringAsync()); Assert.Equal(head, ArchiveJson.Text(body!["inputs"]!["expected_commit"])); Assert.Equal(snapshot.Hash, ArchiveJson.Text(body["inputs"]!["expected_hash"])); dispatches++; return new(HttpStatusCode.NoContent); }
            throw new InvalidOperationException(request.Method + " " + p);
        }); var github = new GitHubPublication(transport, _ => Task.FromResult("test-token"));
        await github.RetryAsync(head, snapshot.Hash, default); Assert.Equal(1, dispatches);
        match = true; headReads = 0; await github.RetryAsync(head, snapshot.Hash, default); Assert.Equal(1, dispatches);
        missing = true; headReads = 0; await github.RetryAsync(head, snapshot.Hash, default); Assert.Equal(2, dispatches);
        headReads = 0; advanceAtFinalCheck = true; await Assert.ThrowsAsync<InvalidOperationException>(() => github.RetryAsync(head, snapshot.Hash, default)); Assert.Equal(2, dispatches);
    }
    [Fact]
    public async Task PublicationCommitsOnlyChangedApprovedBytesAndNeverForcesMain()
    {
        using var w = new Workspace(); var bundle = await w.Bundle(); var prior = await PublicSnapshot.CaptureAsync(w.Paths, bundle); bundle["history"]!["futureField"] = "exact change"; var next = await PublicSnapshot.CaptureAsync(w.Paths, bundle);
        var head = new string('a', 40); var tree = new string('b', 40); var commit = new string('c', 40); var createdTree = new string('d', 40); var published = new Dictionary<string, byte[]>(); var rejected = false; var blobWrites = 0;
        var transport = new Factory(async request =>
        {
            var p = request.RequestUri!.AbsolutePath; var method = request.Method.Method; var body = request.Content == null ? null : JsonNode.Parse(await request.Content.ReadAsStringAsync());
            if (method == "GET" && p.EndsWith("/git/ref/heads/main")) return Json(new JsonObject { ["object"] = new JsonObject { ["sha"] = head } });
            if (method == "GET" && p.EndsWith("/git/commits/" + head)) return Json(new JsonObject { ["sha"] = head, ["tree"] = new JsonObject { ["sha"] = tree } });
            if (method == "GET" && p.Contains("/git/trees/")) return Json(new JsonObject { ["sha"] = tree, ["truncated"] = false, ["tree"] = new JsonArray(prior.Files.Select(f => (JsonNode)new JsonObject { ["path"] = f.Key, ["mode"] = "100644", ["type"] = "blob", ["sha"] = Blob(f.Value) }).ToArray()) });
            if (method == "GET" && p.Contains("/git/blobs/")) { var bytes = prior.Files.Values.Single(f => Blob(f) == p.Split('/')[^1]); return Json(new JsonObject { ["sha"] = Blob(bytes), ["size"] = bytes.Length, ["encoding"] = "base64", ["content"] = Convert.ToBase64String(bytes) }); }
            if (method == "POST" && p.EndsWith("/git/blobs")) { blobWrites++; var bytes = Convert.FromBase64String(ArchiveJson.Text(body!["content"])); published[Blob(bytes)] = bytes; return Json(new JsonObject { ["sha"] = Blob(bytes) }); }
            if (method == "POST" && p.EndsWith("/git/trees")) { Assert.Equal(tree, ArchiveJson.Text(body!["base_tree"])); var entries = body["tree"]!.AsArray(); Assert.Equal(2, entries.Count); Assert.Contains(entries, e => e!["path"]!.GetValue<string>() == "data/version-history.json"); Assert.Contains(entries, e => e!["path"]!.GetValue<string>() == PublicSnapshot.ManifestPath); foreach (var entry in entries) { var path = ArchiveJson.Text(entry!["path"]); Assert.True(path == PublicSnapshot.ManifestPath || PublicSnapshot.Approved(path)); Assert.Equal(next.Files[path], published[ArchiveJson.Text(entry["sha"])]); } return Json(new JsonObject { ["sha"] = createdTree }); }
            if (method == "POST" && p.EndsWith("/git/commits")) { Assert.Equal(head, ArchiveJson.Text(body!["parents"]![0])); Assert.Equal(createdTree, ArchiveJson.Text(body["tree"])); return Json(new JsonObject { ["sha"] = commit }); }
            if (method == "PATCH" && p.EndsWith("/git/refs/heads/main")) { Assert.False(body!["force"]!.GetValue<bool>()); Assert.Equal(commit, ArchiveJson.Text(body["sha"])); return rejected ? new(HttpStatusCode.UnprocessableEntity) : Json(new JsonObject { ["object"] = new JsonObject { ["sha"] = commit } }); }
            throw new InvalidOperationException(method + " " + p);
        });
        var github = new GitHubPublication(transport, _ => Task.FromResult("test-token")); var result = await github.PublishAsync(next, default); Assert.Equal(commit, result.CommitSha); Assert.Equal(2, blobWrites);
        rejected = true; await Assert.ThrowsAsync<InvalidOperationException>(() => github.PublishAsync(next, default));
    }
    [Fact]
    public async Task InspectionRequiresActualPagesBytesAndCurrentMain()
    {
        using var w = new Workspace(); var snapshot = await PublicSnapshot.CaptureAsync(w.Paths, await w.Bundle()); var head = new string('a', 40); var treeSha = new string('b', 40); var tamper = false; var advance = false; var requests = new List<string>();
        var entries = new JsonArray(snapshot.Files.Select(f => (JsonNode)new JsonObject { ["path"] = f.Key, ["sha"] = Blob(f.Value), ["mode"] = "100644", ["type"] = "blob" }).ToArray());
        var transport = new Factory(async request =>
        {
            await Task.Yield(); lock (requests) requests.Add(request.Method + " " + request.RequestUri!.AbsolutePath); Assert.Equal(HttpMethod.Get, request.Method); var uri = request.RequestUri!; var p = uri.AbsolutePath;
            if (uri.Host == "roman17-bot.github.io") { Assert.Null(request.Headers.Authorization); var path = p["/deadlock-archive/".Length..]; if (path.StartsWith("assets/")) path = "public/" + path; var bytes = snapshot.Files[path]; return new(HttpStatusCode.OK) { Content = new ByteArrayContent(tamper && path == "data/heroes.json" ? [9] : bytes) }; }
            if (p.EndsWith("/git/ref/heads/main")) return Json(new JsonObject { ["object"] = new JsonObject { ["sha"] = advance ? new string('c', 40) : head } });
            if (p.Contains("/git/commits/")) return Json(new JsonObject { ["sha"] = p.Split('/')[^1], ["tree"] = new JsonObject { ["sha"] = treeSha } });
            if (p.Contains("/git/trees/")) return Json(new JsonObject { ["sha"] = treeSha, ["truncated"] = false, ["tree"] = entries.DeepClone() });
            if (p.Contains("/git/blobs/")) { var content = snapshot.Files.Values.Single(b => Blob(b) == p.Split('/')[^1]); return Json(new JsonObject { ["sha"] = Blob(content), ["encoding"] = "base64", ["size"] = content.Length, ["content"] = Convert.ToBase64String(content) }); }
            if (p.EndsWith("/actions/workflows/pages.yml/runs")) return Json(new JsonObject { ["total_count"] = 1, ["workflow_runs"] = new JsonArray(new JsonObject { ["id"] = 1, ["head_sha"] = head, ["head_branch"] = "main", ["path"] = ".github/workflows/pages.yml", ["html_url"] = $"https://github.com/{GitHubPublication.Repository}/actions/runs/1", ["status"] = "completed", ["conclusion"] = "success" }) }); throw new InvalidOperationException(p);
        });
        var github = new GitHubPublication(transport, _ => Task.FromResult("test-token")); var healthy = await github.InspectAsync(snapshot, head, default); Assert.True(healthy.RepositoryMatches); Assert.True(healthy.PagesMatches); Assert.Equal("success", healthy.Status);
        tamper = true; var corrupted = await github.InspectAsync(snapshot, head, default); Assert.False(corrupted.PagesMatches); Assert.Equal("failure", corrupted.Status);
        tamper = false; advance = true; var stale = await github.InspectAsync(snapshot, head, default); Assert.False(stale.RepositoryMatches); Assert.Equal("failure", stale.Status); await Assert.ThrowsAsync<InvalidOperationException>(() => github.RetryAsync(head, snapshot.Hash, default)); Assert.DoesNotContain(requests, r => r.StartsWith("POST") || r.StartsWith("PATCH"));
    }
    public sealed class OwnedDatabaseFactAttribute : FactAttribute
    { public OwnedDatabaseFactAttribute() { if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DEADLOCK_TEST_ENV_FILE"))) Skip = "Set DEADLOCK_TEST_ENV_FILE to use an owned isolated test database."; } }
    [OwnedDatabaseFact]
    public async Task ExistingSchemaRoundTripRestartNoOverwriteAndAtomicRejection()
    {
        var env = new Dictionary<string, string>(); foreach (var line in File.ReadLines(Environment.GetEnvironmentVariable("DEADLOCK_TEST_ENV_FILE")!)) { var split = line.IndexOf('='); if (split < 1 || line.TrimStart().StartsWith('#')) continue; env[line[..split].Trim()] = line[(split + 1)..].Trim().Trim('"', '\''); }
        var test = Environment.GetEnvironmentVariable("DEADLOCK_DB_TEST_NAME") ?? env.GetValueOrDefault("DEADLOCK_DB_TEST_NAME"); var live = env.GetValueOrDefault("DEADLOCK_DB_NAME"); if (test == live || test == null || !System.Text.RegularExpressions.Regex.IsMatch(test, "^deadlock_archive_test(?:_[a-z0-9]+)?$")) throw new InvalidOperationException("Refusing working database"); env["DEADLOCK_DB_NAME"] = test;
        var cs = new NpgsqlConnectionStringBuilder { Host = env["DEADLOCK_DB_HOST"], Port = int.Parse(env["DEADLOCK_DB_PORT"]), Database = test, Username = env["DEADLOCK_DB_USER"], Password = env["DEADLOCK_DB_PASSWORD"] }; await using var control = new NpgsqlConnection(cs.ConnectionString); await control.OpenAsync(); var schema = "archive_test_" + Guid.NewGuid().ToString("N"); await using (var cmd = new NpgsqlCommand($"CREATE SCHEMA {schema}", control)) await cmd.ExecuteNonQueryAsync();
        using var w = new Workspace(); var bundle = await w.Bundle();
        // The legacy schema predates official descriptions. Simulate that archive first,
        // then verify new descriptions and future fields survive the native round trip.
        bundle["history"]!.AsObject().Remove("patches");
        await File.WriteAllBytesAsync(Path.Combine(w.Paths.Data, "version-history.json"), ArchiveJson.Bytes(bundle["history"]));
        try
        {
            var store = new ArchiveStore(w.Paths, k => env.GetValueOrDefault(k), schema);
            using (var services = new ServiceCollection().AddSingleton(w.Paths).AddSingleton<IArchiveStore>(store).BuildServiceProvider())
                Assert.Equal(0, await ArchiveCommands.RunAsync("db:migrate", ["db:migrate"], services));
            Assert.Equal(0, ArchiveJson.Number((await store.StatusAsync())["snapshots"]));
            await store.InitializeAsync(); Assert.Equal(ArchiveJson.Canonical(bundle), ArchiveJson.Canonical(await store.ReadBundleAsync()));
            await using (var drop = new NpgsqlCommand($"DROP TABLE {schema}.archive_bundle_payloads", control)) await drop.ExecuteNonQueryAsync(); Assert.Equal(ArchiveJson.Canonical(bundle), ArchiveJson.Canonical(await store.ReadBundleAsync())); await using (var absent = new NpgsqlCommand($"SELECT to_regclass('{schema}.archive_bundle_payloads') IS NULL", control)) Assert.True((bool)(await absent.ExecuteScalarAsync())!); await store.InitializeAsync();
            var edited = bundle.DeepClone().AsObject(); edited["heroes"]!["heroes"]![0]!["base"]!["health"] = 1234; edited["heroes"]!["heroes"]![0]!["extra"] = new JsonObject { ["kept"] = true }; edited["history"]!["futureField"] = new JsonObject { ["kept"] = true };
            edited["history"]!["patches"] = new JsonArray(new JsonObject { ["id"] = "123", ["source"] = "steam", ["url"] = "https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/123", ["publishedAt"] = "2026-11-01T00:00:00.000Z", ["title"] = new JsonObject { ["en"] = "Patch" }, ["body"] = new JsonObject { ["en"] = "Saved official patch description." } });
            await store.ImportAsync(edited, "isolated"); Assert.Equal(ArchiveJson.Canonical(edited), ArchiveJson.Canonical(await store.ReadBundleAsync()));
            await store.ImportAsync(edited, "same"); await store.InitializeAsync(); Assert.Equal(ArchiveJson.Canonical(edited), ArchiveJson.Canonical(await store.ReadBundleAsync()));
            await using (var cmd = new NpgsqlCommand($"UPDATE {schema}.heroes SET base_health=2345 WHERE ordinal=0 AND snapshot_id=(SELECT snapshot_id FROM {schema}.archive_current)", control)) await cmd.ExecuteNonQueryAsync(); var relational = await store.ReadBundleAsync(); Assert.Equal(2345, relational["heroes"]!["heroes"]![0]!["base"]!["health"]!.GetValue<double>());
            var invalid = edited.DeepClone().AsObject(); invalid["mechanics"]!["ru"]!["formulas"]![0]!["sourceIds"] = new JsonArray("missing"); await Assert.ThrowsAsync<InvalidDataException>(() => store.ImportAsync(invalid, "invalid")); Assert.Equal(ArchiveJson.Canonical(relational), ArchiveJson.Canonical(await store.ReadBundleAsync()));
            await using var count = new NpgsqlCommand($"SELECT count(*) FROM {schema}.archive_snapshots", control); Assert.Equal(2L, (long)(await count.ExecuteScalarAsync())!);
            var baseVersion = await store.ReadBundleAsync(); var owner = baseVersion.DeepClone().AsObject(); owner["mechanics"]!["ru"]!["formulas"]![0]!["title"] = "Owner mechanics edit"; owner["history"]!["futureField"] = "Owner history edit"; await store.ImportAsync(owner, "same-client-owner"); var stale = baseVersion.DeepClone().AsObject(); stale["heroes"]!["heroes"]![0]!["base"]!["health"] = 3456;
            await Assert.ThrowsAsync<InvalidOperationException>(() => store.ImportIfUnchangedAsync(stale, "stale-after-owner", baseVersion)); Assert.Equal(ArchiveJson.Canonical(owner), ArchiveJson.Canonical(await store.ReadBundleAsync()));
            var expected = await store.ReadBundleAsync(); var candidate = expected.DeepClone().AsObject(); candidate["heroes"]!["heroes"]![0]!["base"]!["health"] = 4567;
            await using (var lockTransaction = await control.BeginTransactionAsync())
            {
                await using (var command = new NpgsqlCommand("SELECT pg_advisory_xact_lock(14981747,20261025)", control, lockTransaction)) await command.ExecuteNonQueryAsync();
                var pending = store.ImportIfUnchangedAsync(candidate, "stale-during-backup", expected);
                var waiting = false; for (var attempt = 0; attempt < 300; attempt++) { await using var probe = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND application_name='deadlock_archive_aspnet' AND wait_event_type='Lock' AND wait_event='advisory')", control, lockTransaction); if ((bool)(await probe.ExecuteScalarAsync())!) { waiting = true; break; } await Task.Delay(20); }
                if (!waiting) { await lockTransaction.RollbackAsync(); await pending; throw new InvalidOperationException("Refresh did not reach the guarded transaction"); }
                await using (var command = new NpgsqlCommand($"UPDATE {schema}.mechanics_formulas SET title='Owner SQL edit during refresh' WHERE language='ru' AND ordinal=0 AND snapshot_id=(SELECT snapshot_id FROM {schema}.archive_current)", control, lockTransaction)) await command.ExecuteNonQueryAsync();
                await lockTransaction.CommitAsync(); await Assert.ThrowsAsync<InvalidOperationException>(() => pending);
            }
            var afterRace = await store.ReadBundleAsync(); Assert.Equal("Owner SQL edit during refresh", ArchiveJson.Text(afterRace["mechanics"]!["ru"]!["formulas"]![0]!["title"])); Assert.Equal(2345, ArchiveJson.Real(afterRace["heroes"]!["heroes"]![0]!["base"]!["health"]));
            await store.ImportIfUnchangedAsync(candidate, "current-after-race", afterRace); Assert.Equal(ArchiveJson.Canonical(candidate), ArchiveJson.Canonical(await store.ReadBundleAsync()));
        }
        finally { NpgsqlConnection.ClearAllPools(); if (!System.Text.RegularExpressions.Regex.IsMatch(schema, "^archive_test_[a-f0-9]{32}$")) throw new InvalidOperationException("Unsafe cleanup"); await using var cmd = new NpgsqlCommand($"DROP SCHEMA {schema} CASCADE", control); await cmd.ExecuteNonQueryAsync(); }
    }
}
