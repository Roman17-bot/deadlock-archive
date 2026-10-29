# Deadlock Archive visual redesign implementation plan

> **For agentic workers:** Use superpowers:executing-plans for the coordinator's work and bounded website specialists for independent page styles. Follow the existing design brief and explicit ownership; no agent creates children. Steps use checkbox syntax.

**Goal:** Give all six existing screens a distinctive noir visual identity, original logo/icons and purposeful custom motion while retaining the established interface arrangement and behavior.

**Architecture:** Keep React routes, page/component boundaries, API/data models and current layout grids. A shared token/font/icon/motion layer establishes the visual language; page CSS refines each existing surface. Designer creates private source assets, a fresh designcritic reviews the concrete direction and rendered result, coordinator/website implement and publish approved public code/assets through the existing GitHub Pages workflow.

**Tech Stack:** React/TSX, Vite, ordinary CSS, native SVG/CSS/Web Animations API. Self-hosted Cyrillic/Latin fonts with licenses. No new UI/motion runtime dependency is planned.

**Spec:** docs/design-brief.md plus the user's request of29October2026 and the designer's private run29941aea-4822-4ebd-b3c7-ed8ecb693402.

## Global constraints

- Preserve relative element placement, block order, navigation, routes, responsive flows and interaction meaning; small type/spacing refinements stay within existing areas.
- Orange/green/purple remain weapon/vitality/spirit; text remains readable in RU/EN and at mobile widths.
- Keep real game data, calculations, search/filter logic, update/publication behavior and private archive boundaries unchanged.
- Use reduced motion, stable controls and immediate task results; no decorative infinite loops, mass card entrances or delayed filtering.
- Source research, intermediate artwork and screenshots remain private; only optimized final assets and application code enter the public repository.

## Review focus

1. Long Russian/English labels retain readable controls and existing mobile order at390/320px.
2. Heroes' sticky column, growth view and horizontal navigation stay functional; document/table scrolling follows the existing rules.
3. Item filters retain single-category/single-property behavior, search slang, counts, hover/focus and touch-friendly detail links.
4. Calculator/select/dialog, version history and local update/sync actions keep semantics/focus/results; no publication action is triggered by visual verification.
5. SVG semantics and custom animation handle reduced-motion preference changes, repeated input and unmount without delaying the underlying action.

## Task1: Baseline and concrete visual direction

**Files:** private outputs/redesign/2026-10-29/; designer private run; this plan.

- [x] Capture representative desktop screens for home/heroes/items/item detail/mechanics/updates and mobile home/items/heroes before changes. Record major layout anchors and viewport.
- [x] Inspect the designer's token/type/logo/icon/motion sources, then obtain a fresh bounded independent design critique. Refine substantiated issues without moving controls.
- [x] Review additional GitHub skills from primary repositories; add only a useful audited complement to the installed Anthropic/Vercel skills, recording pinned source/license privately.

## Task2: Shared visual assets and interaction layer

**Files:** create src/styles/tokens.css, src/styles/motion.css, src/components/ui/ArchiveIcon/ArchiveIcons.tsx, src/components/ui/ArchiveLogo/ArchiveLogo.tsx, src/hooks/useActionMotion.ts; modify src/styles/global.css, src/components/layout/Header.tsx, src/components/layout/SiteLayout.tsx, index.html, public/favicon.svg, public/assets/fonts/ and existing icon imports. Coordinator owns these files.

**Interfaces:** tree-shakeable named SVG components retain existing size/className/SVG props and compatible icon component type. Logo stays in the brand's current box. Motion hook returns a React capture handler for decorative action feedback and owns cleanup; it does not call or defer business actions.

- [x] Self-host Prata/Golos Text from official sources with licenses, useful subsets and font-display:swap; keep body/input sizes at least their previous values.
- [x] Integrate original reviewed SVG geometries with decorative/default and explicit accessible-label semantics; migrate current icon imports without changing handler logic.
- [x] Replace shared palette/type/button/input/nav/dialog surfaces with a coherent token system and original brand mark while retaining existing layout rules/breakpoints.
- [x] For the motion hook, first test immediate underlying action with normal/reduced motion, cancellation on repeated action/preference change and unmount. Implement only the decorative effects needed by existing controls; verify those tests.
- [x] Add CSS response for selected controls, popovers, tooltips/dialogs and loading with reduced-motion alternatives; verify keyboard/focus visually.

## Task3: All page surfaces

**Files:** existing HomePage.css/HeroesPage.css (website worker A); MechanicsPage.css/Calculator.css/StyledSelect.css/UpdatesPage.css/Synchronization.css (website worker B); ItemsPage.css/ItemDetailPage.css/ItemSkeleton.css (coordinator). TSX logic and grids stay with the coordinator unless explicitly reassigned.

**Interfaces:** all page workers consume shared tokens and named icon components; preserve selectors, DOM, public labels and component APIs.

- [x] Apply the accepted type/surface/edge/state language to home and hero table, preserving roster art area, table density and all existing mobile behaviors.
- [x] Apply it to mechanics, calculator, history and local synchronization states; retain light-panel contrast through explicit on-paper tokens and input alignment.
- [x] Apply it to catalog/sidebar/tiers/cards/tooltips and item detail/statistics; keep prominent situation filters, category semantics and image-first cards.
- [x] Inspect actual desktop/mobile screens for all six routes, including below-fold and modal/empty/loading states. Fix confirmed contrast, clipping and residual old-palette issues in the owning stylesheet.

## Task4: Verification and delivery

**Files:** relevant behavior tests; private before/after evidence and role reports; docs/design-brief.md and asset notes as needed.

- [x] Run npm test -- --maxWorkers=4, npm run typecheck, npm run data:check, npm run build, git diff --check.
- [x] Exercise hero sort/level/notes/scroll, item search/situation/tier/category/reset/detail, calculator values/select/reset, language navigation, history/dialog and local read-only status. Do not trigger data refresh/publication while testing visuals.
- [x] Capture matched after screens and compare structure/anchors. Request fresh designcritic review of actual rendered results plus bounded independent code/regression review; fix confirmed issues.
- [ ] Commit, fast-forward clean original main preserving user edits, push through the existing Pages workflow and verify deployed result/CI. Keep data content unchanged and update private accepted role memory/knowledge.
