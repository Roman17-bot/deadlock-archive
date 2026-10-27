import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));

it('finishes a data-writing job without restarting, while still watching server source', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'deadlock-update-watch-'));
  let child: ChildProcess | undefined;
  let output = '';
  const waitFor = async (pattern: RegExp, timeout = 6000) => {
    const deadline = Date.now() + timeout;
    while (!pattern.test(output)) {
      if (Date.now() > deadline) throw new Error(`Watch event missing: ${pattern}\n${output}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };
  try {
    await mkdir(path.join(directory, 'server'));
    await mkdir(path.join(directory, 'data'));
    await writeFile(path.join(directory, 'package.json'), '{"type":"module"}');
    await writeFile(path.join(directory, 'data/version-history.json'), '{"version":1}');
    const source = `
import history from '../data/version-history.json';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
console.log('WATCH_READY ' + process.pid + ' ' + history.version);
setInterval(() => {
  if (!existsSync('run-update')) return;
  unlinkSync('run-update');
  writeFileSync('data/version-history.json', JSON.stringify({version:2}));
  setTimeout(() => console.log('UPDATE_COMPLETED ' + process.pid), 900);
}, 30);
`;
    await writeFile(path.join(directory, 'server/index.ts'), source);
    const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    const [executable, ...args] = manifest.scripts['dev:api'].split(' ');
    expect(executable).toBe('tsx');
    child = spawn(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), ...args], {
      cwd: directory,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    child.stdout!.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr!.on('data', (chunk) => {
      output += chunk.toString();
    });
    await waitFor(/WATCH_READY \d+ 1/);
    const initialPid = output.match(/WATCH_READY (\d+) 1/)![1];
    await writeFile(path.join(directory, 'run-update'), '');
    await waitFor(new RegExp(`UPDATE_COMPLETED ${initialPid}`), 3500);
    expect(output.match(/WATCH_READY/g)).toHaveLength(1);
    await writeFile(path.join(directory, 'server/index.ts'), source + '\n// source changed\n');
    await waitFor(/WATCH_READY \d+ 2/);
    expect(output.match(/WATCH_READY (\d+) 2/)![1]).not.toBe(initialPid);
  } finally {
    if (child?.pid) {
      if (process.platform === 'win32') {
        await new Promise<void>((resolve) =>
          execFile(
            'taskkill',
            ['/PID', String(child!.pid), '/T', '/F'],
            { windowsHide: true },
            () => resolve(),
          ),
        );
      } else {
        child.kill('SIGTERM');
        await new Promise<void>((resolve) => {
          if (child!.exitCode !== null) return resolve();
          child!.once('exit', () => resolve());
        });
      }
    }
    if (
      path.dirname(directory) !== path.resolve(tmpdir()) ||
      !path.basename(directory).startsWith('deadlock-update-watch-')
    )
      throw new Error('Unexpected test directory');
    await rm(directory, { recursive: true, force: true });
  }
}, 20_000);
