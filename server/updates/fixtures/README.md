# Updater fixtures

Compact projections of the actual client 6819 dumps, GameTracking commit
`17462b250a0ca80e7f80102f2c83cc3eecff5f12`, and version-pinned Deadlock API
assets fetched on 2026-10-24/25. The six hero IDs are 2, 3, 25, 66, 78, 88.
They cover queues, Spirit damage/regen/fire rate, spin-up, charge and multi-path
hit-once. All selected numerical values and 36 level schedules retain the source
values. The nonselected entries, localization/UI fields and visual weapon fields
were omitted to keep the fixture compact; no required numeric field was invented.

Raw fixtures were serialized as equivalent text KV3; their line numbers therefore
belong to these fixtures. Production provenance is located from the complete
pinned raw text, rather than reusing fixture line numbers. The `hero_base` entry
deliberately contains a different HP to catch accidental implicit inheritance.

Sources:

- https://raw.githubusercontent.com/SteamTracking/GameTracking-Deadlock/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/heroes.vdata
- https://raw.githubusercontent.com/SteamTracking/GameTracking-Deadlock/17462b250a0ca80e7f80102f2c83cc3eecff5f12/game/citadel/pak01_dir/scripts/abilities.vdata
- https://api.deadlock-api.com/v1/assets/heroes?client_version=6819&language=english
- https://api.deadlock-api.com/v1/assets/items?client_version=6819&language=english

Unit tests use only these tracked files. Live verification is separate:
`node scripts/update-data.mjs --dry-run --expected-version 6819`.
