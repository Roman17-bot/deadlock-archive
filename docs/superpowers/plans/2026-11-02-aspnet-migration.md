# ASP.NET Core backend and automatic patch updates

Goal: replace the Node HTTP/data backend with native .NET 10 services while preserving React/Vite API contracts, PostgreSQL contents and exact Pages publication. User delegates routine choices; no new authorization/JWT/subscriptions/microservices are included.

Architecture: one modular ASP.NET Core application, EF Core/Npgsql existing-schema store, typed HTTP ingestion, native GitHub sync, queued update orchestration and startup BackgroundService. JSON payload fidelity preserves current frontend schemas; old SQL migrations remain compatible. Private knowledge indexing remains separate Node tooling. Startup serves saved data first, checks once in background, stages/validates all new hero/item/statistics data and commits atomically. Same version does not refetch gameplay assets or dispatch a build; patch-note gap recovery remains independent.

- [x] Port archive store and Pages sync; keep import idempotence, backups, snapshot hashes and stale-deployment guards.
- [x] Port hero/item/statistics ingestion and verify actual new patch changes; reject mixed revisions and partial bundles.
- [x] Backfill official described patch notes with stable identities, safe expandable display and no bare-build public entries.
- [x] Implement API/CLI/host and one-command startup, background refresh, local security and persistent recoverable outcomes.
- [x] Replace legacy Node runtime entrypoints and CI; run contract/security/update/DB/export/UI checks before publishing.
- [ ] Review independently, exercise real PostgreSQL backup/update and compare deployed bytes; record evidence privately.

Ownership: data worker Data/Sync; ingestion worker Ingestion; website worker Patches/UpdatesPage/schema; coordinator host, Updates, CLI, launch scripts, integration tests and release. New shared interfaces are in backend/Deadlock.Api/Contracts.cs.
