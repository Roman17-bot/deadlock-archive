-- Read-only examples for the local archive. Use the PostgreSQL extension's
-- connection editor for credentials; do not save them in this workspace.
-- Run each query only after the archive has been imported.

-- Current imported snapshot and source version:
SELECT s.id, s.client_version, s.imported_at
FROM archive_snapshots AS s
JOIN archive_current AS c ON c.snapshot_id = s.id
WHERE c.singleton = true;

-- Available historical snapshots, newest first:
SELECT id, client_version, imported_at
FROM archive_snapshots
ORDER BY imported_at DESC
LIMIT 20;

-- Hero names in the current snapshot:
SELECT h.hero_id, h.slug, h.name
FROM heroes AS h
JOIN archive_current AS c ON c.snapshot_id = h.snapshot_id
WHERE c.singleton = true
ORDER BY h.name
LIMIT 50;

-- Russian formula prose and exact expression:
SELECT f.formula_id, f.title, f.expression, f.confidence
FROM mechanics_formulas AS f
JOIN archive_current AS c ON c.snapshot_id = f.snapshot_id
WHERE c.singleton = true AND f.language = 'ru'
ORDER BY f.ordinal
LIMIT 20;
