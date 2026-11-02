using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Nodes;
using Deadlock.Api;
using Deadlock.Api.Data;
using Deadlock.Api.Updates;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace Deadlock.Tests;

public class ApiContractsTests
{
    sealed class MemoryArchive(JsonObject bundle) : IArchiveStore
    {
        public bool Configured => false;
        public Task InitializeAsync(CancellationToken ct = default) => Task.CompletedTask;
        public Task<JsonObject> ReadBundleAsync(CancellationToken ct = default) => Task.FromResult((JsonObject)bundle.DeepClone());
        public Task ImportAsync(JsonObject next, string reason, CancellationToken ct = default) { bundle = (JsonObject)next.DeepClone(); return Task.CompletedTask; }
        public Task<JsonObject> StatusAsync(CancellationToken ct = default) => Task.FromResult(new JsonObject());
    }
    sealed class NoChangeRefresh(int version) : IArchiveRefresh
    {
        public int Builds;
        public Task<GameVersion> LatestAsync(CancellationToken ct = default) => Task.FromResult(new GameVersion(version, 1, "2026-10-27"));
        public Task<RefreshCandidate> BuildAsync(JsonObject current, GameVersion expected, CancellationToken ct = default) { Builds++; throw new InvalidOperationException("Same version must not fetch assets"); }
    }
    sealed class UnchangedHistory : IPatchHistoryService
    {
        public int Checks;
        public Task<JsonObject> EnrichAsync(JsonObject history, int currentVersion, CancellationToken ct = default) { Checks++; return Task.FromResult((JsonObject)history.DeepClone()); }
    }
    sealed class NoPublication : IPublicSync
    {
        public int Publications;
        public bool IsBusy => false;
        public JsonObject ReadState() => new() { ["available"] = false, ["phase"] = "idle" };
        public Task<JsonObject> GetStateAsync(bool refresh = false, CancellationToken ct = default) => Task.FromResult(ReadState());
        public JsonObject Start() { Publications++; return ReadState(); }
        public Task<JsonObject> PublishAsync(CancellationToken ct = default) { Publications++; return Task.FromResult(ReadState()); }
    }
    sealed class ApiFactory : WebApplicationFactory<Program>
    {
        readonly string testRoot = Path.Combine(Path.GetTempPath(), "deadlock-api-test-" + Guid.NewGuid().ToString("N"));
        public JsonObject Bundle;
        public NoChangeRefresh Refresh;
        public UnchangedHistory History = new();
        public NoPublication Sync = new();
        public ApiFactory()
        {
            Directory.CreateDirectory(testRoot);
            var root = AppEnvironment.ResolveRoot([]);
            Bundle = ArchiveJson.ReadFilesAsync(new(root), CancellationToken.None).GetAwaiter().GetResult();
            Refresh = new((int)ArchiveJson.Number(Bundle["heroes"]!["meta"]!["clientVersion"]));
        }
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<AppPaths>(); services.AddSingleton(new AppPaths(testRoot));
                foreach (var descriptor in services.Where(d => d.ServiceType == typeof(IHostedService) && d.ImplementationType == typeof(StartupRefresh)).ToArray()) services.Remove(descriptor);
                services.RemoveAll<IArchiveStore>(); services.AddSingleton<IArchiveStore>(new MemoryArchive(Bundle));
                services.RemoveAll<IArchiveRefresh>(); services.AddSingleton<IArchiveRefresh>(Refresh);
                services.RemoveAll<IPatchHistoryService>(); services.AddSingleton<IPatchHistoryService>(History);
                services.RemoveAll<IPublicSync>(); services.AddSingleton<IPublicSync>(Sync);
            });
        }
        public override async ValueTask DisposeAsync()
        {
            await base.DisposeAsync();
            if (Path.GetDirectoryName(testRoot) != Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) || !Path.GetFileName(testRoot).StartsWith("deadlock-api-test-")) throw new InvalidOperationException("Unexpected test path");
            if (Directory.Exists(testRoot)) Directory.Delete(testRoot, true);
        }
    }
    [Fact]
    public async Task ReadApiPreservesCompleteJsonPayloadsAndHead()
    {
        await using var app = new ApiFactory(); using var http = app.CreateClient();
        foreach (var (path, expected) in new Dictionary<string, JsonNode?>
        {
            ["heroes"] = app.Bundle["heroes"],
            ["items"] = app.Bundle["items"],
            ["item-statistics"] = app.Bundle["itemStatistics"],
            ["version-history"] = app.Bundle["history"],
            ["mechanics"] = app.Bundle["mechanics"]!["ru"],
            ["mechanics?language=en"] = app.Bundle["mechanics"]!["en"]
        })
        {
            using var response = await http.GetAsync("/api/" + path);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True(JsonNode.DeepEquals(expected, JsonNode.Parse(await response.Content.ReadAsStringAsync())), path);
            Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        }
        using var head = await http.SendAsync(new(HttpMethod.Head, "/api/heroes"));
        Assert.Equal(HttpStatusCode.OK, head.StatusCode); Assert.Empty(await head.Content.ReadAsByteArrayAsync());
        var hero = app.Bundle["heroes"]!["heroes"]!.AsArray()[0]!;
        var matches = await http.GetFromJsonAsync<JsonArray>("/api/heroes/search?q=" + Uri.EscapeDataString(hero["name"]!.GetValue<string>()) + "&limit=1");
        Assert.True(JsonNode.DeepEquals(hero, Assert.Single(matches!)));
        var formula = app.Bundle["mechanics"]!["ru"]!["formulas"]!.AsArray()[0]!;
        Assert.True(JsonNode.DeepEquals(formula, await http.GetFromJsonAsync<JsonNode>("/api/formulas/" + formula["id"])));
    }
    [Theory]
    [InlineData("/api/mechanics?language=de", 400)]
    [InlineData("/api/formulas/INVALID", 400)]
    [InlineData("/api/heroes/search?limit=21", 400)]
    [InlineData("/api/formulas/does-not-exist", 404)]
    [InlineData("/api/unknown", 404)]
    public async Task InvalidReadsHaveCompatibleStatuses(string path, int expected)
    { await using var app = new ApiFactory(); using var http = app.CreateClient(); Assert.Equal(expected, (int)(await http.GetAsync(path)).StatusCode); }

    [Fact]
    public async Task MutationsRequireLocalOriginNonceAndStrictBodyAndSameVersionSkipsAssetsAndPublication()
    {
        await using var app = new ApiFactory(); using var http = app.CreateClient();
        var session = await http.GetFromJsonAsync<JsonObject>("/api/update/session"); var token = session!["token"]!.GetValue<string>();
        async Task<int> Send(string body, string? origin, string? nonce, string contentType = "application/json")
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/api/update") { Content = new StringContent(body, Encoding.UTF8, contentType) };
            if (origin is not null) request.Headers.Add("Origin", origin); if (nonce is not null) request.Headers.Add("X-Archive-Token", nonce);
            using var response = await http.SendAsync(request); return (int)response.StatusCode;
        }
        Assert.Equal(403, await Send("{\"publish\":true}", null, token));
        Assert.Equal(403, await Send("{\"publish\":true}", "https://evil.example", token));
        Assert.Equal(403, await Send("{\"publish\":true}", "http://127.0.0.1:5173", "wrong"));
        Assert.Equal(415, await Send("{}", "http://127.0.0.1:5173", token, "text/plain"));
        Assert.Equal(400, await Send("{\"publish\":true,\"extra\":1}", "http://127.0.0.1:5173", token));
        Assert.Equal(413, await Send(new string('a', 5000), "http://127.0.0.1:5173", token));
        Assert.Equal(202, await Send("{\"publish\":true}", "http://127.0.0.1:5173", token));
        var updates = app.Services.GetRequiredService<UpdateCoordinator>(); await updates.WaitAsync();
        Assert.Equal("succeeded", updates.ReadState()["phase"]!.GetValue<string>());
        Assert.True(updates.ReadState()["upToDate"]!.GetValue<bool>());
        Assert.Equal(1, app.History.Checks); Assert.Equal(0, app.Refresh.Builds); Assert.Equal(0, app.Sync.Publications);
    }
}
