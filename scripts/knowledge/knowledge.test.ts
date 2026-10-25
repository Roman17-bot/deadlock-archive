import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-ignore Native Node ESM CLI module, also executable without a TS loader.
import { openKnowledge } from './database.mjs';
// @ts-ignore Native Node ESM importer.
import { importKnowledge } from './import.mjs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
// @ts-ignore Native Node ESM schema for an on-disk legacy migration test.
import { schema } from './database.mjs';

let root: string;
function put(path: string, data: unknown) {
  const target = join(root, path);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, typeof data === 'string' ? data : JSON.stringify(data));
}
function heroes(version = 6819) {
  return {
    meta: { clientVersion: version, checkedAt: '2026-10-25T12:00:00Z', gameCommit: 'abc' },
    heroes: [
      {
        id: 72,
        slug: 'nurse-harrow',
        name: 'Nurse Harrow',
        aliases: 'Медсестра Харроу Нёрс',
        base: { health: 600 + version },
      },
    ],
  };
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'deadlock-knowledge-'));
  put('data/heroes.json', heroes());
  put('data/mechanics.json', {
    meta: { reviewedClientVersion: 6819, checkedAt: '2026-10-25T13:00:00Z' },
    sources: [
      {
        id: 'wiki',
        label: 'Resistance observations',
        url: 'https://example.org/resistance',
        kind: 'community',
      },
    ],
    formulas: [
      {
        id: 'resistance',
        title: 'Сопротивление и EHP',
        expression: '1-(1-r1)*(1-r2)',
        variables: ['r1', 'r2'],
        explanation: ['resistance складывается мультипликативно'],
        confidence: 'community-consensus',
        sourceIds: ['wiki'],
      },
    ],
  });
  put(
    'knowledge/current/report.md',
    '# Модель LS\nДве модели: попадание и life steal. Проверить патч.',
  );
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('local knowledge index with real SQLite FTS5', () => {
  it('is idempotent and retains separate dated history after a canonical update', () => {
    const first = importKnowledge({ root });
    expect(first.importedSnapshots).toBe(2);
    expect(importKnowledge({ root }).importedSnapshots).toBe(0);
    put('data/heroes.json', heroes(6820));
    importKnowledge({ root });
    const db = openKnowledge({ root, writable: true });
    try {
      expect(db.status().counts.snapshots).toBe(3);
      expect(db.entity('Харроу').results[0].clientVersion).toBe(6820);
      expect(
        db.entity('Harrow', { history: true }).results.map((x: any) => x.clientVersion),
      ).toEqual([6820, 6819]);
      expect(db.formula('resistance').results[0].stale).toBe(true);
    } finally {
      db.close();
    }
  });
  it('searches actual English and Cyrillic text while preserving source provenance', () => {
    importKnowledge({ root });
    const db = openKnowledge({ root });
    try {
      expect(db.search('Сопротивление').results.find((x: any) => x.type === 'formula').key).toBe(
        'resistance',
      );
      expect(db.search('resistance').results.length).toBeGreaterThan(0);
      expect(db.search('Харроу').results[0].type).toBe('entity');
      expect(
        db.search('модели').results.some((x: any) => x.path === 'knowledge/current/report.md'),
      ).toBe(true);
      const f = db.formula('resistance').results[0];
      expect(f.evidence[0].url).toBe('https://example.org/resistance');
      expect(f.path).toBe('data/mechanics.json');
      expect(f.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(db.entity('Медсестра').results[0].data.base.health).toBe(7419);
    } finally {
      db.close();
    }
  });
  it('bounds queries, treats SQL and FTS operators as text, and retains decisions across imports', () => {
    importKnowledge({ root });
    const db = openKnowledge({ root, writable: true });
    try {
      expect(() => db.search('a', { limit: 1000 })).toThrow(/limit/);
      expect(() => db.search('x'.repeat(501))).toThrow(/500/);
      expect(db.search("'; DROP TABLE snapshots; --").results).toEqual([]);
      expect(db.search('" OR * NOT (').results).toEqual([]);
      expect(() => db.decision('')).toThrow(/decision/);
      expect(db.decision('Основной герой Nurse Harrow только для билдов.').text).toContain(
        'Nurse Harrow',
      );
    } finally {
      db.close();
    }
    importKnowledge({ root });
    const next = openKnowledge({ root });
    try {
      expect(next.status().counts.decisions).toBe(1);
      expect(next.search('билдов').results[0].type).toBe('decision');
    } finally {
      next.close();
    }
  });
  it('indexes raw abilities/items and historical documents without marking them current', () => {
    put('knowledge/current/data/all_ability_item_assets_6819.json', [
      {
        id: 123,
        name: 'Healing Booster',
        type: 'upgrade',
        description: 'усилитель лечения Nurse Harrow',
      },
    ]);
    put('knowledge/history/2026-10-20/report.md', '# Старая формула\nИсторический эксперимент.');
    importKnowledge({ root });
    const db = openKnowledge({ root });
    try {
      expect(db.entity('Healing Booster').results[0].kind).toBe('item');
      expect(db.entity('Nurse Harrow', { limit: 1 }).results[0].kind).toBe('hero');
      expect(db.search('Исторический').results).toEqual([]);
      expect(db.search('Исторический', { history: true }).results[0].historical).toBe(true);
    } finally {
      db.close();
    }
  });
  it('keeps raw assets historical across a client update until a matching cache is imported', () => {
    const oldPath = 'knowledge/current/data/all_ability_item_assets_6819.json';
    const newPath = 'knowledge/current/data/all_ability_item_assets_6820.json';
    put(oldPath, [{ id: 123, name: 'Healing Booster 6819', type: 'upgrade' }]);
    importKnowledge({ root });
    put('data/heroes.json', heroes(6820));
    importKnowledge({ root });
    let db = openKnowledge({ root });
    try {
      expect(db.status().rawAssets).toMatchObject({
        clientVersion: 6820,
        exists: false,
        state: 'stale',
      });
      expect(db.entity('Healing Booster').results).toEqual([]);
      expect(db.search('Healing Booster').results).toEqual([]);
      expect(db.entity('Healing Booster', { history: true }).results[0]).toMatchObject({
        clientVersion: 6819,
        historical: true,
      });
    } finally {
      db.close();
    }

    put(newPath, [{ id: 123, name: 'Healing Booster 6820', type: 'upgrade' }]);
    db = openKnowledge({ root });
    try {
      expect(db.status().needsImport).toBe(true);
      expect(db.status().rawAssets).toMatchObject({
        clientVersion: 6820,
        exists: true,
        changed: true,
      });
    } finally {
      db.close();
    }
    expect(importKnowledge({ root }).importedSnapshots).toBe(1);
    db = openKnowledge({ root });
    try {
      expect(db.entity('Healing Booster').results.map((x: any) => x.clientVersion)).toEqual([6820]);
      expect(
        db.entity('Healing Booster', { history: true }).results.map((x: any) => x.clientVersion),
      ).toEqual([6820, 6819]);
      expect(db.status().needsImport).toBe(false);
    } finally {
      db.close();
    }

    put(newPath, [
      { id: 123, name: 'Healing Booster 6820', type: 'upgrade', description: 'changed cache' },
    ]);
    db = openKnowledge({ root });
    try {
      expect(db.status().needsImport).toBe(true);
      expect(db.status().rawAssets.changed).toBe(true);
    } finally {
      db.close();
    }
  });
  it('keeps both raw versions when versioned cache contents are identical', () => {
    const cache = [{ id: 123, name: 'Healing Booster', type: 'upgrade' }];
    put('knowledge/current/data/all_ability_item_assets_6819.json', cache);
    importKnowledge({ root });
    put('data/heroes.json', heroes(6820));
    put('knowledge/current/data/all_ability_item_assets_6820.json', cache);
    importKnowledge({ root });
    const db = openKnowledge({ root });
    try {
      expect(db.entity('Healing Booster').results.map((x: any) => x.clientVersion)).toEqual([6820]);
      expect(
        db.entity('Healing Booster', { history: true }).results.map((x: any) => x.clientVersion),
      ).toEqual([6820, 6819]);
      expect(db.status().needsImport).toBe(false);
    } finally {
      db.close();
    }
  });
  it('migrates an existing content-only snapshot index before importing a new version', () => {
    const path = join(root, 'knowledge/archive.sqlite');
    mkdirSync(join(root, 'knowledge'), { recursive: true });
    const cache = [{ id: 123, name: 'Healing Booster', type: 'upgrade' }];
    const raw = JSON.stringify(cache);
    put('knowledge/current/data/all_ability_item_assets_6819.json', raw);
    const legacy = new DatabaseSync(path);
    try {
      legacy.exec(schema.replace('UNIQUE(kind,sha256,client_version)', 'UNIQUE(kind,sha256)'));
      legacy.exec('PRAGMA user_version=1');
      const hash = createHash('sha256').update(raw).digest('hex');
      legacy
        .prepare(
          'INSERT INTO snapshots(kind,sha256,path,client_version,checked_at,imported_at,meta) VALUES(?,?,?,?,?,?,?)',
        )
        .run(
          'raw-assets',
          hash,
          'knowledge/current/data/all_ability_item_assets_6819.json',
          6819,
          '2026-10-25T12:00:00Z',
          '2026-10-25T12:00:00Z',
          '{}',
        );
      legacy
        .prepare(
          'INSERT INTO entities(snapshot_id,entity_id,kind,name,aliases,data,confidence) VALUES(?,?,?,?,?,?,?)',
        )
        .run(1, '123', 'item', 'Healing Booster', '', raw.slice(1, -1), 'raw-game-data');
      legacy
        .prepare(
          "INSERT INTO search_index(type,ref_id,snapshot_id,title,body) VALUES('entity',1,1,'Healing Booster',?)",
        )
        .run(raw);
    } finally {
      legacy.close();
    }
    importKnowledge({ root });
    put('data/heroes.json', heroes(6820));
    put('knowledge/current/data/all_ability_item_assets_6820.json', cache);
    importKnowledge({ root });
    const db = openKnowledge({ root });
    try {
      expect(db.status().schemaVersion).toBe(2);
      expect(
        db.entity('Healing Booster', { history: true }).results.map((x: any) => x.clientVersion),
      ).toEqual([6820, 6819]);
    } finally {
      db.close();
    }
  });
  it('does not silently import on a read and redacts credential-shaped content', () => {
    expect(openKnowledge({ root }).status().exists).toBe(false);
    put('knowledge/current/secrets.env', 'token=never-import-this');
    put(
      'knowledge/current/report.md',
      'evidence\nAuthorization: Bearer abcdef-secret\n"access_token": "secret-token-value"',
    );
    importKnowledge({ root });
    const db = openKnowledge({ root });
    try {
      expect(db.search('secret').results).toEqual([]);
      expect(db.status().counts.documents).toBe(1);
    } finally {
      db.close();
    }
  });
  it('keeps a working snapshot intact if a malformed import fails midway', () => {
    importKnowledge({ root });
    put('data/heroes.json', heroes(6820));
    put('data/mechanics.json', '{broken');
    expect(() => importKnowledge({ root })).toThrow();
    const db = openKnowledge({ root });
    try {
      expect(db.status().counts.snapshots).toBe(2);
      expect(db.status().clientVersion).toBe(6819);
    } finally {
      db.close();
    }
  });
  it('reports changed canonical files without mutating or reimporting them', () => {
    importKnowledge({ root });
    put('data/heroes.json', heroes(6820));
    const db = openKnowledge({ root });
    try {
      expect(db.status().needsImport).toBe(true);
      expect(db.status().clientVersion).toBe(6819);
      expect(db.status().counts.snapshots).toBe(2);
    } finally {
      db.close();
    }
  });
  it('offers bounded CLI JSON and rejects SQL commands rather than executing them', () => {
    const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url));
    const run = (...args: string[]) =>
      JSON.parse(
        execFileSync(process.execPath, [cli, '--root', root, ...args], { encoding: 'utf8' }),
      );
    expect(run('status').exists).toBe(false);
    expect(run('import').importedSnapshots).toBe(2);
    expect(run('entity', 'Харроу').results[0].name).toBe('Nurse Harrow');
    expect(run('formula', 'resistance').results[0].evidence[0].id).toBe('wiki');
    expect(run('decision', 'Игру не запускать.').text).toBe('Игру не запускать.');
    const unsafe = spawnSync(
      process.execPath,
      [cli, '--root', root, 'sql', 'DROP TABLE snapshots'],
      { encoding: 'utf8' },
    );
    expect(unsafe.status).toBe(1);
    expect(JSON.parse(unsafe.stdout).error).toContain('command');
    expect(run('status').counts.snapshots).toBe(2);
  });
});
