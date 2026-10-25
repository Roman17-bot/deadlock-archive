import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, request } from 'node:http';
import type { AddressInfo } from 'node:net';
import original from '../../data/heroes.json';
import type { HeroSnapshot } from '../../shared/types';
import { createUpdateManager } from './manager';
import { handleUpdateRequest } from './http';

const origin = 'http://127.0.0.1:5173';
let manager: ReturnType<typeof createUpdateManager>;
let app: ReturnType<typeof createServer>;
let port: number;
let release: (() => void) | undefined;
beforeEach(async () => {
  manager = createUpdateManager({
    snapshot: original as HeroSnapshot,
    root: '.',
    refresh: async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return {
        snapshot: original as HeroSnapshot,
        changed: false,
        checkedAt: new Date().toISOString(),
        sourceCommit: 'a'.repeat(40),
        summary: { heroCount: 44, added: 0, removed: 0, updated: 0, text: 'Current' },
      };
    },
  });
  app = createServer((req, res) => {
    void handleUpdateRequest(req, res, manager).then((handled) => {
      if (!handled) res.writeHead(404).end();
    });
  });
  await new Promise<void>((resolve) => app.listen(0, '127.0.0.1', resolve));
  port = (app.address() as AddressInfo).port;
});
afterEach(async () => {
  release?.();
  release = undefined;
  await new Promise<void>((resolve) => app.close(() => resolve()));
});

function send(
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
) {
  return new Promise<{ status: number; body: string; headers: Record<string, unknown> }>(
    (resolve, reject) => {
      const req = request(
        {
          host: '127.0.0.1',
          port,
          path,
          method: options.method ?? 'GET',
          headers: options.headers,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => resolve({ status: res.statusCode!, body, headers: res.headers }));
        },
      );
      req.on('error', reject);
      req.end(options.body);
    },
  );
}
const post = (headers = {}, body = '{"publish":false}') =>
  send('/api/update', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'X-Archive-Token': manager.getSessionToken(),
      ...headers,
    },
    body,
  });

describe('loopback owner update HTTP boundary', () => {
  it('issues a same-origin session, exposes status without nonce and supports HEAD', async () => {
    const session = await send('/api/update/session');
    expect(session.status).toBe(200);
    expect(JSON.parse(session.body)).toMatchObject({
      token: manager.getSessionToken(),
      state: { phase: 'idle' },
    });
    const status = await send('/api/update/status', { headers: { Origin: origin } });
    expect(status.status).toBe(200);
    expect(status.body).not.toContain(manager.getSessionToken());
    expect(status.headers['access-control-allow-origin']).toBe(origin);
    expect(status.headers['cache-control']).toBe('no-store');
    expect((await send('/api/update/status', { method: 'HEAD' })).body).toBe('');
  });
  it.each([
    'https://roman17-bot.github.io',
    'null',
    'http://evil.test:5173',
    'http://127.0.0.1:5174',
    'http://localhost:5173.evil.test',
  ])('rejects foreign Origin %s without issuing a nonce or CORS grant', async (foreign) => {
    const response = await send('/api/update/session', { headers: { Origin: foreign } });
    expect(response.status).toBe(403);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.body).not.toContain(manager.getSessionToken());
    expect((await post({ Origin: foreign })).status).toBe(403);
  });
  it.each([
    'evil.test',
    '127.0.0.1.evil.test:5173',
    'localhost:abc',
    'localhost:65536',
    'localhost:0',
    '[::1]:5173',
  ])('rejects invalid Host %s', async (host) => {
    expect((await send('/api/update/session', { headers: { Host: host } })).status).toBe(403);
    expect((await post({ Host: host })).status).toBe(403);
  });
  it('rejects cross-site fetch metadata, missing POST Origin and wrong nonce', async () => {
    expect(
      (await send('/api/update/session', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status,
    ).toBe(403);
    expect(
      (
        await send('/api/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Archive-Token': manager.getSessionToken(),
          },
          body: '{"publish":false}',
        })
      ).status,
    ).toBe(403);
    expect((await post({ 'X-Archive-Token': 'invalid' })).status).toBe(403);
    expect(manager.getState().phase).toBe('idle');
  });
  it('rejects unsupported content type, malformed JSON, extra keys and oversized bodies', async () => {
    expect((await post({ 'Content-Type': 'text/plain' })).status).toBe(415);
    for (const body of ['{', '{"publish":"yes"}', '{}', '{"publish":false,"workflow":"other"}'])
      expect((await post({}, body)).status).toBe(400);
    expect((await post({}, ' '.repeat(5000))).status).toBe(413);
    expect(manager.getState().phase).toBe('idle');
  });
  it('accepts only authenticated local jobs and returns a conflict while one is running', async () => {
    const response = await post();
    expect(response.status).toBe(202);
    expect(JSON.parse(response.body).phase).toBe('checking');
    expect((await post()).status).toBe(409);
  });
  it('allows only the exact local preflight and declines unrelated paths', async () => {
    const good = await send('/api/update', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(good.status).toBe(204);
    expect(good.headers['access-control-allow-headers']).toContain('X-Archive-Token');
    expect(
      (
        await send('/api/update', {
          method: 'OPTIONS',
          headers: { Origin: 'https://roman17-bot.github.io' },
        })
      ).status,
    ).toBe(403);
    expect(
      (await send('/api/update/session', { method: 'POST', headers: { Origin: origin } })).status,
    ).toBe(405);
    expect((await send('/other')).status).toBe(404);
  });
});
