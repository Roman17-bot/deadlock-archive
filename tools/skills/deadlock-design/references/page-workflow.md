# New pages in one existing product

Read for a new page or a substantial new section. For a small existing control, use the scoped asset/motion workflow instead.

## Recover only what this page needs

Read the current design tokens, page architecture, shared shell/navigation and relevant reusable components. Inspect one or two relevant neighbouring pages and the accepted designer context. Do not repeat a full project audit or ask the user to choose the approved palette, fonts or technology again. Current project files establish implementation; remembered context supplies decisions, not assumed facts.

Separate the two scopes:

- **Existing page:** preserve its established control areas, order, navigation, density and workflows. Improve craft within those anchors; moving them needs explicit scope.
- **New page:** create an appropriate composition inside the existing product shell. Reuse approved typography, category semantics, controls and tokens, without making the page a clone of another page or redesigning its neighbours. Keep real values and RU/EN labels in HTML.

## Compose around the player's task

For reference and working pages, especially tables, the item catalogue and calculators, fast data access and responsive controls are primary design requirements. Use typography, spacing, surfaces and lightweight CSS/SVG first. Do not add download/rendering cost merely to make every page spectacular. Without explicit user direction, keep heavy WebGL/3D, large decorative assets, constant frame loops and new animation libraries out of integration. If a substantial effect is worth proposing, explain its benefit, loading boundary, fallback and measured transfer/startup/interaction cost before implementation; preserve immediate access to useful content. Light, useful motion within the assigned task remains delegated.

Before creating source, state the page's main player task, primary information/action, visual focal point, hierarchy and section rhythm. Explain how text, graphics, whitespace and transitions serve that content. Use asymmetry, layers, masks or spatial work only where they improve this particular page. A standard hero followed by repeated card grids is not the default answer to every brief.

Reuse the existing design system. Extend tokens/components only for an actual uncovered need; explain the extension and its integration boundary. A consistent page can still be artistically weak: check distinctive composition, lettering, original graphic craft and the relationship between content and interaction, not merely matching colors or passing code tests.

For graphics, choose CSS/SVG/Canvas/WebGL according to the idea. Spatial work needs intentional geometry, materials, light and camera composition that belong to the subject; an unrelated rotating primitive is not a substitute. Read [creative-graphics.md](creative-graphics.md) or [motion.md](motion.md) only when that work is present. 3D, smooth scrolling and a new motion library are optional, not requirements. Verify actual tool availability, compatibility, license and necessity before proposing dependencies.

Actively identify useful graphic and motion opportunities within the assigned page. Routine visual choices are already delegated: do not defer a fitting custom transition until a separate animation commission. Reuse a strong existing interaction when appropriate, or propose a concrete new effect with its purpose, trigger and reduced-motion version. This does not require animation everywhere, expand file ownership or authorize dependency installation.

## Self-check and handoff

For a new page or significant section, inspect the real result at **1440, 768 and 390 CSS px** when browser access is available. Cover the full assigned page, not just its first screen. Check long RU/EN labels, overflow, reading hierarchy, meaningful input states, keyboard/touch, actual movement and any 3D/fallback. Inspect JavaScript errors and the core player scenario. A screenshot does not establish smoothness or performance; record the real checks and unavailable conditions separately.

If shared buttons, tokens, fonts or layout components change, check representative existing pages that use them and the relevant loading/empty/error states. Do not expand a small task into an unrelated whole-site audit.

Deliver editable runnable sources and the bounded implementation handoff from `docs/design/CREATIVE_DIRECTION.md`. Keep assets/prototypes in the assigned private run; website/coordinator integrates production. Explain what to preserve, what changed, compromises and actual evidence. A significant change goes to an independent designcritic. Address confirmed defects locally and retain successful craft; recommendations do not override earlier user-approved identity, and each next pass has a defined acceptance check.
