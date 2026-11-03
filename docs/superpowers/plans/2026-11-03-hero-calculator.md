# Hero Build Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build a version-aware hero/level/item calculator with legal inventories, investment bonuses, final stats and practical formula examples.

**Architecture:** A pure shared model consumes normalized optional calculation metadata in the existing hero/item documents. Native ingestion produces metadata from registered modifiers and exact versioned game configuration. The new React feature loads lazily beside the existing calculator, sharing catalogue cache and existing math.

**Tech Stack:** React/TSX, Vite, plain CSS, native ASP.NET Core10, existing EF/Npgsql and Vitest/xUnit; no new runtime dependency.

**Spec:** docs/superpowers/specs/2026-11-03-hero-calculator.md

## Global constraints

- Keep Formulas mode, routes, current data and Heritage workflows; add RU/EN for every visible control.
- No game launch; private evidence/credentials stay ignored. Primary evidence and precise client identity precede numeric promotion.
- Keep ASP.NET backend and same-client update no-op; explicit metadata enrichment uses dry run then existing refresh/persistence/sync paths.
- Catalogue and metadata versions must match; never combine a newer hero document with incompatible cached items.

## Review focus

- Multi-component/transitive upgrades, downgrades and sibling branches: remove only truly conflicting owned items.
- Capacity, duplicate and active/category limits: reject invalid additions without losing the current inventory.
- Threshold edges, full costs and sold/replaced items: no double counted components or cumulative threshold bonuses.
- Conditional/stale raw properties, innate negative resists, Spirit scaling and health penalties: resting values must represent the chosen conditions.
- Offline metadata, cancellation, mode/language changes and mobile input: retain drafts and accessible usable controls.

### Task1: Normalized data contract and native enrichment

Files: shared/build-types.ts; shared/types.ts and item-types.ts; shared/heroes.ts and items.ts validators; backend/Deadlock.Api/Ingestion/CalculatorMetadata.cs, HeroAdapter.cs, ItemAdapter.cs, ArchiveRefresh.cs, ArchiveValidation.cs; native ingestion tests.

Interfaces: optional HeroSnapshot.calculatorRules, Hero.calculation, ShopItem.calculation; BuildRules/HeroCalculation/ItemCalculation/BuildModifier types defined in shared/build-types.ts. Values use HP/m/s or percentage points as indicated by the stat key. No display-string parsing.

- [x] Write failing native/TS validation tests for metadata, invalid finite values, conditional enemy effects and unused properties.
- [x] Implement extraction from actual intrinsic registrations and the exact pinned raw source; retain unknown legacy payload readability.
- [x] Test current slot/investment tables, innate resist/scaling cases, hidden unconditional bonuses and excluded stale properties.
- [x] Run native checks and a dry-run refresh; review before persistence. Do not publish partial metadata.

### Task2: Pure inventory, investment and stat model

Files: shared/build-inventory.ts, build-stats.ts, build-calculator.test.ts. Root owns these shared files.

Interfaces: chooseBuildItem(slots, index, itemId, catalog, rules), validateBuildInventory; calculateBuild(hero, level, selectedItems, rules). Results include baseline/final stats, invested category totals/bonuses/next thresholds and source contributions for useful explanations.

- [x] Write and run failing tests for multi-input/transitive replacement in both directions, siblings, duplicates and slot limits.
- [x] Implement immutable inventory operations and full-cost investment threshold lookup.
- [x] Write failing real numeric tests for empty/levelled heroes, flat HP versus base-health investment, negative resist pools, Spirit to weapon/regen/fire-rate/resist scaling, negative HP and secondary diminishing bonuses.
- [x] Implement stats with existing shared/mechanics.ts and run the focused tests.

### Task3: Hero calculator UI and examples

Files: src/features/hero-calculator/{HeroCalculator.tsx,HeroCalculator.css,components/*,model/*}; existing Calculator.tsx and MechanicsPage.tsx integration; src/i18n/en-hero-calculator.ts and index.ts; tests/hero-calculator.test.tsx.

Interfaces: HeroCalculator({data:HeroSnapshot,onRule:(id:string)=>void}); consumes shared model and useItems without statistics. Native picker dialog boundaries own focus/escape; selected slots are item IDs/null.

- [x] Write failing interaction tests for hero/level/items, upgrade replacement, cancellation, clear, mode draft preservation and RU/EN.
- [x] Implement lazy two-mode integration, searchable portrait selection, per-slot item picker and legal inventory feedback.
- [x] Add grouped baseline/final stat ledger, category progress and full investment memo.
- [x] Add build-backed EHP, gun, Spirit-scaling and cooldown examples reusing tested formulas, with explicit relevant conditions.
- [x] Verify loading/error/retry and matching catalogue version; no initial statistics fetch or new dependency.

### Task4: Review, data persistence and publication

- [x] Independent mechanics/code review of supported calculations and data extraction; fix confirmed findings.
- [x] Render1440/768/390px, keyboard, empty/full/upgraded states and RU/EN; independent read-only design review.
- [x] Run backend:test, npm test, typecheck, data:check, build and formatting/diff checks appropriate to changed files.
- [x] Back up working DB, perform reviewed explicit refresh/enrichment, verify native API/export and Pages candidate consistency.
- [ ] Preserve user edits, integrate approved code/data, publish and verify CI/deployed assets plus exact public data hashes.
- [ ] Save private evidence/decisions and refresh the knowledge index; report concrete result and meaningful model limits.
