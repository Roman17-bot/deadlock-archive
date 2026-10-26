# Focused retrieval

## Local website data and calculations

After `npm run knowledge -- status`, use `npm run db:status` for the local website's actual PostgreSQL state. `npm run db:query -- hero "Nurse Harrow"` returns bounded current hero data; `npm run db:query -- formula ehp ru` returns one formula, and `history` returns bounded versions. These commands read ignored `.env.local` internally; never print that file or credentials. If PostgreSQL is unavailable, distinguish that from the separately available SQLite evidence archive. See `docs/database.md` and current `server/database/` code for migrations/export/backup; `db:export` is a review artifact. For authorized publication use `npm run db:sync -- --dry-run` first, then `npm run db:sync -- --wait`: the PostgreSQL snapshot is mirrored to public files, committed through the owner backend and verified on Pages. Explicit sync compares content, including same-client edits; the game-update button retains its version no-op. A queued commit is not deployed success. Restart/retry inspects existing jobs; never force an older remote ref. Publication changes remote Git state independently of the working checkout, so fetch/reconcile safely before subsequent code work.

For numeric scenarios retrieve the formula's assumptions and version, then call the tested functions in `shared/mechanics.ts` through Node/tsx or use the website calculator. Percent inputs are ordinary percentages (30, not0.3); decimal comma is accepted by input parsing. Preserve both lifesteal/heal-amp models when unresolved. The calculator is a model, not a measurement of the game engine. Private research/profile/decisions remain in SQLite/FTS5 and are not copied into public website data.

The installed `local-profile.json` contains `repoRoot`, written by the installer on this machine. If the repository moved, locate its `package.json` and `scripts/knowledge/cli.mjs`, then reinstall. The private repo `knowledge/profile.json` holds stable preferences; `status` returns only its relevant public-to-agent fields. Never publish either local profile or the database.

Run from the repository with Node 24.15+:

```powershell
npm run knowledge -- status
npm run knowledge -- entity "Nurse Harrow"
npm run knowledge -- search "lifesteal" --limit 5
npm run knowledge -- formula lifesteal-amp
npm run knowledge -- search "лечение" --history --limit 5
npm run knowledge -- decision "Краткое принятое решение с причиной и датой источника."
```

Stable IDs are the `key` field in search results; pass a formula's key to `formula`. `refId` is an internal database row ID. Do not assume the example formula ID exists. If needed read `data/mechanics.json` selectively by ID/title, not the entire raw asset cache. Search uses Unicode tokens with prefix matching, AND semantics, and literal quoting; it has no SQL interface. Prefer several short synonymous queries to one long natural-language prompt. English/Cyrillic have no automatic translation or stemming.

Common aliases: Nurse Harrow — Нёрс, Нерс, медсестра, Харроу; Violet — Вайолет; lifesteal — вампиризм, лечение; resistance — сопротивление; debuff resistance — устойчивость, дебафф; cooldown — перезарядка; Spirit — спирит. Canonical hero aliases are searched as stored. Ability/item API records usually use English; translate the search term when Russian gives no result. Alias lists help retrieval and do not rename heroes on the site.

Each result carries a path/hash/date and snapshot version when known. A query returns at most 20 entries (default search 8, entity/formula 4); query length is at most 500 characters. Entity details are capped at 14,000 characters, search excerpts at 700. Read the returned original path selectively if detail was truncated. Documents keep full redacted source text in SQLite; their `checkedAt` is file modification time, not an audit date. Historical means a superseded snapshot/document or material under `knowledge/history`; research still needs source-date inspection even when retrieved by default.

The durable index imports canonical `data/heroes.json`, `data/mechanics.json`, private current/research/history reports and the raw abilities/items cache whose filename version matches canonical heroes. Reimport after a change; identical content within one client version does not duplicate records. If a new hero version has no matching raw cache, the previous raw entities become historical and need `--history`; `status.rawAssets` reports `stale` or `missing`. A changed matching cache sets `needsImport`. Formula `stale` compares reviewed client version with current canonical heroes. `status` shows the last import and active snapshots, not a live patch check. `knowledge/current/00_INDEX.md` is a dated navigation document and can lag newer research or executable code. Inspect current commands and the 2026-10-25 reports rather than treating that index as today's updater status.

For implementation questions inspect the relevant tracked code after retrieval. The presence of a design or decision does not establish that code was implemented. For LS recover both heal-amplification models and their assumptions; preserve their alternative stacking orders instead of presenting a universal resolved rule. Build popularity, rank labels and old statistical samples do not prove present effectiveness. Cite original source URLs plus snapshot/review date when giving game facts.

Outside the repository use `node "<repo>/scripts/knowledge/cli.mjs" --root "<repo>" status`; all commands also accept `--db PATH` for an isolated test database. Read operations never create or update the index. `decision` writes only an explicit short decision to an existing index. Import and decision commands mutate the private local database; no game or network action occurs.
