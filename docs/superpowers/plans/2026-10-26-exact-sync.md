# Exact publication implementation plan

Spec: docs/superpowers/specs/2026-10-26-exact-sync-design.md. Authorized autonomous execution. Feature worktree codex/database-pages-sync, base8e4fdf1. Public data must be exactly the DB snapshot; no secret/research upload, no game launch, no forced remote refs.

## Review focus

Data and assets are whitelisted, asset symlinks cannot escape public/, failed local export cannot publish, remote newer/concurrent data cannot be overwritten, same-client data edits publish while identical content is a no-op, queued work is not reported deployed. Review retry and restart behavior and keep game-refresh/no-op semantics distinct from explicit sync.

### 1. Snapshot and consistent export

- [x] RED→GREEN snapshot tests: stable canonical/hash manifest, same-client field change, traversal/symlink/size rejection, local mirror backup/rollback.
- [x] Implement server/sync/types.ts and snapshot.ts: prepareSnapshot(root,bundle):Promise<PublicSnapshot>, mirrorSnapshot(root,snapshot):Promise<{changed:boolean}>, readFileSnapshot(root):Promise<PublicSnapshot>.
- [x] Make PostgresArchive.getBundle use one read-only repeatable-read transaction; verify real concurrent export without touching the working DB.

### 2. GitHub exact publisher

- [x] RED→GREEN tests around approved-path commit, no-op, no downgrade, concurrent-ref failure, safe errors, deployed hash mismatch and retry.
- [x] Implement server/sync/github.ts: publishSnapshot and inspectPublication with contract in spec; existingCredential backend reuse; GitHub primary REST docs checked.
- [x] Preserve unrelated tree paths and never fetch upstream game data as part of publication.

### 3. Orchestration and owner integration

- [x] Implement shared/sync-types.ts, synchronization manager with private restart checkpoint, no-overlap HTTP endpoints and safe statuses; tests first.
- [x] Wire DB export before refresh, exact publication after successful import; keep same-client refresh no-op and all separate outcomes.
- [x] Add db:sync CLI (dry-run, publish, bounded wait); build manifest/CI validation and stored-data-only manual workflow.

### 4. UI, docs and release

- [x] Add local synchronization panel with RU/EN statuses, check/sync controls and deploy feedback; validate same-client changes and retry.
- [x] Update database guide/README/AGENTS/project skill and private routing decision; install maintained skill after integration in original checkout.
- [x] Run full suite with4 workers, typecheck/data/build, real DB checks and independent review, browser desktop/mobile QA and credential audit.
- [x] Commit/push feature into main, execute real exact DB sync, verify Pages by hashes, verify second sync no-op, record deployment evidence and return original checkout.

## Verification before publication — 26 October 2026

Full suite307/307 passed in isolated worktree; typecheck, data validation, public-snapshot verification and Pages-base production build passed. Consistent real PostgreSQL export regression passed. Independent whole-feature review and scoped rereview resolved all reported blockers (stale deployment retry, CLI restart, concurrent status/update). Browser checked RU/EN, desktop and390px layout with no horizontal overflow. Credential audit found0 leaks and no backend code/private files in browser builds. Exact baseline snapshot hash:5e219055279b873d9c81fc28b8fd15ab984521909bb2c9b296fa37bd44da51e4 (50 public files).

Live publication completed: feature `1010332`, exact DB snapshot commit `85441b85d0189113823b3af8fc4c10480f1e8a0e`. [Pages verification](https://github.com/Roman17-bot/deadlock-archive/actions/runs/40274987813) and [PostgreSQL CI](https://github.com/Roman17-bot/deadlock-archive/actions/runs/40274987865) succeeded. Actual served bytes, repository and DB have identical SHA256 `5e219055279b873d9c81fc28b8fd15ab984521909bb2c9b296fa37bd44da51e4`. A repeated `db:sync -- --wait` returned upToDate=true, localSaved=false with unchanged remote HEAD and no additional workflow. Original checkout reconciled by verifying all six exported blobs against origin, backing up these owned exports, then fast-forwarding. Maintained skill installed at original root and validated; private knowledge decision7 records the workflow.
