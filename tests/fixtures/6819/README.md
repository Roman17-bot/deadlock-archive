# Fixed public version 6819

These three JSON files are exact public bytes from commit `dd35654`, copied with
`git show dd35654:data/FILE`. They form a consistent heroes, provenance and version
history set for tests that explicitly model version 6819, a 6819 → 6820 update,
or raw configuration pinned to version 6819.

UI and calculation examples that assert specific health, damage or growth values
also use these fixtures, so later balance changes do not invalidate those examples.

Keep these fixtures fixed when the working archive advances. Tests of current
public data and general API integration should continue to read `data/` directly.
These files contain public curated data only; they do not contain private research.
