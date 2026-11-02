using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Npgsql;

namespace Deadlock.Api.Data;

public sealed record DatabaseSetupState(bool RoleExists, bool Elevated, string? DatabaseOwner, string? TestDatabaseOwner, bool Configured);

public static class DatabaseOwnerTools
{
    public const string AppRole = "deadlock_archive_app", Database = "deadlock_archive", TestDatabase = "deadlock_archive_test";
    public static void ValidateSetupState(DatabaseSetupState state)
    {
        if (state.Elevated) throw new InvalidOperationException("Existing application role has elevated privileges; inspect it manually");
        if (state.DatabaseOwner != null && state.DatabaseOwner != AppRole || state.TestDatabaseOwner != null && state.TestDatabaseOwner != AppRole) throw new InvalidOperationException("Existing archive database has a different owner; inspect it manually");
        if (state.RoleExists != (state.DatabaseOwner != null)) throw new InvalidOperationException("Archive role/database state is incomplete; inspect it manually");
        if (state.RoleExists && !state.Configured) throw new InvalidOperationException("Archive exists but application credentials are missing; setup will not reset the role");
        if (!state.RoleExists && state.Configured) throw new InvalidOperationException("Application credentials exist but archive database is missing; setup will not overwrite configuration");
    }
    public static Task<string> ReadMaskedPasswordAsync(CancellationToken ct = default)
    {
        if (Console.IsInputRedirected) throw new InvalidOperationException("Setup requires an interactive terminal for the masked admin password prompt");
        Console.Write("PostgreSQL postgres password: "); var value = new StringBuilder();
        try { while (true) { ct.ThrowIfCancellationRequested(); var key = Console.ReadKey(true); if (key.Key == ConsoleKey.Enter) return Task.FromResult(value.ToString()); if (key.Key == ConsoleKey.Escape || key.KeyChar == '\u0003') throw new OperationCanceledException("Setup cancelled"); if (key.Key == ConsoleKey.Backspace) { if (value.Length > 0) { value.Length--; Console.Write("\b \b"); } } else if (!char.IsControl(key.KeyChar)) { value.Append(key.KeyChar); Console.Write('*'); } } } finally { Console.WriteLine(); }
    }
    public static async Task<JsonObject> SetupAsync(AppPaths paths, bool noImport = false, CancellationToken ct = default, Func<CancellationToken, Task<string>>? passwordPrompt = null)
    {
        // AppEnvironment has already loaded the ignored local file. Process values retain priority.
        var configured = new ArchiveStore(paths).Configured;
        string? Env(string key) => Environment.GetEnvironmentVariable("DEADLOCK_DB_" + key);
        if (configured && (Env("HOST") != "127.0.0.1" || Env("PORT") != "5432" || Env("NAME") != Database || Env("USER") != AppRole)) throw new InvalidOperationException("Existing configuration differs from the dedicated local archive");
        var password = await (passwordPrompt ?? ReadMaskedPasswordAsync)(ct);
        var config = new NpgsqlConnectionStringBuilder { Host = "127.0.0.1", Port = 5432, Database = "postgres", Username = "postgres", Password = password, Timeout = 5, CommandTimeout = 20, Pooling = false, ApplicationName = "deadlock_archive_setup" };
        await using var admin = new NpgsqlConnection(config.ConnectionString); await admin.OpenAsync(ct); password = "";
        bool exists = false, elevated = false; await using (var command = new NpgsqlCommand("SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication FROM pg_roles WHERE rolname=@name", admin)) { command.Parameters.AddWithValue("name", AppRole); await using var reader = await command.ExecuteReaderAsync(ct); if (await reader.ReadAsync(ct)) { exists = true; elevated = Enumerable.Range(0, 4).Any(reader.GetBoolean); } }
        async Task<string?> Owner(string name) { await using var command = new NpgsqlCommand("SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=@name", admin); command.Parameters.AddWithValue("name", name); return await command.ExecuteScalarAsync(ct) as string; }
        var owner = await Owner(Database); var testOwner = await Owner(TestDatabase); ValidateSetupState(new(exists, elevated, owner, testOwner, configured));
        async Task Execute(string sql) { await using var command = new NpgsqlCommand(sql, admin); await command.ExecuteNonQueryAsync(ct); }
        string? appPassword = null;
        if (!exists) { appPassword = Convert.ToBase64String(RandomNumberGenerator.GetBytes(36)).TrimEnd('=').Replace('+', '-').Replace('/', '_'); await Execute($"CREATE ROLE {AppRole} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '{appPassword}'"); await Execute($"CREATE DATABASE {Database} OWNER {AppRole}"); await Execute($"REVOKE CONNECT ON DATABASE {Database} FROM PUBLIC"); }
        if (testOwner == null) { await Execute($"CREATE DATABASE {TestDatabase} OWNER {AppRole}"); await Execute($"REVOKE CONNECT ON DATABASE {TestDatabase} FROM PUBLIC"); }
        if (appPassword != null)
        {
            var target = ArchiveJson.SafePath(paths.Root, ".env.local"); var previous = File.Exists(target) ? await File.ReadAllTextAsync(target, ct) : "";
            if (Regex.IsMatch(previous, @"(?m)^\s*(?:export\s+)?DEADLOCK_DB_[A-Z_]+\s*=")) throw new IOException("Local database configuration changed; setup will not overwrite it");
            var content = previous + (previous.Length > 0 && !previous.EndsWith('\n') ? "\n" : "") + "\n# Local PostgreSQL archive; keep this file private.\n" + $"DEADLOCK_DB_HOST=127.0.0.1\nDEADLOCK_DB_PORT=5432\nDEADLOCK_DB_NAME={Database}\nDEADLOCK_DB_TEST_NAME={TestDatabase}\nDEADLOCK_DB_USER={AppRole}\nDEADLOCK_DB_PASSWORD={appPassword}\n";
            var temporary = target + "." + Guid.NewGuid().ToString("N") + ".tmp"; try { await using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None)) { await stream.WriteAsync(Encoding.UTF8.GetBytes(content), ct); } if ((File.Exists(target) ? await File.ReadAllTextAsync(target, ct) : "") != previous) throw new IOException("Local configuration changed during setup"); File.Move(temporary, target, true); } finally { if (File.Exists(temporary)) File.Delete(temporary); }
            foreach (var (k, v) in new Dictionary<string, string> { ["HOST"] = "127.0.0.1", ["PORT"] = "5432", ["NAME"] = Database, ["TEST_NAME"] = TestDatabase, ["USER"] = AppRole, ["PASSWORD"] = appPassword }) Environment.SetEnvironmentVariable("DEADLOCK_DB_" + k, v);
        }
        if (!noImport) await new ArchiveStore(paths).InitializeAsync(ct);
        return new JsonObject { ["created"] = !exists, ["preserved"] = exists, ["database"] = Database, ["testDatabase"] = TestDatabase, ["initialized"] = !noImport };
    }
}
