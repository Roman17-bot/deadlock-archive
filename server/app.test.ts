import { afterAll, beforeAll, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
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
