using System.Globalization;
using System.Text.Json.Nodes;
using Deadlock.Api.Data;
using Deadlock.Api.Sync;

namespace Deadlock.Tests;

public sealed class StatisticsHistoryTests
{
    static JsonObject Stats(string from, string to, params (string Date, int Wins, int Losses)[] rows)
    {
        var stats = ReferenceCatalogueTests.StatisticsFixture(6848);
        stats["from"] = from + "T00:00:00Z"; stats["to"] = to + "T12:00:00Z"; stats["updatedAt"] = to + "T13:00:00Z";
        foreach (var scope in stats["scopes"]!.AsArray())
        {
            foreach (var key in new[] { "from", "to", "updatedAt" }) scope![key] = stats[key]!.DeepClone();
            scope!["requestedFrom"] = stats["from"]!.DeepClone(); scope["requestedTo"] = stats["to"]!.DeepClone();
            scope["days"] = new JsonArray(rows.Select(row => (JsonNode)new JsonObject
            {
                ["date"] = row.Date, ["totalSelections"] = row.Wins + row.Losses,
                ["rows"] = new JsonArray(new JsonObject { ["heroId"] = 1, ["wins"] = row.Wins, ["losses"] = row.Losses, ["matches"] = row.Wins + row.Losses })
            }).ToArray());
        }
        return stats;
    }
    [Fact]
    public void RetainsOlderObservedDaysAndReplacesTheCompleteOverlappingWindowWithoutFillingGaps()
    {
        var old = Stats("2026-09-01", "2026-10-01", ("2026-09-01", 5, 5), ("2026-10-01", 2, 8));
        var current = Stats("2026-10-01", "2026-11-01", ("2026-10-01", 8, 2), ("2026-11-01", 6, 4));
        var history = StatisticsHistory.Merge(null, old, current);
        var scope = history["normal-all-all"]!.AsObject();
        Assert.Equal(new[] { "2026-09-01", "2026-10-01", "2026-11-01" }, scope["days"]!.AsArray().Select(d => ArchiveJson.Text(d!["date"])));
        Assert.Equal("1,8,2,10", ArchiveJson.Text(scope["days"]![1]!["rows"]));
        var corrected = Stats("2026-10-01", "2026-11-02", ("2026-11-02", 7, 3));
        var next = StatisticsHistory.Merge(history, current, corrected)["normal-all-all"]!;
        Assert.Equal(new[] { "2026-09-01", "2026-11-02" }, next["days"]!.AsArray().Select(d => ArchiveJson.Text(d!["date"])));
        Assert.Equal("2026-09-01T00:00:00.000Z", ArchiveJson.Text(next["from"]));
    }
    [Fact]
    public void RetainsOnly365CalendarDaysAndDoesNotMutateInputsOrAcceptChangedCohorts()
    {
        var first = new DateOnly(2025, 11, 3);
        var old = Stats("2025-11-03", "2026-11-03", Enumerable.Range(0, 366).Select(i => (first.AddDays(i).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), 1, 2)).ToArray());
        var input = old.ToJsonString(); var history = StatisticsHistory.Merge(null, null, old);
        Assert.Equal(365, history["normal-all-all"]!["days"]!.AsArray().Count);
        Assert.Equal(input, old.ToJsonString());
        var bad = history.DeepClone().AsObject(); bad["normal-all-all"]!["rankMin"] = 11;
        Assert.Throws<InvalidDataException>(() => StatisticsHistory.Validate(bad, 6848));
    }
    [Fact]
    public void PackedHistoryRejectsCorruptCountsDuplicateHeroesAndEscapingScopeNames()
    {
        var history = StatisticsHistory.Merge(null, null, Stats("2026-11-01", "2026-11-02", ("2026-11-01", 5, 5)));
        foreach (var packed in new[] { "1,5,5,11", "1,5,5,10;1,5,5,10", "1,-1,5,4", "1,5,5,NaN", "1,5,5,10;", "1,9007199254740992,0,9007199254740992" })
        {
            var invalid = history.DeepClone().AsObject(); invalid["normal-all-all"]!["days"]![0]!["rows"] = packed;
            Assert.Throws<InvalidDataException>(() => StatisticsHistory.Validate(invalid, 6848));
        }
        Assert.False(PublicSnapshot.Approved("data/hero-history-../../private.json"));
        Assert.True(PublicSnapshot.Approved("data/hero-history-normal-ranked-tier-11.json"));
    }
    [Fact]
    public void AFullYearFor100HeroesRemainsBoundedPerFileAndRoundTripsExactSafeCounts()
    {
        var stats = Stats("2025-11-05", "2026-11-04"); var start = new DateOnly(2025, 11, 5);
        foreach (var scope in stats["scopes"]!.AsArray()) scope!["days"] = new JsonArray(Enumerable.Range(0, 365).Select(i => (JsonNode)new JsonObject
        {
            ["date"] = start.AddDays(i).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), ["totalSelections"] = 9999999900L,
            ["rows"] = new JsonArray(Enumerable.Range(1, 100).Select(h => (JsonNode)new JsonObject { ["heroId"] = h, ["wins"] = 55555555L, ["losses"] = 44444444L, ["matches"] = 99999999L }).ToArray())
        }).ToArray());
        var history = StatisticsHistory.Merge(null, null, stats);
        Assert.All(history, pair => Assert.InRange(ArchiveJson.Bytes(pair.Value).Length, 1, PublicSnapshot.MaxFileBytes));
        StatisticsHistory.Validate(history, 6848);
        var expanded = StatisticsHistory.Expand(history["normal-all-all"]!.AsObject());
        Assert.Equal(55555555, ArchiveJson.Number(expanded["days"]![364]!["rows"]![99]!["wins"]));
        Assert.Equal(9999999900, ArchiveJson.Number(expanded["days"]![0]!["totalSelections"]));
    }
}
