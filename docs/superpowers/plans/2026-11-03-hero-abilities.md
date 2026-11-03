# Hero abilities implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. Coordinator integrates shared context.

**Goal:** Add complete hero abilities to the archive and build calculator while refining its controls and item slots.

**Architecture:** Optional versioned abilities catalogue with normalized native ingestion/storage and lazy frontend loading. Pure property/rank calculations reuse build bonuses. Scoped controls/ability components preserve the existing calculator composition.

**Tech Stack:** React/TypeScript, Vite, CSS/SVG, ASP.NET Core10/EF/Npgsql, existing Vitest/xUnit; no new runtime library.

**Spec:** docs/superpowers/specs/2026-11-03-hero-abilities-design.md

## Constraints and review focus

No game launch, raw/config/credentials private, source versions aligned, same-client no-op retained. No all-heroes raw dump in initial home bundle. Do not infer slots from association arrays. Check cumulative additive/set/multiply upgrades, charged/ultimate/imbued scopes, custom scales and transformed/secondary abilities. Retain legacy archives and atomic public sync; distinguish DB save and publication outcomes.

## Task1 — native catalogue and persistence (data)

Ownership: backend/, new migration005, shared/ability-types.ts and shared/abilities.ts validation, scripts/validate-data.mjs, native/contract tests, docs/database.md. No frontend/shared build math edits.

- [x] Audit source coverage and agree typed catalogue with coordinator/hero specialist.
- [x] Add failing mapping/normalization/rank-operation/version/unsafe text tests; implement extraction from the pinned raw/API pair.
- [x] Add optional bundle/API/export/approved icon support and normalized catalogue/hero ability rows, with legacy absence preserved.
- [x] Prove full reconstruction without supplemental payloads, backfill/roundtrip/export and failed-import atomicity in isolated tests.

## Task2 — polished controls and pure ability evaluation (coordinator)

Ownership: src/features/hero-calculator/, shared/ability-calculation.ts/tests, frontend ability service/hook, RU/EN and feature tests. Designer owns private CSS/SVG handoff only.

- [x] Extract hero/level/clear and inventory UI into focused components; apply accepted socket/control design with existing actions and accessible names.
- [x] Test and implement cumulative rank/property operations, linear scales and explicit cooldown/duration/range/charges effects; preserve unsupported scale output honestly.
- [x] Add lazy catalogue reader with cancellation/version/retry tests; no statistics request.
- [x] Show actual4 abilities and relevant variants/rank controls left; target imbued scope by ability ID; remove manual ability example and synthetic selection toggles when replaced.
- [x] Preserve mode/hero/item drafts and actual inventory behavior; test RU/EN, empty/loading/errors, rank and item updates.

## Task3 — review and rollout (coordinator)

- [x] Independent correctness/coverage and actual rendered design review; address confirmed defects.
- [x] Full JS/native/isolatedPG/typecheck/data/build/format checks appropriate to changes.
- [x] Backup working DB, reviewed dry-run and explicit enrichment; migrate/save/export; API/public consistency.
- [ ] Integrate without losing user edits, publish and verify CI/deployed code and exactDB/files/repository/Pages bytes.
- [ ] Save accepted private role context and refresh knowledge index.
