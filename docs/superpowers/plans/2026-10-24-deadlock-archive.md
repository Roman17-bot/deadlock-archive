# Deadlock Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship a trustworthy, styled hero stat register and home page with a GitHub Pages URL.

**Architecture:** One normalized JSON feeds a React/Vite frontend and a local Node HTTP API. Pure TypeScript domain functions own level progression, searching and sorting. Static production data makes Pages independent of the Node API.

**Tech Stack:** Node24 LTS, React19, Vite8, TypeScript7, plain CSS, Vitest5/Testing Library, JSON.

**Spec:** ../specs/2026-10-24-deadlock-archive-design.md

## Global Constraints
- No game launch; only two website pages; no database or Tailwind.
- All playable heroes from 6819, source metadata retained; stale 6785 websites cannot supply current values.
- Public repository excludes work/, knowledge/, outputs/, credentials and personal game files.
- User delegated decisions and already authorized GitHub creation/push/publication; no repeated approval gate.

## Review Focus
- Search casing, aliases and no-match state must remain usable.
- Every displayed numeric header must sort numerically in both directions, with deterministic ties.
- Level bounds 1..36 and built-in Spirit weapon scaling must not double count growth.
- GitHub Pages base path, hash deep links and local portrait/data URLs must work off root.
- Source errors cannot silently become zero-valued hero stats or an apparently fresh snapshot.

### Task 1: Verified dataset and knowledge snapshot
Files: data/heroes.json, data/provenance.json, knowledge/current/, outputs/.
- [x] Save exact primary assets, version and local install agreement; document weapon exceptions.
- [x] Normalize all44 heroes and emit readable table; validate IDs, finite required values and expected progression.
- [x] Generate current full ability/item reference and retain old match research as dated history.

### Task 2: Shared domain and Node API
Files: shared/heroes.ts, shared/heroes.test.ts, server/app.ts, server/app.test.ts, server/index.ts.
Interfaces: HeroSnapshot/Hero/HeroStats/SortKey; statsAtLevel(hero,level), selectHeroes(heroes,query,sort,level); createApp(snapshot): http.Server.
- [x] Write tests first for level1/36, Spirit coupling, bounds, case/alias search, 9-vs100 numeric sorting and both directions.
- [x] Run npm test; observe missing implementation failure; implement minimal domain; run tests to green.
- [x] Write real loopback API tests for /api/heroes, /api/health,404, and405; RED→GREEN.
- [x] Commit dataset/domain/API after full relevant suite passes.

### Task 3: React pages and interactions
Files: src/app/, src/components/, src/features/heroes/, src/pages/, src/styles/, tests/ui.test.tsx.
- [x] Write interaction tests for home CTA, 44-row register, search/empty, sorting, level, reset and methods; run RED.
- [x] Implement editorial home, register, state and accessible controls; run GREEN.
- [x] Add local portraits/font assets and responsive plain CSS, source/method explanations and CSV export.
- [x] Verify data failure renders an actionable error and retry; no live API required for static export.

### Task 4: Build, review and release
Files: vite.config.ts, tsconfig*.json, .github/workflows/pages.yml, README.md, .gitignore.
- [x] Run complete tests, typecheck and production build. Inspect local rendered pages if supported.
- [x] Fresh reviewer checks full code/data and Review Focus; fix material issues with regression tests.
- [x] Create GitHub repository using existing credential helper; push only intended files; enable Pages.
- [x] Verify deployment terminal success and fetch the actual public home/data/deep-link assets.
- [x] Deliver public URL, repository, table and update notes; state material limits.

### Final user refinements
- [x] npm run dev starts both services, waits for readiness, and opens the home in Google Chrome; Ctrl+C stops both. Tested actual start and cleanup, no remaining listeners.
- [x] Website gives equal emphasis to the roster; Nurse Harrow remains a personal research priority only.
- [x] Public Pages build c2cc7a3 succeeded (run40122485411), public JSON matches the source, assets load and browser interaction/CSV were verified.
