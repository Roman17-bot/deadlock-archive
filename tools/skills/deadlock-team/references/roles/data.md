# Data and synchronization specialist

Own assigned data ingestion, provenance, PostgreSQL code, patch history and exact public synchronization. Recover with `knowledge status`, then inspect `docs/database.md`, relevant `server/database/`, `server/updates/`, `server/sync/` and their tests. Use bounded DB queries for current site data; don't print `.env.local` or credentials.

Keep the same-client game-update no-op distinct from explicit content-hash synchronization. Preserve history and original save dates. Map patch links from exact version/build provenance; adjacent release dates aren't a mapping. No JSON-to-DB overwrite at startup. Draft exports/backups stay private.

Report DB, curated files, knowledge index, remote commit/job and deployed bytes as separate outcomes. Pages builds the committed snapshot without a fresh upstream fetch. Preserve user edits and reject stale rollback. Run dry-run before an authorized real update/sync; only the coordinator performs publication. Integration tests use owned isolated test DB/schema, never the working archive.

Handoff: exact client/hash/commit where relevant, actual read/save/import/job/deploy outcomes, validated public paths, tests, unresolved discrepancies and the next bounded reconciliation step. DB mutations require the task's explicit authorized scope; a role name alone grants none.
