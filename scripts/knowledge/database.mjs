import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { rawAssetsForVersion } from './raw-assets.mjs';

export const schema = `
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,sha256 TEXT NOT NULL,path TEXT NOT NULL,client_version INTEGER,checked_at TEXT,imported_at TEXT NOT NULL,current INTEGER NOT NULL DEFAULT 1,meta TEXT NOT NULL,UNIQUE(kind,sha256,client_version));
CREATE TABLE IF NOT EXISTS entities(id INTEGER PRIMARY KEY,snapshot_id INTEGER NOT NULL REFERENCES snapshots(id),entity_id TEXT NOT NULL,kind TEXT NOT NULL,name TEXT NOT NULL,aliases TEXT NOT NULL,data TEXT NOT NULL,confidence TEXT NOT NULL,UNIQUE(snapshot_id,entity_id));
CREATE TABLE IF NOT EXISTS formulas(id INTEGER PRIMARY KEY,snapshot_id INTEGER NOT NULL REFERENCES snapshots(id),formula_id TEXT NOT NULL,title TEXT NOT NULL,data TEXT NOT NULL,confidence TEXT NOT NULL,UNIQUE(snapshot_id,formula_id));
CREATE TABLE IF NOT EXISTS evidence(id INTEGER PRIMARY KEY,snapshot_id INTEGER NOT NULL REFERENCES snapshots(id),source_id TEXT NOT NULL,label TEXT,url TEXT,kind TEXT,data TEXT NOT NULL,UNIQUE(snapshot_id,source_id));
CREATE TABLE IF NOT EXISTS documents(id INTEGER PRIMARY KEY,path TEXT NOT NULL,sha256 TEXT NOT NULL,checked_at TEXT NOT NULL,client_version INTEGER,historical INTEGER NOT NULL,current INTEGER NOT NULL DEFAULT 1,content TEXT NOT NULL,UNIQUE(path,sha256));
CREATE TABLE IF NOT EXISTS decisions(id INTEGER PRIMARY KEY,text TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS update_runs(id INTEGER PRIMARY KEY,started_at TEXT NOT NULL,finished_at TEXT,outcome TEXT NOT NULL,details TEXT NOT NULL);
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(type UNINDEXED,ref_id UNINDEXED,snapshot_id UNINDEXED,title,body,tokenize='unicode61 remove_diacritics 2');
`;

export function databasePath(root, path) {
  return resolve(path ?? resolve(root, 'knowledge/archive.sqlite'));
}
export function createDatabase(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(schema);
  // Version 1 keyed snapshots by content alone, which merged identical caches from different clients.
  if (
    db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='snapshots'")
      .get()
      .sql.includes('UNIQUE(kind,sha256)')
  ) {
    db.exec('PRAGMA foreign_keys=OFF');
    try {
      db.exec(`BEGIN;
        CREATE TABLE snapshots_next(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,sha256 TEXT NOT NULL,path TEXT NOT NULL,client_version INTEGER,checked_at TEXT,imported_at TEXT NOT NULL,current INTEGER NOT NULL DEFAULT 1,meta TEXT NOT NULL,UNIQUE(kind,sha256,client_version));
        INSERT INTO snapshots_next SELECT * FROM snapshots;
        DROP TABLE snapshots;
        ALTER TABLE snapshots_next RENAME TO snapshots;
        COMMIT;`);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    } finally {
      db.exec('PRAGMA foreign_keys=ON');
    }
  }
  db.exec('PRAGMA user_version=2');
  return db;
}
function optionsLimit(options = {}, fallback = 8) {
  const value = options.limit ?? fallback;
  if (!Number.isInteger(value) || value < 1 || value > 20)
    throw new Error('limit must be an integer from 1 to 20');
  return value;
}
function queryText(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 500)
    throw new Error('query must contain 1–500 characters');
  return value.trim();
}
function fts(value) {
  return (queryText(value).match(/[\p{L}\p{N}_-]+/gu) ?? [])
    .slice(0, 20)
    .map((t) => `"${t}"*`)
    .join(' AND ');
}
function boundedData(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length <= 14000
    ? JSON.parse(text)
    : { excerpt: text.slice(0, 14000), truncated: true };
}
function loadProfile(root) {
  const path = resolve(root, 'knowledge/profile.json');
  if (!existsSync(path)) return null;
  const profile = JSON.parse(readFileSync(path, 'utf8'));
  return {
    repoRoot: profile.repoRoot,
    mainHero: profile.mainHero,
    mainHeroScope: profile.mainHeroScope,
  };
}

/** Deliberately exposes named, bounded operations rather than arbitrary SQL. */
export function openKnowledge({ root = process.cwd(), path, writable = false } = {}) {
  const location = databasePath(root, path);
  const db = existsSync(location) ? new DatabaseSync(location, { readOnly: !writable }) : null;
  const requireDb = () => {
    if (!db) throw new Error('Knowledge index missing; run npm run knowledge:import');
    return db;
  };
  const currentVersion = () =>
    db
      ?.prepare(
        "SELECT client_version FROM snapshots WHERE kind='heroes' AND current=1 ORDER BY id DESC LIMIT 1",
      )
      .get()?.client_version ?? null;
  const provenance = (row) => ({
    snapshotId: row.snapshot_id,
    clientVersion: row.client_version,
    checkedAt: row.checked_at,
    path: row.path,
    sha256: row.sha256,
    historical: !row.current,
    stale:
      row.client_version != null &&
      currentVersion() != null &&
      row.client_version !== currentVersion(),
  });
  return {
    close() {
      db?.close();
    },
    status() {
      if (!db)
        return {
          exists: false,
          path: location,
          profile: loadProfile(root),
          hint: 'npm run knowledge:import',
        };
      const counts = Object.fromEntries(
        [
          'snapshots',
          'entities',
          'formulas',
          'evidence',
          'documents',
          'decisions',
          'update_runs',
        ].map((table) => [table, db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n]),
      );
      const snapshots = db
        .prepare(
          'SELECT kind,client_version AS clientVersion,checked_at AS checkedAt,path,sha256 FROM snapshots WHERE current=1 ORDER BY kind LIMIT 10',
        )
        .all();
      const canonicalFiles = ['heroes', 'mechanics'].map((kind) => {
        const path = `data/${kind}.json`;
        const file = resolve(root, path);
        const snapshot = snapshots.find((s) => s.kind === kind);
        const diskHash = existsSync(file)
          ? createHash('sha256').update(readFileSync(file)).digest('hex')
          : null;
        return {
          path,
          exists: diskHash !== null,
          changed: diskHash !== (snapshot?.sha256 ?? null),
        };
      });
      const clientVersion = currentVersion();
      const raw = rawAssetsForVersion(root, clientVersion);
      const rawSnapshot = snapshots.find((s) => s.kind === 'raw-assets');
      const rawHash = raw.path
        ? createHash('sha256').update(readFileSync(raw.path)).digest('hex')
        : null;
      const rawAssets = {
        clientVersion,
        path:
          clientVersion == null
            ? null
            : `knowledge/current/data/all_ability_item_assets_${clientVersion}.json`,
        exists: raw.path !== null,
        state: raw.path
          ? rawHash === rawSnapshot?.sha256 && rawSnapshot?.clientVersion === clientVersion
            ? 'current'
            : 'pending-import'
          : raw.versions.length || rawSnapshot
            ? 'stale'
            : 'missing',
        changed: raw.path
          ? rawHash !== (rawSnapshot?.sha256 ?? null) ||
            rawSnapshot?.clientVersion !== clientVersion
          : !!rawSnapshot,
        availableVersions: raw.versions,
      };
      return {
        exists: true,
        path: location,
        schemaVersion: db.prepare('PRAGMA user_version').get().user_version,
        clientVersion,
        needsImport: canonicalFiles.some((f) => f.changed) || rawAssets.changed,
        canonicalFiles,
        rawAssets,
        counts,
        snapshots,
        lastImport:
          db
            .prepare(
              'SELECT started_at AS startedAt,finished_at AS finishedAt,outcome,details FROM update_runs ORDER BY id DESC LIMIT 1',
            )
            .get() ?? null,
        profile: loadProfile(root),
      };
    },
    search(query, options = {}) {
      const limit = optionsLimit(options);
      const match = fts(query);
      if (!match) return { query, results: [] };
      const rows = requireDb()
        .prepare(
          `SELECT i.type,i.ref_id AS refId,i.snapshot_id AS snapshotId,i.title,snippet(search_index,4,'[',']',' … ',40) AS excerpt,s.path,s.sha256,s.client_version AS clientVersion,s.checked_at AS checkedAt,COALESCE(s.current,d.current,1) AS is_current,COALESCE(d.historical,0) AS historical,d.path AS document_path,d.sha256 AS document_sha,d.checked_at AS document_date,f.formula_id AS formula_key,e.entity_id AS entity_key
        FROM search_index i LEFT JOIN snapshots s ON s.id=i.snapshot_id LEFT JOIN documents d ON i.type='document' AND d.id=i.ref_id LEFT JOIN formulas f ON i.type='formula' AND f.id=i.ref_id LEFT JOIN entities e ON i.type='entity' AND e.id=i.ref_id
        WHERE search_index MATCH ? AND (? OR (COALESCE(s.current,d.current,1)=1 AND COALESCE(d.historical,0)=0)) ORDER BY rank LIMIT ?`,
        )
        .all(match, options.history ? 1 : 0, limit);
      return {
        query,
        results: rows.map((r) => ({
          type: r.type,
          refId: r.refId,
          key: r.formula_key ?? r.entity_key ?? r.refId,
          title: r.title,
          excerpt: r.excerpt.slice(0, 700),
          snapshotId: r.snapshotId,
          path: r.document_path ?? r.path,
          sha256: r.document_sha ?? r.sha256,
          clientVersion: r.clientVersion,
          checkedAt: r.document_date ?? r.checkedAt,
          historical: !r.is_current || !!r.historical,
        })),
      };
    },
    entity(name, options = {}) {
      const limit = optionsLimit(options, 4);
      const tokens = fts(name);
      const match = tokens ? `title : (${tokens})` : '';
      if (!match) return { query: name, results: [] };
      const rows = requireDb()
        .prepare(
          `SELECT e.*,s.path,s.sha256,s.client_version,s.checked_at,s.current FROM search_index i JOIN entities e ON e.id=i.ref_id JOIN snapshots s ON s.id=e.snapshot_id WHERE search_index MATCH ? AND i.type='entity' AND (? OR s.current=1) ORDER BY s.current DESC,s.id DESC,e.id LIMIT ?`,
        )
        .all(match, options.history ? 1 : 0, limit);
      return {
        query: name,
        results: rows.map((r) => ({
          id: r.entity_id,
          name: r.name,
          aliases: r.aliases,
          kind: r.kind,
          confidence: r.confidence,
          ...provenance(r),
          data: boundedData(r.data),
        })),
      };
    },
    formula(id, options = {}) {
      const limit = optionsLimit(options, 4);
      queryText(id);
      const rows = requireDb()
        .prepare(
          'SELECT f.*,s.path,s.sha256,s.client_version,s.checked_at,s.current FROM formulas f JOIN snapshots s ON s.id=f.snapshot_id WHERE f.formula_id=? AND (? OR s.current=1) ORDER BY s.current DESC,s.id DESC LIMIT ?',
        )
        .all(id, options.history ? 1 : 0, limit);
      return {
        query: id,
        results: rows.map((r) => {
          const data = JSON.parse(r.data);
          const sources = requireDb()
            .prepare(
              'SELECT source_id AS id,label,url,kind FROM evidence WHERE snapshot_id=? ORDER BY source_id',
            )
            .all(r.snapshot_id)
            .filter((s) => (data.sourceIds ?? []).includes(s.id));
          return {
            id: r.formula_id,
            confidence: r.confidence,
            ...provenance(r),
            data: boundedData(data),
            evidence: sources.slice(0, 20),
          };
        }),
      };
    },
    decision(text) {
      if (typeof text !== 'string' || !text.trim() || text.length > 4000)
        throw new Error('decision must contain 1–4000 characters');
      if (!writable) throw new Error('decision requires writable access');
      const createdAt = new Date().toISOString();
      const database = requireDb();
      database.exec('BEGIN');
      try {
        const { lastInsertRowid: id } = database
          .prepare('INSERT INTO decisions(text,created_at) VALUES(?,?)')
          .run(text.trim(), createdAt);
        database
          .prepare("INSERT INTO search_index(type,ref_id,title,body) VALUES('decision',?,?,?)")
          .run(id, text.trim().slice(0, 100), text.trim());
        database.exec('COMMIT');
        return { id: Number(id), text: text.trim(), createdAt };
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
