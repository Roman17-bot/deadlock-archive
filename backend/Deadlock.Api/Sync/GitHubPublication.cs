using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Deadlock.Api.Data;

namespace Deadlock.Api.Sync;

public sealed record PublicationInspection(bool RepositoryMatches, bool PagesMatches, string? RepositoryHash, string? PagesHash, string CommitSha, string Status, string Url, long? RunId = null);
public sealed record PublicationResult(string CommitSha, string Url, long? RunId = null);

/// <summary>Only writes approved snapshot bytes to the observed main tree. Never executes source code.</summary>
public sealed class GitHubPublication(IHttpClientFactory factory, Func<CancellationToken, Task<string>>? credentialProvider = null)
{
    public const string Repository = "Roman17-bot/deadlock-archive";
    public const string WorkflowUrl = "https://github.com/" + Repository + "/actions/workflows/pages.yml";
    private const string Api = "https://api.github.com/repos/" + Repository;
    private const string Pages = "https://roman17-bot.github.io/deadlock-archive/";
    private static bool Sha(string? s) => s != null && Regex.IsMatch(s, "^[a-f0-9]{40}$");
    private static string Text(JsonNode? n) => ArchiveJson.Text(n);
    private static string BlobHash(byte[] b) => Convert.ToHexStringLower(SHA1.HashData(Encoding.UTF8.GetBytes($"blob {b.Length}\0").Concat(b).ToArray()));
    private static InvalidOperationException Failure() => new("GitHub synchronization could not be completed. Check owner authorization, remote changes and retry.");
    private async Task<string> Credential(CancellationToken ct)
    {
        if (credentialProvider != null) return await credentialProvider(ct);
        return await new GitHubCredentials().GetAsync(ct);
    }
    private static async Task<byte[]> Bounded(HttpResponseMessage response, int limit, CancellationToken ct)
    {
        if (!response.IsSuccessStatusCode || response.Content.Headers.ContentLength > limit) throw Failure();
        await using var stream = await response.Content.ReadAsStreamAsync(ct); using var result = new MemoryStream(); var buffer = new byte[16384]; int count;
        while ((count = await stream.ReadAsync(buffer, ct)) > 0) { if (result.Length + count > limit) throw Failure(); await result.WriteAsync(buffer.AsMemory(0, count), ct); }
        return result.ToArray();
    }
    private sealed class Session(HttpClient client, string token)
    {
        public async Task<JsonNode?> Request(string path, CancellationToken ct, string method = "GET", JsonNode? body = null)
        {
            using var req = new HttpRequestMessage(new HttpMethod(method), Api + path); req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token); req.Headers.Accept.ParseAdd("application/vnd.github+json"); req.Headers.TryAddWithoutValidation("X-GitHub-Api-Version", "2026-03-10"); req.Headers.UserAgent.ParseAdd("deadlock-archive-local-sync");
            if (body != null) req.Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct); deadline.CancelAfter(TimeSpan.FromSeconds(20)); using var response = await client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, deadline.Token); if (response.StatusCode == System.Net.HttpStatusCode.NoContent) return null; return JsonNode.Parse(await Bounded(response, 8 * 1024 * 1024, deadline.Token));
        }
        public async Task<byte[]> Public(string path, string hash, CancellationToken ct)
        { using var req = new HttpRequestMessage(HttpMethod.Get, Pages + path + "?snapshot=" + hash + "&verification=" + Guid.NewGuid().ToString("N")); req.Headers.CacheControl = new CacheControlHeaderValue { NoCache = true, NoStore = true }; using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct); deadline.CancelAfter(TimeSpan.FromSeconds(15)); using var response = await client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, deadline.Token); return await Bounded(response, PublicSnapshot.MaxFileBytes, deadline.Token); }
    }
    private async Task<Session> Connect(CancellationToken ct) => new(factory.CreateClient("public-sync"), await Credential(ct));
    private static async Task<string> Head(Session s, CancellationToken ct) { var sha = Text((await s.Request("/git/ref/heads/main", ct))?["object"]?["sha"]); if (!Sha(sha)) throw Failure(); return sha; }
    private sealed record Tree(string Head, string Sha, Dictionary<string, JsonObject> Files);
    private static async Task<Tree> ReadTree(Session s, string head, CancellationToken ct)
    {
        var commit = await s.Request("/git/commits/" + head, ct); var sha = Text(commit?["tree"]?["sha"]); if (Text(commit?["sha"]) != head || !Sha(sha)) throw Failure(); var tree = await s.Request("/git/trees/" + sha + "?recursive=1", ct);
        if (Text(tree?["sha"]) != sha || tree?["truncated"]?.GetValue<bool>() != false || tree["tree"] is not JsonArray list || list.Count > 20000) throw Failure(); var entries = new Dictionary<string, JsonObject>();
        foreach (var n in list) { var e = n!.AsObject(); var p = Text(e["path"]); if (p.Length > 2048 || !Sha(Text(e["sha"])) || !entries.TryAdd(p, e)) throw Failure(); }
        return new(head, sha, entries);
    }
    private static async Task<byte[]> Blob(Session s, string sha, CancellationToken ct)
    {
        var b = await s.Request("/git/blobs/" + sha, ct); if (Text(b?["sha"]) != sha || Text(b?["encoding"]) != "base64" || ArchiveJson.Number(b?["size"]) > PublicSnapshot.MaxFileBytes) throw Failure(); var content = Convert.FromBase64String(Text(b?["content"])); if (content.Length != ArchiveJson.Number(b?["size"]) || BlobHash(content) != sha) throw Failure(); return content;
    }
    private static async Task<JsonObject?> Manifest(Session s, Tree tree, CancellationToken ct) => tree.Files.TryGetValue(PublicSnapshot.ManifestPath, out var e) ? PublicSnapshot.ParseManifest(JsonNode.Parse(await Blob(s, Text(e["sha"]), ct))) : null;
    private static bool Matches(PublicSnapshot snapshot, Tree tree) => snapshot.Files.All(f => tree.Files.TryGetValue(f.Key, out var e) && Text(e["type"]) == "blob" && Text(e["mode"]) == "100644" && Text(e["sha"]) == BlobHash(f.Value));
    private static async Task RejectDowngrade(Session s, PublicSnapshot snapshot, Tree tree, CancellationToken ct)
    {
        foreach (var path in new[] { "data/heroes.json", "data/mechanics.json", "data/mechanics.en.json" }) if (tree.Files.TryGetValue(path, out var e))
        {
            if (Text(e["type"]) != "blob" || Text(e["mode"]) != "100644") throw Failure(); var remote = JsonNode.Parse(await Blob(s, Text(e["sha"]), ct))!["meta"]!; var local = JsonNode.Parse(snapshot.Files[path])!["meta"]!; var key = path == "data/heroes.json" ? "clientVersion" : "reviewedClientVersion";
            if (ArchiveJson.Number(remote[key]) < 1 || ArchiveJson.Number(remote["sourceRevision"]) < 1 || ArchiveJson.Number(local[key]) < 1 || ArchiveJson.Number(local["sourceRevision"]) < 1 || ArchiveJson.Number(remote[key]) > ArchiveJson.Number(local[key]) || ArchiveJson.Number(remote["sourceRevision"]) > ArchiveJson.Number(local["sourceRevision"])) throw Failure();
        }
        var manifest = await Manifest(s, tree, ct); if (manifest != null && (ArchiveJson.Number(manifest["clientVersion"]) > snapshot.ClientVersion || ArchiveJson.Number(manifest["reviewedClientVersion"]) > ArchiveJson.Number(snapshot.Manifest["reviewedClientVersion"]))) throw Failure();
    }
    public async Task<PublicationResult> PublishAsync(PublicSnapshot snapshot, CancellationToken ct)
    {
        try
        {
            var s = await Connect(ct); var head = await Head(s, ct); var tree = await ReadTree(s, head, ct); await RejectDowngrade(s, snapshot, tree, ct); if (Matches(snapshot, tree)) return new(head, "https://github.com/" + Repository + "/commit/" + head);
            var entries = new JsonArray(); foreach (var (p, b) in snapshot.Files)
            {
                var sha = BlobHash(b); if (tree.Files.TryGetValue(p, out var e)) { if (Text(e["type"]) != "blob" || Text(e["mode"]) != "100644") throw Failure(); if (Text(e["sha"]) == sha) continue; }
                var parts = p.Split('/'); for (var i = 1; i < parts.Length; i++) { var parent = string.Join('/', parts.Take(i)); if (tree.Files.TryGetValue(parent, out var entry) && (Text(entry["type"]) != "tree" || Text(entry["mode"]) != "040000")) throw Failure(); }
                var created = await s.Request("/git/blobs", ct, "POST", new JsonObject { ["content"] = Convert.ToBase64String(b), ["encoding"] = "base64" }); if (Text(created?["sha"]) != sha) throw Failure(); entries.Add(new JsonObject { ["path"] = p, ["mode"] = "100644", ["type"] = "blob", ["sha"] = sha });
            }
            var newTree = await s.Request("/git/trees", ct, "POST", new JsonObject { ["base_tree"] = tree.Sha, ["tree"] = entries }); if (!Sha(Text(newTree?["sha"]))) throw Failure();
            var commit = await s.Request("/git/commits", ct, "POST", new JsonObject { ["message"] = $"Publish exact public snapshot {snapshot.ClientVersion} {snapshot.Hash}", ["tree"] = Text(newTree?["sha"]), ["parents"] = new JsonArray(head) }); var commitSha = Text(commit?["sha"]); if (!Sha(commitSha)) throw Failure();
            var updated = await s.Request("/git/refs/heads/main", ct, "PATCH", new JsonObject { ["sha"] = commitSha, ["force"] = false }); if (Text(updated?["object"]?["sha"]) != commitSha) throw Failure(); return new(commitSha, "https://github.com/" + Repository + "/commit/" + commitSha);
        }
        catch { throw Failure(); }
    }
    private sealed record Run(string Status, string Url, long? Id = null);
    private static async Task<Run> Workflow(Session s, string commit, CancellationToken ct)
    {
        var data = await s.Request("/actions/workflows/pages.yml/runs?head_sha=" + commit + "&branch=main&per_page=100&exclude_pull_requests=true", ct); if (data?["workflow_runs"] is not JsonArray runs || runs.Count > 100 || ArchiveJson.Number(data["total_count"]) > 100) throw Failure();
        var run = runs.Where(r => r?["head_sha"]?.GetValue<string>() == commit && r?["head_branch"]?.GetValue<string>() == "main" && r?["path"]?.GetValue<string>() == ".github/workflows/pages.yml").OrderByDescending(r => ArchiveJson.Number(r!["id"])).FirstOrDefault(); if (run == null) return new("unknown", WorkflowUrl); var id = ArchiveJson.Number(run["id"]); var url = Text(run["html_url"]); if (id < 1 || url != $"https://github.com/{Repository}/actions/runs/{id}") throw Failure(); var status = Text(run["status"]) switch { "in_progress" => "in_progress", "queued" or "waiting" or "pending" or "requested" => "queued", "completed" => run["conclusion"]?.GetValue<string>() == "success" ? "success" : "failure", _ => "unknown" }; return new(status, url, id);
    }
    private static async Task<(string? Hash, bool Matches)> PagesMatch(Session s, JsonObject expectedManifest, CancellationToken ct)
    {
        string? hash = null; try
        {
            var expectedHash = Text(expectedManifest["hash"]);
            var m = PublicSnapshot.ParseManifest(JsonNode.Parse(await s.Public(PublicSnapshot.ManifestPath, expectedHash, ct))); hash = Text(m["hash"]); if (!JsonNode.DeepEquals(m, expectedManifest)) return (hash, false); var matches = true;
            await Parallel.ForEachAsync(expectedManifest["files"]!.AsObject(), new ParallelOptions { MaxDegreeOfParallelism = 4, CancellationToken = ct }, async (f, c) => { try { var path = f.Key.StartsWith("public/") ? f.Key[7..] : f.Key; if (ArchiveJson.Hash(await s.Public(path, expectedHash, c)) != Text(f.Value)) matches = false; } catch { matches = false; } }); return (hash, matches);
        }
        catch { return (hash, false); }
    }
    public async Task<PublicationInspection> InspectAsync(PublicSnapshot snapshot, string? expected, CancellationToken ct)
    {
        try { if (expected != null && !Sha(expected)) throw Failure(); var s = await Connect(ct); var main = await Head(s, ct); var tree = await ReadTree(s, main, ct); var commit = expected ?? main; var manifest = await Manifest(s, tree, ct); var repositoryMatches = commit == main && Matches(snapshot, tree); var runTask = Workflow(s, commit, ct); var pagesTask = PagesMatch(s, snapshot.Manifest, ct); await Task.WhenAll(runTask, pagesTask); var run = await runTask; var pages = await pagesTask; var status = !repositoryMatches || run.Status == "failure" ? "failure" : pages.Matches ? "success" : run.Status == "success" ? "failure" : run.Status; return new(repositoryMatches, pages.Matches, manifest?["hash"]?.GetValue<string>(), pages.Hash, commit, status, run.Url, run.Id); } catch { throw Failure(); }
    }
    public async Task<PublicationResult> RetryAsync(string commit, string hash, CancellationToken ct)
    {
        try { if (!Sha(commit) || !Regex.IsMatch(hash, "^[a-f0-9]{64}$")) throw Failure(); var s = await Connect(ct); if (await Head(s, ct) != commit) throw Failure(); var tree = await ReadTree(s, commit, ct); var m = await Manifest(s, tree, ct); if (m?["hash"]?.GetValue<string>() != hash) throw Failure(); var run = await Workflow(s, commit, ct); if (run.Status is "queued" or "in_progress") return new(commit, run.Url, run.Id); if (run.Status == "success" && (await PagesMatch(s, m, ct)).Matches) return new(commit, run.Url, run.Id); if (await Head(s, ct) != commit) throw Failure(); var response = await s.Request("/actions/workflows/pages.yml/dispatches", ct, "POST", new JsonObject { ["ref"] = "main", ["inputs"] = new JsonObject { ["expected_commit"] = commit, ["expected_hash"] = hash } }); if (response == null) return new(commit, WorkflowUrl); var id = ArchiveJson.Number(response["workflow_run_id"]); var url = Text(response["html_url"]); if (id < 1 || url != $"https://github.com/{Repository}/actions/runs/{id}") throw Failure(); return new(commit, url, id); } catch { throw Failure(); }
    }
}
