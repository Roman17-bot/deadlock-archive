# PostgreSQL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development for the assigned bounded tasks. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make the installed PostgreSQL the local site's working database with migrations, history, reliable updates and developer tools.

**Architecture:** Dedicated local DB/role; relational versioned repository via pg; curated JSON as public exchange format; private SQLite evidence remains independent.

**Tech Stack:** Node24, TypeScript, pg, PostgreSQL18, existing React/Vite/Vitest.

**Spec:** docs/superpowers/specs/2026-10-25-postgresql-design.md

## Global Constraints

No game launch; no admin password persistence; ignored .env.local/application password/backups only. No cluster auth changes, no existing database deletion. Preserve RU/EN, source precision and confidence, same-client no-op, static GitHub Pages and one-command Chrome startup.

## Review Focus

- Configured DB failure is explicit and does not serve stale JSON as PostgreSQL.
- Failed imports retain old current snapshots and skip publication while saved JSON is recoverable.
- Existing local DB is not overwritten at startup; JSON/DB lag can be repaired safely.
- Every agent/HTTP query is bounded/parameterized and private evidence/credentials stay private.
- Migrations, real DB tests, backup/restore and static CI are reproducible.

### Task 1: Relational schema and repository

**Files:** server/database/_, db/migrations/_.sql, shared/database-types.ts, real integration tests.
**Interface:** `ArchiveRepository` getHeroes/getMechanics(language)/getHistory/status/importBundle; `readCuratedBundle(root)` validation and exact export. pg Pool created from environment. Explicit close(). Contract to be shared before parallel integration.

- [x] Write failing meaningful real-Postgres integration cases for migration/import/current/history/rollback and bounded queries.
- [x] Implement migrations, repository, bundle validation, transactional idempotent import and typed reads.
- [x] Verify real Postgres and regular tests; report exact data counts.

### Task 2: Safe setup and operational CLI

**Files:** scripts/database/*, .env.example, docs/database.md, db/examples.sql, .vscode/extensions.json.
**Interface:** CLI imports Task1 repository/migrations; `loadDatabaseEnvironment(root)` safely loads ignored .env.local; setup prompts admin secret, creates dedicated role/DB and app config, runs migrate/import. db query/status/export/backup + test service support.

- [x] Implement authenticated local setup, atomic private config writing, no secret output; preserve existing DB/config.
- [x] Add operational commands, SQL examples, VS Code connection instructions and schema diagram.
- [x] Verify setup/status/import/idempotence/export and a private backup/restore round trip on owned test DB.

### Task 3: API, owner update, frontend and CI

**Files:** server/app.ts/index.ts, updates/manager/http/tests, shared/update-types.ts; scripts/dev and package scripts; MechanicsPage and local data loading; CI service/matrix as needed.

- [x] Add RED→GREEN tests for DB-backed API, configured failures and update DB-sync outcomes/retry while preserving no-op.
- [x] Initialize/migrate/seed only empty DB, make live API read PostgreSQL and local mechanics use API.
- [x] Synchronize full verified bundle before index/publication; expose DB outcome without leaking credentials.
- [x] Keep static CI/Pages JSON mode and npm run dev Chrome startup; add real DB CI checks.

### Task 4: Developer tooling, skill, review and release

- [x] Install verified Microsoft PostgreSQL VS Code extension; reuse existing SQL formatter and add workspace recommendations.
- [x] Update/install project skill for PG queries vs private evidence and shared calculator module.
- [x] Full tests/typecheck/data/build, independent review, real local PostgreSQL/API/browser checks and credentials-in-build audit.
- [x] Commit/push/publish portable changes; record deployment proof and private DB setup evidence; preserve existing services.

## Verification — 26 October 2026

- Local PostgreSQL 18: restricted application role, one exact current snapshot, 44 heroes, 27 formulas and 43 sources per language; separate test database.
- `npm test -- --maxWorkers=4`: 216/216 tests, including real PostgreSQL integration; typecheck, data validation and Pages-base production build pass.
- `npm run db:test`: 12/12 tests. A restored backup is exactly equal to the curated bundle both before and after the isolated-schema tests.
- Live local API reports `storage: postgresql`; browser loads bilingual mechanics and history. Same-client button returns up-to-date and leaves import-run count unchanged (2 → 2).
- Independent reviews completed. Fixed slug search parity and explicit local history-load errors; the updater also rereads the database before version preflight after a separate CLI import.
- Public build audit: no application password, backend configuration, or private archive files. Microsoft PostgreSQL extension 1.32.1 installed; maintained project skill installed and validated.
- Release `495bdf5` published on 26 October 2026. [PostgreSQL CI](https://github.com/Roman17-bot/deadlock-archive/actions/runs/40252817278) and [Pages build/deploy](https://github.com/Roman17-bot/deadlock-archive/actions/runs/40252817647) succeeded. Public browser and HTTP checks confirm the released assets, 44 heroes, 27 formulas per language and current history.
