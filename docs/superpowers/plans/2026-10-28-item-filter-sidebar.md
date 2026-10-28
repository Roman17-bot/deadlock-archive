# Item filters and situational sidebar

> **For agentic workers:** Use a bounded website specialist for implementation and a fresh critic for final review. The coordinator verifies the rendered UI and publication.

**Goal:** Make situational selection the prominent feature of the items page and clearly distinguish tier, activation and reset controls.

**Architecture:** Keep existing item data, filter semantics, hash URLs and preview/detail behavior. Extract focused page components for filter UI; use plain CSS. Widen only the catalog page. A left sidebar appears at a suitable desktop breakpoint (about 1200px); smaller screens get a prominent full-width panel with always-visible common situations and collapsible advanced options.

**Tech Stack:** React TSX, Vite, i18next, CSS and existing lucide-react icons. No new dependencies or backend changes.

## Design

- Keep the three category-colored controls and artwork-led cards from 3395643.
- Tiers have their own labeled fieldset, Roman-numeral/cost tiles and a clear selected state. Derive displayed costs from the catalog. Activation has a separate labeled segmented control with icons for all/active/passive.
- A labeled reset button is always visible; it is prominent when criteria are active and resets item search, categories, tiers, activation, properties and property-search text.
- Place "Предметы под ситуацию" in an obvious bordered panel. Provide several shortcuts backed by existing individual tags (anti-heal, bullet/spirit resistance, cleanse, etc.), a search for properties, existing effect groups with counters and clear checked states, and explicit all/any combination controls.
- Property search finds controls; it does not silently change the item-name query. Matching options become visible without further accordion clicks. Empty property search results are explained separately from an empty item result.
- On mobile, users can access common situations without opening advanced options. Keep labels readable, controls at least 42px, no horizontal overflow. A suitable results jump/close control may be used without changing the route/hash.
- Desktop uses available width (up to about 1800px), a readable 260–300px sidebar starting alongside the item search, and preserves three category columns and aligned tiers without giant single-column item cards. Single/two-category results fill the available width. If sidebar scrolling is needed, keep the scrollbar visible and all controls reachable.

## Constraints and review focus

Existing category/tier OR semantics, intersection between dimensions, all/any property matching, counts, reset, URL recovery and detail/back navigation remain intact. Selected quick shortcuts and their corresponding checkboxes represent the same tag. Unknown external tags stay ignored. RU/EN complete. No added source lists, version annotations, raw IDs or research disclaimers. Private data stays private.

## Tasks

- [x] Website specialist reads the current page/model/tests, adds meaningful failing UI tests for new interaction paths, implements focused components/CSS/translations and runs focused tests plus typecheck.
- [x] Coordinator reviews the diff, runs full tests, data check and build; tests desktop/mobile UI, long labels, keyboard controls, property search, quick/full-control synchronization, reset and navigation.
- [x] Fresh critic reviews the bounded change. Fix concrete regressions and verify.
- [ ] Commit, fast-forward the clean original main checkout, push, verify successful Actions and live Pages; preserve a screenshot and private recovery note.
