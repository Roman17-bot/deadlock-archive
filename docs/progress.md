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
- Latest suite27/27. Typecheck, data validation and production build with /deadlock-archive/ base path passed.
- Local Vite+Node running, preview through in-app browser works. Real browser confirmed descendingHP givesMo&Krill930 first and NurseLVL36 yields1850HP/38.5Spirit/0regen.
- No automatic data updater shipped: this release is a versioned snapshot, changed in data/heroes.json and revalidated. This keeps unsupported future gameplay assumptions out of a silent updater.
- Fresh independent review found3 issues: malformed HTTP URL process crash, missing display metadata accepted, and low numeric contrast. Fixed with failing-then-passing regression tests and darker text; all44 hero values independently matched saved6819 primary assets.
- npm run dev now starts Vite and Node together, waits for both HTTP endpoints, then opens a new Chrome home tab. Verified actual startup; NO_OPEN=1 and CHROME_PATH available. Readiness tests cover delayed API, timeout and cancellation.
- Real browser checked mobile home/table, no page overflow/broken images, and method dialog/Escape. Temporary viewport reset.
- Workflow pins official action releases by fullSHA and builds on Node24. Public repository created at https://github.com/Roman17-bot/deadlock-archive; push/Pages still pending.
