using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Deadlock.Api.Ingestion;

public static class HeroAdapter
{
    public static JsonObject Build(JsonObject current, JsonObject rawHeroes, JsonObject abilities, JsonArray apiHeroes, JsonArray activeHeroes, JsonArray apiItems, JsonObject policy, GameVersion version, string commit, string heroesText, string abilitiesText, string checkedAt)
    {
        if (J.Num(policy["schemaVersion"], "policy") != 1 || J.Str(policy["adapter"]) != "materialized-kv3-v1") throw new InvalidDataException("Unsupported updater policy");
        if (J.Str(rawHeroes["generic_data_type"]) != "CitadelHeroData_t" || J.Str(abilities["generic_data_type"]) != "CitadelAbilityVData") throw new InvalidDataException("Unknown raw schema");
        Dictionary<long, JsonObject> ById(JsonArray rows) { var map = new Dictionary<long, JsonObject>(); foreach (var row in J.Rows(rows, "rows")) if (!map.TryAdd(J.Id(row["id"], "id"), row)) throw new InvalidDataException("Duplicate API ID"); return map; }
        var all = ById(apiHeroes); var active = ById(activeHeroes);
        var weapons = new Dictionary<string, JsonObject>(); foreach (var row in J.Rows(apiItems, "items")) if (!weapons.TryAdd(J.Str(row["class_name"]), row)) throw new InvalidDataException("Duplicate weapon class");
        var raw = new Dictionary<long, (string Name, JsonObject Hero, bool Released)>();
        foreach (var (name, value) in rawHeroes)
        {
            if (value is not JsonObject h || h["m_HeroID"] is null || J.Num(h["m_HeroID"], "ID") == 0) continue;
            var id = J.Id(h["m_HeroID"], "hero ID"); var state = J.Str(h["m_eHeroDevelopmentState"]);
            if (state is not ("" or "EHeroDevState_Release" or "EHeroDevState_DebugOnly")) throw new InvalidDataException($"Unknown development state {state}");
            var released = (state == "" ? !J.Bool(h["m_bDisabled"], "disabled", false) && !J.Bool(h["m_bInDevelopment"], "development", false) && J.Bool(h["m_bPlayerSelectable"], "selectable") : state == "EHeroDevState_Release") && !J.Bool(h["m_bDisabled"], "disabled", false);
            if (!raw.TryAdd(id, (name, h, released))) throw new InvalidDataException("Duplicate raw ID");
            if (released && !active.ContainsKey(id)) throw new InvalidDataException($"Released raw hero absent from API {id}");
        }
        var old = ById(J.Arr(current["heroes"], "current heroes")); var result = new List<JsonObject>();
        bool PolicyHas(string field, string key) => J.Arr(policy[field], field).Any(v => J.Str(v) == key);
        foreach (var (id, api) in all)
        {
            var state = J.Str(api["development_state"]);
            if (state is not ("" or "release" or "in_development" or "prototype" or "experimental" or "not_in_development")) throw new InvalidDataException("Unknown API release state");
            var selected = (state == "" ? J.Bool(api["player_selectable"], "selectable") && !J.Bool(api["in_development"], "development", false) : state == "release") && !J.Bool(api["disabled"], "disabled");
            if (selected != active.ContainsKey(id)) throw new InvalidDataException($"API active roster disagreement {id}"); if (!selected) continue;
            if (!raw.TryGetValue(id, out var entry)) throw new InvalidDataException($"Missing raw hero {id}");
            var (className, h, released) = entry; J.Equal(JsonValue.Create(className), api["class_name"], "hero class"); if (!released) throw new InvalidDataException("Raw release disagreement");
            var stats = J.Obj(h["m_mapStartingStats"], "starting stats"); var upgrades = J.Obj(h["m_mapStandardLevelUpUpgrades"], "upgrades"); var scales = J.Obj(h["m_mapScalingStats"] ?? new JsonObject(), "scales"); var levels = J.Obj(h["m_mapLevelInfo"], "levels");
            for (var level = 1; level <= 36; level++)
            {
                var l = J.Obj(levels[level.ToString()], $"level {level}"); var boon = J.Bool(l["m_bUseStandardUpgrade"], "boon", false);
                if (boon != (level > 1)) throw new InvalidDataException("Unsupported boon schedule");
                foreach (var (key, _) in l) if (key is not ("m_bUseStandardUpgrade" or "m_unRequiredGold" or "m_mapBonusCurrencies")) throw new InvalidDataException($"Unknown level modifier {key}");
                if (api["level_info"] is JsonObject apiLevels && boon != J.Bool(apiLevels[level.ToString()]?["use_standard_upgrade"], "API boon", false)) throw new InvalidDataException("Level schedule disagreement");
            }
            string[] consumed = ["MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL", "MODIFIER_VALUE_TECH_POWER", "MODIFIER_VALUE_BASE_BULLET_DAMAGE_FROM_LEVEL", "MODIFIER_VALUE_OUT_OF_COMBAT_HEALTH_REGEN", "MODIFIER_VALUE_BOON_COUNT"];
            foreach (var (key, value) in upgrades) { J.Num(value, key); if (!consumed.Contains(key) && !PolicyHas("ignoredBoonModifiers", key)) throw new InvalidDataException($"Unsupported boon {key}"); J.Equal(value, api["standard_level_up_upgrades"]?[key], $"boon {key}"); }
            if (J.Num(upgrades["MODIFIER_VALUE_BOON_COUNT"], "boon count") != 1 || J.Num(upgrades["MODIFIER_VALUE_OUT_OF_COMBAT_HEALTH_REGEN"], "regen growth", 0) != 0) throw new InvalidDataException("Unsupported boon count/regen");
            foreach (var (key, _) in J.Obj(api["standard_level_up_upgrades"], "API upgrades")) if (!upgrades.ContainsKey(key)) throw new InvalidDataException("Extra API boon");
            foreach (var (key, value) in scales)
            {
                var scale = J.Obj(value, key); if (!PolicyHas("supportedScaling", key) || J.Str(scale["eScalingStat"]) != "ETechPower") throw new InvalidDataException($"Unsupported scaling {key}");
                J.Num(scale["flScale"], key); J.Equal(scale["flScale"], api["scaling_stats"]?[key]?["scale"], key); J.Equal(scale["eScalingStat"], api["scaling_stats"]?[key]?["scaling_stat"], key);
            }
            foreach (var (key, _) in J.Obj(api["scaling_stats"] ?? new JsonObject(), "API scales")) if (!scales.ContainsKey(key)) throw new InvalidDataException("Extra API scaling");
            double Stat(string rawKey, string apiKey, double? fallback = null) { var n = J.Num(stats[rawKey], rawKey, fallback); J.Equal(JsonValue.Create(n), api["starting_stats"]?[apiKey]?["value"] ?? (fallback.HasValue ? JsonValue.Create(fallback.Value) : null), rawKey); return n; }
            double Growth(string key, double? fallback = null) => J.Num(upgrades[key], key, fallback);
            double Scale(string key) => J.Num(scales[key]?["flScale"], key, 0);
            var weaponName = J.Str(J.Obj(h["m_mapBoundAbilities"], "bindings")["ESlot_Weapon_Primary"]); if (weaponName == "") throw new InvalidDataException("Missing weapon"); J.Equal(JsonValue.Create(weaponName), api["items"]?["weapon_primary"], "weapon binding");
            var w = J.Obj(J.Obj(abilities[weaponName], weaponName)["m_mapWeaponInfos"]?["primary"], "primary weapon");
            var aw = J.Obj(weapons.GetValueOrDefault(weaponName)?["weapon_info"], "API weapon");
            foreach (var (key, _) in w) if (!PolicyHas("knownWeaponFields", key)) throw new InvalidDataException($"Unsupported weapon field {key}");
            double Wn(string rawKey, string apiKey, double? fallback = null) { var n = J.Num(w[rawKey], rawKey, fallback); J.Equal(JsonValue.Create(n), aw[apiKey] ?? (fallback.HasValue ? JsonValue.Create(fallback.Value) : null), rawKey); return n; }
            bool Wb(string rawKey, string apiKey) { var b = J.Bool(w[rawKey], rawKey, false); if (aw.ContainsKey(apiKey) && b != J.Bool(aw[apiKey], apiKey)) throw new InvalidDataException($"Weapon flag disagreement {rawKey}"); return b; }
            if (Wb("m_bChargesUp", "charges_up") && !PolicyHas("knownChargedWeapons", weaponName)) throw new InvalidDataException($"Unsupported charged primary {weaponName}");
            var damage = Wn("m_flBulletDamage", "bullet_damage"); var cycle = Wn("m_flCycleTime", "cycle_time"); var intra = Wn("m_flIntraBurstCycleTime", "intra_burst_cycle_time", 0); var burst = Wn("m_iBurstShotCount", "burst_shot_count", 1); var sps = burst / (cycle + (burst - 1) * intra); var fireScale = Scale("EFireRate");
            if (Math.Abs(Scale("ERoundsPerSecond") - fireScale * sps / 100) > 1e-8) throw new InvalidDataException("Unsupported Spirit fire-rate representation");
            var previous = old.GetValueOrDefault(id); var name = J.Str(api["name"]); if (string.IsNullOrWhiteSpace(name)) throw new InvalidDataException("Missing hero name");
            var slug = J.Str(previous?["slug"], Regex.Replace(name.ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-')); if (!Regex.IsMatch(slug, "^[a-z0-9]+(?:-[a-z0-9]+)*$")) throw new InvalidDataException("Unsafe slug");
            var spins = Wb("m_bSpinsUp", "spins_up"); double? full = w["m_flMaxSpinCycleTime"] is null ? null : Wn("m_flMaxSpinCycleTime", "max_spin_cycle_time"); if (spins && !(full > 0)) throw new InvalidDataException("Missing full-spin timing");
            var hero = new JsonObject
            {
                ["id"] = id,
                ["slug"] = slug,
                ["name"] = name,
                ["aliases"] = J.Str(previous?["aliases"]),
                ["tags"] = api["tags"] is JsonArray tags ? tags.DeepClone() : new JsonArray(),
                ["isNew"] = previous?["isNew"]?.DeepClone() ?? JsonValue.Create(true),
                ["portrait"] = J.Str(previous?["portrait"], $"assets/heroes/{slug}.webp"),
                ["base"] = new JsonObject { ["health"] = Stat("EMaxHealth", "max_health"), ["spirit"] = Stat("ETechPower", "tech_power", 0), ["regen"] = Stat("EBaseHealthRegen", "base_health_regen"), ["bulletDamage"] = damage, ["moveSpeed"] = Stat("EMaxMoveSpeed", "max_move_speed"), ["stamina"] = Stat("EStamina", "stamina") },
                ["growth"] = new JsonObject { ["health"] = Growth("MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL"), ["spirit"] = Growth("MODIFIER_VALUE_TECH_POWER"), ["regen"] = Growth("MODIFIER_VALUE_OUT_OF_COMBAT_HEALTH_REGEN", 0), ["bulletDamage"] = Growth("MODIFIER_VALUE_BASE_BULLET_DAMAGE_FROM_LEVEL") },
                ["scaling"] = new JsonObject { ["bulletDamagePerSpirit"] = Scale("EBulletDamage"), ["regenPerSpirit"] = Scale("EBaseHealthRegen"), ["fireRatePercentPerSpirit"] = fireScale },
                ["weapon"] = new JsonObject { ["className"] = weaponName, ["projectiles"] = Wn("m_iBullets", "bullets", 1), ["burst"] = burst, ["cycleTime"] = cycle, ["intraBurstTime"] = intra, ["shotsPerSecond"] = sps, ["spinsUp"] = spins, ["fullSpinCycle"] = full, ["hitOnce"] = Wb("m_bHitOnceAcrossAllBullets", "hit_once_across_all_bullets"), ["clipSize"] = Wn("m_iClipSize", "clip_size"), ["reloadSeconds"] = Wn("m_reloadDuration", "reload_duration"), ["notes"] = previous?["weapon"]?["notes"]?.DeepClone() ?? new JsonArray() },
                ["source"] = new JsonObject { ["heroUrl"] = $"https://github.com/SteamTracking/GameTracking-Deadlock/blob/{commit}/game/citadel/pak01_dir/scripts/heroes.vdata", ["weaponUrl"] = $"https://github.com/SteamTracking/GameTracking-Deadlock/blob/{commit}/game/citadel/pak01_dir/scripts/abilities.vdata", ["heroLine"] = Line(heroesText, className), ["weaponLine"] = Line(abilitiesText, weaponName) }
            };
            foreach (var field in new[] { "base", "growth", "scaling" }) foreach (var (_, value) in J.Obj(hero[field], field)) if (J.Num(value, field) < 0) throw new InvalidDataException("Negative candidate stat");
            if (J.Num(hero["base"]?["health"], "health") <= 0 || damage <= 0 || cycle <= 0 || intra < 0 || burst < 1 || burst != Math.Truncate(burst) || !double.IsFinite(sps) || sps <= 0 || J.Num(hero["base"]?["moveSpeed"], "moveSpeed") <= 0 || J.Num(hero["weapon"]?["clipSize"], "clip") <= 0 || J.Num(hero["weapon"]?["reloadSeconds"], "reload") < 0 || J.Num(hero["weapon"]?["projectiles"], "projectiles") < 1 || J.Num(hero["weapon"]?["projectiles"], "projectiles") != Math.Truncate(J.Num(hero["weapon"]?["projectiles"], "projectiles"))) throw new InvalidDataException("Out-of-range candidate stats");
            result.Add(hero);
        }
        if (result.Count == 0 || result.Count != active.Count || result.Select(h => J.Str(h["slug"])).Distinct().Count() != result.Count) throw new InvalidDataException("Incomplete or duplicate roster");
        var meta = (JsonObject)J.Obj(current["meta"], "meta").DeepClone(); meta["checkedAt"] = checkedAt; meta["snapshotDate"] = checkedAt[..10]; meta["clientVersion"] = version.Version; meta["sourceRevision"] = version.Revision; meta["gameCommit"] = commit; meta["buildDate"] = version.BuildDate; meta["heroCount"] = result.Count;
        meta["sources"] = new JsonArray(new JsonObject { ["label"] = $"Параметры героев · клиент {version.Version}", ["url"] = $"https://api.deadlock-api.com/v1/assets/heroes?client_version={version.Version}" }, new JsonObject { ["label"] = $"Оружие · клиент {version.Version}", ["url"] = $"https://api.deadlock-api.com/v1/assets/items?client_version={version.Version}" }, new JsonObject { ["label"] = "Исходные файлы игры · фиксированная ревизия", ["url"] = $"https://github.com/SteamTracking/GameTracking-Deadlock/tree/{commit}/game/citadel/pak01_dir/scripts" });
        return new JsonObject { ["meta"] = meta, ["heroes"] = J.List(result.OrderBy(h => J.Str(h["name"]), StringComparer.InvariantCultureIgnoreCase)) };
    }
    static int Line(string source, string key) { var match = Regex.Match(source, "^\\s*\"?" + Regex.Escape(key) + "\"?\\s*=", RegexOptions.Multiline); if (!match.Success) throw new InvalidDataException($"Missing source line {key}"); return source[..match.Index].Count(c => c == '\n') + 1; }
}
