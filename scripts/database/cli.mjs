#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, open, rename, unlink, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { Pool } from 'pg';
import { createDatabasePool, loadDatabaseEnvironment } from '../../server/database/config.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DB_NAME = 'deadlock_archive';
const TEST_DB_NAME = 'deadlock_archive_test';
const APP_ROLE = 'deadlock_archive_app';
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 5432;
const CONFIG_KEYS = [
  'DEADLOCK_DB_HOST',
  'DEADLOCK_DB_PORT',
  'DEADLOCK_DB_NAME',
  'DEADLOCK_DB_TEST_NAME',
  'DEADLOCK_DB_USER',
  'DEADLOCK_DB_PASSWORD',
];

function allowedName(name) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) throw new Error('Invalid database identifier');
  return name;
}

function quoteLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function readPassword() {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error('Setup requires an interactive terminal for the masked admin password prompt');
  }
  return await new Promise((resolvePassword, rejectPassword) => {
    let value = '';
    process.stdout.write('PostgreSQL postgres password: ');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const restore = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const onData = (chunk) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\r' || char === '\n') {
          restore();
          resolvePassword(value);
          return;
        }
        if (char === '\u0003') {
          restore();
          rejectPassword(new Error('Setup cancelled'));
          return;
        }
        if (char === '\u007f' || char === '\b') {
          if (value) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (char >= ' ' && char !== '\u007f') {
          value += char;
          process.stdout.write('*');
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

async function writeLocalConfig(password) {
  const target = join(ROOT, '.env.local');
  const previous = existsSync(target) ? readFileSync(target, 'utf8') : '';
  const parsed = previous ? parseEnv(previous) : {};
  if (CONFIG_KEYS.some((key) => parsed[key] !== undefined)) {
    throw new Error('.env.local already has database settings; setup will not overwrite them');
  }
  const content = `${previous}${previous && !previous.endsWith('\n') ? '\n' : ''}\n# Local PostgreSQL archive; keep this file private.\nDEADLOCK_DB_HOST=${DEFAULT_HOST}\nDEADLOCK_DB_PORT=${DEFAULT_PORT}\nDEADLOCK_DB_NAME=${DB_NAME}\nDEADLOCK_DB_TEST_NAME=${TEST_DB_NAME}\nDEADLOCK_DB_USER=${APP_ROLE}\nDEADLOCK_DB_PASSWORD=${password}\n`;
  const temp = `${target}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(temp, content, { mode: 0o600, flag: 'wx' });
  try {
    await rename(temp, target);
  } catch (error) {
    await unlink(temp).catch(() => {});
    throw error;
  }
}

async function setup(args) {
  const skipImport = args.includes('--no-import');
  if (args.some((arg) => arg !== '--no-import')) throw new Error('Usage: db:setup [--no-import]');
  const existingConfig = loadDatabaseEnvironment(ROOT);
  if (
    existingConfig &&
    (existingConfig.database !== DB_NAME ||
      existingConfig.user !== APP_ROLE ||
      existingConfig.host !== DEFAULT_HOST ||
      existingConfig.port !== DEFAULT_PORT)
  ) {
    throw new Error('Existing database configuration differs from the dedicated local archive');
  }
  const adminPassword = await readPassword();
  const admin = new Pool({
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    database: 'postgres',
    user: 'postgres',
    password: adminPassword,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  try {
    const role = await admin.query(
      'SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication FROM pg_roles WHERE rolname = $1',
      [APP_ROLE],
    );
    const db = await admin.query(
      'SELECT datname, pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = $1',
      [DB_NAME],
    );
    const testDb = await admin.query(
      'SELECT datname, pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = $1',
      [TEST_DB_NAME],
    );
    if (
      role.rowCount &&
      (role.rows[0].rolsuper ||
        role.rows[0].rolcreatedb ||
        role.rows[0].rolcreaterole ||
        role.rows[0].rolreplication)
    ) {
      throw new Error('Existing application role has elevated privileges; inspect it manually');
    }
    if (db.rowCount && db.rows[0].owner !== APP_ROLE) {
      throw new Error('Existing archive database has a different owner; inspect it manually');
    }
    if (testDb.rowCount && testDb.rows[0].owner !== APP_ROLE) {
      throw new Error('Existing test database has a different owner; inspect it manually');
    }
    if (Boolean(role.rowCount) !== Boolean(db.rowCount)) {
      throw new Error('Archive role/database state is incomplete; inspect it manually');
    }
    if (role.rowCount && !existingConfig) {
      throw new Error(
        'Archive exists but application credentials are missing; setup will not reset the role',
      );
    }
    if (!role.rowCount && existingConfig) {
      throw new Error(
        'Application credentials exist but archive database is missing; setup will not overwrite configuration',
      );
    }
    if (!role.rowCount) {
      const appPassword = randomBytes(36).toString('base64url');
      await admin.query(
        `CREATE ROLE ${allowedName(APP_ROLE)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD ${quoteLiteral(appPassword)}`,
      );
      await admin.query(`CREATE DATABASE ${allowedName(DB_NAME)} OWNER ${allowedName(APP_ROLE)}`);
      await admin.query(`REVOKE CONNECT ON DATABASE ${allowedName(DB_NAME)} FROM PUBLIC`);
      if (!testDb.rowCount) {
        await admin.query(
          `CREATE DATABASE ${allowedName(TEST_DB_NAME)} OWNER ${allowedName(APP_ROLE)}`,
        );
        await admin.query(`REVOKE CONNECT ON DATABASE ${allowedName(TEST_DB_NAME)} FROM PUBLIC`);
      }
      await writeLocalConfig(appPassword);
      console.log(
        'Created restricted application role and archive databases; saved local application credentials.',
      );
    } else {
      if (!testDb.rowCount) {
        await admin.query(
          `CREATE DATABASE ${allowedName(TEST_DB_NAME)} OWNER ${allowedName(APP_ROLE)}`,
        );
        await admin.query(`REVOKE CONNECT ON DATABASE ${allowedName(TEST_DB_NAME)} FROM PUBLIC`);
      }
      console.log('Existing archive role and database preserved.');
    }
  } finally {
    await admin.end();
  }
  if (!skipImport) {
    await migrate();
    await importBundle();
  }
}

function configuredPool() {
  const config = loadDatabaseEnvironment(ROOT);
  if (!config) throw new Error('Database is not configured. Run npm run db:setup first.');
  return createDatabasePool(config);
}

async function withArchive(task) {
  const pool = configuredPool();
  const { PostgresArchive } = await import('../../server/database/repository.ts');
  const archive = new PostgresArchive(pool);
  try {
    return await task(archive);
  } finally {
    await archive.close();
  }
}

async function migrate() {
  await withArchive(async (archive) => {
    await archive.migrate();
    console.log('Migrations applied.');
  });
}

async function importBundle() {
  await withArchive(async (archive) => {
    await archive.migrate();
    const { readCuratedBundle } = await import('../../server/database/bundle.ts');
    const result = await archive.importBundle(await readCuratedBundle(ROOT), 'cli');
    console.log(JSON.stringify(result));
  });
}

async function status() {
  await withArchive(async (archive) => {
    console.log(JSON.stringify(await archive.status(), null, 2));
  });
}

function reviewDirectory(argument) {
  const base = resolve(ROOT, 'work', 'database-review');
  const target = resolve(ROOT, argument ?? 'work/database-review/latest');
  if (target !== base && !target.startsWith(base + sep)) {
    throw new Error('Export directory must be inside work/database-review');
  }
  return target;
}

async function exportBundle(args) {
  if (args.length > 1) throw new Error('Usage: db:export [work/database-review/name]');
  const directory = reviewDirectory(args[0]);
  if (existsSync(directory))
    throw new Error('Export directory already exists; choose a new review directory');
  await withArchive(async (archive) => {
    const bundle = await archive.getBundle();
    if (!bundle) throw new Error('Archive is empty');
    await mkdir(directory, { recursive: true });
    const files = [
      ['heroes.json', bundle.heroes],
      ['mechanics.json', bundle.mechanics.ru],
      ['mechanics.en.json', bundle.mechanics.en],
      ['provenance.json', bundle.provenance],
      ['version-history.json', bundle.history],
      ...(bundle.items
        ? [
            ['items.json', bundle.items],
            ['item-statistics.json', bundle.itemStatistics],
          ]
        : []),
    ];
    for (const [name, value] of files) {
      await writeFile(join(directory, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    }
    console.log(`Exported review bundle to ${directory}`);
  });
}

function pgDumpPath() {
  if (process.platform === 'win32') {
    const path = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe';
    if (existsSync(path)) return path;
  }
  return 'pg_dump';
}

async function backup() {
  const config = loadDatabaseEnvironment(ROOT);
  if (!config) throw new Error('Database is not configured. Run npm run db:setup first.');
  const directory = join(ROOT, 'work', 'backups', 'postgresql');
  await mkdir(directory, { recursive: true });
  const filename = `deadlock_archive_${new Date().toISOString().replace(/[:.]/g, '-')}.dump`;
  const target = join(directory, filename);
  const handle = await open(target, 'wx', 0o600);
  await handle.close();
  try {
    await new Promise((resolveBackup, rejectBackup) => {
      const child = spawn(
        pgDumpPath(),
        [
          '--format=custom',
          '--no-owner',
          '--no-acl',
          '--host',
          config.host,
          '--port',
          String(config.port),
          '--username',
          config.user,
          '--dbname',
          config.database,
          '--file',
          target,
        ],
        {
          shell: false,
          windowsHide: true,
          env: { ...process.env, PGPASSWORD: config.password },
          stdio: ['ignore', 'ignore', 'pipe'],
        },
      );
      let diagnostic = '';
      child.stderr.on('data', (chunk) => {
        diagnostic = (diagnostic + chunk.toString()).slice(-2000);
      });
      child.once('error', rejectBackup);
      child.once('close', (code) =>
        code === 0
          ? resolveBackup()
          : rejectBackup(
              new Error(
                `pg_dump failed (${code}): ${diagnostic.replaceAll(config.password, '[redacted]')}`,
              ),
            ),
      );
    });
    console.log(`Private backup saved to ${target}`);
  } catch (error) {
    await unlink(target).catch(() => {});
    throw error;
  }
}

async function query(args) {
  const [kind, ...terms] = args;
  await withArchive(async (archive) => {
    let result;
    if (kind === 'status' && terms.length === 0) result = await archive.status();
    else if (kind === 'history' && terms.length === 0) {
      const history = await archive.getHistory();
      result = history && {
        ...history,
        versions: [...history.versions]
          .sort((a, b) => b.clientVersion - a.clientVersion)
          .slice(0, 20),
      };
    } else if (kind === 'hero' && terms.length === 1 && terms[0].length <= 100)
      result = await archive.searchHeroes(terms[0], 20);
    else if (kind === 'item' && terms.length === 1 && terms[0].length <= 100) {
      const catalog = await archive.getItems();
      const term = terms[0].trim().toLocaleLowerCase();
      result =
        catalog?.items
          .filter((item) =>
            `${item.name} ${item.slug} ${item.localizedName.ru} ${item.localizedName.en}`
              .toLocaleLowerCase()
              .includes(term),
          )
          .slice(0, 20) ?? [];
    } else if (
      kind === 'formula' &&
      (terms.length === 1 || terms.length === 2) &&
      terms[0].length <= 100 &&
      (!terms[1] || ['ru', 'en'].includes(terms[1]))
    )
      result = await archive.getFormula(terms[0], terms[1] ?? 'ru');
    else
      throw new Error(
        'Usage: db:query status|history|hero <name>|item <name>|formula <id> [ru|en]',
      );
    console.log(JSON.stringify(result, null, 2));
  });
}

async function testDatabase() {
  const config = loadDatabaseEnvironment(ROOT);
  if (!config) throw new Error('Database is not configured. Run npm run db:setup first.');
  let local = {};
  try {
    local = parseEnv(readFileSync(join(ROOT, '.env.local'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const testName = process.env.DEADLOCK_DB_TEST_NAME ?? local.DEADLOCK_DB_TEST_NAME;
  if (
    !testName ||
    !/^deadlock_archive_test(?:_[a-z0-9]+)?$/.test(testName) ||
    testName === config.database
  ) {
    throw new Error(
      'Refusing integration tests without a distinct dedicated DEADLOCK_DB_TEST_NAME',
    );
  }
  const testFiles = [
    join(ROOT, 'server', 'database', 'repository.integration.test.ts'),
    join(ROOT, 'server', 'database', 'bundle.test.ts'),
  ];
  const vitest = join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
  if (testFiles.some((file) => !existsSync(file)) || !existsSync(vitest))
    throw new Error('Database tests or local Vitest installation are missing');
  await new Promise((resolveTest, rejectTest) => {
    const child = spawn(process.execPath, [vitest, 'run', ...testFiles], {
      cwd: ROOT,
      shell: false,
      windowsHide: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        DEADLOCK_DB_HOST: config.host,
        DEADLOCK_DB_PORT: String(config.port),
        DEADLOCK_DB_NAME: config.database,
        DEADLOCK_DB_TEST_NAME: testName,
        DEADLOCK_DB_USER: config.user,
        DEADLOCK_DB_PASSWORD: config.password,
      },
    });
    child.once('error', rejectTest);
    child.once('close', (code) =>
      code === 0 ? resolveTest() : rejectTest(new Error(`Integration tests failed (${code})`)),
    );
  });
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'setup') await setup(args);
  else if (command === 'migrate' && !args.length) await migrate();
  else if (command === 'import' && !args.length) await importBundle();
  else if (command === 'status' && !args.length) await status();
  else if (command === 'export') await exportBundle(args);
  else if (command === 'backup' && !args.length) await backup();
  else if (command === 'query') await query(args);
  else if (command === 'test' && !args.length) await testDatabase();
  else
    throw new Error('Usage: database/cli.mjs setup|migrate|import|status|export|backup|query|test');
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  let config;
  try {
    config = loadDatabaseEnvironment(ROOT);
  } catch {
    config = null;
  }
  const scrubbed = config?.password ? message.replaceAll(config.password, '[redacted]') : message;
  console.error(
    `Database command failed: ${scrubbed.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')}`,
  );
  process.exitCode = 1;
}
