import { afterEach, describe, expect, it, vi } from 'vitest';
import original from '../../tests/fixtures/6819/heroes.json';
import type { HeroSnapshot } from '../../shared/types';
import { createUpdateManager } from './manager';
import * as stagedRefresh from '../items/archive-refresh';
afterEach(() => vi.restoreAllMocks());

const snapshot = original as HeroSnapshot;
const checkVersion = async () => ({ version: 6820, revision: 11162697, buildDate: '2026-10-25' });
const next = { ...snapshot, meta: { ...snapshot.meta, clientVersion: 6820 } };
const result = {
  snapshot: next,
  changed: true,
  checkedAt: '2026-10-25T09:00:00Z',
  sourceCommit: 'a'.repeat(40),
  summary: { heroCount: 44, added: 0, removed: 0, updated: 1, text: 'Updated' },
};
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('owner update job', () => {
  it('uses the complete staged refresh before importing or publishing', async () => {
    const events: string[] = [];
    vi.spyOn(stagedRefresh, 'refreshArchiveData').mockImplementation(async () => {
      events.push('staged');
      return result;
    });
    const manager = createUpdateManager({
      snapshot,
      root: '.',
      checkVersion,
      syncDatabase: async () => {
        events.push('database');
      },
      publish: async () => {
        events.push('publish');
        return {
          status: 'queued',
          url: 'https://github.com/Roman17-bot/deadlock-archive/actions/runs/1',
        };
      },
    });
    manager.start({ publish: true });
    await settle();
    expect(events).toEqual(['staged', 'database', 'publish']);
  });
  it('preserves the old version when staging fails and retries the same pending version', async () => {
    const database = vi.fn(),
      publish = vi.fn(async () => ({
        status: 'queued' as const,
        url: 'https://github.com/Roman17-bot/deadlock-archive/actions/runs/1',
      }));
    const staged = vi
      .spyOn(stagedRefresh, 'refreshArchiveData')
      .mockRejectedValueOnce(new Error('private upstream information'))
      .mockResolvedValue(result);
    const manager = createUpdateManager({
      snapshot,
      root: '.',
      checkVersion,
      syncDatabase: database,
      publish,
    });
    manager.start({ publish: true });
    await settle();
    expect(manager.getState().phase).toBe('failed');
    expect(manager.getSnapshot().meta.clientVersion).toBe(6819);
    expect(database).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(JSON.stringify(manager.getState())).not.toContain('private upstream');
    manager.start({ publish: true });
    await settle();
    expect(staged).toHaveBeenCalledTimes(2);
    expect(manager.getState().phase).toBe('succeeded');
    expect(database).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(1);
  });
  it('reserves synchronously, rejects overlapping updates and serves the saved snapshot', async () => {
    let finish!: (value: typeof result) => void;
    const manager = createUpdateManager({
      snapshot,
      root: '.',
      checkVersion,
      refresh: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    expect(manager.start({ publish: false })).toMatchObject({
      phase: 'checking',
      localSaved: false,
    });
    expect(() => manager.start({ publish: false })).toThrow(/already|progress/i);
    await settle();
    finish(result);
    await settle();
    expect(manager.getSnapshot().meta.clientVersion).toBe(6820);
    expect(manager.getState()).toMatchObject({
      phase: 'succeeded',
      localSaved: true,
      changed: true,
      clientVersion: 6820,
    });
  });
  it('keeps a successful save when publication fails and redacts dependency errors', async () => {
    const manager = createUpdateManager({
      snapshot,
      root: '.',
      checkVersion,
      refresh: async () => result,
      publish: async () => {
        throw new Error('secret-token');
      },
    });
    manager.start({ publish: true });
    await settle();
    expect(manager.getSnapshot().meta.clientVersion).toBe(6820);
    expect(manager.getState()).toMatchObject({ phase: 'failed', localSaved: true, changed: true });
    expect(JSON.stringify(manager.getState())).not.toContain('secret-token');
  });
  it('reports dispatch as queued and never claims deployment success', async () => {
    const manager = createUpdateManager({
      snapshot,
      root: '.',
      checkVersion,
      refresh: async () => result,
      publish: async ({ expectedVersion }) => {
        expect(expectedVersion).toBe(6820);
        return {
          status: 'queued',
          runId: 123,
          url: 'https://github.com/Roman17-bot/deadlock-archive/actions/runs/123',
        };
      },
    });
    manager.start({ publish: true });
    await settle();
    expect(manager.getState()).toMatchObject({
      phase: 'succeeded',
      localSaved: true,
      publication: { status: 'queued', runId: 123 },
    });
    expect(manager.getState().message).toMatch(/очеред|запущ|отправ/i);
  });
  it('preserves the old snapshot on refresh failure and permits retry', async () => {
    let fail = true;
    const manager = createUpdateManager({
      snapshot,
      root: '.',
      checkVersion,
      refresh: async () => {
        if (fail) throw new Error('private path');
        return result;
      },
    });
    manager.start({ publish: false });
    await settle();
    expect(manager.getState()).toMatchObject({
      phase: 'failed',
      localSaved: false,
      clientVersion: 6819,
    });
    expect(manager.getSnapshot()).toEqual(snapshot);
    fail = false;
    manager.start({ publish: false });
    await settle();
    expect(manager.getState().phase).toBe('succeeded');
  });
  it('reports index failure as a warning while retaining the saved snapshot', async () => {
    const manager = createUpdateManager({
      snapshot,
      root: '.',
      checkVersion,
      refresh: async () => result,
      onSaved: async () => {
        throw new Error('private database path');
      },
    });
    manager.start({ publish: false });
    await settle();
    expect(manager.getState()).toMatchObject({ phase: 'succeeded', localSaved: true });
    expect(manager.getState().message).toMatch(/индекс/i);
    expect(JSON.stringify(manager.getState())).not.toContain('private database path');
  });
  it('returns up to date without refresh, persistence, indexing or dispatch even when publish is requested', async () => {
    const refresh = vi.fn(async () => result);
    const publish = vi.fn();
    const onSaved = vi.fn();
    const manager = createUpdateManager({
      snapshot,
      root: '.',
      checkVersion: async () => ({ version: 6819, revision: 11162696, buildDate: '2026-10-22' }),
      refresh,
      publish,
      onSaved,
    });
    manager.start({ publish: true });
    await settle();
    expect(manager.getState()).toMatchObject({
      phase: 'succeeded',
      upToDate: true,
      localSaved: false,
      changed: false,
      message: 'Текущая версия актуальна.',
    });
    expect(manager.getSnapshot()).toEqual(snapshot);
    expect(refresh).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
  it.each(['older', 'unavailable'])(
    'preserves data and skips refresh on %s latest version',
    async (condition) => {
      const refresh = vi.fn(async () => result);
      const publish = vi.fn();
      const onSaved = vi.fn();
      const manager = createUpdateManager({
        snapshot,
        root: '.',
        checkVersion: async () => {
          if (condition === 'unavailable') throw new Error('private-token');
          return { version: 6818, revision: 11162696, buildDate: '2026-10-22' };
        },
        refresh,
        publish,
        onSaved,
      });
      manager.start({ publish: true });
      await settle();
      expect(manager.getState()).toMatchObject({
        phase: 'failed',
        localSaved: false,
        changed: false,
      });
      expect(manager.getSnapshot()).toEqual(snapshot);
      expect(JSON.stringify(manager.getState())).not.toContain('private-token');
      expect(refresh).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
      expect(onSaved).not.toHaveBeenCalled();
    },
  );
  it('pins a newer refresh to the checked version', async () => {
    const refresh = vi.fn(async () => result);
    const manager = createUpdateManager({ snapshot, root: '.', checkVersion, refresh });
    manager.start({ publish: false });
    await settle();
    expect(refresh).toHaveBeenCalledWith({ root: '.', expectedVersion: 6820 });
    expect(manager.getState()).toMatchObject({
      phase: 'succeeded',
      changed: true,
      localSaved: true,
    });
  });
  it('does not dispatch or index an unchanged full refresh', async () => {
    const publish = vi.fn();
    const onSaved = vi.fn();
    const manager = createUpdateManager({
      snapshot,
      root: '.',
      checkVersion,
      refresh: async () => ({ ...result, snapshot, changed: false }),
      publish,
      onSaved,
    });
    manager.start({ publish: true });
    await settle();
    expect(manager.getState()).toMatchObject({
      phase: 'succeeded',
      changed: false,
      localSaved: false,
      upToDate: true,
    });
    expect(publish).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
  it('retains the saved snapshot and blocks dispatch when public history could not be saved', async () => {
    const publish = vi.fn();
    const onSaved = vi.fn();
    const manager = createUpdateManager({
      snapshot,
      root: '.',
      checkVersion,
      refresh: async () => ({ ...result, historySaved: false }),
      publish,
      onSaved,
    });
    manager.start({ publish: true });
    await settle();
    expect(manager.getState()).toMatchObject({
      phase: 'succeeded',
      localSaved: true,
      historySaved: false,
    });
    expect(manager.getState().message).toMatch(/истори.*не сохранена/i);
    expect(manager.getSnapshot().meta.clientVersion).toBe(6820);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
  });
});
describe('PostgreSQL update synchronization', () => {
  it('uses the current database snapshot after a separate CLI import without dispatching again', async () => {
    const refresh = vi.fn(async () => result);
    const syncDatabase = vi.fn();
    const publish = vi.fn();
    const manager = createUpdateManager({
      snapshot,
      root: '.',
      checkVersion,
      readSnapshot: async () => next,
      refresh,
      syncDatabase,
      publish,
    });
    manager.start({ publish: true });
    await settle();
    expect(manager.getState()).toMatchObject({
      phase: 'succeeded',
      clientVersion: 6820,
      upToDate: true,
      localSaved: false,
    });
    expect(manager.getSnapshot()).toEqual(next);
    expect(refresh).not.toHaveBeenCalled();
    expect(syncDatabase).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
  it('commits the database before indexing and publication and reads its history', async () => {
    const order: string[] = [];
    const history = { schemaVersion: 1 as const, versions: [] };
    const manager = createUpdateManager({
      snapshot,
      root: '.',
      checkVersion,
      prepareRefresh: async () => {
        order.push('export');
      },
      refresh: async () => {
        order.push('refresh');
        return result;
      },
      syncDatabase: async (value) => {
        expect(value.meta.clientVersion).toBe(6820);
        order.push('db');
      },
      onSaved: async () => {
        order.push('index');
      },
      readHistory: async () => history,
      publish: async () => {
        order.push('publish');
        return {
          status: 'queued',
          url: 'https://github.com/Roman17-bot/deadlock-archive/actions/workflows/refresh-data.yml',
        };
      },
    });
    manager.start({ publish: true });
    await settle();
    expect(order).toEqual(['export', 'refresh', 'db', 'index', 'publish']);
    expect(manager.getState()).toMatchObject({
      phase: 'succeeded',
      databaseSaved: true,
      localSaved: true,
    });
    expect(await manager.getHistory()).toEqual(history);
  });
  it('preserves the previous database snapshot on sync failure and retries a newer saved JSON', async () => {
    const syncDatabase = vi
      .fn()
      .mockRejectedValueOnce(new Error('private-db-password'))
      .mockResolvedValue(undefined);
    const publish = vi.fn(async () => ({
      status: 'queued' as const,
      url: 'https://github.com/Roman17-bot/deadlock-archive/actions/workflows/refresh-data.yml',
    }));
    const onSaved = vi.fn();
    const manager = createUpdateManager({
      snapshot,
      root: '.',
      checkVersion,
      refresh: async () => ({ ...result, changed: false }),
      syncDatabase,
      publish,
      onSaved,
    });
    manager.start({ publish: true });
    await settle();
    expect(manager.getState()).toMatchObject({
      phase: 'failed',
      databaseSaved: false,
      localSaved: true,
    });
    expect(JSON.stringify(manager.getState())).not.toContain('private-db-password');
    expect(manager.getSnapshot()).toEqual(snapshot);
    expect(publish).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    manager.start({ publish: true });
    await settle();
    expect(syncDatabase).toHaveBeenCalledTimes(2);
    expect(manager.getSnapshot().meta.clientVersion).toBe(6820);
    expect(manager.getState()).toMatchObject({ phase: 'succeeded', databaseSaved: true });
    expect(publish).toHaveBeenCalledTimes(1);
  });
  it('does not import into PostgreSQL or publish for an already current client', async () => {
    const syncDatabase = vi.fn(),
      publish = vi.fn();
    const manager = createUpdateManager({
      snapshot,
      root: '.',
      checkVersion: async () => ({ version: 6819, revision: 11162696, buildDate: '2026-10-22' }),
      syncDatabase,
      publish,
    });
    manager.start({ publish: true });
    await settle();
    expect(manager.getState()).toMatchObject({ phase: 'succeeded', upToDate: true });
    expect(syncDatabase).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});
