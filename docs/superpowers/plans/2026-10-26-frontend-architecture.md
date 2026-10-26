# Frontend architecture implementation plan

> **For agentic workers:** Use subagent-driven-development or executing-plans. User approved autonomous implementation with unchanged UI/behavior.

**Goal:** Make pages and related UI/logic easy to find while preserving the existing website.
**Architecture:** Four page modules, shared layout/UI, isolated calculator/sync features, typed service functions and local hooks. Existing React/Vite/plain CSS and root shared mathematics remain.
**Spec:** docs/superpowers/specs/2026-10-26-frontend-architecture-design.md

## Global constraints

No design/copy/URL/API/data/math/schema/dependency changes; no game launch or credential publication. Preserve safe lifecycle and local/static modes, CSS selectors and media queries. Work in assigned modules; root owns integration/release and shared transport/layout.

## Review focus

Preserve route prefix/fallback and hero query remount; CSS cascade and responsive widths; strict-mode abort/poll locks and terminal outcomes; no frontend credentials; lazy mechanics/static Pages; old import paths fully removed without compatibility shims.

### 1. Baseline and app foundation
- [x] Verify clean baseline307 tests, typecheck/build and ten visual scenes before edits.
- [x] Extract layout, hash routing, snapshot hook, HTTP/environment helpers; relocate common controls/hook; preserve DOM and semantics.

### 2. Home and hero pages
- [x] Move route entries/CSS, split sections/table/controls and state hook along actual responsibilities.
- [x] Preserve search/sort/level/mobile/CSV/notes behavior; verify relevant UI regressions after integration.

### 3. Mechanics and calculator
- [x] Move page, split library UI and data hook/client; split calculator definitions/evaluator/form/results and relocate control CSS without altering rules.
- [x] Run mechanics/API/calculator tests, preserve bilingual catalogue validation and root shared math.

### 4. Updates and synchronization
- [x] Move page and split history/update state and presentation; extract standalone sync feature/client/hook with exact async contracts.
- [x] Run owner/sync regressions, preserve local/static modes, safe links and no-op/retry/abort behavior.

### 5. Integration, parity and release
- [x] Integrate all imports/CSS order; remove obsolete paths; update architecture docs and recovery routing.
- [x] Full tests/typecheck/data/publication/build; inspect visual pixel/geometry/text differences and test browser interactions desktop/mobile/RU/EN.
- [x] Independent final review, fix blockers, audit unchanged data/backend and public credential exclusion.
- [ ] Commit/FF/push, verify PostgreSQL/Pages CI and public site; keep original checkout and private evidence current.
