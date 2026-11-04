# Hero roster dossier implementation plan

> **For agentic workers:** Use superpowers:executing-plans for the coordinator's implementation and a fresh independent design review at the end.

**Goal:** Turn the existing Heroes tab into an expressive, usable dossier folder with a compact contact sheet and a tall character showcase.

**Architecture:** Keep AppRoutes/HeroNavigation, public data contracts and the existing profile/statistics resources. Reuse the ability catalogue for real ability icons and localized names. Use original code-native vector decoration and CSS motion; only the selected hero's large artwork loads. All implementation stays within the roster page and its focused components.

**Tech stack:** Existing React/TSX, plain CSS, SVG, Vite; no new runtime libraries.

**Spec:** User's 4 November request and five attached images; existing Heritage direction in docs/design-brief.md. User previously delegated design decisions, so no new approval gate.

## Design decisions

Use a dossier folder and pinned ivory paper portraits in the left ~64% of the page, a taller full-body character display in the right ~36%. Keep the page/header aligned to the 1920px register/statistics shell. Header has breadcrumbs, the established title typography and gold star. Remove repeated date/threshold/extraction prose. Keep actual 7-day win rates and their colors unchanged. Hover/focus previews a hero; the whole card is a direct detail link. Touch opens that link immediately. The preview also offers dossier/calculator links and real ability icons. Full-body renders are preferable to 3D: they achieve the requested composition without a new renderer, model download or perpetual GPU work.

## Review focus

- Fast successive preview changes must not leave the previous hero's art under a new name.
- Search/empty/reset and keyboard focus must remain useful with a direct-link contact sheet.
- Mobile must show usable cards and preserve access to the preview without document overflow.
- Decorations must not intercept clicks, obscure names/rates or create a second input focus border.
- Reduced motion must disable tilt/entrance movement; missing image/ability data must leave a usable page.

## Tasks

- [x] Adapt the existing roster interaction tests to assert direct card links, hover/focus preview, no redundant Details buttons and search recovery. Add focused ability/fallback coverage where behavior changes.
- [x] Integrate the designer's SVG/material treatment; implement the wide header, styled search, compact paper cards and reversible tilt states in HeroRosterPage.tsx/CSS.
- [x] Implement a focused HeroShowcase component with selected full-body art, localized summary, real ability shortcuts, fallback and interruption-safe motion. Reuse existing public resources; don't add speculative gameplay labels.
- [x] Render 1920/1440/768/390, RU/EN, keyboard/hover/empty states and reduced motion. Run the focused behavior suite, typecheck and production build. Obtain one independent designcritic review and fix concrete defects.
- [ ] Publish through the existing main workflow, save accepted design/asset provenance and update private role context. Do not launch the game or publish private source material.
