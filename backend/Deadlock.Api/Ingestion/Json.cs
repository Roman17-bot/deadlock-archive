using System.Globalization;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Deadlock.Api.Ingestion;

internal static class J
{
    public static JsonObject Obj(JsonNode? value, string label) => value as JsonObject ?? throw new InvalidDataException($"Missing object {label}");
    public static JsonArray Arr(JsonNode? value, string label) => value as JsonArray ?? throw new InvalidDataException($"Missing array {label}");
    public static string Str(JsonNode? value, string fallback = "") => value is JsonValue v && v.TryGetValue<string>(out var s) ? s : fallback;
    public static double Num(JsonNode? value, string label, double? fallback = null)
    {
        if (value is null && fallback.HasValue) return fallback.Value;
        if (value is JsonValue v && v.GetValueKind() == System.Text.Json.JsonValueKind.Number && double.TryParse(v.ToJsonString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var n) && double.IsFinite(n)) return n;
        throw new InvalidDataException($"Missing/invalid number {label}");
    }
    public static long Id(JsonNode? value, string label) { var n = Num(value, label); if (n < 1 || n != Math.Truncate(n) || n > 9007199254740991) throw new InvalidDataException($"Invalid integer {label}"); return (long)n; }
    public static bool Bool(JsonNode? value, string label, bool? fallback = null)
    {
        if (value is null && fallback.HasValue) return fallback.Value;
        if (value is JsonValue v) { if (v.TryGetValue<bool>(out var b)) return b; if (v.GetValueKind() == System.Text.Json.JsonValueKind.Number) { var n = Num(v, label); if (n is 0 or 1) return n == 1; } }
        throw new InvalidDataException($"Invalid boolean {label}");
    }
    public static void Equal(JsonNode? a, JsonNode? b, string label)
    {
        if (a is JsonValue av && b is JsonValue bv && av.GetValueKind() == System.Text.Json.JsonValueKind.Number && bv.GetValueKind() == System.Text.Json.JsonValueKind.Number) { if (Math.Abs(Num(av, label) - Num(bv, label)) <= 1e-8) return; }
        else if (JsonNode.DeepEquals(a, b)) return;
        throw new InvalidDataException($"API/raw disagreement {label}: {a} vs {b}");
    }
    public static JsonArray List(IEnumerable<JsonNode?> values) => new(values.Select(v => v?.DeepClone()).ToArray());
    public static JsonObject Local(string ru, string en) => new() { ["ru"] = ru, ["en"] = en };
    public static IEnumerable<JsonObject> Rows(JsonNode? value, string label) => Arr(value, label).Select(v => Obj(v, label));
    public static string Scalar(JsonNode? value) => value is JsonValue v && v.TryGetValue<string>(out var s) ? s : value?.GetValueKind() == System.Text.Json.JsonValueKind.Number ? Format(Num(value, "scalar")) : value?.ToJsonString() ?? "";
    public static double ParseFloat(JsonNode? value) { var m = Regex.Match(Scalar(value), @"^[\s]*[+-]?(?:\d+(?:\.\d*)?|\.\d+)"); return m.Success && double.TryParse(m.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var n) ? n : 0; }
    public static string Format(double number) => number.ToString("G", CultureInfo.InvariantCulture);
}
