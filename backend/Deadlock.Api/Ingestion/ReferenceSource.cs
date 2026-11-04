using System.Globalization;
using System.Text;
using System.Text.Json.Nodes;
using Deadlock.Api.Data;

namespace Deadlock.Api.Ingestion;

/// <summary>Refreshes game-source identity/geometry while keeping editorial and unexposed rule review dates honest.</summary>
public static class ReferenceSource
{
    static long N(JsonNode? value) => ArchiveJson.Number(value);
    static string S(JsonNode? value) => ArchiveJson.Text(value);
    public static JsonObject Profiles(JsonObject previous, JsonObject heroes, JsonArray source, int version, string checkedAt)
    {
        var old = previous["heroes"]!.AsArray().ToDictionary(p => N(p!["heroId"])); var api = source.ToDictionary(p => N(p!["id"])); var rows = new JsonArray();
        foreach (var hero in heroes["heroes"]!.AsArray())
        {
            var id = N(hero!["id"]); var upstream = api[id]!; var row = old.TryGetValue(id, out var saved) ? saved!.DeepClone().AsObject() : new JsonObject
            {
                ["heroId"] = id, ["summary"] = new JsonObject { ["ru"] = "Описание нового героя готовится.", ["en"] = "The new hero's description is being prepared." },
                ["lore"] = new JsonObject { ["ru"] = "История пока не добавлена.", ["en"] = "The hero's story has not been added yet." }, ["relationships"] = new JsonArray(), ["tips"] = new JsonArray(), ["videos"] = new JsonArray()
            };
            row["slug"] = hero["slug"]!.DeepClone(); row["art"] = new JsonObject { ["background"] = upstream["images"]!["background_image_webp"]!.DeepClone(), ["card"] = upstream["images"]!["icon_hero_card_webp"]!.DeepClone() };
            // Fetching new assets is not a fresh editorial review of curated lore, advice or clips.
            row["reviewedClientVersion"] = saved?["reviewedClientVersion"]?.DeepClone() ?? (saved != null ? previous["clientVersion"]!.DeepClone() : null);
            if (version != N(previous["clientVersion"])) row["videos"] = new JsonArray();
            rows.Add(row);
        }
        var result = previous.DeepClone().AsObject(); result["clientVersion"] = version; result["updatedAt"] = checkedAt; result["heroes"] = rows; ReferenceCatalogues.Profiles(result, heroes); return result;
    }
    public static JsonObject Map(JsonObject previous, JsonObject source, JsonArray misc, JsonArray npcs, JsonObject generic, int version, long revision, string commit, string checkedAt)
    {
        var result = previous.DeepClone().AsObject(); var meta = result["meta"]!.AsObject(); var priorVersion = N(meta["clientVersion"]);
        meta["rulesClientVersion"] ??= priorVersion; meta["classRulesClientVersion"] = version; meta["clientVersion"] = version; meta["sourceRevision"] = revision; meta["sourceCommit"] = commit; meta["checkedAt"] = checkedAt;
        var radius = ArchiveJson.Real(source["radius"]); result["radius"] = radius; result["images"] = source["images"]!.DeepClone(); result["ziplinePaths"] = source["zipline_paths"]!.DeepClone();
        var old = previous["objects"]!.AsArray(); var rules = result["rules"]!.AsObject(); var classes = misc.ToDictionary(x => S(x!["class_name"])); var units = npcs.ToDictionary(x => S(x!["class_name"]));
        foreach (var kind in new[] { "weak", "medium", "strong", "vault" })
        {
            var name = "neutral_camp_" + (kind == "vault" ? "vaults" : kind); if (!classes.TryGetValue(name, out var cfg)) throw new InvalidDataException("Missing source camp timer");
            var rule = rules["campRules"]![kind]!.AsObject(); rule["firstSpawnSeconds"] = cfg!["initial_spawn_delay_in_seconds"]!.DeepClone(); rule["respawnSeconds"] = cfg["spawn_interval_in_seconds"]!.DeepClone();
            var unit = units[S(rule["unitReference"])]!; rule["perUnit"] = new JsonObject(); foreach (var field in new[] { "max_health", "gold_reward", "gold_reward_bonus_percent_per_minute" }) rule["perUnit"]![field] = unit[field]!.DeepClone();
        }
        var buffs = classes["citadel_item_powerup_spawner"]!; rules["bridgeBuffs"]!["firstSpawnSeconds"] = buffs["initial_spawn_time"]!.DeepClone(); rules["bridgeBuffs"]!["respawnSeconds"] = buffs["spawn_interval"]!.DeepClone();
        var snacks = classes["citadel_pickup_floating_health"]!; rules["healingSnacks"]!["firstSpawnSeconds"] = snacks["spawn_delay"]!.DeepClone(); rules["healingSnacks"]!["respawnSeconds"] = snacks["respawn_time"]!.DeepClone();
        if (generic["objective_params"] != null) rules["objectiveRewardConfig"] = generic["objective_params"]!.DeepClone();
        var points = new JsonArray();
        JsonObject Point(string category, JsonObject entry, string? explicitId = null)
        {
            var world = entry["position"]!.AsArray();
            var prior = old.FirstOrDefault(p => S(p!["category"]) == category && JsonNode.DeepEquals(p["world"], world));
            var id = explicitId ?? prior?["id"]?.GetValue<string>() ?? category + ":" + ArchiveJson.Hash(Encoding.UTF8.GetBytes(world.ToJsonString()))[..12];
            var p = new JsonObject { ["id"] = id, ["category"] = category, ["world"] = world.DeepClone(), ["x"] = (ArchiveJson.Real(world[0]) + radius) / (2 * radius), ["y"] = (radius - ArchiveJson.Real(world[1])) / (2 * radius), ["layer"] = null, ["firstSpawnSeconds"] = null, ["respawnSeconds"] = null, ["timingNote"] = "Per-instance timing or availability is not known." };
            foreach (var key in new[] { "kind", "team", "target", "name" }) if (entry[key] != null) p[key] = entry[key]!.DeepClone();
            if (category == "camps") { var rule = rules["campRules"]![S(entry["kind"])]!; p["firstSpawnSeconds"] = rule["firstSpawnSeconds"]!.DeepClone(); p["respawnSeconds"] = rule["respawnSeconds"]!.DeepClone(); p["perUnit"] = rule["perUnit"]!.DeepClone(); p["unitCount"] = null; p["timingNote"] = "Class timer verified; live availability and unit composition unknown."; }
            if (category is "bridge_buffs" or "healing_snacks") { var rule = rules[category == "bridge_buffs" ? "bridgeBuffs" : "healingSnacks"]!; p["firstSpawnSeconds"] = rule["firstSpawnSeconds"]!.DeepClone(); p["respawnSeconds"] = rule["respawnSeconds"]!.DeepClone(); }
            return p;
        }
        foreach (var (category, entries) in source["entities"]!.AsObject()) foreach (var entry in entries!.AsArray()) points.Add(Point(category, entry!.AsObject()));
        foreach (var entry in source["neutral_camps"]!.AsArray()) points.Add(Point("camps", entry!.AsObject(), "camp:" + S(entry["name"])));
        foreach (var (id, entry) in source["objective_positions"]!.AsObject())
        {
            var prior = old.FirstOrDefault(p => S(p!["id"]) == id); var footprint = prior?["markerFootprint"]?.DeepClone() as JsonArray ?? new JsonArray(0, 0);
            points.Add(new JsonObject { ["id"] = id, ["category"] = "objectives", ["x"] = ArchiveJson.Real(entry!["left_relative"]) + ArchiveJson.Real(footprint[0]) / 2, ["y"] = ArchiveJson.Real(entry["top_relative"]) + ArchiveJson.Real(footprint[1]) / 2, ["markerTopLeft"] = new JsonArray(entry["left_relative"]!.DeepClone(), entry["top_relative"]!.DeepClone()), ["markerFootprint"] = footprint, ["layer"] = null, ["firstSpawnSeconds"] = null, ["respawnSeconds"] = null, ["timingNote"] = "Marker geometry; no world elevation or verified availability." });
        }
        result["objects"] = points;
        // Curated route geometry must be re-reviewed if placements/configuration changes.
        if (version != priorVersion) { result["routeExamples"] = new JsonArray(); meta["routeExamplesReviewedClientVersion"] = priorVersion; }
        ReferenceCatalogues.WorldMap(result); return result;
    }
}
