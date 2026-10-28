# Item catalog visual refresh

> **For agentic workers:** Execute inline with superpowers:executing-plans; use a single bounded final review.

**Goal:** Make item artwork and category colors prominent, expose category controls, and remove the annotations identified by the user.

**Architecture:** Keep the existing React pages, filter model, data and routes. Change presentation CSS and move the category control group outside the collapsible filter panel.

**Tech Stack:** React TSX, Vite, plain CSS, existing lucide-react icons.

**Spec:** User screenshots and request in this chat. The user previously delegated design decisions and opted out of additional design approval.

## Design

Use full-width square artwork with a compact name/translation/price footer. Orange weapon, green vitality and purple spirit colors distinguish borders, headers, active badges and category buttons. Preserve readable labels, three category columns on desktop, tier alignment, mobile layout and accessible hover/focus previews. Category buttons form a separate always-visible row; secondary filters remain collapsible.

References inspected: https://deadlock.one/predmety (large artwork), https://deadlock.coach/ru/items (category colors and tier grouping). Keep the archive's typography and dark palette. A dense icon-only grid was considered but would hide item names; copying either whole page would clash with the existing site.

Remove the catalog version annotation, per-item version, statistics cohort/footer shown in the screenshot, and the home "without items and buffs" cell. Preserve statistics values and private metadata. Retain the single global version in the header and the update center.

## Constraints / review focus

- No data, PostgreSQL, update or publication pipeline changes; no new dependencies.
- RU/EN labels and URL filters, detail/back navigation and all/any behavior remain intact.
- Phone users can select categories without expanding other filters.
- At 320–1440 CSS px, no horizontal page overflow or truncated item names.
- Active markers, focus outlines and previews remain usable.

## Execution

- [x] Extend existing mobile and statistics UI checks, observe the intended failure.
- [x] Implement category controls, artwork cards and requested copy removal, including home grid rebalance.
- [x] Run focused UI tests, typecheck, data check, full tests and production build.
- [x] Inspect desktop/mobile RU/EN in the browser and obtain a bounded independent review.
- [ ] Commit, fast-forward the clean original checkout, push and verify deployed UI.
