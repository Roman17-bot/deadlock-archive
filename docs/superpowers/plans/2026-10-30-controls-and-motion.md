# Controls and motion refinement plan

> **For agentic workers:** Coordinator executes with superpowers:executing-plans. Designer owns only its assigned private assets/prototype. A fresh designcritic checks the actual component changes and rendered screens.

**Goal:** Replace the rejected flat-control treatment with visibly distinct, opaque controls and meaningful interaction motion, retaining the approved palette/fonts and existing layout.

**Architecture:** Keep current React routes, state, handlers, data and CSS grids. Restore the framed D logo, extract the header language switch into its own component, refine existing control styles in their owning files, and add one cancellable result-transition hook. No UI or animation dependency.

**Tech Stack:** React/TSX, CSS, SVG and Web Animations API.

**Spec:** The user's feedback of 30 October 2026 and docs/design-brief.md. The DA mark and palette-only redesign are rejected; existing decision autonomy remains in force.

## Constraints and acceptance

- Preserve navigation, search/filter areas, table scrolling, calculator/update actions, RU/EN, game data and immediate results.
- Restore the old single D in a refined engraved frame, including favicon. Keep current wordmark fonts.
- Categories have solid enamel faces and a physical selected state; tiers, activation and regular actions have different forms. No translucent button faces or generic glow/ripple system.
- RU/EN has a visible sliding carriage, stable labels and existing accessible button semantics. No control/text shrinking.
- At least language selection, filter results, accordion expansion, menu/dialog and action controls receive observable, action-specific motion. Reduced motion retains final states without travel. No delayed filtering or endless decoration.
- Check 320/390px and desktop; keep focus rings outside decoration, long labels, rapid input and interruption functional.

## Work

1. [x] Inspect the user screenshots and previous published captures, old D and designer's concrete source. Root integrates useful component treatments; fresh critic receives actual before/after evidence.
2. [x] Implement framed D/favicon, sliding LanguageSwitch, solid category keycaps, tier stamps, activation keys and shared action/input states. Refine the selected visible SVGs at 16/24px.
3. [x] Test result-motion mount/selection/repeat/reduced/unmount/failure behavior before implementation; connect it to catalog choices and calculator task selection. Add contained accordion/menu/dialog motion without changing layout order.
4. [x] Exercise the real controls in RU/EN, keyboard/touch-size layouts, rapid switching and reduced-motion source/lifecycle. Obtain independent design review; fix confirmed problems. Do not equate static screenshots or test counts with aesthetic success.
5. [ ] Run full tests, typecheck, data validation and build; commit/publish through the existing workflow, inspect live Pages, preserve private evidence and record the user's rejection as the current design constraint.
