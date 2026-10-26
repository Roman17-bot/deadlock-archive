# PostgreSQL for the Deadlock archive

Owner requested a full local PostgreSQL database, optional agent use, and VS Code extensions. Autonomous decisions/development/publication remain authorized. PostgreSQL18 service is running on5432; admin authentication was supplied by the owner. Do not change existing cluster authentication/network settings or other databases.

## Architecture

Use `pg` with a bounded connection pool and parameterized queries. Create dedicated `deadlock_archive` DB and `deadlock_archive_app` LOGIN role (no superuser/createdb/createrole). Random application password goes only into ignored `.env.local`; admin password is entered through a masked prompt and retained only in memory. SQL migrations are tracked, transactional, checksum-validated and advisory-locked. Never log connection strings/passwords or send them to React/GitHub.

PostgreSQL holds versioned relational data for the actual current website features: release metadata, snapshots/current pointers, heroes, weapons, formulas and their RU/EN prose, sources/formula-source relations, archive version history and import runs. Preserve exact source precision and all metadata/notes; retain older snapshots and source confidence. Import a validated curated bundle transactionally, deduplicate identical content, expose bounded read queries and exact snapshot export. Do not invent users/builds/items tables without data/features.

The local Node API reads from PostgreSQL when configured. Missing config keeps portable JSON mode for CI/static tooling; configured-but-broken DB must fail clearly rather than silently use stale JSON. Startup migrates and seeds only an empty archive; an existing DB stays authoritative across restarts. API additions: safe health/storage status, mechanics?language=ru|en, version history, bounded hero/formula queries. Frontend localhost mechanics reads the API; Pages keeps static curated data. No PostgreSQL port or credential exposed through the website.

Curated JSON remains the versioned review/publication format. Local owner updates validate sources and save JSON, then import the full curated bundle in one PostgreSQL transaction before publication/indexing completion. JSON save, DB save, knowledge indexing and publication are separately reported. On DB failure preserve the old DB and saved JSON, skip publication, expose an actionable error. Retry must synchronize a newer saved-file version if DB is behind, while the explicit same-client no-op rule remains intact for a synchronized current DB. Export validated DB state to a reviewable directory; promotion to publication files is explicit, never implicit during a read. GitHub Actions/Pages run without private DB and keep working.

Add db:setup/migrate/import/status/export/backup/query commands, SQL examples and a schema diagram. db:backup creates private pg_dump custom dumps; restoration targets a separate verification DB first. Test migrations/import/rollback/idempotence/query isolation against a real owned Postgres test DB; normal unit/CI tests need no local password (CI provisions isolated postgres service). Never drop an existing user database or use --clean against it.

Agent use: PostgreSQL for live website facts/history and comparisons; retain private SQLite/FTS5 evidence/profile/decisions as independent recovery path. Document routing and calculator shared functions in maintained deadlock-project skill; install updated skill. No private research replication to public data. No game launch.

## Alternatives considered

An all-JSON app cannot provide relational integrity/history queries. Moving private evidence too would couple recovery to a running service and duplicate existing working FTS; defer that migration. Hosting Postgres for Pages would require external hosting/access decisions; retain the static deployment and prepare a conventional Node/Postgres backend locally.

## Verification

Real dedicated role is restricted; import preserves44 heroes and all27 rules/43 sources in each language; Node API proves it is reading DB. Invalid imports roll back without changing current pointers; concurrent readers see complete snapshots, same version history is not duplicated; no-op owner update does not save/import/dispatch. Public production build contains no DB secrets. Existing187tests plus meaningful DB/integration regressions pass. VS Code extension installation verified by CLI inventory. Leave user-owned services running.
