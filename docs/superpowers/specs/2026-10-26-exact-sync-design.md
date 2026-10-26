# Exact PostgreSQL → GitHub Pages synchronization

The owner requests full data synchronization and has delegated implementation/design/publication decisions. PostgreSQL is the source for publication. A new local sync button publishes all current public data, including edits within the same client version. Updating game data continues to use version checks and the same-client no-op; direct sync compares content instead.

## Chosen approach

Export a consistent read of PostgreSQL, validate and mirror the five curated JSON files, then update only approved public data/assets in an atomic GitHub Git-data commit. A normal main-branch push triggers pages.yml, which builds those committed files without fetching different game data. Track the commit and verify the deployed public snapshot before reporting success. This uses existing owner credentials only on the local backend.

Alternatives: fetching the game API again in Actions cannot guarantee the DB's exact data; connecting Pages to local PostgreSQL would require new external hosting/network access. Both are excluded. No background watcher or cloud DB is introduced. Direct SQL changes are published by the sync button/CLI; a successful new-patch update with publication enabled invokes the same exact publisher.

## Public snapshot contract

`server/sync/types.ts` defines PublicSnapshot: bundle, clientVersion, hash, manifest, files [{path,content:Buffer}]. SnapshotManifest has schemaVersion1, clientVersion, reviewedClientVersion, hash and files mapping repository-relative public paths to SHA256. Approved paths: data/heroes.json, mechanics.json, mechanics.en.json, provenance.json, version-history.json; corresponding portraits under public/assets/heroes/; generated data/snapshot-manifest.json. Never include database dumps, credentials, research or arbitrary repo files.

Canonical JSON recursively sorts object keys, preserves array order and source precision, and ends with a newline. Hash is SHA256 of canonical JSON of the path→SHA256 map excluding the manifest itself. Manifest is stable: no export timestamp that causes false changes. DB reads use one REPEATABLE READ READ ONLY transaction, including the current pointer and all child rows. Snapshot validation retains actual mechanics review versions; no automatic retagging. Path/symlink/size checks protect asset reads. Local mirror writes changed files with backups/rollback and does not alter the DB.

## GitHub and deployment

`publishSnapshot(snapshot,deps)` returns {changed,commitSha,hash,url,runId?}. Read main ref/commit/tree, compare Git blob hashes, reject remote client/revision downgrade, upload changed approved blobs, create a commit based on the observed main head, and update its ref with force:false. No retry that overwrites a concurrent commit. Identical repo content creates no commit or workflow dispatch. Unrelated remote files stay intact. Existing owner credentials remain in memory and never enter logs, React or snapshot files.

`inspectPublication(snapshot,{commitSha?},deps)` returns repositoryMatches,pagesMatches,repositoryHash,pagesHash,commitSha,status,url,runId?. Status is queued|in_progress|success|failure|unknown. Check the Pages workflow for the exact commit. Public verification checks manifest and actual served file hashes (bounded requests, cache busting). A queued/accepted commit is never deployment success. If repo is current but Pages is behind, monitor/retry its existing workflow rather than create duplicate data commits; explicit safe dispatch of pages.yml is allowed only when the needed workflow is absent or failed. No-op when repo and Pages already match.

The private sync checkpoint survives API restarts in ignored work/. A new sync captures a new DB snapshot, so SQL edits can publish without changing client version. A failed export never publishes; a failed upload keeps local DB/JSON and can be retried. A failed deployment reports failure; next sync can dispatch the exact existing commit without a duplicate data commit. Remote newer data is rejected, not silently imported or overwritten. Manual cloud workflow publishes committed data only and stops fetching upstream game data independently.

## Owner workflow and UI

New /api/sync/status GET and /api/sync POST reuse local Host/Origin/session-nonce protections. POST accepts only an empty JSON object. Reserve one job synchronously; refuse overlap with game refresh. Status reports source hashes, local save, commit/run link and final deployed verification. UI card in local Updates shows check/sync actions, readable RU/EN status, content hashes and retry states; narrow screens do not overflow. Refresh UI retains its prior semantics. After new-patch DB save, invoke exact sync; first mirror current DB before source refresh to preserve DB-managed mechanics/history. JSON save, DB save, knowledge indexing, GitHub commit and Pages deployment remain separate outcomes.

CLI: npm run db:sync -- --dry-run checks without writing; npm run db:sync publishes; --wait waits for verified deployment with a bounded timeout. The build prepares a public manifest from curated data without needing PostgreSQL. CI validates any tracked manifest against actual files before building. The refresh-data workflow becomes manual publication of already committed data, retaining expected_version compatibility.

## Verification

Meaningful tests: stable content hashes and same-client changes; safe asset paths and local rollback; consistent DB export; whitelisted Git commit/no-op/concurrent-ref rejection/downgrade refusal/redaction; successful and failed deploy/retry; owner access/concurrency; RU/EN panel and mobile layout. Full existing suite, typecheck, data check and Pages-base build; isolated real DB tests; independent review; real GitHub publication of the baseline exact DB snapshot and verification of all served data. Preserve existing PostgreSQL service, original checkout and private files. No game launch.
