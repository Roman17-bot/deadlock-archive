import { afterAll, beforeAll, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { connect } from 'node:net';
import { spawn } from 'node:child_process';
import snapshot from '../data/heroes.json';
import type { HeroSnapshot } from '../shared/types';
import { createApp } from './app';
import { createUpdateManager } from './updates/manager';

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

it('connects the local owner API to the live hero and health responses', async () => {
  const next = structuredClone(snapshot) as HeroSnapshot;
  next.meta.clientVersion = 6820;
  const updates = createUpdateManager({
    snapshot: snapshot as HeroSnapshot,
    root: '.',
    refresh: async () => ({
      snapshot: next,
      changed: true,
      checkedAt: '2026-10-25T10:00:00Z',
      sourceCommit: next.meta.gameCommit,
      summary: { heroCount: 44, added: 0, removed: 0, updated: 1, text: 'Updated' },
    }),
  });
  const managed = createApp(snapshot as HeroSnapshot, { updates });
  await new Promise<void>((resolve) => managed.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(managed.address() as AddressInfo).port}`;
  try {
    const sessionResponse = await fetch(`${url}/api/update/session`);
    expect(sessionResponse.status).toBe(200);
    const session = await sessionResponse.json();
    expect(
      (
        await fetch(`${url}/api/update`, {
          method: 'POST',
          headers: {
            Origin: 'http://127.0.0.1:5173',
            'Content-Type': 'application/json',
            'X-Archive-Token': session.token,
          },
          body: JSON.stringify({ publish: false }),
        })
      ).status,
    ).toBe(202);
    await vi.waitFor(() => expect(updates.getState().phase).toBe('succeeded'));
    expect((await (await fetch(`${url}/api/heroes`)).json()).meta.clientVersion).toBe(6820);
    expect((await (await fetch(`${url}/api/health`)).json()).clientVersion).toBe(6820);
  } finally {
    await new Promise<void>((resolve) => managed.close(() => resolve()));
  }
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
