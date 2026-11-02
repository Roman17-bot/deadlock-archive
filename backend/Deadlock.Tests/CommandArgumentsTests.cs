using Deadlock.Api;
using Deadlock.Api.Updates;

namespace Deadlock.Tests;

public sealed class CommandArgumentsTests
{
    [Theory]
    [InlineData("--dry-ru")]
    [InlineData("--expected-version")]
    [InlineData("--expected-version", "not-a-number")]
    [InlineData("--expected-version", "0")]
    public async Task InvalidUpdateArgumentsAreRejectedBeforeResolvingOrInitializingStorage(params string[] args)
    {
        await Assert.ThrowsAsync<InvalidDataException>(() => ArchiveCommands.RunAsync("update", ["update", .. args], new NoServices()));
    }
    sealed class NoServices : IServiceProvider
    {
        public object? GetService(Type type) => throw new InvalidOperationException("Invalid arguments must not access storage or network");
    }
}
