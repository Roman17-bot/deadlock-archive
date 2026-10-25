import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { createDatabase, databasePath } from './database.mjs';
import { rawAssetsForVersion } from './raw-assets.mjs';

const sha = (text) => createHash('sha256').update(text).digest('hex');
const slash = (value) => value.replaceAll('\\', '/');
// Only an explicit local evidence tree is imported. No environment, logs, credentials or chats.
const allowed = new Set(['.md', '.json', '.txt', '.h', '.vdata', '.inf', '.html']);
export function redact(text) {
  return text
    .replace(/(Authorization\s*:\s*Bearer\s+)\S+/gi, '$1[REDACTED]')
    .replace(
      /((?:["']?(?:access_token|refresh_token|api_key|password|client_secret)["']?)\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,}\r\n]+)/gi,
      '$1"[REDACTED]"',
    )
    .replace(
      /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\b/g,
      '[REDACTED]',
    );
}
function filesAt(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .flatMap((entry) => {
      const file = resolve(path, entry.name);
      if (entry.isSymbolicLink()) return [];
      if (entry.isDirectory()) return filesAt(file);
      return entry.isFile() &&
        allowed.has(extname(file)) &&
        !/(?:credential|secret|chat[-_]?log)/i.test(entry.name)
        ? [file]
        : [];
    })
    .sort();
}

export function importKnowledge({ root = process.cwd(), path } = {}) {
  root = resolve(root);
  const database = createDatabase(databasePath(root, path));
  const startedAt = new Date().toISOString();
  const stats = { importedSnapshots: 0, importedDocuments: 0, skippedFiles: [] };
  const index = (type, ref, snapshot, title, body) =>
    database
      .prepare('INSERT INTO search_index(type,ref_id,snapshot_id,title,body) VALUES(?,?,?,?,?)')
      .run(type, ref, snapshot, title, body);
  const insertSnapshot = (kind, file, text, meta) => {
    const hash = sha(text);
    const version = meta.clientVersion ?? meta.reviewedClientVersion ?? null;
    const existing = database
      .prepare('SELECT id FROM snapshots WHERE kind=? AND sha256=? AND client_version IS ?')
      .get(kind, hash, version);
    if (existing) {
      // A deliberate rollback to an old known file must still become the current snapshot.
      database
        .prepare('UPDATE snapshots SET current=CASE WHEN id=? THEN 1 ELSE 0 END WHERE kind=?')
        .run(existing.id, kind);
      return null;
    }
    database.prepare('UPDATE snapshots SET current=0 WHERE kind=?').run(kind);
    const result = database
      .prepare(
        'INSERT INTO snapshots(kind,sha256,path,client_version,checked_at,imported_at,meta) VALUES(?,?,?,?,?,?,?)',
      )
      .run(
        kind,
        hash,
        slash(relative(root, file)),
        version,
        meta.checkedAt ?? startedAt,
        startedAt,
        JSON.stringify(meta),
      );
    stats.importedSnapshots++;
    return Number(result.lastInsertRowid);
  };
  const insertEntity = (snapshot, entity, kind) => {
    const name = entity.name ?? entity.class_name ?? String(entity.id);
    const aliases = Array.isArray(entity.aliases)
      ? entity.aliases.join(' ')
      : (entity.aliases ?? '');
    const data = redact(JSON.stringify(entity));
    const result = database
      .prepare(
        'INSERT INTO entities(snapshot_id,entity_id,kind,name,aliases,data,confidence) VALUES(?,?,?,?,?,?,?)',
      )
      .run(
        snapshot,
        String(entity.id ?? entity.class_name ?? name),
        kind,
        name,
        aliases,
        data,
        kind === 'hero' ? 'curated-game-data' : 'raw-game-data',
      );
    index('entity', result.lastInsertRowid, snapshot, `${name} ${aliases}`, data);
  };
  database.exec('BEGIN');
  try {
    let heroVersion = null;
    for (const [kind, filename] of [
      ['heroes', 'data/heroes.json'],
      ['mechanics', 'data/mechanics.json'],
    ]) {
      const file = resolve(root, filename);
      if (!existsSync(file)) continue;
      const text = readFileSync(file, 'utf8');
      const data = JSON.parse(text);
      if (kind === 'heroes') heroVersion = data.meta?.clientVersion ?? null;
      const snapshot = insertSnapshot(kind, file, text, data.meta ?? {});
      if (snapshot === null) continue;
      for (const entity of data.heroes ?? []) insertEntity(snapshot, entity, 'hero');
      for (const source of data.sources ?? [])
        database
          .prepare(
            'INSERT INTO evidence(snapshot_id,source_id,label,url,kind,data) VALUES(?,?,?,?,?,?)',
          )
          .run(
            snapshot,
            source.id,
            source.label,
            source.url ?? null,
            source.kind ?? 'unspecified',
            redact(JSON.stringify(source)),
          );
      for (const formula of data.formulas ?? []) {
        const result = database
          .prepare(
            'INSERT INTO formulas(snapshot_id,formula_id,title,data,confidence) VALUES(?,?,?,?,?)',
          )
          .run(
            snapshot,
            formula.id,
            formula.title,
            redact(JSON.stringify(formula)),
            formula.confidence,
          );
        index('formula', result.lastInsertRowid, snapshot, formula.title, JSON.stringify(formula));
      }
    }
    const rawFile = rawAssetsForVersion(root, heroVersion).path;
    // A versioned cache cannot be current after canonical heroes advance without it.
    database.prepare("UPDATE snapshots SET current=0 WHERE kind='raw-assets'").run();
    if (rawFile) {
      const text = readFileSync(rawFile, 'utf8');
      const snapshot = insertSnapshot('raw-assets', rawFile, text, {
        clientVersion: heroVersion,
        checkedAt: statSync(rawFile).mtime.toISOString(),
      });
      if (snapshot !== null)
        for (const entity of JSON.parse(text))
          insertEntity(snapshot, entity, entity.type === 'ability' ? 'ability' : 'item');
    }
    const files = ['current', 'research', 'history']
      .flatMap((dir) => filesAt(resolve(root, 'knowledge', dir)))
      .filter(
        (file) =>
          file !== rawFile && !slash(relative(root, file)).startsWith('knowledge/current/data/'),
      );
    // Deletion or movement removes a document from current retrieval, preserving its history.
    database.prepare('UPDATE documents SET current=0').run();
    for (const file of files) {
      const rel = slash(relative(root, file));
      if (statSync(file).size > 16 * 1024 * 1024) {
        stats.skippedFiles.push(rel);
        continue;
      }
      const raw = readFileSync(file, 'utf8');
      const hash = sha(raw);
      const existing = database
        .prepare('SELECT id FROM documents WHERE path=? AND sha256=?')
        .get(rel, hash);
      if (existing) {
        database.prepare('UPDATE documents SET current=1 WHERE id=?').run(existing.id);
        continue;
      }
      const content = redact(raw);
      const result = database
        .prepare(
          'INSERT INTO documents(path,sha256,checked_at,client_version,historical,content) VALUES(?,?,?,?,?,?)',
        )
        .run(
          rel,
          hash,
          statSync(file).mtime.toISOString(),
          Number(/(?:^|\D)(68\d{2})(?:\D|$)/.exec(rel)?.[1]) || null,
          rel.startsWith('knowledge/history/') ? 1 : 0,
          content,
        );
      index('document', result.lastInsertRowid, null, rel, content);
      stats.importedDocuments++;
    }
    database
      .prepare('INSERT INTO update_runs(started_at,finished_at,outcome,details) VALUES(?,?,?,?)')
      .run(startedAt, new Date().toISOString(), 'imported', JSON.stringify(stats));
    database.exec('COMMIT');
    return stats;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.close();
  }
}
