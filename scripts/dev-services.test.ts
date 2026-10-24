import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { waitForServices } from './dev-services.mjs';

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

async function endpoint(status: () => number) {
  const server = createServer((_request, response) => {
    response.writeHead(status()).end();
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
}

describe('development service readiness', () => {
  it('waits for the API as well as the website before resolving', async () => {
    let apiReady = false;
    const web = await endpoint(() => 200);
    const api = await endpoint(() => (apiReady ? 200 : 503));
    let finished = false;
    const ready = waitForServices([web, api], { intervalMs: 10, timeoutMs: 1000 }).then(() => {
      finished = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(finished).toBe(false);
    apiReady = true;
    await ready;
    expect(finished).toBe(true);
  });

  it('reports a service that never becomes ready', async () => {
    const api = await endpoint(() => 503);
    await expect(waitForServices([api], { intervalMs: 10, timeoutMs: 80 })).rejects.toThrow(
      'Timed out',
    );
  });

  it('stops waiting when the development processes exit', async () => {
    const api = await endpoint(() => 503);
    const controller = new AbortController();
    const ready = waitForServices([api], { intervalMs: 10, signal: controller.signal });
    controller.abort();
    await expect(ready).rejects.toMatchObject({ name: 'AbortError' });
  });
});
