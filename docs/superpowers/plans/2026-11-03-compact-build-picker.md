# Compact build picker implementation plan

> **For agentic workers:** use superpowers:executing-plans. The coordinator implements; designer supplies a bounded handoff, fresh designcritic reviews the rendered result.

**Goal:** reduce inventory and shop scrolling while making item categories obvious.

**Architecture:** extract the item chooser from HeroCalculator into BuildItemPicker, reusing PickerDialog and chooseBuildItem. Scoped CSS controls density and dialog scrolling; Mechanics page gains width without changing element order.

**Tech stack:** existing React/TypeScript, CSS, Vite, i18next; no new packages.

**Spec:** ../specs/2026-11-03-compact-build-picker.md

## Constraints and review focus

Preserve lazy requests, calculations, all 12 slots/4 active limit, upgrade replacement and drafts. Keep names readable, remove targets44px, keyboard focus and reduced motion. Inspect long Russian names, zero results, selected/disabled entries, smallest screens, and wide layouts.

## Task 1 — grouped chooser

- [x] Add behavioral tests for grouped categories/tiers, exclusive category and tier filters with search/reset, duplicate/active reasons and selected state. Run red before implementation.
- [x] Create src/features/hero-calculator/BuildItemPicker.tsx and CSS; remove old item controls/results from HeroCalculator.tsx. Add optional className to PickerDialog. Add only required English strings.
- [x] Run focused tests including existing calculator/abilities interactions.

## Task 2 — compact layout

- [x] Update existing slot and responsive CSS in place; use input container width for column counts. Keep fill/category and insert/reduced-motion behavior.
- [x] Widen MechanicsPage.css to1920px/32px gutters; keep mobile gutters. Render390/768/1440/1920 and inspect filled RU/EN names, controls, dialog scrolling and focus.

## Task 3 — review and delivery

- [x] Fresh read-only designcritic review of actual screenshots/source; fix confirmed issues.
- [x] Run npm test, typecheck/data:check/build, formatting/diff checks. No backend rerun required unless backend changes.
- [ ] Commit, fast-forward clean original checkout and publish using existing authorization. Verify CI/deployed chunks and unchanged public-data sync; preserve private reports/context.

## Verification before publication

354 tests in35files passed. Production build/typecheck/data validation/format and diff checks passed. Actual local production QA covered390/768/1440/1920px, full RU/EN names, three category surfaces, composed search/category/tier, one-Escape focus return and short844x390viewport scrolling. No new data fetch or heavy runtime dependency. Fresh designcritic b5c4b1e8 returned ready-with-limits with no confirmed findings; motion/performance and real OSkeyboard were not measured. Post-publication outcome is recorded in the private project archive.
