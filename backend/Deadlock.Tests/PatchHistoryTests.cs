using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using Deadlock.Api;
using Deadlock.Api.Patches;
using Microsoft.Extensions.Logging.Abstractions;

namespace Deadlock.Tests;

public sealed class PatchHistoryTests : IDisposable
{
    private readonly string root = Path.Combine(Path.GetTempPath(), "deadlock-patches-" + Guid.NewGuid().ToString("N"));
    private PatchHistoryService Service(HttpMessageHandler handler) => new(new AppPaths(root), new HttpClient(handler), NullLogger<PatchHistoryService>.Instance);
    private static JsonObject History(string baseline = "2026-10-01") => new()
    {
        ["schemaVersion"] = 1,
        ["versions"] = new JsonArray(new JsonObject
        {
            ["clientVersion"] = 6800,
            ["buildDate"] = baseline,
            ["firstPublishedAt"] = "2026-10-01T00:00:00.000Z",
            ["provenance"] = new JsonObject { ["kind"] = "snapshot-save", ["reference"] = "2026-10-01T00:00:00.000Z" }
        })
    };
    private static JsonObject News(int id, int day) => new()
    {
        ["gid"] = id.ToString(),
        ["appid"] = 1422450,
        ["feedname"] = "steam_community_announcements",
        ["date"] = new DateTimeOffset(2026, 10, day, 12, 0, 0, TimeSpan.Zero).ToUnixTimeSeconds(),
        ["title"] = $"Gameplay Update {day}",
        ["contents"] = "[h2]Heroes[/h2][list][*]Nurse Harrow: Healing Needles reduced from 25 to 22.[/list]"
    };
    private sealed class Feed(IEnumerable<JsonObject> notes, int failAt = -1) : HttpMessageHandler
    {
        public int Calls { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls++;
            Assert.Equal("api.steampowered.com", request.RequestUri!.Host);
            if (Calls == failAt) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
            var before = long.Parse(request.RequestUri.Query.Split('&').Single(s => s.StartsWith("enddate=")).Split('=')[1]);
            // Simulate an upstream cap lower than our requested page size.
            var page = notes.Where(p => p["date"]!.GetValue<long>() < before).OrderByDescending(p => p["date"]!.GetValue<long>()).Take(1);
            var json = new JsonObject { ["appnews"] = new JsonObject { ["appid"] = 1422450, ["newsitems"] = new JsonArray(page.Select(p => (JsonNode?)p.DeepClone()).ToArray()) } };
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json.ToJsonString(), Encoding.UTF8, "application/json") });
        }
    }

    [Fact]
    public async Task BackfillsAllPagesAndResumesAfterBoundWithoutInventingClientVersions()
    {
        var feed = new Feed(Enumerable.Range(1, 20).Select(day => News(day, day)));
        var service = Service(feed);
        var first = await service.EnrichAsync(History(), 6800);
        Assert.Equal(8, first["patches"]!.AsArray().Count);
        Assert.True(service.HasPending);
        Assert.False(service.LastCheckFailed);
        Assert.Null(first["patchBackfill"]);
        var result = first;
        for (var retry = 0; retry < 4; retry++) result = await service.EnrichAsync(result, 6800);
        Assert.Equal(20, result["patches"]!.AsArray().Count);
        Assert.False(service.HasPending);
        Assert.False(service.LastCheckFailed);
        Assert.True(JsonNode.DeepEquals(History()["versions"], result["versions"]));
        Assert.All(result["patches"]!.AsArray(), p =>
        {
            Assert.Null(p!["clientVersion"]);
            Assert.Contains("Healing Needles reduced from 25 to 22", p["body"]!["en"]!.GetValue<string>());
        });
        var stable = await service.EnrichAsync(result, 6800);
        Assert.True(JsonNode.DeepEquals(result, stable));
    }

    [Fact]
    public async Task FailedPageKeepsEarlierDescriptionsAndRetriesCursor()
    {
        var feed = new Feed(new[] { News(1, 30), News(2, 20), News(3, 10) }, failAt: 2);
        var service = Service(feed);
        var first = await service.EnrichAsync(History(), 6800);
        Assert.Single(first["patches"]!.AsArray());
        Assert.True(service.HasPending);
        Assert.True(service.LastCheckFailed);
        // Simulate failed database import: return the original history again. Private cache recovers the first page.
        var recovered = await service.EnrichAsync(History(), 6800);
        Assert.Equal(3, recovered["patches"]!.AsArray().Count);
        Assert.False(service.HasPending);
        Assert.False(service.LastCheckFailed);
        Assert.True(JsonNode.DeepEquals(recovered, await service.EnrichAsync(recovered, 6800)));
    }

    [Fact]
    public async Task NewLongOfflineGapHasItsOwnDurableCursorAfterInitialBackfillCompleted()
    {
        var initial = Service(new Feed(new[] { News(1, 1) }));
        var history = await initial.EnrichAsync(History(), 6800);
        var service = Service(new Feed(Enumerable.Range(1, 30).Select(day => News(day, day))));
        for (var retry = 0; retry < 6; retry++) history = await service.EnrichAsync(history, 6800);
        Assert.Equal(30, history["patches"]!.AsArray().Count);
        Assert.Equal(30, history["patches"]!.AsArray().Select(p => p!["id"]!.GetValue<string>()).Distinct().Count());
    }

    [Fact]
    public async Task FailureWithNoDescriptionsDoesNotChangeHistory()
    {
        var history = History();
        var result = await Service(new Feed([], failAt: 1)).EnrichAsync(history, 6800);
        Assert.True(JsonNode.DeepEquals(history, result));
    }

    [Fact]
    public async Task EmptyAnnouncementsAreOmittedAndMarkupIsPlainText()
    {
        var image = News(1, 30);
        image["contents"] = "[img]https://example.com/image.png[/img]";
        var note = News(2, 29);
        note["contents"] = "[h2]Heroes[/h2][list][*]Nurse Harrow: Heal 25 &gt; 22.[/list]<script>alert('safe text')</script>";
        var result = await Service(new Feed(new[] { image, note })).EnrichAsync(History(), 6800);
        Assert.Single(result["patches"]!.AsArray());
        var body = result["patches"]![0]!["body"]!["en"]!.GetValue<string>();
        Assert.Contains("## Heroes", body);
        Assert.Contains("- Nurse Harrow: Heal 25 > 22.", body);
        Assert.DoesNotContain("<script>", body);
        Assert.DoesNotContain("[list]", body);
    }

    public void Dispose()
    {
        if (Directory.Exists(root)) Directory.Delete(root, true);
    }
}
