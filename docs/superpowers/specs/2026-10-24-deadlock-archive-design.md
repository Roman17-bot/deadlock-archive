# Deadlock Archive — design

## Intent and authorization
Russian personal reference for the user and friends: accurate comparisons of every playable hero before future build experiments. Nurse Harrow is the user's current main. On 24 October the user explicitly delegated implementation and design decisions without intermediate approval.

## Scope
- Refresh mechanical knowledge from client 6819, keep older match statistics clearly historical, add detailed Violet/Nurse reports.
- First prepare one authoritative JSON dataset and a readable Markdown table for all 44 playable heroes.
- Two website pages only: editorial noir home and sortable hero register. Russian UI, English hero names, local Valve-derived portraits.
- React TSX + Vite, plain CSS, Node.js with JSON and no database. Node 24 LTS available locally.
- New local Git repository in this workspace, new GitHub repository under the authenticated account, GitHub Pages deployment for friends.
- Never launch Deadlock. No credentials, Steam account files, old player-match research, or local paths in the public bundle.

## Approaches
1. Selected by executor under delegated authority: Vite static frontend + shared JSON + local Node HTTP API. Works on GitHub Pages now; API is independently runnable and replaceable later.
2. Server-rendered Node deployment: rejected for this release because GitHub Pages cannot run Node.
3. Hosted Sites/Worker deployment: rejected because the user explicitly requested Vite/Node and GitHub publication.

## Architecture
Root npm project; src/ holds web app, shared/ pure hero types/stat/search/sort functions, server/ independently testable Node HTTP app, scripts/ data update/build helpers, data/ authoritative versioned JSON, public/assets/ portraits/fonts. Vite serves the web app; local API on loopback provides health and validated hero data. Production exports the same JSON to dist/data. Hash routes make deep links work on GitHub Pages without server rewrites.

## Data model and meaning
Hero ID is the stable key. Filter player_selectable && !disabled, retaining released Baba/Violet despite in_development metadata. Normal match roster is 44, not all 65 asset entities. Level 1 has zero Boons; levels 2–36 add one each. Include HP, Spirit Power, HP/s, bullet/pellet damage, full shot damage, calculated firing DPS and per-level growth. Preserve raw weapon values and Spirit-to-weapon coefficients. Distinguish direct Boon damage from effective natural damage growth including Spirit. No items, headshots, falloff, armor or temporary buffs.

Calculated DPS excludes reload and documents burst timing; spin weapons have start/full-spin notes. It is a comparison model, not a claimed runtime measurement. Preserve exact precision internally and round presentation only. Snapshot records source version, immutable revision, extraction/check date, source URLs and validation counts.

## Experience and visual direction
Charcoal/forest background, ivory editorial areas, muted sage and brass, art-deco lines and serif display typography. No Tailwind, no template gradient dashboard. Home: recognisable Deadlock masthead, large illustrated hero feature, clear register CTA, snapshot date, Violet/Nurse spotlight. Register: search, level control 1–36, ascending/descending numeric sorting on all displayed stats and growths, reset, CSV export, method/source dialog, empty state, sticky hero names and scrollable table on narrow screens. Keyboard focus, real buttons and semantic table with aria-sort. No dead navigation or dummy controls.

## Validation
Domain tests cover accurate level growth and Spirit coupling, integer level boundaries, numeric sorting (including ties), source roster and read-only API. UI tests cover loading/error, search, empty state, sorting, level change, reset and method dialog. Real browser QA at desktop/mobile when permitted; the Windows browser automation path already stopped because its URL guard could not determine the current URL. Other supported browser surfaces may be used for our own local site. Build and public live URL must be verified independently of a push.
