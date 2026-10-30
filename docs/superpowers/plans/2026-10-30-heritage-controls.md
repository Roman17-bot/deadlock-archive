# Heritage controls refinement

**Goal:** Make Heritage buttons more distinctive and its gold warmer and clearer, preserving the green foundation and existing controls.

**Scope:** Only the Heritage CSS and matching favicon colors. Keep layout, labels, typography, category semantics, route/query behavior and animation lifecycle. No game-data or backend change. Routine implementation decisions are delegated by the user.

- [x] Refine scoped brass tokens and action/category/tier/activation/language surfaces from the designer's bounded prototype; preserve readable labels and keyboard focus.
- [x] Inspect actual desktop and narrow RU/EN controls, selection, focus, disabled appearance and language movement; review hover/press and reduced-motion rules in source. One independent design review found no actionable defect.
- [ ] Run existing tests, typecheck, data validation and build; publish the comparison variant and verify live Pages. Record accepted evidence privately.

No new implementation-mirroring tests for a reversible CSS-only refinement. Existing behavior tests plus rendered checks cover the relevant risks. Default noir styling must remain isolated.
