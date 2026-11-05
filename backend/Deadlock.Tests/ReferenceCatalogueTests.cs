using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using Deadlock.Api;
using Deadlock.Api.Data;
using Deadlock.Api.Ingestion;
using Deadlock.Api.Sync;

namespace Deadlock.Tests;

public sealed class ReferenceCatalogueTests
{
    sealed class Workspace : IDisposable
    {
        public AppPaths Paths { get; } = new(Path.Combine(Path.GetTempPath(), "deadlock-reference-test-" + Guid.NewGuid().ToString("N")));
        public Workspace() => Directory.CreateDirectory(Paths.Root);
        public void Dispose() => Directory.Delete(Paths.Root, true);
    }
    sealed class Handler(Func<HttpRequestMessage, HttpResponseMessage> reply) : HttpMessageHandler
    {
        public List<Uri> Requests { get; } = [];
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) { Requests.Add(request.RequestUri!); var response = reply(request); response.RequestMessage = request; return Task.FromResult(response); }
    }
    static JsonObject Row(int hero, long day, int wins = 4, int losses = 6) => new() { ["hero_id"] = hero, ["bucket"] = day, ["wins"] = wins, ["losses"] = losses, ["matches"] = wins + losses };
    static JsonObject HeroRoster() => new() { ["meta"] = new JsonObject { ["clientVersion"] = 6848 }, ["heroes"] = new JsonArray(new JsonObject { ["id"] = 1, ["slug"] = "hero-one" }) };
    static JsonObject Profiles() => new() { ["schemaVersion"] = 1, ["clientVersion"] = 6848, ["updatedAt"] = "2026-11-04T08:00:00Z", ["heroes"] = new JsonArray(new JsonObject { ["heroId"] = 1, ["slug"] = "hero-one", ["art"] = new JsonObject { ["background"] = "https://assets-bucket.deadlock-api.com/hero.webp", ["card"] = "https://assets-bucket.deadlock-api.com/card.webp" }, ["summary"] = new JsonObject { ["ru"] = "Описание", ["en"] = "Summary" }, ["lore"] = new JsonObject { ["ru"] = "История", ["en"] = "Story" }, ["relationships"] = new JsonArray(), ["tips"] = new JsonArray(), ["videos"] = new JsonArray() }) };
    internal static JsonObject ProfilesFixture(JsonObject heroes)
    {
        var catalogue = Profiles(); var template = catalogue["heroes"]![0]!.DeepClone(); catalogue["clientVersion"] = heroes["meta"]!["clientVersion"]!.DeepClone(); catalogue["heroes"] = new JsonArray(heroes["heroes"]!.AsArray().Select(hero => { var row = template.DeepClone().AsObject(); row["heroId"] = hero!["id"]!.DeepClone(); row["slug"] = hero["slug"]!.DeepClone(); return (JsonNode)row; }).ToArray()); return catalogue;
    }
    internal static JsonObject StatisticsFixture(int version)
    {
        var from = "2026-11-03T00:00:00Z"; var to = "2026-11-04T08:00:00Z";
        var scopes = StatisticsCollector.ScopeDefinitions(); foreach (var scope in scopes) { scope["from"] = from; scope["to"] = to; scope["updatedAt"] = to; scope["requestedFrom"] = from; scope["requestedTo"] = to; scope["days"] = new JsonArray(new JsonObject { ["date"] = "2026-11-03", ["totalSelections"] = 10, ["rows"] = new JsonArray(new JsonObject { ["heroId"] = 1, ["wins"] = 4, ["losses"] = 6, ["matches"] = 10 }) }); }
        JsonObject Pairs() => new() { ["from"] = from, ["to"] = to, ["updatedAt"] = to, ["sameLane"] = false, ["minMatches"] = 20, ["rows"] = new JsonArray() };
        return new JsonObject { ["schemaVersion"] = 1, ["clientVersion"] = version, ["sourceClientVersion"] = null, ["source"] = "deadlock-api", ["metric"] = "selection-share", ["timeResolutionSeconds"] = 3600, ["from"] = from, ["to"] = to, ["updatedAt"] = to, ["periods"] = new JsonArray(7, 30), ["scopes"] = new JsonArray(scopes.Cast<JsonNode>().ToArray()), ["matchups"] = Pairs(), ["synergies"] = Pairs() };
    }
    [Fact]
    public async Task CollectsExactlySupportedScopesAndKeepsDirectionalPairObservations()
    {
        using var workspace = new Workspace(); var clock = new DateTimeOffset(2026, 11, 4, 8, 0, 0, TimeSpan.Zero); var first = new DateTimeOffset(2026, 10, 6, 0, 0, 0, TimeSpan.Zero).ToUnixTimeSeconds();
        var handler = new Handler(request => new(HttpStatusCode.OK) { Content = new StringContent(request.RequestUri!.AbsolutePath.EndsWith("hero-stats") ? new JsonArray(Row(1, first), Row(2, first)).ToJsonString() : request.RequestUri.AbsolutePath.Contains("counter") ? "[{\"hero_id\":1,\"enemy_hero_id\":2,\"wins\":52,\"matches_played\":100},{\"hero_id\":2,\"enemy_hero_id\":1,\"wins\":47,\"matches_played\":100}]" : "[{\"hero_id1\":1,\"hero_id2\":2,\"wins\":53,\"matches_played\":100}]", Encoding.UTF8, "application/json") });
        var collector = new StatisticsCollector(workspace.Paths, new HttpClient(handler)); var result = await collector.BuildAsync(6848, default, clock);
        Assert.Equal(17, handler.Requests.Count); Assert.Equal(15, result["scopes"]!.AsArray().Count); Assert.Null(result["sourceClientVersion"]);
        var normal = result["scopes"]![0]!; Assert.Equal(20, ArchiveJson.Number(normal["days"]![0]!["totalSelections"]));
        Assert.Equal(47, ArchiveJson.Number(result["matchups"]!["rows"]![1]!["wins"]));
        Assert.Single(handler.Requests, r => r.Query.Contains("game_mode=street_brawl"));
        Assert.DoesNotContain(handler.Requests, r => r.Query.Contains("game_mode=street_brawl") && r.Query.Contains("average_badge"));
        Assert.Equal(11, handler.Requests.Count(r => r.Query.Contains("min_average_badge")));
        Assert.All(handler.Requests.Where(r => r.AbsolutePath.Contains("counter") || r.AbsolutePath.Contains("synergy")), r => Assert.Contains("same_lane_filter=false", r.Query));
        var repeat = await collector.BuildAsync(6848, default, clock); Assert.Equal(17, handler.Requests.Count); ReferenceCatalogues.Statistics(repeat);
        result["scopes"]![0]!["days"]![0]!["totalSelections"] = 19;
        Assert.Throws<InvalidDataException>(() => ReferenceCatalogues.Statistics(result));
    }
    [Fact]
    public void DailySelectionShareDropsWidenedExtraDayAndDoesNotInventMissingDays()
    {
        var from = new DateTimeOffset(2026, 11, 3, 0, 0, 0, TimeSpan.Zero); var to = from.AddHours(23);
        var raw = new JsonArray(Row(1, from.ToUnixTimeSeconds(), 6, 4), Row(2, from.ToUnixTimeSeconds(), 2, 3), Row(1, from.AddDays(1).ToUnixTimeSeconds(), 100, 0));
        var days = StatisticsCollector.Days(raw, from, to); Assert.Single(days); Assert.Equal(15, ArchiveJson.Number(days[0]!["totalSelections"])); Assert.Equal(2, days[0]!["rows"]!.AsArray().Count);
    }
    [Fact]
    public void StatisticsHaveIndependentSixHourFreshness()
    {
        var now = DateTimeOffset.Parse("2026-11-04T08:00:00Z"); Assert.True(StatisticsCollector.Due(null, now));
        Assert.False(StatisticsCollector.Due(new JsonObject { ["updatedAt"] = "2026-11-04T03:00:00Z" }, now));
        Assert.True(StatisticsCollector.Due(new JsonObject { ["updatedAt"] = "2026-11-04T02:00:00Z" }, now));
    }
    [Theory]
    [InlineData("https://attacker.example/image.webp")]
    [InlineData("images/../secrets.webp")]
    [InlineData("file:///tmp/image.webp")]
    public void ProfilesRejectUntrustedOrEscapingMedia(string url)
    {
        var profiles = Profiles(); profiles["heroes"]![0]!["art"]!["background"] = url; Assert.Throws<InvalidDataException>(() => ReferenceCatalogues.Profiles(profiles, HeroRoster()));
    }
    [Fact]
    public void PublicManifestApprovesOnlySafeMediaRoots()
    {
        Assert.True(PublicSnapshot.Approved("data/hero-statistics.json")); Assert.True(PublicSnapshot.Approved("public/images/hero-art/hero-one.webp")); Assert.True(PublicSnapshot.Approved("public/images/map/mid.png"));
        Assert.False(PublicSnapshot.Approved("public/images/../private.webp")); Assert.False(PublicSnapshot.Approved("public/images/token.json")); Assert.False(PublicSnapshot.Approved("knowledge/private.json"));
    }
    [Fact]
    public async Task MediaDownloadsValidateMagicBeforeRewritingPublicReferences()
    {
        var profile = Profiles(); var bundle = new JsonObject { ["heroProfiles"] = profile };
        await Assert.ThrowsAsync<InvalidDataException>(() => ReferenceMedia.MaterializeAsync(bundle, (_, _, _) => Task.FromResult(Encoding.UTF8.GetBytes("not an image")), default));
        Assert.StartsWith("https://", ArchiveJson.Text(profile["heroes"]![0]!["art"]!["background"]));
        var bytes = Encoding.UTF8.GetBytes("RIFF0000WEBPfake"); var assets = await ReferenceMedia.MaterializeAsync(bundle, (_, limit, _) => { Assert.Equal(4 * 1024 * 1024, limit); return Task.FromResult(bytes); }, default, (image, _) => Task.FromResult(image));
        Assert.Single(assets); Assert.Equal("images/hero-art/hero-one.webp", ArchiveJson.Text(profile["heroes"]![0]!["art"]!["background"])); ReferenceCatalogues.Profiles(profile, HeroRoster());
    }
    [Fact]
    public void NewClientProfilesRefreshSourceArtWithoutClaimingEditorialReview()
    {
        var profiles = Profiles(); var heroes = HeroRoster(); heroes["meta"]!["clientVersion"] = 6849;
        var saved = profiles["heroes"]![0]!;
        saved["loreChapters"] = JsonNode.Parse("""
            [{"title":{"ru":"Глава","en":"Chapter"},"paragraphs":[{"ru":"Текст","en":"Text"}]}]
            """);
        saved["tips"] = JsonNode.Parse("""
            [{"title":{"ru":"Совет","en":"Tip"},"ru":"Текст","en":"Text"}]
            """);
        var source = new JsonArray(new JsonObject { ["id"] = 1, ["images"] = new JsonObject { ["background_image_webp"] = "https://assets-bucket.deadlock-api.com/new.webp", ["icon_hero_card_webp"] = "https://assets-bucket.deadlock-api.com/card.webp" } });
        var next = ReferenceSource.Profiles(profiles, heroes, source, 6849, "2026-11-05T00:00:00Z");
        Assert.Equal(6849, ArchiveJson.Number(next["clientVersion"])); Assert.Equal(6848, ArchiveJson.Number(next["heroes"]![0]!["reviewedClientVersion"])); Assert.Equal("https://assets-bucket.deadlock-api.com/new.webp", ArchiveJson.Text(next["heroes"]![0]!["art"]!["background"]));
        Assert.True(JsonNode.DeepEquals(saved["loreChapters"], next["heroes"]![0]!["loreChapters"]));
        Assert.True(JsonNode.DeepEquals(saved["tips"], next["heroes"]![0]!["tips"]));
    }
    internal static JsonObject MapFixture(int version)
    {
        var map = new JsonObject { ["meta"] = new JsonObject { ["schemaVersion"] = 1, ["clientVersion"] = 6848, ["sourceRevision"] = 1, ["sourceCommit"] = new string('a', 40), ["checkedAt"] = "2026-11-04T08:00:00Z" }, ["radius"] = 10752, ["images"] = new JsonObject { ["mid"] = "images/map/mid.png" }, ["rules"] = JsonNode.Parse("{\"campRules\":{\"weak\":{\"firstSpawnSeconds\":120,\"respawnSeconds\":85,\"perUnit\":{\"max_health\":142,\"gold_reward\":45,\"gold_reward_bonus_percent_per_minute\":1.08}}},\"crates\":{\"dropProbability\":0.6,\"soulsBase\":23,\"soulsPerMinute\":1.8},\"toughCrates\":{\"dropProbability\":1,\"soulsBase\":46,\"soulsPerMinute\":3.6},\"goldenStatues\":{\"dropProbability\":0.5}}"), ["ziplinePaths"] = new JsonArray(), ["objects"] = new JsonArray(new JsonObject { ["id"] = "core", ["category"] = "objectives", ["x"] = .5, ["y"] = .9, ["layer"] = null, ["firstSpawnSeconds"] = null, ["respawnSeconds"] = null }) };
        map["meta"]!["clientVersion"] = version; return map;
    }
    [Fact]
    public void ReviewedApplyRejectsSameClientOwnerChanges()
    {
        var archive = new JsonObject { ["clientVersion"] = 6848, ["history"] = "before", ["statistics"] = 1 };
        var review = new JsonObject { ["expectedArchiveHash"] = ArchiveJson.Hash(ArchiveJson.Bytes(archive)) };
        Deadlock.Api.Updates.ReferenceUpdateService.ValidateReviewedArchive(review, archive);
        archive["history"] = "owner edit";
        Assert.Throws<InvalidOperationException>(() => Deadlock.Api.Updates.ReferenceUpdateService.ValidateReviewedArchive(review, archive));
    }
    [Fact]
    public async Task MissingImageOptimizerUsesOnlyTheSameHerosOfficialCard()
    {
        var profile = Profiles(); var bundle = new JsonObject { ["heroProfiles"] = profile }; var requested = new List<string>();
        var image = new byte[30]; Encoding.ASCII.GetBytes("RIFF").CopyTo(image, 0); Encoding.ASCII.GetBytes("WEBPVP8X").CopyTo(image, 8); image[24] = 99; image[27] = 149;
        var assets = await ReferenceMedia.MaterializeAsync(bundle, (url, _, _) => { requested.Add(url); return Task.FromResult(image); }, default, (_, _) => throw new PlatformNotSupportedException());
        Assert.Equal(new[] { "https://assets-bucket.deadlock-api.com/hero.webp", "https://assets-bucket.deadlock-api.com/card.webp" }, requested);
        Assert.Single(assets); Assert.Equal((100, 150), ReferenceImageOptimizer.Dimensions(assets.Single().Value));
    }
    [Fact]
    public void NewClientMapRefreshesKnownClassDataButKeepsUnexposedRulesReviewVersion()
    {
        var map = MapFixture(6848); var rules = map["rules"]!.AsObject(); var template = rules["campRules"]!["weak"]!.DeepClone().AsObject(); template["unitReference"] = "unit";
        foreach (var kind in new[] { "weak", "medium", "strong", "vault" }) rules["campRules"]![kind] = template.DeepClone();
        rules["bridgeBuffs"] = new JsonObject(); rules["healingSnacks"] = new JsonObject();
        var misc = new JsonArray(); foreach (var kind in new[] { "weak", "medium", "strong", "vaults" }) misc.Add(new JsonObject { ["class_name"] = "neutral_camp_" + kind, ["initial_spawn_delay_in_seconds"] = 123, ["spawn_interval_in_seconds"] = 234 });
        misc.Add(new JsonObject { ["class_name"] = "citadel_item_powerup_spawner", ["initial_spawn_time"] = 300, ["spawn_interval"] = 300 }); misc.Add(new JsonObject { ["class_name"] = "citadel_pickup_floating_health", ["spawn_delay"] = 180, ["respawn_time"] = 180 });
        var npcs = new JsonArray(new JsonObject { ["class_name"] = "unit", ["max_health"] = 100, ["gold_reward"] = 55, ["gold_reward_bonus_percent_per_minute"] = 1.08 });
        var source = new JsonObject { ["radius"] = 1000, ["images"] = new JsonObject { ["mid"] = "https://assets-bucket.deadlock-api.com/mid.png" }, ["zipline_paths"] = new JsonArray(), ["entities"] = new JsonObject(), ["neutral_camps"] = new JsonArray(new JsonObject { ["name"] = "one", ["kind"] = "weak", ["position"] = new JsonArray(0, 0, 123) }), ["objective_positions"] = new JsonObject { ["core"] = new JsonObject { ["left_relative"] = .4, ["top_relative"] = .5 } } };
        var result = ReferenceSource.Map(map, source, misc, npcs, new JsonObject(), 6849, 2, new string('b', 40), "2026-11-05T00:00:00Z");
        Assert.Equal(6849, ArchiveJson.Number(result["meta"]!["clientVersion"])); Assert.Equal(6848, ArchiveJson.Number(result["meta"]!["rulesClientVersion"])); Assert.Equal(6849, ArchiveJson.Number(result["meta"]!["classRulesClientVersion"]));
        Assert.Equal(123, ArchiveJson.Number(result["objects"]![0]!["firstSpawnSeconds"])); Assert.Null(result["objects"]![0]!["layer"]); Assert.Null(result["objects"]![0]!["unitCount"]); Assert.Empty(result["routeExamples"]!.AsArray());
    }
    [Fact]
    public void MapMarkersDoNotInventObjectiveElevationOrInstanceTimers()
    {
        var map = MapFixture(6848);
        ReferenceCatalogues.WorldMap(map); var missingRules = map.DeepClone().AsObject(); missingRules["rules"] = new JsonObject(); Assert.Throws<InvalidDataException>(() => ReferenceCatalogues.WorldMap(missingRules)); var missingImage = map.DeepClone().AsObject(); missingImage["images"]!.AsObject().Remove("mid"); Assert.Throws<InvalidDataException>(() => ReferenceCatalogues.WorldMap(missingImage)); map["objects"]![0]!["layer"] = "upper"; Assert.Throws<InvalidDataException>(() => ReferenceCatalogues.WorldMap(map));
    }
}
