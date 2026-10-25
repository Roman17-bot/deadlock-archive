import { describe, expect, it, vi } from 'vitest';
import original from '../../data/heroes.json';
import type { HeroSnapshot } from '../../shared/types';
import { createUpdateManager } from './manager';

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
