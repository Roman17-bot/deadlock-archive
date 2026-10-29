# Single category and grouped situation buttons

**Goal:** Replace combined category/property selection with simple all-or-one switching and use more desktop space.

The user delegated design decisions and requested this concrete update to 224126b. Reuse the website specialist, then a bounded fresh review and coordinator browser/publication checks.

## Behavior

- Shop categories have an explicit "Все категории" button and the existing three colored choices. Exactly all or one is selected; pressing a chosen category again keeps it selected. A new category replaces the old one.
- Situational filtering has "Все свойства" plus all 59 existing properties as the same visual button tiles, arranged in their seven existing groups. Remove the six-shortcut duplication, checkbox UI and all/any controls. One active property globally; choosing another replaces it, clicking the selected one keeps it. Group accordions may organize the buttons; reveal selected/search-match groups and provide an obvious initial open group.
- Counts show the result of switching to that property (replace previous tags), retaining item search/category/tier/activation context. The all-properties count excludes the property restriction.
- Keep property search independent from item search/URL. Reset clears both searches/all criteria. Preserve existing tier and activation behavior and detail/back navigation.
- Normalize old multi-category/multi-tag URLs to the first valid category/property and ignore obsolete mode=any. Serialize at most one category/tag and omit mode. Shared filtering internals need not be rewritten; site-facing state/links must obey single selection.

## Presentation

Widen only catalog to about2048px and reduce desktop side padding to24px. Sidebar about320px at1200–1499px and360px at1500px+. Preserve readable cards, available-width 1/2/3 category grids and sticky reachable sidebar. Give every property a button with a relevant icon, count, visible active state, localized accessible name that includes the visible label, and full useful description in title. No raw identifiers/source notes in the UI.

Mobile must fit320px, with an intuitive explicit all-category control, no clipped labels or horizontal overflow. Item detail retains1380px width. No data, API, PostgreSQL, source refresh or dependency changes.

## Checks

- Meaningful RED-to-GREEN tests: category switching/all, property replacement/all, repeated selected click, replacement-based counts, legacy URL normalization/serialization, all properties rendered as grouped buttons and no all/any/checkbox controls, independent searches/reset, RU/EN and navigation.
- Coordinator: full tests, data check and build; browser320/390/900/1200/1440/1920 and short viewport, real anti-heal→bullet resistance switching6→22, catalog width and full59-button coverage.
- Commit, fast-forward clean original main, push and verify live Pages. Keep screenshots/research private.
