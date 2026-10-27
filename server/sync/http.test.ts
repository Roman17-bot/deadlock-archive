import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import snapshot from '../../tests/fixtures/6819/heroes.json';
import type { HeroSnapshot } from '../../shared/types';
import type { SyncState } from '../../shared/sync-types';
import type { UpdateState } from '../../shared/update-types';
import type { UpdateManager } from '../updates/manager';
import { createApp } from '../app';
import type { SyncManager } from './manager';
const origin = 'http://127.0.0.1:5173';
const state: SyncState = {
  available: true,
  source: 'postgresql',
  phase: 'idle',
  localSaved: false,
  updatedAt: '2026-10-26T00:00:00Z',
  message: 'Можно проверить синхронизацию.',
};
let phase: UpdateState['phase'];
let app: ReturnType<typeof createApp>;
let base: string;
let sync: SyncManager, updates: UpdateManager;
beforeEach(async () => {
  phase = 'idle';
  updates = {
    getSnapshot: () => snapshot as HeroSnapshot,
    getHistory: async () => ({ schemaVersion: 1, versions: [] }),
    getState: () => ({
      phase,
      clientVersion: 6819,
      changed: false,
      localSaved: false,
      message: '',
      updatedAt: '',
    }),
    getSessionToken: () => 'owner-nonce',
    start: vi.fn(() => ({
      phase: 'checking' as const,
      clientVersion: 6819,
      changed: false,
      localSaved: false,
      message: '',
      updatedAt: '',
    })),
  };
  sync = {
    readState: () => state,
    getState: vi.fn(async () => state),
    start: vi.fn(() => ({ ...state, phase: 'checking' as const })),
    publishCurrent: vi.fn(),
    isBusy: vi.fn(() => false),
    waitForJob: async () => state,
  };
  app = createApp(snapshot as HeroSnapshot, { updates, sync });
  await new Promise<void>((r) => app.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
});
afterEach(async () => {
  await new Promise<void>((r) => app.close(() => r()));
});
const post = (url = '/api/sync', body = '{}', headers: Record<string, string> = {}) =>
  fetch(base + url, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'X-Archive-Token': 'owner-nonce',
      ...headers,
    },
    body,
  });
describe('owner synchronization HTTP boundary', () => {
  it('does not start an independent inspection while the game updater owns the job', async () => {
    phase = 'saving';
    expect((await fetch(base + '/api/sync/status?refresh=1')).status).toBe(200);
    expect(sync.getState).not.toHaveBeenCalled();
  });
  it('checks only by GET and starts using the existing local nonce', async () => {
    expect((await fetch(base + '/api/sync/status?refresh=1')).status).toBe(200);
    expect(sync.getState).toHaveBeenCalledWith({ refresh: true });
    expect(sync.start).not.toHaveBeenCalled();
    const response = await post();
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ phase: 'checking' });
    expect(sync.start).toHaveBeenCalledOnce();
  });
  it('rejects hostile origin, missing nonce and nonempty payloads', async () => {
    expect((await post('/api/sync', '{}', { Origin: 'https://evil.example' })).status).toBe(403);
    expect((await post('/api/sync', '{}', { 'X-Archive-Token': '' })).status).toBe(403);
    expect((await post('/api/sync', '{"force":true}')).status).toBe(400);
    expect(sync.start).not.toHaveBeenCalled();
  });
  it('prevents overlap with game refresh in both directions', async () => {
    phase = 'saving';
    expect((await post()).status).toBe(409);
    expect(sync.start).not.toHaveBeenCalled();
    phase = 'idle';
    vi.mocked(sync.isBusy).mockReturnValue(true);
    expect((await post('/api/update', '{"publish":true}')).status).toBe(409);
    expect(updates.start).not.toHaveBeenCalled();
  });
  it('reports unavailable storage in portable JSON mode', async () => {
    await new Promise<void>((r) => app.close(() => r()));
    app = createApp(snapshot as HeroSnapshot, { updates });
    await new Promise<void>((r) => app.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
    const response = await fetch(base + '/api/sync/status');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ available: false, source: 'json' });
    expect((await post()).status).toBe(503);
  });
  it('returns safe errors when status inspection fails', async () => {
    vi.mocked(sync.getState).mockRejectedValue(Error('private-password'));
    const response = await fetch(base + '/api/sync/status');
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private-password');
  });
});
