import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { Pool } from 'pg';

export interface DatabaseEnvironment {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

const KEYS = [
  'DEADLOCK_DB_HOST',
  'DEADLOCK_DB_PORT',
  'DEADLOCK_DB_NAME',
  'DEADLOCK_DB_USER',
  'DEADLOCK_DB_PASSWORD',
] as const;

/** Process environment wins over the ignored local file. No config means JSON mode. */
export function loadDatabaseEnvironment(
  root: string,
  environment: NodeJS.ProcessEnv = process.env,
): DatabaseEnvironment | null {
  let local: Record<string, string | undefined> = {};
  try {
    local = parseEnv(readFileSync(join(root, '.env.local'), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error('Cannot read .env.local', { cause: error });
    }
  }
  const values = Object.fromEntries(
    KEYS.map((key) => [key, environment[key] ?? local[key]]),
  ) as Record<(typeof KEYS)[number], string | undefined>;
  if (KEYS.every((key) => values[key] === undefined)) return null;
  if (KEYS.some((key) => !values[key])) {
    throw new Error('Incomplete DEADLOCK_DB_* configuration');
  }
  const host = values.DEADLOCK_DB_HOST!;
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error('DEADLOCK_DB_HOST must be local');
  }
  const port = Number(values.DEADLOCK_DB_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid DEADLOCK_DB_PORT');
  }
  const database = values.DEADLOCK_DB_NAME!;
  const user = values.DEADLOCK_DB_USER!;
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(database) || !/^[a-z_][a-z0-9_]{0,62}$/.test(user)) {
    throw new Error('Invalid DEADLOCK_DB_NAME or DEADLOCK_DB_USER');
  }
  return { host, port, database, user, password: values.DEADLOCK_DB_PASSWORD! };
}

export function createDatabasePool(config: DatabaseEnvironment): Pool {
  const pool = new Pool({
    ...config,
    max: 5,
    min: 0,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 15000,
    query_timeout: 20000,
    application_name: 'deadlock_archive',
  });
  // An idle client can lose its connection independently of an HTTP request.
  pool.on('error', () => {
    console.error(
      'PostgreSQL connection lost; a new connection will be attempted on the next request.',
    );
  });
  return pool;
}
