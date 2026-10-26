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
    expect(count.rows[0].n).toBe(44);
  });

  it('rejects invalid import without changing current pointers', async () => {
    const previous = await archive.status();
    const bad = structuredClone(await readCuratedBundle(root));
    bad.mechanics.ru.formulas[0].sourceIds = ['missing-source'];
    await expect(archive.importBundle(bad)).rejects.toThrow();
    expect(await archive.status()).toEqual(previous);
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
    expect(retained.rows[0].n).toBe(44);
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
    bundle.heroes.meta.clientVersion = 6820;
    bundle.heroes.meta.buildDate = '2026-10-26';
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
      clientVersion: 6820,
      buildDate: '2026-10-26',
      firstPublishedAt: '2026-10-26T00:00:00.000Z',
      provenance: { kind: 'snapshot-save', reference: '2026-10-26T00:00:00.000Z' },
    });
    const result = await archive.importBundle(bundle, 'new-hero-patch');
    expect(result.imported).toBe(true);
    expect(result.clientVersion).toBe(6820);
    expect(await archive.getBundle()).toEqual(bundle);
    expect((await archive.getMechanics('en'))?.meta.reviewedClientVersion).toBe(6819);
    expect((await archive.status()).currentClientVersion).toBe(6820);
  });

  it('refuses to move the active snapshot back to an older client', async () => {
    const previous = await archive.status();
    expect(previous.currentClientVersion).toBe(6820);
    const oldBundle = await readCuratedBundle(root);
    await expect(archive.importBundle(oldBundle, 'accidental-old-files')).rejects.toThrow(
      /older|downgrade/i,
    );
    expect(await archive.status()).toEqual(previous);
  });
});
