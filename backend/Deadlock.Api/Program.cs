using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Deadlock.Api;
using Deadlock.Api.Data;
using Deadlock.Api.Ingestion;
using Deadlock.Api.Patches;
using Deadlock.Api.Sync;
using Deadlock.Api.Updates;

var root = AppEnvironment.ResolveRoot(args);
AppEnvironment.LoadLocal(root);
var command = args.FirstOrDefault() is { } first && !first.StartsWith('-') ? first : "serve";
var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = [], ContentRootPath = root });
builder.Logging.AddFilter("Microsoft", LogLevel.Warning);
builder.Logging.AddFilter("System.Net.Http.HttpClient", LogLevel.Warning);
builder.Services.AddSingleton(new AppPaths(root));
builder.Services.AddSingleton<ArchiveStore>();
builder.Services.AddSingleton<IArchiveStore>(sp => sp.GetRequiredService<ArchiveStore>());
builder.Services.AddSingleton<IArchiveRefresh>(sp => new ArchiveRefresh(sp.GetRequiredService<AppPaths>()));
builder.Services.AddHttpClient<PatchHistoryService>(c => c.Timeout = TimeSpan.FromSeconds(90))
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddTransient<IPatchHistoryService>(sp => sp.GetRequiredService<PatchHistoryService>());
builder.Services.AddHttpClient("public-sync", c => c.Timeout = TimeSpan.FromSeconds(90))
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddSingleton<IPublicSync, PublicSync>();
builder.Services.AddSingleton<BundlePersistence>();
builder.Services.AddSingleton<UpdateCoordinator>();
builder.Services.AddHttpClient<StatisticsCollector>(client => client.Timeout = Timeout.InfiniteTimeSpan).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false, AutomaticDecompression = System.Net.DecompressionMethods.All });
builder.Services.AddHttpClient("reference-assets", client => client.Timeout = Timeout.InfiniteTimeSpan).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddTransient<ReferenceUpdateService>();
if (command == "serve") builder.Services.AddHostedService<StartupRefresh>();
var port = Environment.GetEnvironmentVariable("API_PORT") ?? "3001";
if (!int.TryParse(port, out var portNumber) || portNumber is < 1 or > 65535) throw new InvalidDataException("Invalid API_PORT");
builder.WebHost.UseUrls($"http://127.0.0.1:{portNumber}");
var app = builder.Build();
try
{
    if (command != "serve") { Environment.ExitCode = await ArchiveCommands.RunAsync(command, args, app.Services); return; }
    var store = app.Services.GetRequiredService<IArchiveStore>();
    await store.InitializeAsync();
    var updates = app.Services.GetRequiredService<UpdateCoordinator>();
    await updates.InitializeAsync(CancellationToken.None);
    var sync = app.Services.GetRequiredService<IPublicSync>();
    var localRoutes = new HashSet<string>(["/api/update", "/api/update/session", "/api/update/status", "/api/version-history", "/api/sync", "/api/sync/status"]);
    var allowedOrigins = new HashSet<string>(["http://127.0.0.1:5173", "http://localhost:5173"]);
    app.Run(async context =>
    {
        var request = context.Request; var response = context.Response; var ct = context.RequestAborted;
        response.Headers.XContentTypeOptions = "nosniff";
        response.ContentType = "application/json; charset=utf-8";
        async Task Reply(int status, object? value = null)
        { response.StatusCode = status; if (value is not null && request.Method != "HEAD") await response.WriteAsJsonAsync(value, cancellationToken: ct); }
        try
        {
            var path = request.Path.Value ?? "/";
            var rawTarget = context.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpRequestFeature>()?.RawTarget;
            if (rawTarget?.StartsWith("//") == true) { await Reply(400, new { error = "Invalid request target" }); return; }
            var local = localRoutes.Contains(path);
            if (local)
            {
                response.Headers.CacheControl = "no-store";
                var origin = request.Headers.Origin.ToString();
                if (!Regex.IsMatch(request.Host.Value ?? "", @"^(localhost|127\.0\.0\.1)(?::[0-9]{1,5})?$") || request.Host.Port is < 1 or > 65535 ||
                    (origin.Length > 0 && !allowedOrigins.Contains(origin)) || request.Headers["Sec-Fetch-Site"] == "cross-site")
                { await Reply(403, new { error = "Local access only" }); return; }
                if (origin.Length > 0) { response.Headers.AccessControlAllowOrigin = origin; response.Headers.Vary = "Origin"; }
                if (request.Method == "OPTIONS")
                {
                    if (origin.Length == 0) { await Reply(403, new { error = "Local Origin required" }); return; }
                    response.Headers.AccessControlAllowMethods = path is "/api/update" or "/api/sync" ? "POST, OPTIONS" : "GET, HEAD, OPTIONS";
                    response.Headers.AccessControlAllowHeaders = "Content-Type, X-Archive-Token";
                    await Reply(204); return;
                }
                if (path is "/api/update" or "/api/sync")
                {
                    if (request.Method != "POST") { response.Headers.Allow = "POST, OPTIONS"; await Reply(405, new { error = "Method not allowed" }); return; }
                    var token = Encoding.UTF8.GetBytes(request.Headers["X-Archive-Token"].ToString()); var expected = Encoding.UTF8.GetBytes(updates.SessionToken);
                    if (origin.Length == 0 || token.Length != expected.Length || !CryptographicOperations.FixedTimeEquals(token, expected))
                    { await Reply(403, new { error = "Local session required" }); return; }
                    if (!Regex.IsMatch(request.ContentType ?? "", @"^application/json(?:\s*;\s*charset=utf-8)?$", RegexOptions.IgnoreCase) || request.Headers.ContainsKey("Content-Encoding"))
                    { await Reply(415, new { error = "JSON content type required" }); return; }
                    if (request.ContentLength > 4096) { await Reply(413, new { error = "Request body too large" }); return; }
                    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromSeconds(5));
                    using var bytes = new MemoryStream(); var buffer = new byte[1024]; int count;
                    try { while ((count = await request.Body.ReadAsync(buffer, timeout.Token)) > 0) { if (bytes.Length + count > 4096) { await Reply(413, new { error = "Request body too large" }); return; } bytes.Write(buffer, 0, count); } }
                    catch (OperationCanceledException) when (!ct.IsCancellationRequested) { await Reply(408, new { error = "Invalid JSON request" }); return; }
                    JsonObject? body;
                    try { body = JsonNode.Parse(bytes.ToArray()) as JsonObject; }
                    catch (System.Text.Json.JsonException) { await Reply(400, new { error = "Invalid JSON request" }); return; }
                    if (path == "/api/sync")
                    {
                        if (!store.Configured) { await Reply(503, new { error = "PostgreSQL is required" }); return; }
                        if (body is null || body.Count != 0) { await Reply(400, new { error = "Expected an empty object" }); return; }
                        await Reply(202, updates.StartSync()); return;
                    }
                    if (body is null || body.Count != 1 || body["publish"] is not JsonValue value || !value.TryGetValue<bool>(out var publish))
                    { await Reply(400, new { error = "Expected {publish:boolean}" }); return; }
                    await Reply(202, updates.Start(publish)); return;
                }
            }
            if (request.Method is not ("GET" or "HEAD")) { response.Headers.Allow = "GET, HEAD"; await Reply(405, new { error = "Read-only API" }); return; }
            if (path == "/api/update/session") { await Reply(200, new { token = updates.SessionToken, state = updates.ReadState() }); return; }
            if (path == "/api/update/status") { await Reply(200, updates.ReadState()); return; }
            if (path == "/api/sync/status") { await Reply(200, updates.IsBusy ? sync.ReadState() : await sync.GetStateAsync(request.Query["refresh"] == "1", ct)); return; }
            var bundle = await store.ReadBundleAsync(ct);
            response.Headers.CacheControl = "no-cache";
            switch (path)
            {
                case "/api/heroes": await Reply(200, bundle["heroes"]); break;
                case "/api/abilities": await Reply(bundle["abilities"] is null ? 404 : 200, bundle["abilities"] ?? (object)new { error = "Ability data unavailable" }); break;
                case "/api/items":
                case "/api/item-statistics":
                    var data = bundle[path == "/api/items" ? "items" : "itemStatistics"];
                    await Reply(data is null ? 404 : 200, data ?? (object)new { error = "Item data unavailable" }); break;
                case "/api/hero-profiles":
                case "/api/hero-statistics":
                case "/api/world-map":
                    var referenceKey = path == "/api/hero-profiles" ? "heroProfiles" : path == "/api/hero-statistics" ? "heroStatistics" : "worldMap";
                    var reference = bundle[referenceKey];
                    await Reply(reference is null ? 404 : 200, reference ?? (object)new { error = "Reference data unavailable" }); break;
                case "/api/version-history": await Reply(200, bundle["history"]); break;
                case "/api/health":
                    var health = new JsonObject { ["status"] = "ok", ["storage"] = store.Configured ? "postgresql" : "json", ["clientVersion"] = bundle["heroes"]!["meta"]!["clientVersion"]!.DeepClone(), ["heroCount"] = bundle["heroes"]!["meta"]!["heroCount"]!.DeepClone() };
                    if (store.Configured) health["database"] = await store.StatusAsync(ct);
                    await Reply(200, health); break;
                case "/api/heroes/search":
                    var query = request.Query["q"].ToString().Trim(); var rawLimit = request.Query["limit"].ToString();
                    if (query.Length > 80 || query.Any(c => c < ' ' || c == 127) || rawLimit != "" && !Regex.IsMatch(rawLimit, @"^(?:[1-9]|1[0-9]|20)$")) { await Reply(400, new { error = "Invalid search query" }); break; }
                    var limit = rawLimit == "" ? 20 : int.Parse(rawLimit);
                    await Reply(200, new JsonArray(bundle["heroes"]!["heroes"]!.AsArray().Where(h => $"{h!["name"]} {h["slug"]} {h["aliases"]}".Contains(query, StringComparison.OrdinalIgnoreCase)).Take(limit).Select(h => h!.DeepClone()).ToArray())); break;
                default:
                    if (path == "/api/mechanics" || path.StartsWith("/api/formulas/"))
                    {
                        var language = request.Query["language"].ToString(); if (language == "" && !request.Query.ContainsKey("language")) language = "ru";
                        if (language is not ("ru" or "en")) { await Reply(400, new { error = "Invalid language" }); break; }
                        var catalogue = bundle["mechanics"]![language]!;
                        if (path == "/api/mechanics") { await Reply(200, catalogue); break; }
                        var id = path["/api/formulas/".Length..];
                        if (!Regex.IsMatch(id, "^[a-z0-9][a-z0-9-]{0,79}$")) { await Reply(400, new { error = "Invalid formula request" }); break; }
                        var formula = catalogue["formulas"]!.AsArray().FirstOrDefault(f => f!["id"]!.GetValue<string>() == id);
                        await Reply(formula is null ? 404 : 200, formula ?? (object)new { error = "Formula not found" });
                    }
                    else await Reply(404, new { error = "Not found" });
                    break;
            }
        }
        catch (UpdateBusyException) { await Reply(409, new { error = "An archive operation is already in progress" }); }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { }
        catch { if (!response.HasStarted) await Reply(store.Configured ? 503 : 500, new { error = store.Configured ? "Archive unavailable" : "Request failed" }); }
    });
    Console.WriteLine($"API: http://127.0.0.1:{portNumber}/api/health");
    await app.RunAsync();
}
catch (Exception error)
{
    Console.Error.WriteLine(error is InvalidDataException ? $"Archive validation failed: {error.Message}" : "Archive startup/command failed; check local configuration and saved data.");
    Environment.ExitCode = 1;
}
finally { await app.DisposeAsync(); }

public partial class Program;
