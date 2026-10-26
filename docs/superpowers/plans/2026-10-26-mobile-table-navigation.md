# Mobile table navigation implementation plan

> **For agentic workers:** Use superpowers:executing-plans for inline execution and a fresh whole-branch review.

**Goal:** Make every mobile stat discoverable and remove unnecessary growth scrolling.

**Architecture:** Keep the existing semantic table. Add a page-local scroll hook and navigation component; scoped CSS fits the growth view and delineates the pinned hero column.

**Tech Stack:** Existing React/TypeScript, CSS, i18next and Vitest. No dependencies.

**Spec:** `docs/superpowers/specs/2026-10-26-mobile-table-navigation-design.md`

## Global constraints

- No changes to numbers, API, PostgreSQL, public snapshot or desktop appearance.
- Keep search, sorting, levels, notes and RU/EN working; document owns vertical scrolling.
- Use actual measured overflow, not a hard-coded viewport assumption.

## Review focus

- Fit/no fit after resizing: controls must follow actual measured overflow.
- Finger/keyboard scrolling: controls and range must follow the real scroll position.
- Switch growth/stats or expand notes: no stale offset, clipped notes or layout overflow.
- Long names, decimals and English headings at CSS 320 px: readable cells and no growth scroll.
- Last hidden columns and sorting at the right edge: always reachable, pinned hero still separated.

## Task 1: Mobile table and navigation

Files: new `hooks/useTableScroll.ts`, `components/TableScrollNavigation.tsx`, `tests/table-scroll.test.tsx`; update `HeroTable.tsx`, `MobileTableTools.tsx`, `HeroesPage.css` and `i18n/en-common.ts`.

- [ ] Add behavioral tests for initial overflow, arrows/range/swipe, fitting/resizing, view reset, preserved sort/notes, and English labels. Watch missing-navigation failures first.
- [ ] Implement measured scroll state, clamped navigation, resize/content observation and cleanup, with reset only when the table group changes.
- [ ] Add styled sticky controls only for an overflowing mobile table. Apply a permanent hero separator and conditional edge shadows. Make growth columns fit the container without hiding overflow.
- [ ] Run new tests and existing UI/hero details tests; inspect real geometry at all required widths and capture screenshots.
- [ ] Run full suite, typecheck, data validation, public snapshot verification, production build and formatting. Request a fresh review, then resolve actionable findings.
- [ ] Commit, fast-forward the clean original checkout, publish through the existing GitHub Pages workflow, verify deployed UI/assets, and record the result in the private knowledge archive.
