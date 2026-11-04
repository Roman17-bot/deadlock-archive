using System.Diagnostics;
using System.Text.RegularExpressions;

namespace Deadlock.Api.Sync;

/// <summary>Resolves the locally authenticated account without assuming the repository owner is the user.</summary>
public sealed class GitHubCredentials(
    Func<string, string?>? readEnvironment = null,
    Func<ProcessStartInfo, string?, CancellationToken, Task<string?>>? runProcess = null,
    TimeSpan? processTimeout = null)
{
    private const int OutputLimit = 16384;
    private static bool Valid(string? token) => !string.IsNullOrEmpty(token) && token.Length <= 8192 && !token.Any(char.IsWhiteSpace) && !token.Any(char.IsControl);
    private static InvalidOperationException Unavailable() => new("GitHub credentials are unavailable; authenticate GitHub CLI or configure GH_TOKEN.");

    public async Task<string> GetAsync(CancellationToken ct = default)
    {
        ct.ThrowIfCancellationRequested();
        var explicitToken = (readEnvironment ?? Environment.GetEnvironmentVariable)("GH_TOKEN");
        if (!string.IsNullOrEmpty(explicitToken)) return Valid(explicitToken) ? explicitToken : throw Unavailable();

        var cli = Start("gh", ["auth", "token", "--hostname", "github.com"]);
        var output = await TryRunAsync(cli, null, ct);
        var token = output?.TrimEnd('\r', '\n');
        if (Valid(token)) return token!;

        var git = Start("git", ["-c", "credential.trace=false", "-c", "credential.traceSecrets=false", "-c", "credential.interactive=never", "credential", "fill"]);
        output = await TryRunAsync(git, "protocol=https\nhost=github.com\n\n", ct);
        token = output == null ? null : Regex.Match(output, @"(?m)^password=([^\r\n]+)").Groups[1].Value;
        return Valid(token) ? token! : throw Unavailable();
    }

    private static ProcessStartInfo Start(string tool, string[] arguments)
    {
        var start = new ProcessStartInfo(tool) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true };
        foreach (var argument in arguments) start.ArgumentList.Add(argument);
        foreach (var key in new[] { "GCM_TRACE", "GCM_TRACE_SECRETS", "GIT_TRACE", "GIT_TRACE2", "GIT_TRACE_CURL", "GIT_CURL_VERBOSE", "GCM_GUI_PROMPT", "GIT_TERMINAL_PROMPT" }) start.Environment[key] = "0";
        start.Environment.Remove("GH_DEBUG");
        start.Environment["GH_PROMPT_DISABLED"] = "1";
        start.Environment["GCM_INTERACTIVE"] = "never";
        start.Environment["GIT_ASKPASS"] = "";
        start.Environment["SSH_ASKPASS"] = "";
        return start;
    }

    private async Task<string?> TryRunAsync(ProcessStartInfo start, string? input, CancellationToken ct)
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct);
        deadline.CancelAfter(processTimeout ?? TimeSpan.FromSeconds(10));
        try
        {
            var output = await (runProcess ?? RunAsync)(start, input, deadline.Token);
            deadline.Token.ThrowIfCancellationRequested();
            return output?.Length <= OutputLimit ? output : null;
        }
        catch (Exception)
        {
            ct.ThrowIfCancellationRequested();
            // Missing tools, expired authentication and helper failures may fall back; never log their output.
            return null;
        }
    }

    private static async Task<string?> RunAsync(ProcessStartInfo start, string? input, CancellationToken ct)
    {
        using var process = Process.Start(start) ?? throw Unavailable();
        try
        {
            // Drain both pipes concurrently so a verbose helper cannot deadlock before the deadline.
            var output = ReadBoundedAsync(process.StandardOutput, ct);
            var error = ReadBoundedAsync(process.StandardError, ct);
            if (input != null) await process.StandardInput.WriteAsync(input.AsMemory(), ct);
            process.StandardInput.Close();
            await Task.WhenAll(output, error, process.WaitForExitAsync(ct));
            return process.ExitCode == 0 ? await output : null;
        }
        finally
        {
            if (!process.HasExited) process.Kill(entireProcessTree: true);
        }
    }

    private static async Task<string> ReadBoundedAsync(StreamReader reader, CancellationToken ct)
    {
        var buffer = new char[OutputLimit + 1];
        try
        {
            var count = 0;
            while (count < buffer.Length)
            {
                var read = await reader.ReadAsync(buffer.AsMemory(count), ct);
                if (read == 0) return new string(buffer, 0, count);
                count += read;
            }
            throw Unavailable();
        }
        finally { Array.Clear(buffer); }
    }
}
