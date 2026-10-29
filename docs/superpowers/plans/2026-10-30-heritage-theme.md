# Heritage appearance preview

**Goal:** Show the current functional site in its former bottle-green/ivory/muted-gold palette with an aristocratic noir treatment of controls, keeping the navy variant available for comparison.

**Architecture:** A validated `?theme=heritage` query selects a scoped CSS variant before React renders. Hash navigation retains the query. No new theme control, persisted preference, route, data API or animation library. Existing fonts, framed D, layouts, game-category colors and motion lifecycle remain.

**Direction:** Restore the old root colors from36b50bb; use ivory action plaques, fine brass rules, dark-green category crests, Roman folio tier tabs, inlaid activation keys and an olive/gold sliding language inset. Avoid the industrial blue ledges/rubber-pill appearance. This is a comparison variant, not a statement of user acceptance.

1. [x] Test validated appearance selection, default reset, metadata and asset-base preservation; implement the small bootstrap in src/app/appearance.ts and main.tsx.
2. [x] Implement src/styles/themes/heritage.css, scoped to the selected theme. Apply the materials consistently to all six pages, paper panels, controls, focus and hover/selected states. Preserve positions and motion.
3. [x] Inspect default and heritage desktop side by side, both RU/EN and320/390px. Exercise language/category/property/tier/reset/detail/calculator/dialog; obtain independent design critique and fix confirmed issues.
4. [ ] Run tests/typecheck/data/build/publication validation, commit/publish and verify both public links. Preserve private evidence and record the variant as exploratory.
