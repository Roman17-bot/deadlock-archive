# Deadlock Archive progress — 24 October 2026

User authorized autonomous decisions, new GitHub repository and Pages deployment. Main: Nurse Harrow. No game launch.

- Research: three independent agents cover new heroes, patch delta, and stat model.
- Local steam.inf: 6819 / 11162696 / Oct22 16:40:35, matches fresh API.
- GitHub existing GCM account verified through /user: Roman17-bot (183053080). No credential saved or printed.
- Chrome Windows UI automation stopped by its URL guard; do not retry that path this turn. Non-UI GitHub API remains available.
- Frozen deadlock.io JSON still6785; current data comes from version-pinned6819 API/raw GameTracking.
- Roster44; Baba/Violet in_development flags retained because selectable and officially released.
- API derived weapon DPS has a burst-delay defect; use explicit comparison formula and preserve raw values/notes.
- New repository is an empty user-selected workspace; no existing checkout/worktree needs isolation. Implementation will use a feature branch and a final fresh review.

## Completed work
- Dataset/data validation: 44 playable heroes, individual Spirit growth, natural Spirit-to-damage and Victor regen included. All portraits present. Markdown table and private full knowledge archive generated.
- Private knowledge/current covers44heroes/176signatureabilities/156regularitems; old player research explicitly historical. Archive integrity checked.
- Domain/API tests first failed on missing implementation, then passed. UI tests likewise RED→GREEN; route hash query updates and keyboard skip link each reproduced failing behavior and were fixed.
- Latest suite28/28. Typecheck, data validation and production build with /deadlock-archive/ base path passed for the final visual update.
- Local Vite+Node startup and in-app browser preview verified. Real browser confirmed descendingHP givesMo&Krill930 first and NurseLVL36 yields1850HP/38.5Spirit/0regen.
- No automatic data updater shipped: this release is a versioned snapshot, changed in data/heroes.json and revalidated. This keeps unsupported future gameplay assumptions out of a silent updater.
- Fresh independent review found3 issues: malformed HTTP URL process crash, missing display metadata accepted, and low numeric contrast. Fixed with failing-then-passing regression tests and darker text; all44 hero values independently matched saved6819 primary assets.
- npm run dev now starts Vite and Node together, waits for both HTTP endpoints, then opens a new Chrome home tab. Verified actual startup; NO_OPEN=1 and CHROME_PATH available. Readiness tests cover delayed API, timeout and cancellation.
- Real browser checked mobile home/table, no page overflow/broken images, and method dialog/Escape. Temporary viewport reset.
- Fresh review follow-up found a missing spotlight hero could break the home; optional featured records now render safely, with a failing-then-passing UI regression test.
- Workflow pins official action releases by fullSHA and builds on Node24. Public repository and successful Pages deployment exist at https://github.com/Roman17-bot/deadlock-archive and https://roman17-bot.github.io/deadlock-archive/ (run40122136658, commit479f2f3).
- Latest user clarification: Nurse Harrow priority applies to future builds/replay analysis only. Removed website focus labels/row styling and replaced the dominant Nurse artwork with an equal-size portrait index of all44 heroes; both new releases have the same label. Final visual update verified locally and published.

- Final release c2cc7a3: Pages run40122485411 succeeded. Public home/data/JS/CSS/all fonts and sample art return successfully; parsed data exactly matches local JSON.
- Public browser verified44 rows, no focused hero row, all44 portraits loaded, numeric sorting, Russian search, LVL36 and real CSV download44 rows. Screenshots saved in outputs/site-home.png and site-heroes.png.
- Owned development processes stopped after Ctrl+C verification; no listeners on5173/3001. Restart with npm run dev; Chrome opens automatically.
- Final private knowledge ZIP regenerated with the user's clarification; integrity and CSV values checked.

## Readability refinement
- User requests larger text/UI and natural-height table scrolling with the document.
- Baseline public DOM: number12px, growth10px, search11px; wrapper672px for2659px of content at654px viewport.
- Updated source typography to rem: core16–18px, numeric cells18px, labels12–14px; input56px and controls44–56px. Changed both pages, method dialog and footer.
- Removed all table height caps; desktop table/header scroll with the document, smaller screens retain horizontal columns. All44 rows have natural height.
- Browser verified18px numbers,18px search, wrapper content/client heights equal (4075–4612px depending on width), wrapper scrollTop0 while document scroll reached4427px and Yamato became visible.
- Mobile at325px: fixed archive-strip min-content overflow; compact170px hero column leaves108px for a102.5px stat column. Numeric health sorting, Russian search, LVL36 and method dialog checked; no page-level horizontal overflow. Independent CSS review raised the same narrow hero column issue; now fixed.
- Desktop and mobile viewport overrides reset. All28 tests and the Pages production build/typecheck passed.
- Release b28d2f4 published successfully by Actions40125290557 (build/deploy success). Public DOM confirms44 rows,18px values/growth, max-height:none, full4085px height; document scrollY740 with wrapper scrollTop0. Screenshot outputs/site-readable-table.png saved; preview processes stopped, no listeners on5173/3001. Screenshot and public page handed off in the existing browser tab.

## Mobile refinement from Samsung screenshots
- Added <=760px stat groups:5 core metrics or4 growth metrics, preserving search/level. Hidden numeric sorts reset/fall back to name. Wide view restores all9 metrics at18px. Whole hero cell opens notes; colspan follows current columns.
- Tests:4 new UI cases first failed on missing mode behavior, then passed. Scope includes preserved filters/level, hidden-sort clearing and resize back to all columns.32 total tests passed; typecheck passed after correcting unsupported Testing Library test options.
- Portrait indices sit below the images on mobile without an overlay background. Browser measured44 portraits and0 overlaps at432/412px.
- Mobile table480px vs1120px before; growth min360px.57px rows vs90–104px, core15px/growth14px/name14px, first column112px. Natural2574px full height, no inner vertical scroll. Verified sorting, level27, Russian search, notes colspan5 and desktop colspan10.
-320px browser had305px client area due scrollbar; removed body min320 constraint (now280) to prevent page-level horizontal overflow. At320 and412 the document matches client width; intended table-only horizontal scrolling remains.
- Range now explicit WebKit/Firefox track, progress and22px diamond thumb,40px touch area,8px light gold/sage track with border. Added dark scheme declaration and local light scheme for ivory table/dialog. Research by an independent agent confirms Samsung Force Dark cannot be reliably overridden or detected; true Samsung mode not emulated.
- Independent release review found no blocking issues. All32 tests and final Pages production build/typecheck passed.
- Release6deec42 deployed by Actions40130007302 (build/deploy success). Public browser412px verified44 portraits/0 overlaps,6 core or5 growth columns, LVL27 and44 full-height rows2574px. Screenshots outputs/mobile-home-fixed.png and mobile-table-fixed.png saved. Viewport reset, public table reset to default and handed off; owned preview90708 stopped, no listeners5173/3001. Samsung proprietary forced recoloring remains unconfirmed without the phone.
