import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import original from '../../data/heroes.json';
import originalHistory from '../../data/version-history.json';
import type { HeroSnapshot } from '../../shared/types';
import { createUpdateManager } from './manager';
import { handleUpdateRequest } from './http';

const origin = 'http://127.0.0.1:5173';
let manager: ReturnType<typeof createUpdateManager>;
let app: ReturnType<typeof createServer>;
let port: number;
let root: string;
let release: (() => void) | undefined;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'deadlock-history-http-'));
  await mkdir(join(root, 'data'));
  await writeFile(join(root, 'data/version-history.json'), JSON.stringify(originalHistory));
  manager = createUpdateManager({
    snapshot: original as HeroSnapshot,
    root,
    checkVersion: async () => ({ version: 6820, revision: 11162697, buildDate: '2026-10-25' }),
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
  await rm(root, { recursive: true, force: true });
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
  it('serves fresh validated history after an on-disk save without restarting the manager', async () => {
    const initial = await send('/api/version-history');
    expect(initial.status).toBe(200);
    expect(JSON.parse(initial.body)).toEqual(originalHistory);
    expect(initial.headers['cache-control']).toBe('no-store');
    expect(initial.body).not.toContain(manager.getSessionToken());
    const next = structuredClone(originalHistory);
    next.versions.unshift({ ...next.versions[0], clientVersion: 6820 });
    await writeFile(join(root, 'data/version-history.json'), JSON.stringify(next));
    const refreshed = await send('/api/version-history?path=knowledge/private.json', {
      headers: { Origin: origin },
    });
    expect(refreshed.status).toBe(200);
    expect(JSON.parse(refreshed.body)).toEqual(next);
    expect(refreshed.headers['access-control-allow-origin']).toBe(origin);
    const head = await send('/api/version-history', { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(head.body).toBe('');
    expect((await send('/api/version-history', { method: 'POST' })).status).toBe(405);
  });
  it.each(['missing', 'malformed', 'duplicate', 'oversized'])(
    'redacts %s history failures',
    async (condition) => {
      if (condition === 'missing') await rm(join(root, 'data/version-history.json'));
      if (condition === 'malformed')
        await writeFile(join(root, 'data/version-history.json'), '{private-path');
      if (condition === 'duplicate')
        await writeFile(
          join(root, 'data/version-history.json'),
          JSON.stringify({
            ...originalHistory,
            versions: [originalHistory.versions[0], originalHistory.versions[0]],
          }),
        );
      if (condition === 'oversized')
        await writeFile(join(root, 'data/version-history.json'), ' '.repeat(256_001));
      const response = await send('/api/version-history');
      expect(response.status).toBe(503);
      expect(JSON.parse(response.body)).toEqual({ error: 'Version history unavailable' });
      expect(response.body).not.toContain(root);
      expect(response.headers['cache-control']).toBe('no-store');
    },
  );
  it('protects the history route with the local read boundary', async () => {
    const forbidden: Record<string, string>[] = [
      { Origin: 'https://evil.test' },
      { Host: 'evil.test' },
      { 'Sec-Fetch-Site': 'cross-site' },
    ];
    for (const headers of forbidden) {
      const response = await send('/api/version-history', { headers });
      expect(response.status).toBe(403);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    }
    const preflight = await send('/api/version-history', {
      method: 'OPTIONS',
      headers: { Origin: origin },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-methods']).toBe('GET, HEAD, OPTIONS');
  });
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
