using System.Text.Json.Nodes;

namespace Deadlock.Api;

public static class AppEnvironment
{
    public static string ResolveRoot(string[] args)
    {
        var index = Array.IndexOf(args, "--root");
        var value = index >= 0 && index + 1 < args.Length ? args[index + 1] : Environment.GetEnvironmentVariable("DEADLOCK_ROOT");
        if (value is not null) return Path.GetFullPath(value);
        foreach (var start in new[] { Environment.CurrentDirectory, AppContext.BaseDirectory })
            for (var dir = new DirectoryInfo(start); dir is not null; dir = dir.Parent)
                if (File.Exists(Path.Combine(dir.FullName, "data", "heroes.json"))) return dir.FullName;
        throw new InvalidOperationException("Cannot locate archive root; use --root.");
    }

    public static void LoadLocal(string root)
    {
        var path = Path.Combine(root, ".env.local");
        if (!File.Exists(path)) return;
        foreach (var raw in File.ReadLines(path))
        {
            var line = raw.Trim();
            if (line.StartsWith("export ")) line = line[7..].TrimStart();
            var split = line.IndexOf('=');
            if (split <= 0 || line.StartsWith('#')) continue;
            var key = line[..split].Trim();
            if (!System.Text.RegularExpressions.Regex.IsMatch(key, "^[A-Za-z_][A-Za-z0-9_]*$")) continue;
            var value = line[(split + 1)..].Trim();
            if (value.Length >= 2 && value[0] is '\'' or '"' && value[^1] == value[0]) value = value[1..^1];
            else { var comment = value.IndexOf(" #", StringComparison.Ordinal); if (comment >= 0) value = value[..comment].TrimEnd(); }
            if (Environment.GetEnvironmentVariable(key) is null) Environment.SetEnvironmentVariable(key, value);
        }
    }
}
