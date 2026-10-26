import { afterEach, describe, expect, it, vi } from 'vitest';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { CuratedBundle } from '../../shared/database-types';
import type { PublicSnapshot } from './types';
import { createSyncManager, runSynchronization } from './manager';

const owned: string[] = [];
afterEach(async () => {
  for (const root of owned.splice(0)) await rm(root, { recursive: true, force: true });
});
const hash = 'a'.repeat(64),
  commit = 'b'.repeat(40);
const bundle = { heroes: { meta: { clientVersion: 6819 } } } as CuratedBundle;
const snapshot = {
  bundle,
  clientVersion: 6819,
  hash,
  manifest: { schemaVersion: 1, clientVersion: 6819, reviewedClientVersion: 6819, hash, files: {} },
  files: [],
} as PublicSnapshot;
const inspection = {
  repositoryMatches: false,
  pagesMatches: false,
  repositoryHash: null,
  pagesHash: null,
  commitSha: commit,
  status: 'unknown' as const,
  url: 'https://github.com/Roman17-bot/deadlock-archive/actions/workflows/pages.yml',
};
const queued = {
  ...inspection,
  repositoryMatches: true,
  repositoryHash: hash,
  status: 'queued' as const,
};
const matched = { ...queued, pagesMatches: true, pagesHash: hash, status: 'success' as const };
async function setup(overrides: Record<string, unknown> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'deadlock-sync-manager-'));
  owned.push(root);
  const deps = {
    root,
    readBundle: vi.fn(async () => bundle),
    prepare: vi.fn(async () => snapshot),
    matchesLocal: vi.fn(async () => true),
    mirror: vi.fn(async () => ({ changed: true })),
    publish: vi.fn(async () => ({ changed: true, commitSha: commit, hash, url: inspection.url })),
    inspect: vi.fn(async () => inspection),
    retry: vi.fn(async () => ({
      status: 'queued' as const,
      url: inspection.url,
      dispatched: true,
    })),
    checkIntervalMs: 0,
    ...overrides,
  };
  return { deps, manager: createSyncManager(deps) };
}
async function settle(manager: ReturnType<typeof createSyncManager>) {
  await manager.waitForJob();
  return manager.readState();
}
describe('exact snapshot synchronization', () => {
  it('reports a new unpublished snapshot as a difference rather than a failed job', async () => {
    const { manager } = await setup({
      inspect: async () => ({ ...inspection, status: 'failure' }),
    });
    expect(await manager.getState({ refresh: true })).toMatchObject({
      phase: 'idle',
      repositoryMatches: false,
      pagesMatches: false,
    });
  });
  it('performs a dry-run inspection without writing a checkpoint', async () => {
    const { deps, manager } = await setup({
      persistCheckpoint: false,
      inspect: async () => matched,
    });
    expect((await manager.getState({ refresh: true })).phase).toBe('succeeded');
    await expect(access(path.join(deps.root, 'work/sync-state.json'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
  it('requires the actual matching hashes before reporting success', async () => {
    const { manager } = await setup({
      inspect: async () => ({ ...matched, pagesHash: 'f'.repeat(64) }),
    });
    expect((await manager.getState({ refresh: true })).phase).not.toBe('succeeded');
  });
  it('does nothing when local files, repository and served files already match', async () => {
    const { deps, manager } = await setup({ inspect: vi.fn(async () => matched) });
    expect(manager.start().phase).toBe('checking');
    expect(await settle(manager)).toMatchObject({
      phase: 'succeeded',
      upToDate: true,
      snapshotHash: hash,
    });
    expect(deps.mirror).not.toHaveBeenCalled();
    expect(deps.publish).not.toHaveBeenCalled();
    expect(deps.retry).not.toHaveBeenCalled();
  });
  it('mirrors and publishes a changed snapshot even for the same client', async () => {
    const order: string[] = [];
    const { manager } = await setup({
      matchesLocal: async () => false,
      mirror: async () => {
        order.push('mirror');
        return { changed: true };
      },
      publish: async () => {
        order.push('publish');
        return { changed: true, commitSha: commit, hash, url: inspection.url };
      },
      inspect: vi.fn().mockResolvedValueOnce(inspection).mockResolvedValue(queued),
    });
    manager.start();
    const state = await settle(manager);
    expect(order).toEqual(['mirror', 'publish']);
    expect(state).toMatchObject({
      phase: 'queued',
      clientVersion: 6819,
      localSaved: true,
      commitSha: commit,
    });
  });
  it('never publishes after a failed local export and redacts errors', async () => {
    const { deps, manager } = await setup({
      matchesLocal: async () => false,
      mirror: async () => {
        throw Error('private-password');
      },
    });
    manager.start();
    expect(await settle(manager)).toMatchObject({ phase: 'failed', localSaved: false });
    expect(deps.publish).not.toHaveBeenCalled();
    expect(JSON.stringify(manager.readState())).not.toContain('private-password');
  });
  it('retries an existing failed deployment without creating another data commit', async () => {
    const { deps, manager } = await setup({
      inspect: vi
        .fn()
        .mockResolvedValueOnce({ ...queued, status: 'failure' })
        .mockResolvedValue(queued),
    });
    manager.start();
    expect(await settle(manager)).toMatchObject({ phase: 'queued', commitSha: commit });
    expect(deps.publish).not.toHaveBeenCalled();
    expect(deps.retry).toHaveBeenCalledWith(commit, hash);
  });
  it('reserves synchronously and refuses overlapping jobs', async () => {
    let finish!: (b: CuratedBundle) => void;
    const { manager } = await setup({
      readBundle: () =>
        new Promise<CuratedBundle>((resolve) => {
          finish = resolve;
        }),
    });
    manager.start();
    expect(() => manager.start()).toThrow(/progress/i);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    finish(bundle);
    await settle(manager);
  });
  it('verifies served data before success and recovers its pending commit after restart', async () => {
    const { deps, manager } = await setup({
      inspect: vi.fn().mockResolvedValueOnce(inspection).mockResolvedValue(queued),
    });
    manager.start();
    expect(await settle(manager)).toMatchObject({ phase: 'queued' });
    const restarted = createSyncManager({ ...deps, inspect: vi.fn(async () => matched) });
    expect(await runSynchronization(restarted)).toMatchObject({
      phase: 'succeeded',
      repositoryMatches: true,
      pagesMatches: true,
    });
  });
  it('keeps the saved local data after a GitHub failure and allows retry', async () => {
    const { deps, manager } = await setup({
      matchesLocal: async () => false,
      publish: vi
        .fn()
        .mockRejectedValueOnce(Error('secret-token'))
        .mockResolvedValue({ changed: true, commitSha: commit, hash, url: inspection.url }),
    });
    manager.start();
    expect(await settle(manager)).toMatchObject({ phase: 'failed', localSaved: true });
    expect(JSON.stringify(manager.readState())).not.toContain('secret-token');
    manager.start();
    expect(await settle(manager)).toMatchObject({ phase: 'queued' });
    expect(deps.publish).toHaveBeenCalledTimes(2);
  });
  it('returns a queued publication to the game updater without claiming deployment', async () => {
    const { manager } = await setup({ inspect: async () => queued });
    expect(await manager.publishCurrent()).toMatchObject({
      status: 'queued',
      commitSha: commit,
      hash,
    });
  });
});
