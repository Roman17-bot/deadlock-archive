using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Deadlock.Api.Data;
using Deadlock.Api.Sync;
using Deadlock.Api.Updates;
using Npgsql;

namespace Deadlock.Api;

public static class ArchiveCommands
{
    public static async Task<int> RunAsync(string command, string[] args, IServiceProvider services)
    {
        var parsed = ValidateArguments(command, args);
        args = parsed.Args;
        var expectedVersion = parsed.ExpectedVersion;
        var paths = services.GetRequiredService<AppPaths>();
        var store = services.GetRequiredService<IArchiveStore>();
        var ct = CancellationToken.None;
        if (command == "deployment-guard") { await DeploymentGuardAsync(ct); return 0; }
        if (command is "prepare-public" or "verify-publication" or "check")
        {
            var bundle = await ArchiveJson.ReadFilesAsync(paths, ct);
            var snapshot = await PublicSnapshot.CaptureAsync(paths, bundle, ct);
            if (command == "prepare-public")
            {
                Directory.CreateDirectory(Path.Combine(paths.Public, "data"));
                foreach (var file in snapshot.Files.Where(f => f.Key.StartsWith("data/")))
                    await File.WriteAllBytesAsync(ArchiveJson.SafePath(paths.Public, file.Key), file.Value, ct);
                foreach (var language in new[] { "", ".en" }) File.Copy(Path.Combine(paths.Root, "docs", $"mechanics-reference{language}.md"), Path.Combine(paths.Public, "data", $"mechanics-reference{language}.md"), true);
            }
            if (command == "verify-publication")
            {
                var expected = JsonNode.Parse(await File.ReadAllBytesAsync(Path.Combine(paths.Data, "snapshot-manifest.json"), ct));
                if (!JsonNode.DeepEquals(snapshot.Manifest, expected)) throw new InvalidDataException("Public manifest does not match curated files");
                var hash = Environment.GetEnvironmentVariable("EXPECTED_SNAPSHOT_HASH");
                if (!string.IsNullOrEmpty(hash) && hash != snapshot.Hash) throw new InvalidDataException("Unexpected public hash");
                var version = Environment.GetEnvironmentVariable("EXPECTED_VERSION");
                if (!string.IsNullOrEmpty(version) && version != snapshot.ClientVersion.ToString()) throw new InvalidDataException("Unexpected client version");
                var commit = Environment.GetEnvironmentVariable("EXPECTED_SYNC_COMMIT");
                if (!string.IsNullOrEmpty(commit) && (!Regex.IsMatch(commit, "^[a-f0-9]{40}$") || (await ProcessOutput("git", ["rev-parse", "HEAD"], paths.Root, ct)).Trim() != commit)) throw new InvalidDataException("Unexpected publication commit");
            }
            Print(new JsonObject { ["command"] = command, ["clientVersion"] = snapshot.ClientVersion, ["hash"] = snapshot.Hash, ["files"] = snapshot.Files.Count }); return 0;
        }
        if (command == "db:setup") { Print(await DatabaseOwnerTools.SetupAsync(paths, args.Contains("--no-import"), ct)); return 0; }
        if (command == "db:backup") { await BackupAsync(paths, ct); return 0; }
        if (command == "db:migrate")
        {
            await ((ArchiveStore)store).MigrateAsync(ct);
            Print(new JsonObject { ["migrated"] = store.Configured }); return 0;
        }
        if (expectedVersion is not null && (await services.GetRequiredService<IArchiveRefresh>().LatestAsync(ct)).Version != expectedVersion)
            throw new InvalidDataException("Latest client does not match --expected-version; no update applied");
        if (!args.Contains("--dry-run") && command is "db:import" or "update" or "items:refresh" or "references:refresh" or "stats:refresh") await store.InitializeAsync(ct);
        switch (command)
        {
            case "stats:refresh":
                Print(await services.GetRequiredService<ReferenceUpdateService>().StatisticsAsync(args.Contains("--force"), args.Contains("--dry-run"), ct)); return 0;
            case "references:refresh":
                string? Option(string name) { var position = Array.IndexOf(args, name); return position >= 0 ? args[position + 1] : null; }
                Print(await services.GetRequiredService<ReferenceUpdateService>().ReferencesAsync(Option("--profiles"), Option("--map"), args.Contains("--dry-run"), ct, Option("--review"))); return 0;
            case "db:status": Print(await store.StatusAsync(ct)); return 0;
            case "db:import": await store.ImportAsync(await ArchiveJson.ReadFilesAsync(paths, ct), "explicit-import", ct); Print(await store.StatusAsync(ct)); return 0;
            case "db:setup":
                if (!store.Configured) throw new InvalidOperationException("Configure the private DEADLOCK_DB_* environment before initializing PostgreSQL; see docs/database.md.");
                Print(await store.StatusAsync(ct)); return 0;
            case "db:export":
                var relative = args.Skip(1).FirstOrDefault(x => !x.StartsWith('-')) ?? $"work/database-review/{DateTime.UtcNow:yyyyMMddTHHmmss}-{Guid.NewGuid():N}";
                var target = Path.GetFullPath(relative, paths.Root);
                if (!target.StartsWith(Path.Combine(paths.Work, "database-review") + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) || Directory.Exists(target)) throw new InvalidDataException("Export requires a new work/database-review child directory");
                var exported = await store.ReadBundleAsync(ct); Directory.CreateDirectory(target);
                foreach (var (file, keys) in ArchiveJson.Files) if (ArchiveJson.At(exported, keys) is { } node) await File.WriteAllBytesAsync(Path.Combine(target, file), ArchiveJson.Bytes(node), ct);
                Print(new JsonObject { ["exported"] = target }); return 0;
            case "db:backup": await BackupAsync(paths, ct); return 0;
            case "db:query":
                var queryArgs = args.Skip(1).TakeWhile(x => x != "--root").ToArray();
                var kind = queryArgs.ElementAtOrDefault(0) ?? ""; var query = kind is "hero" or "item" ? string.Join(' ', queryArgs.Skip(1)) : queryArgs.ElementAtOrDefault(1) ?? "";
                if (query.Length > 80) throw new InvalidDataException("Query too long");
                var content = await store.ReadBundleAsync(ct);
                if (kind == "status") { Print(await store.StatusAsync(ct)); return 0; }
                if (kind == "history")
                {
                    var history = content["history"]!.DeepClone().AsObject();
                    foreach (var key in new[] { "versions", "patches" }) if (history[key] is JsonArray list) history[key] = new JsonArray(list.Take(50).Select(v => v?.DeepClone()).ToArray());
                    Print(history); return 0;
                }
                if (kind is "hero" or "item")
                {
                    var rows = content[kind == "hero" ? "heroes" : "items"]?[kind == "hero" ? "heroes" : "items"]?.AsArray() ?? [];
                    Print(new JsonArray(rows.Where(x => x!.ToJsonString().Contains(query, StringComparison.OrdinalIgnoreCase)).Take(20).Select(x => x!.DeepClone()).ToArray())); return 0;
                }
                if (kind == "formula")
                {
                    var language = queryArgs.ElementAtOrDefault(2) ?? "ru"; if (language is not ("ru" or "en")) throw new InvalidDataException("Invalid language");
                    Print(content["mechanics"]![language]!["formulas"]!.AsArray().FirstOrDefault(f => f!["id"]!.GetValue<string>() == query)); return 0;
                }
                throw new InvalidDataException("Expected hero NAME, item NAME or formula ID ru|en");
            case "sync":
                var sync = services.GetRequiredService<IPublicSync>();
                JsonObject result;
                if (args.Contains("--dry-run")) { result = await ((PublicSync)sync).DryRunAsync(ct); result["dryRun"] = true; }
                else
                {
                    result = await sync.GetStateAsync(true, ct);
                    if (result["upToDate"]?.GetValue<bool>() != true && result["phase"]?.GetValue<string>() is not ("queued" or "in_progress"))
                    { await sync.PublishAsync(ct); result = sync.ReadState(); }
                    if (args.Contains("--wait"))
                    {
                        using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(10));
                        while (result["phase"]?.GetValue<string>() is "queued" or "in_progress") { await Task.Delay(3000, timeout.Token); result = await sync.GetStateAsync(true, timeout.Token); }
                    }
                }
                Print(result); return result["phase"]?.GetValue<string>() == "failed" ? 1 : 0;
            case "update":
            case "items:refresh":
                if (args.Contains("--dry-run"))
                {
                    var original = await store.ReadBundleAsync(ct); var refresh = services.GetRequiredService<IArchiveRefresh>(); var latest = await refresh.LatestAsync(ct);
                    if (latest.Version < ArchiveJson.Number(original["heroes"]!["meta"]!["clientVersion"])) throw new InvalidDataException("Refusing downgrade");
                    if (latest.Version == ArchiveJson.Number(original["heroes"]!["meta"]!["clientVersion"]) && command == "update")
                    { Print(new JsonObject { ["dryRun"] = true, ["upToDate"] = true, ["clientVersion"] = latest.Version }); return 0; }
                    var candidate = await refresh.BuildAsync(original, latest, ct);
                    var completed = RefreshMaterializer.Complete(candidate);
                    var backfill = await RefreshMaterializer.BackfillAsync(services.GetRequiredService<IPatchHistoryService>(), completed["history"]!.AsObject(), latest.Version, ct);
                    completed["history"] = backfill.History;
                    ArchiveJson.Validate(completed);
                    Directory.CreateDirectory(Path.Combine(paths.Work, "update-review"));
                    await File.WriteAllBytesAsync(Path.Combine(paths.Work, "update-review", "candidate.json"), ArchiveJson.Bytes(completed), ct);
                    Print(new JsonObject { ["dryRun"] = true, ["clientVersion"] = latest.Version, ["summary"] = candidate.Summary.DeepClone(), ["items"] = candidate.Bundle["items"]?["items"]?.AsArray().Count, ["statistics"] = candidate.Bundle["itemStatistics"]?["items"]?.AsArray().Count, ["sourceCommit"] = candidate.SourceCommit }); return 0;
                }
                var updates = services.GetRequiredService<UpdateCoordinator>(); await updates.InitializeAsync(ct); updates.Start(args.Contains("--publish"), refreshItems: command == "items:refresh", expectedVersion: expectedVersion); await updates.WaitAsync(ct); var outcome = updates.ReadState(); Print(outcome); return outcome["phase"]?.GetValue<string>() == "failed" ? 1 : 0;
            default: throw new InvalidDataException("Unknown archive command");
        }
    }
    static (string[] Args, int? ExpectedVersion) ValidateArguments(string command, string[] arguments)
    {
        var args = arguments.Skip(1).ToList();
        var rootSeen = false;
        for (var index = 0; index < args.Count; index++)
        {
            if (args[index] != "--root") continue;
            if (rootSeen || index + 1 >= args.Count || string.IsNullOrWhiteSpace(args[index + 1]) || args[index + 1].StartsWith('-')) throw new InvalidDataException("--root requires one directory");
            rootSeen = true; args.RemoveRange(index, 2); index--;
        }
        int? expected = null;
        if (command is "update" or "items:refresh")
        {
            var seen = new HashSet<string>();
            for (var index = 0; index < args.Count; index++)
            {
                var option = args[index];
                if (!seen.Add(option)) throw new InvalidDataException("Duplicate command option");
                if (option is "--dry-run" or "--publish") continue;
                if (option != "--expected-version") throw new InvalidDataException("Unknown update option");
                if (++index >= args.Count || !Regex.IsMatch(args[index], "^[0-9]+$") || !int.TryParse(args[index], out var version) || version < 1) throw new InvalidDataException("--expected-version requires a positive integer");
                expected = version;
            }
        }
        else if (command == "stats:refresh")
        {
            if (args.Any(a => a is not ("--dry-run" or "--force")) || args.Count != args.Distinct().Count()) throw new InvalidDataException("Usage: stats:refresh [--dry-run] [--force]");
        }
        else if (command == "references:refresh")
        {
            var seen = new HashSet<string>();
            for (var i = 0; i < args.Count; i++) { var option = args[i]; if (!seen.Add(option)) throw new InvalidDataException("Duplicate reference option"); if (option == "--dry-run") continue; if (option is not ("--profiles" or "--map" or "--review") || ++i >= args.Count || args[i].StartsWith('-')) throw new InvalidDataException("Usage: references:refresh [--dry-run] --profiles FILE --map FILE"); }
            if (seen.Contains("--review") && (seen.Contains("--profiles") || seen.Contains("--map"))) throw new InvalidDataException("Use one reference review or curated input files");
            if (!seen.Contains("--profiles") && !seen.Contains("--map") && !seen.Contains("--review")) throw new InvalidDataException("Reference candidate required");
        }
        else if (command == "sync")
        {
            if (args.Any(a => a is not ("--dry-run" or "--wait")) || args.Count != args.Distinct().Count() || args.Count > 1) throw new InvalidDataException("Usage: sync [--dry-run|--wait]");
        }
        else if (command == "db:setup")
        {
            if (args.Count > 1 || args.Any(a => a != "--no-import")) throw new InvalidDataException("Usage: db:setup [--no-import]");
        }
        else if (command == "db:export")
        {
            if (args.Count > 1 || args.Any(a => a.StartsWith('-'))) throw new InvalidDataException("Usage: db:export [work/database-review/name]");
        }
        else if (command == "db:query")
        {
            var valid = args.Count > 0 && args[0] switch
            {
                "status" or "history" => args.Count == 1,
                "hero" or "item" => args.Count >= 2 && !args.Skip(1).Any(a => a.StartsWith('-')) && string.Join(' ', args.Skip(1)).Length is > 0 and <= 80,
                "formula" => args.Count is 2 or 3 && Regex.IsMatch(args[1], "^[a-z0-9-]{1,80}$") && (args.Count == 2 || args[2] is "ru" or "en"),
                _ => false
            };
            if (!valid) throw new InvalidDataException("Usage: db:query status|history|hero NAME|item NAME|formula ID [ru|en]");
        }
        else if (command is "db:status" or "db:migrate" or "db:import" or "db:backup" or "deployment-guard" or "prepare-public" or "verify-publication" or "check")
        {
            if (args.Count > 0) throw new InvalidDataException("Command does not accept extra arguments");
        }
        else throw new InvalidDataException("Unknown archive command");
        return ([command, .. args], expected);
    }
    static void Print(JsonNode? value) => Console.WriteLine(value?.ToJsonString(ArchiveJson.Options) ?? "null");
    public static async Task<string> ProcessOutput(string file, string[] args, string root, CancellationToken ct, Dictionary<string, string>? environment = null)
    {
        var info = new ProcessStartInfo(file) { WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        foreach (var arg in args) info.ArgumentList.Add(arg); if (environment is not null) foreach (var pair in environment) info.Environment[pair.Key] = pair.Value;
        using var process = Process.Start(info) ?? throw new IOException("Could not launch owner tool");
        var output = process.StandardOutput.ReadToEndAsync(ct); var errors = process.StandardError.ReadToEndAsync(ct);
        try { await process.WaitForExitAsync(ct); await errors; if (process.ExitCode != 0) throw new IOException("Owner tool failed"); return await output; }
        finally { if (!process.HasExited) process.Kill(true); }
    }
    public static async Task BackupAsync(AppPaths paths, CancellationToken ct)
    {
        var directory = Path.Combine(paths.Work, "backups", "postgresql"); Directory.CreateDirectory(directory);
        var file = Path.Combine(directory, $"archive-{DateTime.UtcNow:yyyyMMddTHHmmss}-{Guid.NewGuid():N}.dump");
        var tool = OperatingSystem.IsWindows() ? @"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" : "pg_dump";
        string Env(string key) => Environment.GetEnvironmentVariable("DEADLOCK_DB_" + key) ?? throw new InvalidDataException("PostgreSQL configuration missing");
        await ProcessOutput(tool, ["--format=custom", "--no-owner", "--no-acl", "--file", file, "--host", Env("HOST"), "--port", Env("PORT"), "--username", Env("USER"), "--dbname", Env("NAME")], paths.Root, ct, new() { ["PGPASSWORD"] = Env("PASSWORD") });
        Print(new JsonObject { ["backup"] = file });
    }
    static async Task DeploymentGuardAsync(CancellationToken ct)
    {
        var expected = Environment.GetEnvironmentVariable("EXPECTED_SYNC_COMMIT");
        if (expected is null || !Regex.IsMatch(expected, "^[a-f0-9]{40}$")) throw new InvalidDataException("Expected exact deployment commit");
        using var http = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false });
        using var request = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/repos/Roman17-bot/deadlock-archive/git/ref/heads/main");
        request.Headers.UserAgent.ParseAdd("DeadlockArchive/2.0");
        var token = Environment.GetEnvironmentVariable("GITHUB_TOKEN"); if (!string.IsNullOrEmpty(token)) request.Headers.Authorization = new("Bearer", token);
        using var response = await http.SendAsync(request, ct); response.EnsureSuccessStatusCode();
        var json = JsonNode.Parse(await response.Content.ReadAsStringAsync(ct));
        if (json?["object"]?["sha"]?.GetValue<string>() != expected) throw new InvalidDataException("Refusing stale deployment");
    }
}
