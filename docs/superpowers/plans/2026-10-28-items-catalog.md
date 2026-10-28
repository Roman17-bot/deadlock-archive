# Items Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** A complete, searchable shop with situational filters, accessible item previews and details backed by real purchase statistics.

**Architecture:** Shared typed curated catalog and statistics; Node ingestion normalizes versioned assets, PostgreSQL stores both, exact Pages synchronization publishes identical JSON and local icons. Page-owned React components use the existing hash router and i18n.

**Tech Stack:** React/TSX, Vite, CSS, Node24, PostgreSQL; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-28-items-catalog-design.md`

## Global Constraints

- Public RU/EN copy uses player terms; keep research private and never launch the game.
- Keep source numbers, explicit statistics period and sample counts; missing observations are not zero winrate.
- Preserve same-client update no-op, PostgreSQL ownership and exact publication checks.
- Catalog contains available ordinary shop tiers1–4; local icons only.

## Review Focus

- Mixed filters: categories/tiers OR within their set; effect mode all/any explicit; empty and shared URL states recover.
- Conditional/negative effects: self-heal penalties never count as enemy antiheal; passive debuff resistance never implies a cleanse.
- Tooltips usable by keyboard and dismissible; mobile does not require hover, overflow or nested vertical scroll.
- Analytics: no divide-by-zero, missing rows, retired heroes or wrong period silently shown as current.
- Existing DB/publication: migration preserves older bundles and user edits; new JSON/icons covered by byte verification.

## Task 1 — Current catalog, filters, ingestion (coordinator + item evidence specialist)

Files: `shared/item-types.ts`, `shared/items.ts`, `shared/item-filters.ts`, `server/items/*`, `scripts/update-items.mjs`, `data/items.json`, `data/item-statistics.json`, `public/assets/items/*`.

- [ ] Test numeric/localization normalization, inactive/Legendary exclusion, safe descriptions, conditional traits and analytics aggregates with bounded fixtures; watch RED.
- [ ] Implement normalized `ItemCatalog` / `ItemStatistics` from `shared/item-types.ts`; fetch bounded pinned EN/RU assets and fixed-period analytics, download trusted WebP icons, validate before writing.
- [ ] Export validators `validateItemCatalog(value)` / `validateItemStatistics(value, catalog?)` from `shared/items.ts`; filter definitions and `filterItems` from `shared/item-filters.ts`.
- [ ] Generate all156 items with meaningful advice; check against independent evidence report.
- [ ] Verify focused tests and generated catalog constraints.

## Task 2 — PostgreSQL, API, update and exact publication (data specialist)

Files: `shared/database-types.ts`, `server/database/*`, `db/migrations/003_items.sql`, `server/app.ts`, `server/index.ts`, `server/sync/*`, `scripts/database/cli.mjs`, `scripts/validate-data.mjs`, relevant tests/docs.

- [ ] Test bundle optional legacy fields and complete new fields, DB round trip, API and publication of item JSON/icons; watch RED.
- [ ] Extend bundle with optional `items: ItemCatalog` and `itemStatistics: ItemStatistics`, requiring both together and matching versions. Persist and export through PostgreSQL tables, preserve old bundles.
- [ ] Add GET `/api/items` and `/api/item-statistics` through DB reads or file mode. Extend snapshot allowlist, manifest and limits for approved item files/icons without allowing arbitrary paths.
- [ ] Connect fresh item generation with new-version refresh; failures prevent stale items publication, same-version no-op unchanged.
- [ ] Add bounded `db:query item NAME` if useful and document initial explicit import and refresh command.
- [ ] Verify integration and migration in isolated test DB, preserving production DB until coordinator backup/import.

## Task 3 — Catalog and detail UI (website specialist)

Files: `src/pages/ItemsPage/*`, `src/pages/ItemDetailPage/*`, `src/features/items/*`, `src/services/itemsApi.ts`, `src/i18n/en-items.ts`, router/header/global imports and UI tests.

- [ ] Test combined/all-any filters, query persistence/back, empty results, keyboard preview, detail/not-found states and English text; watch RED.
- [ ] Implement three category columns with tier sections, search, basic filters, mobile filter panel, grouped effect filters and selected chips. Consume shared filter definitions and type contract.
- [ ] Implement game-like safe-text preview on hover/focus, click through to detail; no raw HTML injection.
- [ ] Implement details, linked upgrades/components, advice, winrate/sample/time and most frequent hero rows. Missing/failed statistics do not hide item descriptions.
- [ ] Add lazy routes `#/items` / `#/items/:slug`, nav and full RU/EN copy.
- [ ] Verify focused tests, desktop/mobile behavior and no regressions to existing routes.

## Task 4 — Integrate, independent review, local/Pages verification (coordinator + fresh critic)

- [ ] Inspect complete diff and cross-check coverage/taxonomy; fresh critic reviews game claims, UX and persistence/publication.
- [ ] Run `npm test`, typecheck, data:check, data:verify-publication, build and db:test.
- [ ] Backup production DB, explicitly import validated new bundle, verify item/API/export counts.
- [ ] Publish code and curated data together; preserve source checkout edits; verify CI and exact DB/repository/Pages bytes.
- [ ] Inspect desktop and320–430px UI in RU/EN and item detail; save private screenshot, update private role memory/knowledge.
