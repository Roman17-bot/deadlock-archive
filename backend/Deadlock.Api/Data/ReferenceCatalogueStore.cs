using System.Text.Json.Nodes;
using Npgsql;
using NpgsqlTypes;

namespace Deadlock.Api.Data;

/// <summary>Catalogue headers and ordered entity/cohort observations survive removal of supplemental bundles.</summary>
public static class ReferenceCatalogueStore
{
    static void Set(JsonObject root, string path, JsonArray rows)
    {
        var parts = path.Split('.'); var parent = parts.Length == 1 ? root : root[parts[0]]!.AsObject(); parent[parts[^1]] = rows;
    }
    public static async Task WriteAsync(NpgsqlConnection connection, NpgsqlTransaction transaction, long snapshot, JsonObject bundle, CancellationToken ct)
    {
        foreach (var (kind, collections) in ReferenceCatalogues.Collections)
        {
            if (bundle[kind] is not JsonObject catalogue) continue;
            var header = catalogue.DeepClone().AsObject();
            foreach (var collection in collections) if (ArchiveJson.At(header, collection.Split('.')) is JsonArray) Set(header, collection, []);
            await using (var insert = new NpgsqlCommand("INSERT INTO reference_catalogues(snapshot_id,kind,header) VALUES(@id,@kind,@header)", connection, transaction))
            {
                insert.Parameters.AddWithValue("id", snapshot); insert.Parameters.AddWithValue("kind", kind); insert.Parameters.AddWithValue("header", NpgsqlDbType.Jsonb, header.ToJsonString()); await insert.ExecuteNonQueryAsync(ct);
            }
            foreach (var collection in collections)
            {
                if (ArchiveJson.At(catalogue, collection.Split('.')) is not JsonArray rows) continue;
                for (var ordinal = 0; ordinal < rows.Count; ordinal++)
                {
                    await using var insert = new NpgsqlCommand("INSERT INTO reference_catalogue_rows(snapshot_id,kind,collection,ordinal,data) VALUES(@id,@kind,@collection,@ordinal,@data)", connection, transaction);
                    insert.Parameters.AddWithValue("id", snapshot); insert.Parameters.AddWithValue("kind", kind); insert.Parameters.AddWithValue("collection", collection); insert.Parameters.AddWithValue("ordinal", ordinal); insert.Parameters.AddWithValue("data", NpgsqlDbType.Jsonb, rows[ordinal]!.ToJsonString()); await insert.ExecuteNonQueryAsync(ct);
                }
            }
        }
    }
    public static async Task ReadAsync(NpgsqlConnection connection, NpgsqlTransaction transaction, long snapshot, JsonObject bundle, CancellationToken ct)
    {
        await using var exists = new NpgsqlCommand("SELECT to_regclass('reference_catalogues') IS NOT NULL", connection, transaction);
        if (await exists.ExecuteScalarAsync(ct) is not true) { foreach (var kind in ReferenceCatalogues.Collections.Keys) bundle.Remove(kind); return; }
        var headers = new Dictionary<string, JsonObject>();
        await using (var select = new NpgsqlCommand("SELECT kind,header::text FROM reference_catalogues WHERE snapshot_id=@id", connection, transaction))
        {
            select.Parameters.AddWithValue("id", snapshot); await using var reader = await select.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) headers.Add(reader.GetString(0), JsonNode.Parse(reader.GetString(1))!.AsObject());
        }
        foreach (var (kind, collections) in ReferenceCatalogues.Collections)
        {
            if (!headers.TryGetValue(kind, out var header)) { bundle.Remove(kind); continue; }
            await using var select = new NpgsqlCommand("SELECT collection,data::text FROM reference_catalogue_rows WHERE snapshot_id=@id AND kind=@kind ORDER BY collection,ordinal", connection, transaction);
            select.Parameters.AddWithValue("id", snapshot); select.Parameters.AddWithValue("kind", kind);
            await using var reader = await select.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var collection = reader.GetString(0); if (!collections.Contains(collection) || ArchiveJson.At(header, collection.Split('.')) is not JsonArray rows) throw new InvalidDataException("Invalid stored reference collection"); rows.Add(JsonNode.Parse(reader.GetString(1)));
            }
            bundle[kind] = header;
        }
    }
}
