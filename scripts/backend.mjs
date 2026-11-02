import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Node starts the native owner CLI; no data/API logic lives in this launcher.
export async function runBackend(command, args = []) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const child = spawn(
    'dotnet',
    ['run', '--project', 'backend/Deadlock.Api', '--no-launch-profile', '--', command, ...args],
    {
      cwd: root,
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
    },
  );
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
  return await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await runBackend(process.argv[2] ?? 'serve', process.argv.slice(3));
}
