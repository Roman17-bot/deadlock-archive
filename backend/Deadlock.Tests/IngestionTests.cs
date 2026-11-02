using System.Net;
using System.Text.Json.Nodes;
using Deadlock.Api;
using Deadlock.Api.Ingestion;
using Xunit.Abstractions;

namespace Deadlock.Tests;

public sealed class IngestionTests(ITestOutputHelper output)
{
    static string Root { get { var d = new DirectoryInfo(AppContext.BaseDirectory); while (d is not null && !File.Exists(Path.Combine(d.FullName, "data/updater-policy.json"))) d = d.Parent; if (d is null && File.Exists(Path.Combine(Directory.GetCurrentDirectory(), "data/updater-policy.json"))) return Directory.GetCurrentDirectory(); return d?.FullName ?? throw new DirectoryNotFoundException("Repository root"); } }
    static string Fixture(string file) { var migrated = Path.Combine(Root, "backend/Deadlock.Tests/Fixtures/6819", file); return File.ReadAllText(File.Exists(migrated) ? migrated : Path.Combine(Root, "server/updates/fixtures", file)); }
    static JsonObject Current() => new() { ["heroes"] = JsonNode.Parse(File.ReadAllText(Path.Combine(Root, "data/heroes.json"))), ["mechanics"] = new JsonObject { ["ru"] = new JsonObject { ["sentinel"] = "never reverify" } }, ["history"] = new JsonObject { ["versions"] = new JsonArray() }, ["provenance"] = new JsonObject { ["sentinel"] = "retain" } };
    static readonly GameVersion Version = new(6819, 11162696, "2026-10-22");
    const string Commit = "17462b250a0ca80e7f80102f2c83cc3eecff5f12";
    static JsonObject Shop() => JsonNode.Parse("""{"id":1,"name":"Example","class_name":"upgrade_example","type":"upgrade","shopable":true,"item_slot_type":"weapon","item_tier":1,"cost":800,"is_active_item":false,"properties":{"TechPower":{"value":"7","label":"Spirit Power","prefix":"{s:sign}"}},"description":{},"tooltip_sections":[{"section_type":"innate","section_attributes":[{"properties":["TechPower"]}]}],"shop_image_webp":"https://assets-bucket.deadlock-api.com/example.webp"}""")!.AsObject();
    static JsonObject Steam() => JsonNode.Parse("""{"client_version":6819,"server_version":6819,"source_revision":11162696,"version_date":"Oct 22 2026","version_time":"16:40:35"}""")!.AsObject();
    sealed class Fake(Func<HttpRequestMessage, HttpResponseMessage> handle) : HttpMessageHandler { protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) { var r = handle(request); r.RequestMessage = request; return Task.FromResult(r); } }
    static HttpResponseMessage Json(JsonNode node) => new(HttpStatusCode.OK) { Content = new StringContent(node.ToJsonString()) };
    static HttpResponseMessage Text(string text) => new(HttpStatusCode.OK) { Content = new StringContent(text) };
    static string RawSteam(int version = 6819, long revision = 11162696, string date = "Oct 22 2026") => $"ClientVersion={version}\nServerVersion={version}\nSourceRevision={revision}\nVersionDate={date}\nVersionTime=16:40:35";
    static HttpClient Mock(List<Uri> calls, bool drift = false, bool failRu = false, Func<Uri, HttpResponseMessage?>? source = null)
    {
        var checks = 0;
        return new HttpClient(new Fake(request =>
        {
            var u = request.RequestUri!; lock (calls) calls.Add(u);
            var overridden = source?.Invoke(u); if (overridden is not null) return overridden;
            if (u.AbsolutePath.EndsWith("/steam-info")) { var info = Steam(); if (u.Query == "" && ++checks > 1 && drift) { info["client_version"] = 6820; info["server_version"] = 6820; } return Json(info); }
            if (u.AbsolutePath.EndsWith("/commits/master")) return Json(new JsonObject { ["sha"] = Commit });
            if (u.AbsolutePath.EndsWith("/steam.inf")) return Text(RawSteam());
            if (u.AbsolutePath.EndsWith("/heroes.vdata")) return Text(Fixture("heroes.vdata")); if (u.AbsolutePath.EndsWith("/abilities.vdata")) return Text(Fixture("abilities.vdata"));
            if (u.AbsolutePath.EndsWith("/heroes")) return Text(Fixture("heroes.json"));
            if (u.AbsolutePath.EndsWith("/items")) { if (failRu && u.Query.Contains("russian")) return new(HttpStatusCode.BadRequest); var rows = JsonNode.Parse(Fixture("items.json"))!.AsArray(); for (var i = 0; i < rows.Count; i++) rows[i]!["id"] = 100000 + i; rows.Add(Shop()); return Json(rows); }
            if (u.AbsolutePath.EndsWith("/item-stats")) return Json(JsonNode.Parse(u.Query.Contains("bucket=hero") ? """[{"item_id":1,"bucket":4,"wins":6,"losses":4,"matches":10,"avg_buy_time_s":360}]""" : """[{"item_id":1,"bucket":0,"wins":6,"losses":4,"matches":10,"avg_buy_time_s":360}]""")!);
            if (u.Host == "assets-bucket.deadlock-api.com") return new(HttpStatusCode.OK) { Content = new ByteArrayContent("RIFF0000WEBPfixture"u8.ToArray()) };
            throw new InvalidOperationException("Unexpected request " + u);
        }));
    }
    [Fact]
    public void Kv3PreservesTypedValuesAndRejectsMalformedOrHostileInput()
    {
        var result = Kv3.Parse("<!-- header --> { x=resource_name:\"file.vpcf\" n=0xff b=true a=[1,2] y=subclass:{ k=1 } }"); Assert.Equal("file.vpcf", result["x"]!.GetValue<string>()); Assert.Equal(255, result["n"]!.GetValue<double>());
        foreach (var bad in new[] { "{x=1 x=2}", "{__proto__={}}", "{x=bad}", "{x=unknown:\"x\"}", "{x=1e999}", "{} {}", "{x=[1}" }) Assert.ThrowsAny<Exception>(() => Kv3.Parse(bad));
    }
    [Theory]
    [InlineData("http://api.deadlock-api.com/x")]
    [InlineData("https://evil.test/x")]
    [InlineData("https://user:secret@api.deadlock-api.com/x")]
    [InlineData("https://api.deadlock-api.com:8443/x")]
    public void RejectsUntrustedOrigins(string url) => Assert.Throws<InvalidDataException>(() => ArchiveRefresh.ValidateSource(url));
    [Fact]
    public async Task FullCandidatePinsVersionAndPreservesCompanionsWithoutWrites()
    {
        var calls = new List<Uri>(); var current = Current(); current["heroes"]!["meta"]!["clientVersion"] = 6818; var before = current.ToJsonString(); using var http = Mock(calls); var service = new ArchiveRefresh(new(Root), http); var candidate = await service.BuildAsync(current, Version);
        Assert.Equal(before, current.ToJsonString()); Assert.True(JsonNode.DeepEquals(current["mechanics"], candidate.Bundle["mechanics"])); Assert.True(JsonNode.DeepEquals(current["history"], candidate.Bundle["history"])); Assert.True(JsonNode.DeepEquals(current["provenance"], candidate.Bundle["provenance"])); Assert.Equal(6, candidate.Summary["heroCount"]!.GetValue<int>()); Assert.Single(candidate.Bundle["items"]!["items"]!.AsArray()); Assert.Contains("public/assets/items/example.webp", candidate.Assets.Keys);
        Assert.All(calls.Where(u => u.AbsolutePath.EndsWith("/items") || u.AbsolutePath.EndsWith("/heroes")), u => Assert.Contains("client_version=6819", u.Query));
        Assert.DoesNotContain(calls, u => u.AbsolutePath.EndsWith("/commits")); Assert.Equal(Commit, candidate.SourceCommit);
        var analytics = calls.Where(u => u.AbsolutePath.EndsWith("/item-stats")).ToList(); Assert.Equal(2, analytics.Count); Assert.Equal(analytics[0].Query.Replace("bucket=no_bucket", "bucket=hero"), analytics[1].Query); Assert.Contains("min_unix_timestamp=1792687235", analytics[0].Query);
        var heroes = candidate.Bundle["heroes"]!["heroes"]!.AsArray().OfType<JsonObject>().ToDictionary(h => h["name"]!.GetValue<string>());
        Assert.True(heroes["Baba"]["weapon"]!["hitOnce"]!.GetValue<bool>()); Assert.Equal(3, heroes["Baba"]["weapon"]!["projectiles"]!.GetValue<double>());
        Assert.True(heroes["Victor"]["weapon"]!["spinsUp"]!.GetValue<bool>()); Assert.Equal(0.171, heroes["Victor"]["weapon"]!["fullSpinCycle"]!.GetValue<double>());
        Assert.Equal(3 / (0.2625 + 2 * 0.084), heroes["Seven"]["weapon"]!["shotsPerSecond"]!.GetValue<double>(), 12);
        Assert.Equal(4, heroes["Deadman Danny"]["weapon"]!["shotsPerSecond"]!.GetValue<double>()); Assert.True(heroes["Warden"]["scaling"]!["fireRatePercentPerSpirit"]!.GetValue<double>() > 0);
    }
    [Fact]
    public async Task ApiExtractionLagResolvesExactHistoricalSteamVersionAndPinsAllRawSources()
    {
        const string head = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", disagreement = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        var calls = new List<Uri>(); var current = Current(); current["heroes"]!["meta"]!["clientVersion"] = 6818;
        using var http = Mock(calls, source: u =>
        {
            if (u.AbsolutePath.EndsWith("/commits/master")) return Json(new JsonObject { ["sha"] = head });
            if (u.AbsolutePath.EndsWith("/commits")) { Assert.Contains("sha=" + head, u.Query); Assert.Contains("path=game%2Fcitadel%2Fsteam.inf", u.Query); return Json(new JsonArray(new JsonObject { ["sha"] = head }, new JsonObject { ["sha"] = disagreement }, new JsonObject { ["sha"] = Commit })); }
            if (u.AbsolutePath.Contains(head) && u.AbsolutePath.EndsWith("/steam.inf")) return Text(RawSteam(6821));
            if (u.AbsolutePath.Contains(disagreement) && u.AbsolutePath.EndsWith("/steam.inf")) return Text(RawSteam(revision: 11162697));
            return null;
        });
        var candidate = await new ArchiveRefresh(new(Root), http).BuildAsync(current, Version);
        Assert.Equal(Commit, candidate.SourceCommit); Assert.Equal(Version.Version, candidate.Bundle["heroes"]!["meta"]!["clientVersion"]!.GetValue<int>());
        Assert.All(calls.Where(u => u.AbsolutePath.EndsWith(".vdata")), u => Assert.Contains("/" + Commit + "/", u.AbsolutePath));
        Assert.Equal(3, calls.Count(u => u.AbsolutePath.EndsWith("/steam.inf")));
    }
    [Theory]
    [InlineData(11162697, "Oct 22 2026")]
    [InlineData(11162696, "Oct 23 2026")]
    public async Task SameClientWithDifferentRevisionOrBuildDateIsNeverAccepted(long revision, string date)
    {
        var calls = new List<Uri>(); var current = Current(); current["heroes"]!["meta"]!["clientVersion"] = 6818; var before = current.ToJsonString();
        using var http = Mock(calls, source: u => u.AbsolutePath.EndsWith("/steam.inf") ? Text(RawSteam(revision: revision, date: date)) : u.AbsolutePath.EndsWith("/commits") ? Json(new JsonArray()) : null);
        await Assert.ThrowsAsync<InvalidDataException>(() => new ArchiveRefresh(new(Root), http).BuildAsync(current, Version));
        Assert.Equal(before, current.ToJsonString()); Assert.DoesNotContain(calls, u => u.AbsolutePath.EndsWith(".vdata"));
    }
    [Fact]
    public async Task HistoricalVersionSearchStopsAtThirtyCandidatesAndThreePages()
    {
        var calls = new List<Uri>(); var current = Current(); current["heroes"]!["meta"]!["clientVersion"] = 6818;
        using var http = Mock(calls, source: u =>
        {
            if (u.AbsolutePath.EndsWith("/steam.inf")) return Text(RawSteam(6821));
            if (u.AbsolutePath.EndsWith("/commits")) { var page = int.Parse(u.Query.Split("page=").Last()); return Json(new JsonArray(Enumerable.Range((page - 1) * 10 + 1, 10).Select(i => (JsonNode)new JsonObject { ["sha"] = i.ToString("x40") }).ToArray())); }
            return null;
        });
        var error = await Assert.ThrowsAsync<InvalidDataException>(() => new ArchiveRefresh(new(Root), http).BuildAsync(current, Version));
        Assert.Contains("history", error.Message, StringComparison.OrdinalIgnoreCase); Assert.Equal(3, calls.Count(u => u.AbsolutePath.EndsWith("/commits"))); Assert.Equal(31, calls.Count(u => u.AbsolutePath.EndsWith("/steam.inf"))); Assert.DoesNotContain(calls, u => u.AbsolutePath.EndsWith(".vdata"));
    }
    [Fact]
    public async Task InvalidHistoricalCommitCannotBecomeAnUpstreamPath()
    {
        var calls = new List<Uri>(); var current = Current(); current["heroes"]!["meta"]!["clientVersion"] = 6818;
        using var http = Mock(calls, source: u => u.AbsolutePath.EndsWith("/steam.inf") ? Text(RawSteam(6821)) : u.AbsolutePath.EndsWith("/commits") ? Json(new JsonArray(new JsonObject { ["sha"] = "../master" })) : null);
        var error = await Assert.ThrowsAsync<InvalidDataException>(() => new ArchiveRefresh(new(Root), http).BuildAsync(current, Version)); Assert.Contains("commit", error.Message, StringComparison.OrdinalIgnoreCase); Assert.Single(calls, u => u.AbsolutePath.EndsWith("/steam.inf"));
    }
    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task FailureOrVersionDriftNeverReturnsPartialCandidate(bool drift, bool failRu)
    {
        var current = Current(); current["heroes"]!["meta"]!["clientVersion"] = 6818; var before = current.ToJsonString(); using var http = Mock([], drift, failRu); await Assert.ThrowsAnyAsync<Exception>(() => new ArchiveRefresh(new(Root), http).BuildAsync(current, Version)); Assert.Equal(before, current.ToJsonString());
    }
    [Fact]
    public void NormalItemsKeepLocalizedValuesAndRecipientSemantics()
    {
        var item = Shop(); item["id"] = 3361811174L; item["name"] = "Cheat Death"; item["properties"]!["HealAmpReceivePenaltyPercent"] = new JsonObject { ["value"] = "-60", ["label"] = "Incoming Healing" }; var ru = (JsonObject)item.DeepClone(); ru["name"] = "Обман смерти"; ru["properties"]!["TechPower"]!["label"] = "Спиритическая мощь";
        var result = ItemAdapter.Catalog(new JsonArray(item), new JsonArray(ru), Version, "2026-11-02T00:00:00Z", new JsonObject()); var normalized = result["items"]![0]!; Assert.Equal("+7", normalized["attributes"]![0]!["value"]!.GetValue<string>()); Assert.Equal("Спиритическая мощь", normalized["attributes"]![0]!["label"]!["ru"]!.GetValue<string>()); var tags = normalized["tags"]!.AsArray().Select(x => x!.GetValue<string>()).ToList(); Assert.Contains("cleanse", tags); Assert.Contains("death-prevention", tags); Assert.DoesNotContain("anti-heal", tags);
    }
    [Fact]
    public void StatisticsRejectInconsistentCountsAndDuplicateHeroBuckets()
    {
        var catalog = ItemAdapter.Catalog(new JsonArray(Shop()), new JsonArray(Shop()), Version, "2026-11-02T00:00:00Z", new JsonObject());
        Assert.Throws<InvalidDataException>(() => ItemAdapter.Statistics(JsonNode.Parse("""[{"item_id":1,"wins":6,"losses":4,"matches":11,"avg_buy_time_s":360}]""")!.AsArray(), [], catalog, 6819, "2026-11-02T00:00:00Z", "2026-11-01T00:00:00Z", "2026-11-02T00:00:00Z"));
    }
    [Fact]
    public void StrictShapeValidationRejectsMissingHeroFieldsInvalidItemsAndBadPatchBinding()
    {
        var heroes = Current()["heroes"]!.AsObject(); ArchiveValidation.Heroes(heroes); heroes["heroes"]![0]!["base"]!.AsObject().Remove("spirit"); Assert.Throws<InvalidDataException>(() => ArchiveValidation.Heroes(heroes));
        var catalog = ItemAdapter.Catalog(new JsonArray(Shop()), new JsonArray(Shop()), Version, "2026-11-02T00:00:00Z", new JsonObject()); ArchiveValidation.Catalog(catalog); catalog["items"]![0]!["cost"] = 1; Assert.Throws<InvalidDataException>(() => ArchiveValidation.Catalog(catalog));
        var history = JsonNode.Parse(File.ReadAllText(Path.Combine(Root, "data/version-history.json")))!.AsObject(); ArchiveValidation.History(history); history["versions"]![0]!["patch"]!["url"] = "https://steamdb.info/patchnotes/1/"; Assert.Throws<InvalidDataException>(() => ArchiveValidation.History(history));
    }
    [Fact]
    public void NumericJsonFormattingMatchesJavaScriptStringAndDisabledValueSemantics()
    {
        var shop = Shop(); shop["properties"]!["TechPower"]!["value"] = JsonNode.Parse("7.0"); shop["properties"]!["Hidden"] = JsonNode.Parse("""{"value":0.0,"disable_value":"0","label":"Hidden"}"""); shop["tooltip_sections"]![0]!["section_attributes"]![0]!["properties"]!.AsArray().Add("Hidden");
        var catalog = ItemAdapter.Catalog(new JsonArray(shop), new JsonArray(shop.DeepClone()), Version, "2026-11-02T00:00:00Z", new JsonObject()); var attributes = catalog["items"]![0]!["attributes"]!.AsArray(); Assert.Single(attributes); Assert.Equal("+7", attributes[0]!["value"]!.GetValue<string>());
    }
    [Fact]
    public async Task LiveReadOnlyCandidateWhenExplicitlyEnabled()
    {
        if (Environment.GetEnvironmentVariable("DEADLOCK_LIVE_INGESTION") != "1") return;
        var current = Current(); using var http = new HttpClient(new SocketsHttpHandler { AllowAutoRedirect = false }) { Timeout = Timeout.InfiniteTimeSpan }; var service = new ArchiveRefresh(new(Root), http); var latest = await service.LatestAsync(); output.WriteLine($"Latest {latest}"); var candidate = await service.BuildAsync(current, latest); output.WriteLine(candidate.Summary.ToJsonString()); output.WriteLine($"Source commit {candidate.SourceCommit}; assets {candidate.Assets.Count}");
        foreach (var next in candidate.Bundle["heroes"]!["heroes"]!.AsArray().OfType<JsonObject>()) { var old = current["heroes"]!["heroes"]!.AsArray().OfType<JsonObject>().FirstOrDefault(h => JsonNode.DeepEquals(h["id"], next["id"])); if (old is null) { output.WriteLine("Added " + next["name"]); continue; } foreach (var field in new[] { "base", "growth", "scaling", "weapon" }) if (!JsonNode.DeepEquals(old[field], next[field])) output.WriteLine(next["name"] + " " + field + " old=" + old[field] + " new=" + next[field]); }
        Assert.True(JsonNode.DeepEquals(current["mechanics"], candidate.Bundle["mechanics"])); Assert.Equal(latest.Version, candidate.Bundle["items"]!["meta"]!["clientVersion"]!.GetValue<int>());
    }
}
