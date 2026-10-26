import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PostgresArchive } from './repository';
import { readCuratedBundle } from './bundle';
import { createDatabasePool, loadDatabaseEnvironment } from './config';

const root = fileURLToPath(new URL('../../', import.meta.url));
const local: Record<string, string | undefined> = (() => {
  try {
    return parseEnv(readFileSync(join(root, '.env.local'), 'utf8'));
  } catch {
    return {};
  }
})();
const testName = process.env.DEADLOCK_DB_TEST_NAME ?? local.DEADLOCK_DB_TEST_NAME;
const environment = loadDatabaseEnvironment(root);
const enabled = Boolean(testName && environment);
const suite = enabled ? describe : describe.skip;

suite('PostgresArchive on an owned test database', () => {
  let archive: PostgresArchive;
  let pool: Pool;
  let control: Pool;
  let schemaName: string;

  beforeAll(async () => {
    if (
      !environment ||
      !testName ||
      !/^deadlock_archive_test(?:_[a-z0-9]+)?$/.test(testName) ||
      testName === environment.database
    )
      throw new Error('Refusing to run integration tests outside an owned dedicated test database');
    control = createDatabasePool({ ...environment, database: testName });
    schemaName = `archive_test_${randomUUID().replaceAll('-', '')}`;
    await control.query(`CREATE SCHEMA "${schemaName}"`);
    pool = new Pool({
      ...environment,
      database: testName,
      options: `-c search_path=${schemaName}`,
      max: 2,
    });
    const target = await pool.query(
      'SELECT current_database() AS database, current_schema() AS schema',
    );
    expect(target.rows[0]).toEqual({ database: testName, schema: schemaName });
    archive = new PostgresArchive(pool);
    await archive.migrate();
  });
  afterAll(async () => {
    await pool?.end();
    if (control && schemaName) await control.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    await control?.end();
  });

  it('migrates and imports a relational snapshot with exact export and bounded reads', async () => {
    const bundle = await readCuratedBundle(root);
    (bundle.provenance as Record<string, unknown>).testRunId = randomUUID();
    const first = await archive.importBundle(bundle, 'integration-test');
    const second = await archive.importBundle(bundle, 'integration-test-retry');
    expect(first.imported).toBe(true);
    expect(second.imported).toBe(false);
    expect(second.snapshotId).toBe(first.snapshotId);
    expect(await archive.getBundle()).toEqual(bundle);
    expect((await archive.searchHeroes('nurse-harrow', 20)).map((hero) => hero.name)).toEqual([
      'Nurse Harrow',
    ]);
    expect((await archive.searchHeroes('', 999)).length).toBeLessThanOrEqual(20);
    expect((await archive.getFormula(bundle.mechanics.ru.formulas[0].id, 'ru'))?.id).toBe(
      bundle.mechanics.ru.formulas[0].id,
    );
    const count = await pool.query('SELECT count(*)::int AS n FROM heroes WHERE snapshot_id = $1', [
      first.snapshotId,
    ]);
    expect(count.rows[0].n).toBe(bundle.heroes.heroes.length);
  });

  it('rejects invalid import without changing current pointers', async () => {
    const previous = await archive.status();
    const bad = structuredClone(await readCuratedBundle(root));
    bad.mechanics.ru.formulas[0].sourceIds = ['missing-source'];
    await expect(archive.importBundle(bad)).rejects.toThrow();
    expect(await archive.status()).toEqual(previous);
  });

  it('roundtrips patch links through relational history without losing their provenance', async () => {
    const bundle = structuredClone(await readCuratedBundle(root));
    const patch = {
      source: 'steamdb',
      steamBuildId: 26147187,
      gameCommit: bundle.heroes.meta.gameCommit,
      url: 'https://steamdb.info/patchnotes/26147187/',
      notes: 'unpublished',
      checkedAt: '2026-10-26T09:00:00.000Z',
      summary: { ru: 'Описание не опубликовано.', en: 'No notes published.' },
    };
    Object.assign(bundle.history.versions[0], { patch });
    await archive.importBundle(bundle, 'patch-history-test');
    expect((await archive.getHistory())?.versions[0]).toHaveProperty('patch', patch);
    expect((await archive.getBundle())?.history).toEqual(bundle.history);
  });

  it('rolls back a database constraint failure and retains the earlier snapshot', async () => {
    const previous = await archive.status();
    const original = await archive.getBundle();
    const bad = structuredClone(await readCuratedBundle(root));
    (bad.provenance as Record<string, unknown>).testRunId = randomUUID();
    bad.heroes.heroes[1].slug = bad.heroes.heroes[0].slug;
    await expect(archive.importBundle(bad, 'constraint-failure')).rejects.toThrow();
    expect(await archive.status()).toEqual(previous);
    expect(await archive.getBundle()).toEqual(original);
  });

  it('keeps previous versions and enforces formula-source references', async () => {
    const previous = await archive.status();
    const bundle = await readCuratedBundle(root);
    (bundle.provenance as Record<string, unknown>).testRunId = randomUUID();
    const result = await archive.importBundle(bundle, 'history-check');
    expect(result.snapshotId).not.toBe(previous.currentSnapshotId);
    const retained = await pool.query(
      'SELECT count(*)::int AS n FROM heroes WHERE snapshot_id = $1',
      [previous.currentSnapshotId],
    );
    expect(retained.rows[0].n).toBe(previous.heroes);
    const run = await pool.query(
      'SELECT count(*)::int AS n FROM archive_import_runs WHERE snapshot_id = $1',
      [result.snapshotId],
    );
    expect(run.rows[0].n).toBe(1);
    await expect(
      pool.query(
        `INSERT INTO mechanics_formula_sources
      (snapshot_id, language, formula_id, ordinal, source_id) VALUES ($1, $2, $3, $4, $5)`,
        [result.snapshotId, 'ru', bundle.mechanics.ru.formulas[0].id, 999, 'nonexistent-source'],
      ),
    ).rejects.toMatchObject({ code: '23503' });
    expect((await archive.getHistory())?.versions).toEqual(bundle.history.versions);
  });

  it('imports a newer hero patch while retaining older mechanics review metadata', async () => {
    const bundle = await readCuratedBundle(root);
    const futureClient = bundle.heroes.meta.clientVersion + 1;
    const reviewedClient = bundle.mechanics.en.meta.reviewedClientVersion;
    const futureBuildDate = new Date(Date.parse(bundle.heroes.meta.buildDate) + 86_400_000)
      .toISOString()
      .slice(0, 10);
    const publishedAt = `${futureBuildDate}T00:00:00.000Z`;
    bundle.heroes.meta.clientVersion = futureClient;
    bundle.heroes.meta.buildDate = futureBuildDate;
    bundle.heroes.meta.sourceRevision += 1;
    bundle.heroes.meta.gameCommit = 'a'.repeat(40);
    const provenance = bundle.provenance as {
      meta: {
        clientVersion: number;
        buildDate: string;
        sourceRevision: number;
        gameCommit: string;
      };
      testRunId?: string;
    };
    provenance.meta.clientVersion = bundle.heroes.meta.clientVersion;
    provenance.meta.buildDate = bundle.heroes.meta.buildDate;
    provenance.meta.sourceRevision = bundle.heroes.meta.sourceRevision;
    provenance.meta.gameCommit = bundle.heroes.meta.gameCommit;
    provenance.testRunId = randomUUID();
    bundle.history.versions.unshift({
      clientVersion: futureClient,
      buildDate: futureBuildDate,
      firstPublishedAt: publishedAt,
      provenance: { kind: 'snapshot-save', reference: publishedAt },
    });
    const result = await archive.importBundle(bundle, 'new-hero-patch');
    expect(result.imported).toBe(true);
    expect(result.clientVersion).toBe(futureClient);
    expect(await archive.getBundle()).toEqual(bundle);
    expect((await archive.getMechanics('en'))?.meta.reviewedClientVersion).toBe(reviewedClient);
    expect((await archive.status()).currentClientVersion).toBe(futureClient);
  });

  it('refuses to move the active snapshot back to an older client', async () => {
    const previous = await archive.status();
    const oldBundle = await readCuratedBundle(root);
    expect(previous.currentClientVersion).toBe(oldBundle.heroes.meta.clientVersion + 1);
    await expect(archive.importBundle(oldBundle, 'accidental-old-files')).rejects.toThrow(
      /older|downgrade/i,
    );
    expect(await archive.status()).toEqual(previous);
  });

  it('exports one consistent state when SQL edits commit during the read', async () => {
    const before = await archive.getBundle();
    if (!before) throw new Error('Expected imported test snapshot');
    const lock = Math.floor(Math.random() * 1_000_000_000) + 1;
    const writer = await control.connect();
    let exporting: Promise<unknown> | undefined;
    try {
      // Gate catalogue reads inside PostgreSQL, after the exporter has read archive_current.
      await writer.query(
        `ALTER TABLE "${schemaName}".mechanics_catalogues RENAME TO consistency_catalogues`,
      );
      await writer.query(`CREATE VIEW "${schemaName}".mechanics_catalogues AS
        SELECT catalogue.* FROM "${schemaName}".consistency_catalogues catalogue
        CROSS JOIN (SELECT pg_advisory_xact_lock(${lock})) gate`);
      await writer.query('SELECT pg_advisory_lock($1)', [lock]);
      exporting = archive.getBundle();
      const deadline = Date.now() + 5000;
      let waiting = false;
      while (Date.now() < deadline) {
        const blocked = await writer.query<{ waiting: boolean }>(
          "SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND objid = $1 AND NOT granted) AS waiting",
          [lock],
        );
        if (blocked.rows[0].waiting) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
      await writer.query('BEGIN');
      await writer.query(
        `UPDATE "${schemaName}".heroes SET base_regen = $1 WHERE snapshot_id = (SELECT snapshot_id FROM "${schemaName}".archive_current) AND ordinal = 0`,
        [0.123456789123],
      );
      await writer.query(
        `UPDATE "${schemaName}".consistency_catalogues SET meta = jsonb_set(meta, '{title}', '"concurrent SQL edit"') WHERE snapshot_id = (SELECT snapshot_id FROM "${schemaName}".archive_current)`,
      );
      await writer.query(
        `UPDATE "${schemaName}".archive_snapshots SET provenance = jsonb_set(provenance, '{consistencyEdit}', '"concurrent SQL edit"') WHERE id = (SELECT snapshot_id FROM "${schemaName}".archive_current)`,
      );
      await writer.query('COMMIT');
      await writer.query('SELECT pg_advisory_unlock($1)', [lock]);
      expect(await exporting).toEqual(before);
      const after = await archive.getBundle();
      expect(after?.heroes.heroes[0].base.regen).toBe(0.123456789123);
      expect(after?.mechanics.ru.meta.title).toBe('concurrent SQL edit');
      expect(after?.mechanics.en.meta.title).toBe('concurrent SQL edit');
      expect(after?.provenance).toHaveProperty('consistencyEdit', 'concurrent SQL edit');
    } finally {
      await writer.query('ROLLBACK');
      await writer.query('SELECT pg_advisory_unlock_all()');
      await exporting?.catch(() => {});
      await writer.query(`DROP VIEW IF EXISTS "${schemaName}".mechanics_catalogues`);
      await writer.query(
        `ALTER TABLE "${schemaName}".consistency_catalogues RENAME TO mechanics_catalogues`,
      );
      writer.release();
    }
  });
});
