import { describe, expect, it } from 'vitest';
import original from '../../data/heroes.json';
import type { HeroSnapshot } from '../../shared/types';
import { createUpdateManager } from './manager';

const snapshot = original as HeroSnapshot;
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
});
