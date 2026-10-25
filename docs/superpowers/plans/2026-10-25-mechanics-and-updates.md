# Mechanics, updater and project memory implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Publish a Russian mechanics reference with calculators, a verifiable owner-operated updater, and a searchable local project knowledge database/skill.

**Architecture:** Versioned JSON is the public source of truth, typed pure functions implement explicit calculation models, Node handles refresh/persistence and owner publication. SQLite indexes research and decisions locally; a short installed skill routes future agents to compact retrieval commands. Research precedes page implementation.

**Tech Stack:** Existing React/TSX, Vite, plain CSS, Node24.15+, native node:sqlite, Vitest/Testing Library, GitHub Actions/Pages.

**Spec:** docs/superpowers/specs/2026-10-25-mechanics-and-updates-design.md

## Global Constraints

- Do not launch Deadlock. Keep private knowledge, backups and credentials out of the public build/repository.
- User delegated implementation choices and publishing; do not add a new approval gate.
- Consensus from independent sources is accepted as a working rule; preserve provenance and label conflicts rather than claiming closed-engine proof.
- Retain existing desktop/mobile readability and natural document scrolling.
- Do not silently replace a working snapshot with partial, differently versioned or unsupported data.
- No frontend GitHub token; only owner-triggered local bridge or authenticated Actions may publish.

## Review Focus

- New patch changes a rule while old calculators remain: show reviewed version and stale warning; mathematical identities stay usable with explicit inputs.
- Blank/decimal-comma/infinite/100%-resistance input: validate without coercing to zero or rendering NaN/Infinity.
- GitHub publication fails after local save: report the two outcomes independently and preserve saved data.
- Upstream changes during request or supplies unknown scaling: reject candidate, preserve canonical snapshot and backup.
- Context resets or repeat import: database remains idempotent and retains historical records with source/version.

## Task 1: research and Russian formula catalogue

Files: knowledge/research/2026-10-25/* (private evidence); data/mechanics.json (public curated reference); docs/mechanics-reference.md (human readable export).

Produces: `MechanicsCatalog { meta: { reviewedClientVersion, checkedAt }, sources: EvidenceSource[], formulas: FormulaEntry[] }`; entries have `id, category, title, expression, variables, explanation, example, caveats, confidence, sourceIds`.

- [x] Finish damage/resistance and debuff/healing independent audits; read complete reports.
- [x] Resolve disagreements using primary fields and independent observations; record corrections to prior table/model explicitly.
- [x] Write catalogue and understandable Russian reference before implementing the new page.
- [x] Check links, numeric examples and current client6819/source revision against local and remote steam.inf.

## Task 2: calculator domain and page

Files: shared/mechanics.ts, shared/mechanics.test.ts, shared/mechanics-types.ts; src/features/mechanics/{MechanicsPage,Calculator,FormulaCard}.tsx; src/styles/mechanics.css; tests/mechanics.test.tsx. Integration in App.tsx, Home.tsx and global.css.

Interfaces: domain exports percent list parser and task-specific pure calculators; `MechanicsPage({data:HeroSnapshot})` loads/bundles catalogue and renders controls; entry sourceIds resolve to catalogue sources. Calculator results include units and applied expression.

- [x] Write domain tests with literal hand-derived examples: 30%+20%=44%, 1000HP→1785.714EHP, 1000 damage→560; negative resistance; mixed damage; empty/invalid numeric input; remaining duration; healing and cooldown examples chosen after audit.
- [x] Observe missing implementation failures, implement pure functions with finite/bound checks, then rerun.
- [x] Write UI tests for editing EHP inputs, decimal comma, invalid state, formula search, source disclosure, navigation and stale reviewed-version warning. Observe RED then implement.
- [x] Build page with clear calculator task selector, readable formula notation, examples and source links; responsive single-column mobile layout.
- [x] Correct hit-once/timing claims in existing table only when research warrants it; regression-test affected hero calculations with independently derived literals.
- [x] Remove hard-coded roster/version/check dates from home/header/methodology where updater would make them stale.

## Task 3: versioned refresh pipeline

Files: server/updates/{kv3,source,snapshot,storage}.ts and *.test.ts; scripts/update-data.mjs; data/updater-policy.json. No browser or server route edits in this task.

Interfaces: `refreshData({root, fetchImpl?, dryRun?, expectedVersion?}): Promise<RefreshResult>` returns `snapshot, changed, checkedAt, backupPath?, sourceCommit`; reads current canonical data; validates candidate before persistence. All network hosts are fixed trusted source hosts; raw config is parsed as data, never evaluated. Policy records supported defaults/known special cases.

- [x] Write parser/transform tests against compact representative real-shaped KV3/asset fixtures, including inheritance, boons, Spirit scaling, multi-path hit-once and missing values.
- [x] Test mismatched versions, mid-fetch version change, unsupported scaling, duplicate roster IDs, malformed source, no-write on failure, backup/atomic file replacement and unchanged snapshot behavior.
- [x] Observe failures, implement acquisition+version agreement+candidate validation; preserve metadata/aliases and download missing icons with bounded requests.
- [x] Run dry-run against current sources and independently compare all44 base/growth/scaling/raw weapon fields to pinned6819 raw.
- [x] Provide CLI `npm run data:update` plus `--dry-run`/`--expected-version` suitable for Actions, without interactive authorization or credentials.

## Task 4: owner update API, interface and publication

Files: server/updates/{manager,publish,http}.ts and tests; shared/update-types.ts; src/features/updates/UpdatePage.tsx; tests/updates.test.tsx; src/styles/updates.css; server/app.ts,index.ts; .github/workflows/refresh-data.yml; App.tsx.

Interfaces: controller `getSnapshot():HeroSnapshot`, `getState():UpdateState`, `start({publish:boolean}):UpdateState`; phases idle/checking/saving/publishing/succeeded/failed, localSaved, changed, clientVersion, message, optional publication/run URL, updatedAt. App uses optional injected controller; default old read-only API behavior remains. `GET /api/update/session` returns process nonce and state; `GET /api/update/status` read-only; `POST /api/update` requires exact Origin/Host, JSON and `X-Archive-Token`, returns202 or conflict. Snapshot GET reads current controller snapshot.

- [x] Write real HTTP tests for rejected Origin/Host/nonce, concurrent job conflict, successful live snapshot replacement and failed publication preserving local save.
- [x] Observe RED and implement loopback routes with an exact allowlist for local Vite origins only; no public CORS, no secrets in responses/errors. Public site links to the local center instead of acquiring a session nonce remotely.
- [x] Implement Git Credential Manager acquisition with shell disabled, fixed GitHub repository/ref/workflow, bounded timeouts, no credential logs; support modern dispatch200/run ID and legacy204.
- [x] Write UI tests for local save+publish, network unavailable fallback, public reload validation and partial failure; implement status announcements and explicit owner workflow link.
- [x] Implement manual Actions workflow: refresh→checks→optional data-only commit/push→Pages build/deploy in same run. No unsolicited schedule. Ensure JSON/portrait change allowlist, bounded permissions/concurrency and pinned official actions.
- [x] Keep local/public modes explicit. Public site cannot claim local disk save when bridge is unavailable.

## Task 5: SQLite knowledge and installed skill

Files: scripts/knowledge/{database,import,cli}.mjs and tests; scripts/install-skill.mjs; tools/skills/deadlock-project/{SKILL.md,agents/openai.yaml,references/retrieval.md}; AGENTS.md; docs/knowledge.md.

Interfaces: CLI `npm run knowledge -- status|import|search QUERY|entity NAME|formula ID|decision TEXT`; all return bounded JSON. Database default knowledge/archive.sqlite, tables snapshots/entities/formulas/evidence/documents/decisions/update_runs plus FTS. Preserve source paths/hashes, version and confidence. Inputs parameterized, read access does not import everything automatically. `npm run skill:install` installs only this skill into default user skills directory.

- [x] Run a no-skill retrieval scenario before authoring the skill; record observed gaps, then address them in short routing instructions.
- [x] Write temporary real-SQLite tests for Russian/English search, idempotence, snapshot history, formula evidence and rejected unsafe DB queries; observe RED then implement.
- [x] Import canonical heroes/formulas and local research/current reports and raw abilities/items. Keep historical snapshots searchable with dates; do not mix old meta as current.
- [x] Write skill entrypoint+selective reference and project AGENTS. Validate with bundled quick_validate.py and an independent real retrieval task after installation.
- [x] Ensure future update success refreshes knowledge index, or reports index warning separately without pretending data save failed.

## Task 6: integration, review, release

- [x] Run npm test, typecheck, data:check and Pages-base production build; inspect all outputs.
- [x] Fresh independent code/research review covering arithmetic, source freshness, updater failure isolation, credentials, SQLite import and mobile UI.
- [x] Fix material review findings with targeted regressions and rerun relevant checks.
- [x] Browser: desktop and mobile320/412px; calculator values/errors, formula search, nav wrapping, current table, public/local update paths. Save screenshots as ignored outputs.
- [x] Merge verified feature into main, push, wait for Pages deployment success and verify public code/data/page.
- [x] Exercise manual updater workflow on current version, checking no unintended data changes and successful deployment.
- [x] Record release IDs, data/formula provenance and skill location; stop owned local servers and reset viewport before handoff.

## Release evidence

- Code37b63ad merged fast-forward to main and published by Actions40217626662: build/deploy success.
- Real local browser update without publish: verified6819/44 unchanged. Real publish checkbox+button dispatched40217772861 through server-side GCM; manual refresh workflow completed success and published Pages. No game launched.
- Public JSON heroes/mechanics matches local parsed JSON exactly; Markdown reference HTTP200. Browser verified27rules/15calculator options, public version check, EHP explanation opened+focused, Baba8.8/DPS28.39 and44 natural-height rows2574px.
- Mobile320/412 and desktop1280 checked; no document overflow. Proof screenshots outputs/mechanics-desktop.png and mechanics-mobile.png. Viewport reset and public page retained.
-147tests, typecheck, data validation and Pages production build passed. Owned dev session97780 stopped; no listeners5173/3001.
- SQLite schema2 and installed deadlock-project skill validated by independent retrieval and version-transition tests. Private database/research never published.
