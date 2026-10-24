import { afterAll, beforeAll, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { connect } from 'node:net';
import { spawn } from 'node:child_process';
import snapshot from '../data/heroes.json';
import type { HeroSnapshot } from '../shared/types';
import { createApp } from './app';

const app = createApp(snapshot as HeroSnapshot);
let base: string;
beforeAll(async () => {
  await new Promise<void>((resolve) => app.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
});
afterAll(
  () =>
    new Promise<void>((resolve, reject) =>
      app.close((error) => (error ? reject(error) : resolve())),
    ),
);
it('serves the same verified snapshot without a database', async () => {
  const response = await fetch(`${base}/api/heroes`);
  expect(response.status).toBe(200);
  expect((await response.json()).heroes).toHaveLength(44);
});
it('reports the data version in health', async () => {
  expect(await (await fetch(`${base}/api/health`)).json()).toMatchObject({
    status: 'ok',
    clientVersion: 6819,
  });
});
it('returns explicit 404 and rejects writes', async () => {
  expect((await fetch(`${base}/missing`)).status).toBe(404);
  expect((await fetch(`${base}/api/heroes`, { method: 'POST' })).status).toBe(405);
});
it('returns 400 for a malformed request target and keeps serving', async () => {
  // Isolate the process so an uncaught request-handler exception is observable.
  const child = spawn(
    process.execPath,
    [
      '--import',
      'tsx',
      '--input-type=module',
      '-e',
      `
    import { readFileSync } from 'node:fs';
    import { createApp } from './server/app.ts';
    const app = createApp(JSON.parse(readFileSync('data/heroes.json', 'utf8')));
    app.listen(0, '127.0.0.1', () => console.log(app.address().port));
  `,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  );
  try {
    const port = await new Promise<number>((resolve, reject) => {
      child.stdout.once('data', (chunk) => resolve(Number(chunk.toString().trim())));
      child.once('error', reject);
      child.once('exit', (code) => reject(new Error(`API exited: ${code}`)));
    });
    const raw = await new Promise<string>((resolve, reject) => {
      const socket = connect(port, '127.0.0.1', () =>
        socket.write('GET // HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n'),
      );
      let response = '';
      socket.on('data', (chunk) => {
        response += chunk.toString();
      });
      socket.on('end', () => resolve(response));
      socket.on('error', reject);
    });
    expect(raw).toMatch(/^HTTP\/1.1 400 /);
    expect((await fetch(`http://127.0.0.1:${port}/api/health`)).status).toBe(200);
  } finally {
    child.kill();
  }
});
