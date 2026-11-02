using System.Data;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace Deadlock.Api.Data;

/// <summary>Compatible with the existing PostgreSQL archive; JSON mode is explicit fallback only.</summary>
public sealed class ArchiveStore : IOptimisticArchiveStore
{
    private readonly AppPaths paths;
    private readonly string? connectionString;
    private readonly SemaphoreSlim gate = new(1, 1);
    public bool Configured => connectionString != null;
    public ArchiveStore(AppPaths paths) : this(paths, Environment.GetEnvironmentVariable) { }
    public ArchiveStore(AppPaths paths, Func<string, string?> environment, string? ownedTestSchema = null)
    {
        this.paths = paths;
        var keys = new[] { "HOST", "PORT", "NAME", "USER", "PASSWORD" };
        var v = keys.Select(k => environment("DEADLOCK_DB_" + k)).ToArray();
        if (v.All(x => x == null)) return;
        if (v.Any(string.IsNullOrEmpty)) throw new InvalidOperationException("Incomplete DEADLOCK_DB_* configuration");
        if (v[0] is not ("localhost" or "127.0.0.1" or "::1") || !int.TryParse(v[1], out var port) || port is < 1 or > 65535) throw new InvalidOperationException("Invalid local database address");
        if (new[] { v[2], v[3] }.Any(x => !System.Text.RegularExpressions.Regex.IsMatch(x!, "^[a-z_][a-z0-9_]{0,62}$"))) throw new InvalidOperationException("Invalid database or role name");
        var config = new NpgsqlConnectionStringBuilder { Host = v[0]!, Port = port, Database = v[2]!, Username = v[3]!, Password = v[4]!, Timeout = 5, CommandTimeout = 20, ApplicationName = "deadlock_archive_aspnet", MaxPoolSize = 5 };
        if (ownedTestSchema != null) { if (!System.Text.RegularExpressions.Regex.IsMatch(v[2]!, "^deadlock_archive_test(?:_[a-z0-9]+)?$") || !System.Text.RegularExpressions.Regex.IsMatch(ownedTestSchema, "^archive_test_[a-f0-9]{32}$")) throw new InvalidOperationException("Refusing non-isolated test schema"); config.SearchPath = ownedTestSchema; }
        connectionString = config.ConnectionString;
    }
    private ArchiveDbContext Context() => new(new DbContextOptionsBuilder<ArchiveDbContext>().UseNpgsql(connectionString!).Options);
    public async Task<string> BackupAsync(CancellationToken ct = default)
    {
        if (connectionString == null) throw new InvalidOperationException("PostgreSQL is not configured");
        var config = new NpgsqlConnectionStringBuilder(connectionString); var directory = ArchiveJson.SafePath(paths.Root, "work/backups/postgresql"); Directory.CreateDirectory(directory); var target = ArchiveJson.SafePath(paths.Root, $"work/backups/postgresql/{config.Database}_{DateTime.UtcNow:yyyyMMddTHHmmssfff}_{Guid.NewGuid():N}.dump");
        var windows = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "PostgreSQL", "18", "bin", "pg_dump.exe");
        var info = new System.Diagnostics.ProcessStartInfo(File.Exists(windows) ? windows : "pg_dump") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardError = true, RedirectStandardOutput = true };
        foreach (var arg in new[] { "--format=custom", "--no-owner", "--no-acl", "--host", config.Host, "--port", config.Port.ToString(), "--username", config.Username, "--dbname", config.Database, "--file", target }) info.ArgumentList.Add(arg!);
        if (!string.IsNullOrEmpty(config.SearchPath)) { info.ArgumentList.Add("--schema"); info.ArgumentList.Add(config.SearchPath); }
        info.Environment["PGPASSWORD"] = config.Password; info.Environment["PGCONNECT_TIMEOUT"] = "5";
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromSeconds(60));
        using var process = System.Diagnostics.Process.Start(info) ?? throw new IOException("Cannot start PostgreSQL backup");
        try { var stderr = process.StandardError.ReadToEndAsync(timeout.Token); var stdout = process.StandardOutput.ReadToEndAsync(timeout.Token); await process.WaitForExitAsync(timeout.Token); await Task.WhenAll(stderr, stdout); if (process.ExitCode != 0 || !File.Exists(target) || new FileInfo(target).Length == 0) throw new IOException("PostgreSQL backup failed; archive was not changed"); return target; }
        catch { if (File.Exists(target)) File.Delete(target); throw; }
        finally { if (!process.HasExited) process.Kill(true); }
    }
    private static async Task<List<JsonObject>> Query(NpgsqlConnection c, NpgsqlTransaction? tx, string sql, CancellationToken ct, params object?[] args)
    {
        await using var cmd = new NpgsqlCommand(sql, c, tx);
        for (var i = 0; i < args.Length; i++) cmd.Parameters.AddWithValue("p" + i, args[i] ?? DBNull.Value);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        var rows = new List<JsonObject>();
        while (await r.ReadAsync(ct)) { var row = new JsonObject(); for (var i = 0; i < r.FieldCount; i++) row[r.GetName(i)] = r.IsDBNull(i) ? null : JsonValue.Create(r.GetValue(i)); rows.Add(row); }
        return rows;
    }
    private static async Task<int> Execute(NpgsqlConnection c, NpgsqlTransaction? tx, string sql, CancellationToken ct, params object?[] args)
    {
        await using var cmd = new NpgsqlCommand(sql, c, tx);
        for (var i = 0; i < args.Length; i++) cmd.Parameters.AddWithValue("p" + i, args[i] ?? DBNull.Value);
        return await cmd.ExecuteNonQueryAsync(ct);
    }
    private static async Task Insert(NpgsqlConnection c, NpgsqlTransaction tx, string table, Dictionary<string, object?> fields, CancellationToken ct)
    {
        await using var cmd = new NpgsqlCommand($"INSERT INTO {table} ({string.Join(',', fields.Keys)}) VALUES ({string.Join(',', fields.Keys.Select((_, i) => "@p" + i))})", c, tx);
        var i = 0;
        foreach (var (key, value) in fields)
        {
            var p = new NpgsqlParameter("p" + i++, value is JsonNode || key is "patch" or "meta" or "statistics_meta" or "data" ? NpgsqlDbType.Jsonb : key == "weapon_full_spin_cycle" ? NpgsqlDbType.Double : value switch { long => NpgsqlDbType.Bigint, int => NpgsqlDbType.Integer, double => NpgsqlDbType.Double, bool => NpgsqlDbType.Boolean, _ => NpgsqlDbType.Text });
            p.Value = value is JsonNode n ? n.ToJsonString() : value ?? (object)DBNull.Value; cmd.Parameters.Add(p);
        }
        await cmd.ExecuteNonQueryAsync(ct);
    }
    private sealed class SessionArchiveLock(NpgsqlConnection connection) : IAsyncDisposable
    {
        public static async Task<SessionArchiveLock> AcquireAsync(NpgsqlConnection connection, CancellationToken ct)
        {
            try { await Execute(connection, null, "SELECT pg_advisory_lock(14981747,20261025)", ct); return new(connection); }
            catch { if (connection.State == ConnectionState.Open) await Execute(connection, null, "SELECT pg_advisory_unlock(14981747,20261025)", CancellationToken.None); throw; }
        }
        public async ValueTask DisposeAsync() { if (connection.State == ConnectionState.Open) await Execute(connection, null, "SELECT pg_advisory_unlock(14981747,20261025)", CancellationToken.None); }
    }
    public Task InitializeAsync(CancellationToken ct = default) => InitializeCoreAsync(true, ct);
    public Task MigrateAsync(CancellationToken ct = default) => InitializeCoreAsync(false, ct);
    private async Task InitializeCoreAsync(bool seedEmptyArchive, CancellationToken ct)
    {
        if (!Configured) { await ArchiveJson.ReadFilesAsync(paths, ct); return; }
        await gate.WaitAsync(ct);
        try
        {
            await using var db = Context(); await db.Database.OpenConnectionAsync(ct);
            var c = (NpgsqlConnection)db.Database.GetDbConnection();
            var existingSchema = await Query(c, null, "SELECT to_regclass('archive_current')::text AS current_table,to_regclass('archive_bundle_payloads')::text AS payload_table", ct);
            if (existingSchema[0]["current_table"] != null) { var applied = await Query(c, null, "SELECT version FROM archive_migrations", ct); if (existingSchema[0]["payload_table"] == null || Directory.GetFiles(Path.Combine(paths.Root, "db", "migrations"), "*.sql").Any(f => !applied.Any(a => ArchiveJson.Text(a["version"]) == Path.GetFileName(f)))) await BackupAsync(ct); }
            await using var tx = await c.BeginTransactionAsync(ct);
            await Execute(c, tx, "SELECT pg_advisory_xact_lock(14981747,20261025); CREATE TABLE IF NOT EXISTS archive_migrations(version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())", ct);
            foreach (var file in Directory.GetFiles(Path.Combine(paths.Root, "db", "migrations"), "*.sql").Order(StringComparer.Ordinal))
            {
                var bytes = await File.ReadAllBytesAsync(file, ct); var hash = ArchiveJson.Hash(bytes); var name = Path.GetFileName(file);
                var applied = await Query(c, tx, "SELECT checksum FROM archive_migrations WHERE version=@p0", ct, name);
                if (applied.Count > 0) { if (ArchiveJson.Text(applied[0]["checksum"]) != hash) throw new InvalidDataException("Migration checksum mismatch: " + name); continue; }
                await Execute(c, tx, System.Text.Encoding.UTF8.GetString(bytes), ct);
                await Execute(c, tx, "INSERT INTO archive_migrations(version,checksum) VALUES(@p0,@p1)", ct, name, hash);
            }
            // Supplemental full payload retains future JSON fields while all existing relational columns stay authoritative.
            await Execute(c, tx, "CREATE TABLE IF NOT EXISTS archive_bundle_payloads(snapshot_id bigint PRIMARY KEY REFERENCES archive_snapshots(id) ON DELETE CASCADE, data jsonb NOT NULL)", ct);
            var empty = (await Query(c, tx, "SELECT snapshot_id FROM archive_current WHERE singleton=true", ct)).Count == 0;
            await tx.CommitAsync(ct);
            if (empty && seedEmptyArchive) await ImportDatabaseAsync(await ArchiveJson.ReadFilesAsync(paths, ct), "initial-empty-archive", ct);
        }
        finally { gate.Release(); }
    }
    private static readonly Dictionary<string, string> HeroMap = new()
    {
        ["hero_id"] = "id",
        ["slug"] = "slug",
        ["name"] = "name",
        ["aliases"] = "aliases",
        ["tags"] = "tags",
        ["is_new"] = "isNew",
        ["portrait"] = "portrait",
        ["base_health"] = "base.health",
        ["base_spirit"] = "base.spirit",
        ["base_regen"] = "base.regen",
        ["base_bullet_damage"] = "base.bulletDamage",
        ["base_move_speed"] = "base.moveSpeed",
        ["base_stamina"] = "base.stamina",
        ["growth_health"] = "growth.health",
        ["growth_spirit"] = "growth.spirit",
        ["growth_regen"] = "growth.regen",
        ["growth_bullet_damage"] = "growth.bulletDamage",
        ["scaling_bullet_damage_per_spirit"] = "scaling.bulletDamagePerSpirit",
        ["scaling_regen_per_spirit"] = "scaling.regenPerSpirit",
        ["scaling_fire_rate_percent_per_spirit"] = "scaling.fireRatePercentPerSpirit",
        ["weapon_class_name"] = "weapon.className",
        ["weapon_projectiles"] = "weapon.projectiles",
        ["weapon_burst"] = "weapon.burst",
        ["weapon_cycle_time"] = "weapon.cycleTime",
        ["weapon_intra_burst_time"] = "weapon.intraBurstTime",
        ["weapon_shots_per_second"] = "weapon.shotsPerSecond",
        ["weapon_spins_up"] = "weapon.spinsUp",
        ["weapon_full_spin_cycle"] = "weapon.fullSpinCycle",
        ["weapon_hit_once"] = "weapon.hitOnce",
        ["weapon_clip_size"] = "weapon.clipSize",
        ["weapon_reload_seconds"] = "weapon.reloadSeconds",
        ["weapon_notes"] = "weapon.notes",
        ["source_hero_url"] = "source.heroUrl",
        ["source_weapon_url"] = "source.weaponUrl",
        ["source_hero_line"] = "source.heroLine",
        ["source_weapon_line"] = "source.weaponLine"
    };
    private static object? Value(JsonNode? node)
    {
        if (node == null) return null; if (node is JsonArray or JsonObject) return node;
        if (node.AsValue().TryGetValue<bool>(out var boolean)) return boolean;
        if (node.AsValue().TryGetValue<string>(out var text)) return text;
        return ArchiveJson.Real(node);
    }
    private static void Set(JsonObject o, string path, JsonNode? value) { var keys = path.Split('.'); for (var i = 0; i < keys.Length - 1; i++) { o[keys[i]] ??= new JsonObject(); o = o[keys[i]]!.AsObject(); } o[keys[^1]] = value?.DeepClone(); }
    private static JsonObject Decode(JsonObject row) { var o = new JsonObject(); foreach (var (k, v) in row) o[k] = v is JsonValue j && j.TryGetValue<string>(out var s) && s != null && (s.StartsWith('{') || s.StartsWith('[')) ? JsonNode.Parse(s) : v?.DeepClone(); return o; }
    private static async Task<List<JsonObject>> Rows(NpgsqlConnection c, NpgsqlTransaction tx, string table, long id, CancellationToken ct, string extra = "", params object?[] args) => (await Query(c, tx, $"SELECT row_to_json(t)::text AS data FROM (SELECT * FROM {table} WHERE snapshot_id=@p0 {extra}) t", ct, new object?[] { id }.Concat(args).ToArray())).Select(r => JsonNode.Parse(ArchiveJson.Text(r["data"]))!.AsObject()).ToList();
    public async Task<JsonObject> ReadBundleAsync(CancellationToken ct = default)
    {
        if (!Configured) return await ArchiveJson.ReadFilesAsync(paths, ct);
        await using var db = Context(); await db.Database.OpenConnectionAsync(ct); var c = (NpgsqlConnection)db.Database.GetDbConnection();
        await using var tx = await c.BeginTransactionAsync(IsolationLevel.RepeatableRead, ct); await Execute(c, tx, "SET TRANSACTION READ ONLY", ct);
        var bundle = await ReadDatabaseBundleAsync(db, c, tx, ct);
        await tx.CommitAsync(ct);
        return bundle;
    }
    private static async Task<JsonObject> ReadDatabaseBundleAsync(ArchiveDbContext db, NpgsqlConnection c, NpgsqlTransaction tx, CancellationToken ct)
    {
        await db.Database.UseTransactionAsync(tx, ct);
        var current = await db.Current.AsNoTracking().Include(x => x.Snapshot).SingleOrDefaultAsync(x => x.Singleton, ct);
        if (current == null) throw new InvalidDataException("Archive is empty");
        var id = current.SnapshotId;
        var schema = await Query(c, tx, "SELECT to_regclass('archive_bundle_payloads')::text AS payload_table,to_regclass('item_catalogues')::text AS items_table", ct);
        var saved = schema[0]["payload_table"] == null ? new List<JsonObject>() : await Query(c, tx, "SELECT data::text FROM archive_bundle_payloads WHERE snapshot_id=@p0", ct, id);
        var bundle = saved.Count == 0 ? new JsonObject() : JsonNode.Parse(ArchiveJson.Text(saved[0]["data"]))!.AsObject();
        var heroes = new JsonArray();
        foreach (var row in await Rows(c, tx, "heroes", id, ct, "ORDER BY ordinal")) { var hero = bundle["heroes"]?["heroes"]?.AsArray().FirstOrDefault(h => ArchiveJson.Number(h?["id"]) == ArchiveJson.Number(row["hero_id"]))?.DeepClone().AsObject() ?? new JsonObject(); foreach (var (column, path) in HeroMap) Set(hero, path, row[column]); heroes.Add(hero); }
        bundle["heroes"] ??= new JsonObject(); bundle["heroes"]!["meta"] = JsonNode.Parse(current.Snapshot.HeroMeta); bundle["heroes"]!["heroes"] = heroes;
        bundle["provenance"] = JsonNode.Parse(current.Snapshot.Provenance);
        var mechanics = bundle["mechanics"]?.DeepClone().AsObject() ?? new JsonObject();
        foreach (var lang in new[] { "ru", "en" })
        {
            var catalog = (bundle["mechanics"]?[lang]?.DeepClone().AsObject()) ?? new JsonObject();
            catalog["meta"] = (await Rows(c, tx, "mechanics_catalogues", id, ct, "AND language=@p1", lang)).Single()["meta"]!.DeepClone();
            var sources = new JsonArray(); foreach (var r in await Rows(c, tx, "mechanics_sources", id, ct, "AND language=@p1 ORDER BY ordinal", lang)) { var source = catalog["sources"]?.AsArray().FirstOrDefault(x => JsonNode.DeepEquals(x?["id"], r["source_id"]))?.DeepClone().AsObject() ?? new JsonObject(); source["id"] = r["source_id"]!.DeepClone(); foreach (var k in new[] { "label", "url", "kind" }) source[k] = r[k]!.DeepClone(); sources.Add(source); }
            var formulas = new JsonArray(); var links = await Rows(c, tx, "mechanics_formula_sources", id, ct, "AND language=@p1 ORDER BY ordinal", lang);
            foreach (var r in await Rows(c, tx, "mechanics_formulas", id, ct, "AND language=@p1 ORDER BY ordinal", lang)) { var f = catalog["formulas"]?.AsArray().FirstOrDefault(x => JsonNode.DeepEquals(x?["id"], r["formula_id"]))?.DeepClone().AsObject() ?? new JsonObject(); f["id"] = r["formula_id"]!.DeepClone(); foreach (var key in new[] { "category", "title", "expression", "variables", "explanation", "example", "caveats", "confidence" }) f[key] = r[key]?.DeepClone(); f["sourceIds"] = new JsonArray(links.Where(x => JsonNode.DeepEquals(x["formula_id"], r["formula_id"])).Select(x => x["source_id"]!.DeepClone()).ToArray()); formulas.Add(f); }
            catalog["sources"] = sources; catalog["formulas"] = formulas; mechanics[lang] = catalog;
        }
        bundle["mechanics"] = mechanics;
        var versions = new JsonArray(); foreach (var r in await Rows(c, tx, "history_entries", id, ct, "ORDER BY ordinal")) { var v = bundle["history"]?["versions"]?.AsArray().FirstOrDefault(x => JsonNode.DeepEquals(x?["clientVersion"], r["client_version"]))?.DeepClone().AsObject() ?? new JsonObject(); v["clientVersion"] = r["client_version"]!.DeepClone(); v["buildDate"] = r["build_date"]!.DeepClone(); v["firstPublishedAt"] = r["first_published_at"]!.DeepClone(); v["provenance"] ??= new JsonObject(); v["provenance"]!["kind"] = r["provenance_kind"]!.DeepClone(); v["provenance"]!["reference"] = r["provenance_reference"]!.DeepClone(); if (r["patch"] != null) v["patch"] = r["patch"]!.DeepClone(); else v.Remove("patch"); versions.Add(v); }
        bundle["history"] ??= new JsonObject(); bundle["history"]!["schemaVersion"] = 1; bundle["history"]!["versions"] = versions;
        var itemMeta = schema[0]["items_table"] == null ? new List<JsonObject>() : await Rows(c, tx, "item_catalogues", id, ct);
        if (itemMeta.Count > 0) { bundle["items"] ??= new JsonObject(); bundle["items"]!["meta"] = itemMeta[0]["meta"]!.DeepClone(); bundle["items"]!["items"] = new JsonArray((await Rows(c, tx, "shop_items", id, ct, "ORDER BY ordinal")).Select(x => x["data"]!.DeepClone()).ToArray()); bundle["itemStatistics"] ??= new JsonObject(); bundle["itemStatistics"]!["meta"] = itemMeta[0]["statistics_meta"]!.DeepClone(); bundle["itemStatistics"]!["items"] = new JsonArray((await Rows(c, tx, "item_purchase_statistics", id, ct, "ORDER BY ordinal")).Select(x => x["data"]!.DeepClone()).ToArray()); } else { bundle.Remove("items"); bundle.Remove("itemStatistics"); }
        ArchiveJson.Validate(bundle); return bundle;
    }
    public Task ImportAsync(JsonObject bundle, string reason, CancellationToken ct = default) => ImportCoreAsync(bundle, reason, null, ct);
    public Task ImportIfUnchangedAsync(JsonObject bundle, string reason, JsonObject expected, CancellationToken ct = default) => ImportCoreAsync(bundle, reason, expected.DeepClone().AsObject(), ct);
    private async Task ImportCoreAsync(JsonObject bundle, string reason, JsonObject? expected, CancellationToken ct)
    {
        ArchiveJson.Validate(bundle); await gate.WaitAsync(ct);
        try
        {
            if (Configured)
            {
                var previous = await ReadBundleAsync(ct);
                if (expected != null && ArchiveJson.Canonical(previous) != ArchiveJson.Canonical(expected)) throw new InvalidOperationException("Archive changed during refresh; rebuild from current data");
                if (ArchiveJson.Canonical(previous) == ArchiveJson.Canonical(bundle)) return;
                await BackupAsync(ct);
                var backup = ArchiveJson.SafePath(paths.Root, $"work/backups/postgresql-json/{DateTime.UtcNow:yyyyMMddTHHmmssfff}-{Guid.NewGuid():N}.json"); Directory.CreateDirectory(Path.GetDirectoryName(backup)!); await File.WriteAllBytesAsync(backup, ArchiveJson.Bytes(previous), ct);
                await ImportDatabaseAsync(bundle, reason, ct, expected);
            }
            else
            {
                if (expected != null && ArchiveJson.Canonical(await ArchiveJson.ReadFilesAsync(paths, ct)) != ArchiveJson.Canonical(expected)) throw new InvalidOperationException("Archive changed during refresh; rebuild from current data");
                await Sync.PublicSnapshot.MirrorFilesAsync(paths, ArchiveJson.Files.Where(x => ArchiveJson.At(bundle, x.Value) != null).ToDictionary(x => "data/" + x.Key, x => ArchiveJson.Bytes(ArchiveJson.At(bundle, x.Value))), ct);
            }
        }
        finally { gate.Release(); }
    }
    private async Task ImportDatabaseAsync(JsonObject b, string reason, CancellationToken ct, JsonObject? expected = null)
    {
        ArchiveJson.Validate(b); await using var db = Context(); await db.Database.OpenConnectionAsync(ct); var c = (NpgsqlConnection)db.Database.GetDbConnection();
        // Acquire before Serializable establishes its snapshot; an owner import that was already
        // holding the archive lock must be visible to the semantic comparison after the wait.
        await using var sessionLock = expected == null ? null : await SessionArchiveLock.AcquireAsync(c, ct);
        await using var tx = await c.BeginTransactionAsync(expected == null ? IsolationLevel.ReadCommitted : IsolationLevel.Serializable, ct);
        await Execute(c, tx, "SELECT pg_advisory_xact_lock(14981747,20261025)", ct);
        if (expected != null)
        {
            // Read authoritative relational values inside the commit transaction: owner SQL edits
            // intentionally do not rewrite archive_snapshots.content_hash.
            var currentBundle = await ReadDatabaseBundleAsync(db, c, tx, ct);
            if (ArchiveJson.Canonical(currentBundle) != ArchiveJson.Canonical(expected)) throw new InvalidOperationException("Archive changed during refresh; rebuild from current data");
        }
        var version = (int)ArchiveJson.Number(b["heroes"]!["meta"]!["clientVersion"]); var hash = ArchiveJson.Hash(ArchiveJson.Bytes(b));
        var current = await Query(c, tx, "SELECT s.client_version,c.snapshot_id FROM archive_current c JOIN archive_snapshots s ON s.id=c.snapshot_id", ct);
        if (current.Count > 0 && ArchiveJson.Number(current[0]["client_version"]) > version) throw new InvalidDataException("Cannot import older client");
        var found = await Query(c, tx, "SELECT id FROM archive_snapshots WHERE content_hash=@p0", ct, hash); long id; string outcome;
        if (found.Count > 0) { id = ArchiveJson.Number(found[0]["id"]); outcome = current.Count > 0 && ArchiveJson.Number(current[0]["snapshot_id"]) == id ? "unchanged" : "repointed"; }
        else
        {
            var created = await Query(c, tx, "INSERT INTO archive_snapshots(content_hash,client_version,hero_meta,provenance,import_reason) VALUES(@p0,@p1,@p2::jsonb,@p3::jsonb,@p4) RETURNING id", ct, hash, version, b["heroes"]!["meta"]!.ToJsonString(), b["provenance"]!.ToJsonString(), reason); id = ArchiveJson.Number(created[0]["id"]); outcome = "imported";
            var ordinal = 0; foreach (var h in b["heroes"]!["heroes"]!.AsArray()) { var fields = new Dictionary<string, object?> { ["snapshot_id"] = id, ["ordinal"] = ordinal++ }; foreach (var (column, path) in HeroMap) { var n = ArchiveJson.At(h!, path.Split('.')); fields[column] = column is "hero_id" or "weapon_projectiles" or "weapon_burst" or "source_hero_line" or "source_weapon_line" ? (int)ArchiveJson.Number(n) : Value(n); } await Insert(c, tx, "heroes", fields, ct); }
            foreach (var lang in new[] { "ru", "en" })
            {
                var catalog = b["mechanics"]![lang]!; await Insert(c, tx, "mechanics_catalogues", new() { ["snapshot_id"] = id, ["language"] = lang, ["meta"] = catalog["meta"] }, ct); ordinal = 0;
                foreach (var s in catalog["sources"]!.AsArray()) await Insert(c, tx, "mechanics_sources", new() { ["snapshot_id"] = id, ["language"] = lang, ["ordinal"] = ordinal++, ["source_id"] = Value(s!["id"]), ["label"] = Value(s["label"]), ["url"] = Value(s["url"]), ["kind"] = Value(s["kind"]) }, ct);
                ordinal = 0; foreach (var f in catalog["formulas"]!.AsArray()) { var fields = new Dictionary<string, object?> { ["snapshot_id"] = id, ["language"] = lang, ["ordinal"] = ordinal++, ["formula_id"] = Value(f!["id"]) }; foreach (var key in new[] { "category", "title", "expression", "variables", "explanation", "example", "caveats", "confidence" }) fields[key] = Value(f[key]); await Insert(c, tx, "mechanics_formulas", fields, ct); var index = 0; foreach (var source in f["sourceIds"]!.AsArray()) await Insert(c, tx, "mechanics_formula_sources", new() { ["snapshot_id"] = id, ["language"] = lang, ["formula_id"] = Value(f["id"]), ["ordinal"] = index++, ["source_id"] = Value(source) }, ct); }
            }
            ordinal = 0; foreach (var v in b["history"]!["versions"]!.AsArray()) await Insert(c, tx, "history_entries", new() { ["snapshot_id"] = id, ["ordinal"] = ordinal++, ["client_version"] = (int)ArchiveJson.Number(v!["clientVersion"]), ["build_date"] = Value(v["buildDate"]), ["first_published_at"] = Value(v["firstPublishedAt"]), ["provenance_kind"] = Value(v["provenance"]!["kind"]), ["provenance_reference"] = Value(v["provenance"]!["reference"]), ["patch"] = v["patch"] }, ct);
            if (b["items"] != null) { await Insert(c, tx, "item_catalogues", new() { ["snapshot_id"] = id, ["meta"] = b["items"]!["meta"], ["statistics_meta"] = b["itemStatistics"]!["meta"] }, ct); ordinal = 0; foreach (var item in b["items"]!["items"]!.AsArray()) await Insert(c, tx, "shop_items", new() { ["snapshot_id"] = id, ["ordinal"] = ordinal++, ["item_id"] = ArchiveJson.Number(item!["id"]), ["slug"] = Value(item["slug"]), ["category"] = Value(item["category"]), ["tier"] = (int)ArchiveJson.Number(item["tier"]), ["data"] = item }, ct); ordinal = 0; foreach (var item in b["itemStatistics"]!["items"]!.AsArray()) await Insert(c, tx, "item_purchase_statistics", new() { ["snapshot_id"] = id, ["ordinal"] = ordinal++, ["item_id"] = ArchiveJson.Number(item!["itemId"]), ["data"] = item }, ct); }
            await Insert(c, tx, "archive_bundle_payloads", new() { ["snapshot_id"] = id, ["data"] = b }, ct);
        }
        if (outcome != "unchanged") await Execute(c, tx, "INSERT INTO archive_current(singleton,snapshot_id) VALUES(true,@p0) ON CONFLICT(singleton) DO UPDATE SET snapshot_id=EXCLUDED.snapshot_id", ct, id);
        await Execute(c, tx, "INSERT INTO archive_import_runs(snapshot_id,outcome,reason) VALUES(@p0,@p1,@p2)", ct, id, outcome, reason); await tx.CommitAsync(ct);
    }
    public async Task<JsonObject> StatusAsync(CancellationToken ct = default)
    {
        if (!Configured) { var b = await ReadBundleAsync(ct); return new JsonObject { ["configured"] = false, ["storage"] = "json", ["source"] = "json", ["clientVersion"] = b["heroes"]!["meta"]!["clientVersion"]!.DeepClone(), ["heroes"] = b["heroes"]!["heroes"]!.AsArray().Count, ["formulas"] = b["mechanics"]!["ru"]!["formulas"]!.AsArray().Count, ["sources"] = b["mechanics"]!["ru"]!["sources"]!.AsArray().Count, ["historyVersions"] = b["history"]!["versions"]!.AsArray().Count, ["items"] = b["items"]?["items"]?.AsArray().Count ?? 0 }; }
        await using var db = Context(); var pointer = await db.Current.AsNoTracking().Include(x => x.Snapshot).SingleOrDefaultAsync(x => x.Singleton, ct); var result = new JsonObject { ["configured"] = true, ["storage"] = "postgresql", ["source"] = "postgresql", ["snapshots"] = await db.Snapshots.LongCountAsync(ct), ["currentSnapshotId"] = pointer?.SnapshotId, ["currentClientVersion"] = pointer?.Snapshot.ClientVersion, ["clientVersion"] = pointer?.Snapshot.ClientVersion };
        await db.Database.OpenConnectionAsync(ct); var c = (NpgsqlConnection)db.Database.GetDbConnection(); var migrations = await Query(c, null, "SELECT count(*) AS n FROM archive_migrations", ct); result["schemaVersion"] = ArchiveJson.Number(migrations[0]["n"]);
        foreach (var (key, table, extra) in new[] { ("heroes", "heroes", ""), ("formulas", "mechanics_formulas", " AND language='ru'"), ("sources", "mechanics_sources", " AND language='ru'"), ("historyVersions", "history_entries", "") }) result[key] = pointer == null ? 0 : ArchiveJson.Number((await Query(c, null, $"SELECT count(*) AS n FROM {table} WHERE snapshot_id=@p0{extra}", ct, pointer.SnapshotId))[0]["n"]);
        var itemsAvailable = await Query(c, null, "SELECT to_regclass('shop_items')::text AS name", ct); result["items"] = pointer == null || itemsAvailable[0]["name"] == null ? 0 : ArchiveJson.Number((await Query(c, null, "SELECT count(*) AS n FROM shop_items WHERE snapshot_id=@p0", ct, pointer.SnapshotId))[0]["n"]); return result;
    }
}
