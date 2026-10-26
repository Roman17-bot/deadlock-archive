import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { Pool } from 'pg';

export const ARCHIVE_LOCK: [number, number] = [14981747, 20261025];
const migrationsDir = fileURLToPath(new URL('../../db/migrations/', import.meta.url));

export async function migrateArchive(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', ARCHIVE_LOCK);
    await client.query(`CREATE TABLE IF NOT EXISTS archive_migrations (
      version text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const files = (await readdir(migrationsDir))
      .filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name))
      .sort();
    for (const file of files) {
      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const result = await client.query<{ checksum: string }>(
        'SELECT checksum FROM archive_migrations WHERE version = $1',
        [file],
      );
      if (result.rows.length) {
        if (result.rows[0].checksum !== checksum)
          throw new Error(`Migration checksum mismatch: ${file}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO archive_migrations (version, checksum) VALUES ($1, $2)', [
        file,
        checksum,
      ]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
