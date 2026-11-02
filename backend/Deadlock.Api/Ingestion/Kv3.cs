using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Deadlock.Api.Ingestion;

/// <summary>Strict text KV3 parser; typed resources are inert values.</summary>
public static class Kv3
{
    public static JsonObject Parse(string source)
    {
        var lexer = new Regex("\\G(?:\\s+|<!--[\\s\\S]*?-->|/\\*[\\s\\S]*?\\*/|//[^\\r\\n]*|\"(?:\\\\[\\s\\S]|[^\"\\\\])*\"|[{}\\[\\]=,:]|[^\\s{}\\[\\]=,:\"]+)");
        var tokens = new List<string>();
        for (var offset = 0; offset < source.Length;)
        {
            var match = lexer.Match(source, offset); if (!match.Success) throw new InvalidDataException($"Invalid KV3 token at {offset}");
            offset += match.Length; var token = match.Value;
            if (!char.IsWhiteSpace(token[0]) && !token.StartsWith("<!--") && !token.StartsWith("/*") && !token.StartsWith("//")) tokens.Add(token);
        }
        var index = 0;
        string Take() => index < tokens.Count ? tokens[index++] : throw new InvalidDataException("Unexpected end of KV3");
        string? Peek() => index < tokens.Count ? tokens[index] : null;
        JsonNode? Value(int depth)
        {
            if (depth > 128) throw new InvalidDataException("KV3 nesting limit");
            var token = Take();
            if (token == "{")
            {
                var result = new JsonObject();
                while (Peek() != "}")
                {
                    if (Peek() == ",") { index++; continue; }
                    var raw = Take(); var key = raw.StartsWith('"') ? JsonSerializer.Deserialize<string>(raw)! : raw;
                    if (key.Length == 0 || "{}[]=,:".Contains(raw[0]) || result.ContainsKey(key) || key is "__proto__" or "constructor" or "prototype") throw new InvalidDataException($"Invalid or duplicate KV3 key {key}");
                    if (Take() != "=") throw new InvalidDataException("Expected KV3 assignment");
                    result[key] = Value(depth + 1);
                }
                Take(); return result;
            }
            if (token == "[")
            {
                var result = new JsonArray(); while (Peek() != "]") { if (Peek() == ",") { index++; continue; } result.Add(Value(depth + 1)); }
                Take(); return result;
            }
            if (Peek() == ":")
            {
                if (token is not ("resource_name" or "soundevent" or "panorama" or "subclass")) throw new InvalidDataException($"Unsupported KV3 type {token}");
                index++; var value = Value(depth + 1);
                if (token == "subclass" ? value is not JsonObject : value is not JsonValue v || !v.TryGetValue<string>(out _)) throw new InvalidDataException("Invalid typed KV3 value");
                return value;
            }
            if (token.StartsWith('"')) return JsonValue.Create(JsonSerializer.Deserialize<string>(token));
            if (token == "true") return JsonValue.Create(true); if (token == "false") return JsonValue.Create(false); if (token == "null") return null;
            if (Regex.IsMatch(token, @"^0x[\da-f]+$", RegexOptions.IgnoreCase)) return JsonValue.Create((double)long.Parse(token[2..], NumberStyles.HexNumber, CultureInfo.InvariantCulture));
            if (Regex.IsMatch(token, @"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$") && double.TryParse(token, NumberStyles.Float, CultureInfo.InvariantCulture, out var number) && double.IsFinite(number)) return JsonValue.Create(number);
            throw new InvalidDataException($"Unsupported KV3 value {token}");
        }
        var root = Value(0); if (index != tokens.Count || root is not JsonObject obj) throw new InvalidDataException("KV3 root or trailing data invalid"); return obj;
    }
}
