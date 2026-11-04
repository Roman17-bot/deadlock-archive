# Match statistics redesign

Preserve the hero register and Heritage identity. Replace the statistics page's native controls and dense explanatory copy with search, mode, ranked-only rank, and week/month/year filters. The table presents hero, appearances, win rate and selection rate, with visible daily points and tooltips anchored above the selected point. Keep keyboard and touch interaction, missing-day gaps, RU/EN, responsive scrolling, and lightweight SVG/CSS.

Implementation ownership: website specialist owns statistics UI, shared select's optional icon support, hero subsection navigation and related component tests. Coordinator owns data validation, accumulated history, source checks, local rank assets, integration and publication. Designer supplies a bounded handoff; independent design critic reviews rendered evidence.

1. Verify current analytics semantics, rank assets and update freshness using primary sources; compare compatible public statistics without conflating different samples.
2. Test and implement a bounded rolling 365-day history. Keep the existing 30-day catalogue for quick initial loading; publish compact optional per-cohort history files, loaded only for the selected year view. Merge overlapping days by replacement, retain gaps, and preserve legacy archives. Persist through PostgreSQL and exact Pages synchronization.
3. Implement the approved Heritage controls, navigation and table. Show real local rank icons. Auto-scale chart ranges with visible bounds, retain flat constant series, and provide pointer/touch/keyboard point selection and viewport-positioned tooltips.
4. Review desktop/mobile RU/EN in an isolated local browser, run focused and full frontend/native/database checks, and fix findings. Verify year-file size limits and catalogue round trips.
5. Back up the owner database, review a dry-run statistics refresh, save validated data, update private evidence/instructions, and publish the approved code/data using the existing synchronization workflow. Confirm deployed output.

No game launch, new graphics library, full-year upstream fetch or unrelated page redesign. Historical days accumulate only from actual observations. Public copy stays concise; evidence and sampling limitations remain in the private archive.
