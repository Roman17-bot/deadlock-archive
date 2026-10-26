import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabasePool, loadDatabaseEnvironment } from '../../server/database/config';

const temporary: string[] = [];
function rootWithConfig(text: string): string {
  const root = mkdtempSync(join(tmpdir(), 'deadlock-db-config-'));
  temporary.push(root);
  writeFileSync(join(root, '.env.local'), text);
  return root;
}

afterEach(() => {
  for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('local PostgreSQL configuration', () => {
  const valid =
    'DEADLOCK_DB_HOST=127.0.0.1\nDEADLOCK_DB_PORT=5432\nDEADLOCK_DB_NAME=deadlock_archive\nDEADLOCK_DB_USER=deadlock_archive_app\nDEADLOCK_DB_PASSWORD=local-secret\n';

  it('treats absent configuration as portable JSON mode', () => {
    expect(loadDatabaseEnvironment(rootWithConfig('OTHER_SETTING=yes\n'), {})).toBeNull();
  });

  it('loads ignored local settings while honoring explicit process settings', async () => {
    const config = loadDatabaseEnvironment(rootWithConfig(valid), { DEADLOCK_DB_PORT: '5433' });
    expect(config).toEqual({
      host: '127.0.0.1',
      port: 5433,
      database: 'deadlock_archive',
      user: 'deadlock_archive_app',
      password: 'local-secret',
    });
    const pool = createDatabasePool(config!);
    expect(pool.options.max).toBe(5);
    expect(pool.options.connectionTimeoutMillis).toBe(5000);
    await pool.end();
  });

  it('rejects incomplete, remote, and invalid port settings before connecting', () => {
    expect(() =>
      loadDatabaseEnvironment(rootWithConfig('DEADLOCK_DB_HOST=127.0.0.1\n'), {}),
    ).toThrow('Incomplete');
    expect(() =>
      loadDatabaseEnvironment(rootWithConfig(valid.replace('127.0.0.1', 'db.example.com')), {}),
    ).toThrow('local');
    expect(() =>
      loadDatabaseEnvironment(rootWithConfig(valid.replace('5432', '70000')), {}),
    ).toThrow('PORT');
  });

  it('handles a lost idle connection without crashing or logging private diagnostics', async () => {
    const config = loadDatabaseEnvironment(rootWithConfig(valid), {});
    const pool = createDatabasePool(config!);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => pool.emit('error', new Error('private-connection-diagnostic'))).not.toThrow();
      expect(log).toHaveBeenCalledWith(
        'PostgreSQL connection lost; a new connection will be attempted on the next request.',
      );
    } finally {
      await pool.end();
      log.mockRestore();
    }
  });
});
