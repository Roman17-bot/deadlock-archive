# Frontend organization with preserved UI

Owner approved the previously proposed architecture and now explicitly requests the refactor while keeping appearance and behavior unchanged. Work is in the existing clean managed worktree on codex/frontend-architecture, base504b161. Original repository and private archive remain at C:/Users/roma1/OneDrive/Рабочий стол/Deadlock.

## Design

Put all four route screens in src/pages/{HomePage,HeroesPage,MechanicsPage,UpdatesPage}. A page owns its specific composition, components, hooks and stylesheet. Keep standalone calculator and synchronization features in src/features/{calculator,synchronization}. Shared presentation belongs in components/{layout,ui}, shared hooks in hooks, HTTP/data source adapters in services. App assembles routes/layout and shared snapshot state instead of owning header/footer/request details. Root shared/ stays shared by browser and server.

This is the approved approach. Alternatives considered in the earlier audit: retain mixed pages/features placement, or copy the VSV components-only organization. Both obscure route entry points as this archive grows. No router/state/UI dependency change is needed.

## Invariants

Preserve existing JSX tags, classes, visible strings, ARIA/keyboard behavior, component props used by tests, hash links and prefix route fallback, hero query links and route-key reset. Do not add DOM wrappers merely to split components. Keep Math/validation/source precision, local PostgreSQL versus static Pages behavior, update/session nonce handling, polling/timeouts/abort rules, same-client no-op and exact sync outcomes. Keep data/, shared/, server/, database schema, dependencies and API contracts unchanged.

CSS moves adjacent to pages/features/primitives; copy selectors/declarations/media queries exactly, keep deliberate cascade order in global.css. Shared styles remain global. Splits may change build order only when computed style/layout comparisons demonstrate equivalent results. Preserve current imports/ordering where feasible and retain mechanics lazy loading. Do not redesign, add 404 behavior or introduce a new router/store.

## Interfaces and ownership

Root: src/app/*; components/layout/{SiteLayout,Header,Footer}; components/ui/MethodDialog/MethodDialog.tsx and StyledSelect/StyledSelect.tsx (unchanged implementation relocation); hooks/useMediaQuery.ts (relocate unchanged); hooks/useHeroSnapshot.ts; services/http.ts and environment.ts; main/global CSS import graph; App/UI/i18n tests, docs and release. readJson(url:string,init?:RequestInit):Promise<unknown> preserves the existing default20s timeout only when no signal is supplied. siteMode(): 'local'|'public' keeps exact localhost/127.0.0.1:5173 policy. heroSnapshotUrl():string preserves VITE_API_URL || (DEV ? '/api/heroes' : asset('data/heroes.json')).

Home/heroes agent: pages/HomePage/HomePage.tsx exports HomePage({data,onMethod}), pages/HeroesPage/HeroesPage.tsx exports HeroesPage({data,onMethod}); page-local components/hooks/CSS, remove old pages/Home.tsx and features/heroes/. Preserve JSX and all interaction/reset/CSV/sorting semantics. Root updates tests/ui.test.tsx and app imports.

Mechanics agent: pages/MechanicsPage/MechanicsPage.tsx exports MechanicsPage({data,localApi?}); page library/components/hooks; features/calculator/Calculator.tsx exports Calculator({onRule}), definitions/evaluate under calculator model; services/mechanicsApi.ts; MechanicsPage.css, Calculator.css and components/ui/StyledSelect/StyledSelect.css. Consume root HTTP/environment and relocated StyledSelect. Preserve source catalogue validation, bilingual parity,15 modes and root shared math. Update only mechanics.test.tsx/mechanics-api.test.tsx direct imports. Remove old features/mechanics/ and styles/mechanics.css.

Updates agent: pages/UpdatesPage/UpdatesPage.tsx exports UpdatesPage({data,onSnapshot,mode?}); page-local components/hooks/CSS; features/synchronization/SyncPanel.tsx exports SyncPanel with existing props and extracted hook/model; services/{updatesApi,synchronizationApi}.ts. Consume root readJson/siteMode. Move synchronization CSS to feature and retain shared updates CSS classes exactly. Update updates.test.tsx and sync-panel.test.tsx imports. Preserve all async guards/cleanup/retry/error/outcome behavior and exact DOM. Remove old features/updates/ and styles/updates.css.

No old-path proxy exports: update direct imports and tests. No agent commits or live publication; root integrates and releases. No database writes or game launch. New tests only for substantive new seams/risks, existing regression suite is primary evidence for behavior-preserving extraction.

## Verification

Baseline307 tests, typecheck/build, built CSS digest; ten fixed desktop/mobile screenshots + full-main text/layout/style manifests (4 pages plus open calculator menu at1280x900 and390x844) recorded before source edits. Compare same states after refactor using pixel metrics and DOM/style geometry, inspect differences, exercise sorting/level/filter/CSV/modal, calculator modes/errors/menu keyboard, RU/EN, local history and sync status. Run full existing suite, typecheck,data check, public snapshot verify and production build. Independent whole-branch review. Final data snapshot hash must remain5e219055279b873d9c81fc28b8fd15ab984521909bb2c9b296fa37bd44da51e4. Publish authorized site update after checks; verify CI and static Pages. Keep research/credentials/screenshots private, preserve user processes and original private archive.
