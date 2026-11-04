using System.ComponentModel;
using System.Diagnostics;
using Deadlock.Api.Sync;

namespace Deadlock.Tests;

public sealed class GitHubCredentialsTests
{
    [Fact]
    public async Task ExplicitTokenWinsWithoutStartingAnyHelper()
    {
        var credentials = new GitHubCredentials(key => key == "GH_TOKEN" ? "fake-explicit-token" : null,
            (_, _, _) => throw new InvalidOperationException("No helper should run"));
        Assert.Equal("fake-explicit-token", await credentials.GetAsync());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task CurrentGitHubCliAccountIsPreferredToGitHelpers(string? explicitToken)
    {
        var calls = 0;
        var credentials = new GitHubCredentials(_ => explicitToken, (start, input, ct) =>
        {
            calls++;
            Assert.Equal("gh", start.FileName);
            Assert.Equal(new[] { "auth", "token", "--hostname", "github.com" }, start.ArgumentList);
            Assert.Null(input);
            Assert.True(ct.CanBeCanceled);
            Assert.False(start.UseShellExecute);
            Assert.True(start.RedirectStandardOutput);
            Assert.True(start.RedirectStandardError);
            Assert.Equal("1", start.Environment["GH_PROMPT_DISABLED"]);
            Assert.False(start.Environment.ContainsKey("GH_DEBUG"));
            return Task.FromResult<string?>("fake-current-account-token\r\n");
        });
        Assert.Equal("fake-current-account-token", await credentials.GetAsync());
        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task MissingCliFallsBackToConfiguredGitHelpersWithoutOwnerUsername()
    {
        var tools = new List<string>();
        var credentials = new GitHubCredentials(_ => null, (start, input, _) =>
        {
            tools.Add(start.FileName);
            if (start.FileName == "gh") throw new Win32Exception("fake missing CLI");
            Assert.Equal("git", start.FileName);
            Assert.Equal(new[] { "-c", "credential.trace=false", "-c", "credential.traceSecrets=false", "-c", "credential.interactive=never", "credential", "fill" }, start.ArgumentList);
            Assert.Equal("protocol=https\nhost=github.com\n\n", input);
            Assert.DoesNotContain("username=", input);
            Assert.Equal("0", start.Environment["GIT_TERMINAL_PROMPT"]);
            Assert.Equal("0", start.Environment["GIT_TRACE_CURL"]);
            Assert.Equal("never", start.Environment["GCM_INTERACTIVE"]);
            Assert.Equal("", start.Environment["GIT_ASKPASS"]);
            return Task.FromResult<string?>("protocol=https\nhost=github.com\nusername=some-collaborator\npassword=fake-git-token\n");
        });
        Assert.Equal("fake-git-token", await credentials.GetAsync());
        Assert.Equal(new[] { "gh", "git" }, tools);
    }

    [Theory]
    [InlineData("has whitespace")]
    [InlineData(" leading-space")]
    [InlineData("two\nlines")]
    [InlineData("control\u0001character")]
    public async Task InvalidExplicitTokenFailsWithoutSilentlySwitchingAccounts(string token)
    {
        var credentials = new GitHubCredentials(_ => token,
            (_, _, _) => throw new InvalidOperationException("No helper should run"));
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => credentials.GetAsync());
        Assert.DoesNotContain(token, error.Message);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("two\nlines")]
    [InlineData("invalid token")]
    public async Task UnavailableOrMalformedCliOutputFallsBack(string? cliOutput)
    {
        var calls = 0;
        var credentials = new GitHubCredentials(_ => null, (start, _, _) =>
        {
            calls++;
            return Task.FromResult(start.FileName == "gh" ? cliOutput : "password=fake-fallback-token\n");
        });
        Assert.Equal("fake-fallback-token", await credentials.GetAsync());
        Assert.Equal(2, calls);
    }

    [Fact]
    public async Task OversizedHelperOutputIsRejectedBeforeParsing()
    {
        var credentials = new GitHubCredentials(_ => null, (start, _, _) => Task.FromResult<string?>(
            start.FileName == "gh" ? new string('x', 8193) : "password=fake-token\n" + new string('x', 16384)));
        await Assert.ThrowsAsync<InvalidOperationException>(() => credentials.GetAsync());
    }

    [Fact]
    public async Task HelperTimeoutCancelsTheAttemptAndAllowsGitFallback()
    {
        var cancelled = false;
        var credentials = new GitHubCredentials(_ => null, async (start, _, ct) =>
        {
            if (start.FileName == "git") return "password=fake-git-token\n";
            try { await Task.Delay(Timeout.InfiniteTimeSpan, ct); }
            catch (OperationCanceledException) { cancelled = true; throw; }
            return null;
        }, TimeSpan.FromMilliseconds(50));
        Assert.Equal("fake-git-token", await credentials.GetAsync());
        Assert.True(cancelled);
    }

    [Fact]
    public async Task CallerCancellationDoesNotStartTheNextHelper()
    {
        using var cancel = new CancellationTokenSource();
        var calls = 0;
        var credentials = new GitHubCredentials(_ => null, (_, _, ct) =>
        {
            calls++;
            cancel.Cancel();
            return Task.FromCanceled<string?>(ct);
        });
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => credentials.GetAsync(cancel.Token));
        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task HelperErrorsNeverExposeCredentialOutputOrExceptions()
    {
        const string sensitive = "fake-sensitive-helper-output";
        var credentials = new GitHubCredentials(_ => null,
            (_, _, _) => throw new IOException(sensitive));
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => credentials.GetAsync());
        Assert.DoesNotContain(sensitive, error.ToString());
        Assert.Null(error.InnerException);
    }
}
