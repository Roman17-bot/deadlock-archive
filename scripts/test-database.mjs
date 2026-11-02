import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
let directory;
let envFile = process.env.DEADLOCK_TEST_ENV_FILE ?? path.join(root, '.env.local');
try {
  if (!existsSync(envFile)) {
    directory = await mkdtemp(path.join(tmpdir(), 'deadlock-owned-db-'));
    envFile = path.join(directory, 'test.env');
    const keys = ['HOST', 'PORT', 'NAME', 'TEST_NAME', 'USER', 'PASSWORD'];
    if (keys.some((key) => !process.env['DEADLOCK_DB_' + key]))
      throw Error('Test database configuration is missing');
    await writeFile(
      envFile,
      keys.map((key) => `DEADLOCK_DB_${key}=${process.env['DEADLOCK_DB_' + key]}`).join('\n'),
      { mode: 0o600 },
    );
  }
  const child = spawn(
    'dotnet',
    [
      'test',
      'backend/Deadlock.Tests',
      '--artifacts-path',
      'work/dotnet-tests',
      '--nologo',
      '--filter',
      'FullyQualifiedName~DataSyncTests',
    ],
    {
      cwd: root,
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
      env: { ...process.env, DEADLOCK_TEST_ENV_FILE: envFile },
    },
  );
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
} finally {
  if (directory) {
    await unlink(envFile).catch(() => {});
    await rmdir(directory);
  }
}
