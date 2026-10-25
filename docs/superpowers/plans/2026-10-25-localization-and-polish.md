# Localization and polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all five requested UI/data improvements and publish them.

**Architecture:** i18next dictionaries plus paired mechanics catalogues; reusable accessible combobox; Node version preflight and persisted JSON history.

**Tech Stack:** Existing React/TypeScript/Vite/plain CSS/Node 24, i18next and react-i18next.

**Spec:** docs/superpowers/specs/2026-10-25-localization-and-polish-design.md

## Global Constraints

Do not launch the game. Keep knowledge, backups and credentials private. Preserve calculator math and source confidence. No frontend GitHub credentials. Owner already authorized autonomous implementation and publication.

## Review Focus

- Same-version button clicks must cause neither persistence nor GitHub dispatch.
- RU/EN switch must retain calculator input, filters and route while updating all accessible labels and locale formatting.
- Long RU/EN labels must fit at 320px and menu keyboard focus must not be trapped.
- New snapshots must not create duplicate or fabricated historical entries.
- Data source or publication failure must not misrepresent save/deploy status.

### Task 1: Update preflight and history

**Files:** server/updates/source.ts, manager.ts, storage.ts and tests; shared/update-types.ts; new data/version-history.json and validation/public preparation/workflow.

**Interfaces:** Optional `UpdateState.upToDate`; exported version-history schema and safe JSON history. Expose history to public and local browser without credentials.

- [x] Add regressions for same/new/older/unavailable version and history duplication; observe RED.
- [x] Implement early check and append history with correct date provenance; observe GREEN.
- [x] Verify actual dry-run, no-change manager behavior and existing persistence/security tests.

### Task 2: i18n foundation and site translation

**Files:** new src/i18n/{index.ts,en-common.ts,en-calculator.ts,en-data.ts}; App.tsx, Home.tsx, HeroRegister.tsx, MethodDialog.tsx, UpdatePage.tsx, format.ts; new tests/i18n.test.tsx.

**Interfaces:** `useI18n(): {t(key: string, values?: Record<string, unknown>): string, language: 'ru'|'en', setLanguage(language): void}`; shared i18n instance for number/date formatting. English dictionaries map existing Russian text to English. RU remains default.

- [x] Test language toggle, persistence, all routes and input preservation; observe RED.
- [x] Install maintained i18next packages; translate shell/home/register/method/updates and dynamic data notices; localize formatting and CSV.
- [x] Integrate complete paired data/mechanics.en.json; validate ID/source/field parity and no Cyrillic in English prose.

### Task 3: Calculator menu and responsive layout

**Files:** new src/components/StyledSelect.tsx; Calculator.tsx, MechanicsPage.tsx, styles/mechanics.css, src/i18n/en-calculator.ts; tests/mechanics.test.tsx and select tests.

**Interfaces:** Consume `useI18n` from Task 2 and paired English catalogue. Preserve all task IDs, math and entered values; `onRule(id)` stays unchanged.

- [x] Add keyboard/menu tests then implement select-only combobox and its site styles.
- [x] Translate calculator/page UI, labels, errors and explanations using Task 2 contract; preserve values across language changes.
- [x] Align field grid, use single column on narrow screens; verify screenshots and DOM bounds in RU and EN.

### Task 4: Integrate, review, publish and remember

- [x] Show persisted version history with current/past labels and both date meanings, translated.
- [x] Run npm test, npm run typecheck, npm run data:check, npm run build; independent review of behavior, access and translations.
- [x] Verify desktop/mobile routes and real unchanged update (no Actions dispatch).
- [x] Commit, fast-forward main, push, verify successful Pages deployment and public UI.
- [x] Update docs/progress.md and private knowledge decisions/import. Preserve pre-existing user dev services; leave no new owned service. Deliver links and screenshots.

Release: code935a114; Pages run40223331859 build/deploy succeeded. Public JS index-VadAZjgN.js, English catalogue/reference and history returned200. Public RU/EN/calculator/history and published snapshot check verified; mobile397px viewport had303px inputs at left47px, no horizontal overflow. Additional search-focus fix included. 187/187 tests passing.
