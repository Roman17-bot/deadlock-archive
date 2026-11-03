# Compact build inventory and item shop

The user requests smaller slots with more slots per row, a wider calculator and page, and an item chooser that is easier to browse than a long single list. Category identity must be immediately visible.

Keep the current Heritage palette, fonts, input-left/results-right order, hero controls, abilities, inventory rules, calculations and lazy data loading. Increase the Mechanics page maximum from 1600 to 1920px with 32px desktop gutters. Use the available input width for two, three, four or six inventory columns; names remain readable and controls keep usable touch targets. Remove redundant space inside sockets.

Replace item rows with a shop grid, grouped by category then ascending tier. Use opaque orange/green/purple surfaces, category headings and icons, visible tier/cost, selected check, and readable disabled reasons. Search, exclusive category buttons, tier buttons and reset stay above one results scroll area. The native dialog retains focus return and single-Escape dismissal; hero chooser stays as before.

Alternative considered: simply shorten the existing list. Rejected because it retains excessive scrolling and weak category recognition. Three independent category scroll lanes would make mobile and keyboard navigation harder. A single grouped grid gives predictable reading order.

Routine design decisions remain delegated by the user; no extra approval round. No data/model/backend changes, new dependencies or heavy effects. Designer handoff ab4b69e2 is private evidence, not a rendered approval.

Acceptance: more slots fit at 1440/1920px, no horizontal page/dialog overflow at 390/768/1440/1920px, complete RU/EN names and prices, category/tier/search/reset compose correctly, inventory upgrades/duplicates/active limits still work, Escape restores focus, existing Formulas and build drafts remain intact.
