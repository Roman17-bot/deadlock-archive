import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import concurrently from 'concurrently';
import { waitForServices } from './dev-services.mjs';

const website = 'http://127.0.0.1:5173/';
const api = `http://127.0.0.1:${process.env.API_PORT ?? 3001}/api/health`;
const controller = new AbortController();
const { result } = concurrently(
  [
    { name: 'WEB', command: 'vite --host 127.0.0.1', prefixColor: 'cyan' },
    { name: 'API', command: 'tsx watch server/index.ts', prefixColor: 'green' },
  ],
  { killOthersOn: ['failure', 'success'] },
);

const browserReady = waitForServices([website, api], { signal: controller.signal })
  .then(async () => {
    if (process.env.NO_OPEN === '1') return;
    const candidates = process.env.CHROME_PATH
      ? [process.env.CHROME_PATH]
      : process.platform === 'win32'
        ? [
            path.join(
              process.env.ProgramFiles ?? 'C:\\Program Files',
              'Google/Chrome/Application/chrome.exe',
            ),
            path.join(
              process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
              'Google/Chrome/Application/chrome.exe',
            ),
            path.join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
          ]
        : process.platform === 'darwin'
          ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
          : [
              '/usr/bin/google-chrome',
              '/usr/bin/google-chrome-stable',
              '/opt/google/chrome/chrome',
            ];
    let executable;
    for (const candidate of candidates) {
      try {
        await access(candidate);
        executable = candidate;
        break;
      } catch {
        /* Try the next standard location. */
      }
    }
    if (!executable) throw new Error(`Chrome не найден. Укажи CHROME_PATH или открой ${website}`);
    await new Promise((resolve, reject) => {
      const browser = spawn(executable, ['--new-tab', website], {
        detached: true,
        stdio: 'ignore',
        shell: false,
      });
      browser.once('error', reject);
      browser.once('spawn', () => {
        browser.unref();
        resolve();
      });
    });
    console.log(`\nChrome: ${website}\nСайт и API готовы. Ctrl+C остановит оба сервиса.\n`);
  })
  .catch((error) => {
    if (!controller.signal.aborted) console.error(`Автооткрытие: ${error.message}`);
  });

try {
  await result;
} catch {
  process.exitCode = 1;
} finally {
  controller.abort();
  await browserReady;
}
