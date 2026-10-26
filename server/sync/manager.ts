import { readFileSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CuratedBundle } from '../../shared/database-types';
import type { SyncState } from '../../shared/sync-types';
import type { PublicationState } from '../../shared/update-types';
import type { PublicSnapshot } from './types';
import { prepareSnapshot, mirrorSnapshot } from './snapshot';
import { publishSnapshot, inspectPublication, retryPublication } from './github';

interface Inspection {
  repositoryMatches: boolean;
  pagesMatches: boolean;
  repositoryHash: string | null;
  pagesHash: string | null;
  commitSha: string;
  status: string;
  url: string;
  runId?: number;
}
export interface SyncManagerOptions {
  root: string;
  readBundle: () => Promise<CuratedBundle>;
  prepare?: (root: string, bundle: CuratedBundle) => Promise<PublicSnapshot>;
  mirror?: (root: string, snapshot: PublicSnapshot) => Promise<{ changed: boolean }>;
  matchesLocal?: (snapshot: PublicSnapshot) => Promise<boolean>;
  publish?: (
    snapshot: PublicSnapshot,
  ) => Promise<{ changed: boolean; commitSha: string; hash: string; url: string; runId?: number }>;
  inspect?: (snapshot: PublicSnapshot, options?: { commitSha?: string }) => Promise<Inspection>;
  retry?: (
    commitSha: string,
    hash: string,
  ) => Promise<{ status: string; url: string; runId?: number; dispatched: boolean }>;
  onSaved?: () => void | Promise<void>;
  checkIntervalMs?: number;
  persistCheckpoint?: boolean;
}
export interface SyncManager {
  readState(): SyncState;
  getState(options?: { refresh?: boolean }): Promise<SyncState>;
  start(): SyncState;
  publishCurrent(): Promise<PublicationState>;
  isBusy(): boolean;
  waitForJob(): Promise<SyncState>;
}
const workflow = 'https://github.com/Roman17-bot/deadlock-archive/actions/workflows/pages.yml';
const genericFailure = 'Синхронизация не удалась. Локальные данные сохранены; повторите попытку.';
export class SyncConflictError extends Error {
  constructor() {
    super('Synchronization is already in progress');
  }
}

export async function runSynchronization(
  manager: SyncManager,
  options: { dryRun?: boolean } = {},
): Promise<SyncState> {
  const state = await manager.getState({ refresh: true });
  if (options.dryRun || state.upToDate || ['queued', 'in_progress'].includes(state.phase))
    return state;
  manager.start();
  return manager.waitForJob();
}

export function createSyncManager(options: SyncManagerOptions): SyncManager {
  let state: SyncState = {
    available: true,
    source: 'postgresql',
    phase: 'idle',
    localSaved: false,
    updatedAt: new Date().toISOString(),
    message: 'Можно проверить синхронизацию.',
  };
  const checkpoint = path.join(options.root, 'work', 'sync-state.json');
  let queuedAt = 0;
  // Only restore public identifiers; never trust cached prose or cached success.
  try {
    const saved = JSON.parse(readFileSync(checkpoint, 'utf8'));
    if (/^[a-f0-9]{40}$/.test(saved.commitSha) && /^[a-f0-9]{64}$/.test(saved.snapshotHash)) {
      queuedAt = Number.isFinite(saved.queuedAt) ? saved.queuedAt : 0;
      state = {
        ...state,
        commitSha: saved.commitSha,
        snapshotHash: saved.snapshotHash,
        phase: ['queued', 'in_progress'].includes(saved.phase) ? saved.phase : 'idle',
      };
    }
  } catch {
    /* A missing/interrupted checkpoint can be recovered by inspecting the actual snapshots. */
  }
  let working = false;
  let job: Promise<SyncState> | null = null;
  let checkPromise: Promise<SyncState> | null = null;
  let checkedAt = 0;
  const readState = () => structuredClone(state);
  const save = async () => {
    if (options.persistCheckpoint === false) return;
    await mkdir(path.dirname(checkpoint), { recursive: true });
    const temp = `${checkpoint}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify({ ...state, queuedAt }, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    await rename(temp, checkpoint);
  };
  const update = async (patch: Partial<SyncState>) => {
    state = { ...state, ...patch, updatedAt: new Date().toISOString() };
    await save();
  };
  const prepare = options.prepare ?? prepareSnapshot;
  const mirror = options.mirror ?? mirrorSnapshot;
  const publish = options.publish ?? publishSnapshot;
  const inspect = options.inspect ?? inspectPublication;
  const retry = options.retry ?? retryPublication;
  const matchesLocal =
    options.matchesLocal ??
    (async (snapshot: PublicSnapshot) => {
      for (const file of snapshot.files.filter((f) => f.path.startsWith('data/'))) {
        try {
          if (!(await readFile(path.join(options.root, file.path))).equals(file.content))
            return false;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
          throw error;
        }
      }
      return true;
    });
  const capture = async () => prepare(options.root, await options.readBundle());
  async function applyInspection(
    snapshot: PublicSnapshot,
    found: Inspection,
    local: boolean,
    pending: boolean,
  ) {
    const same =
      local &&
      found.repositoryMatches &&
      found.pagesMatches &&
      found.repositoryHash === snapshot.hash &&
      found.pagesHash === snapshot.hash;
    const waiting = pending && Date.now() - queuedAt < 120_000;
    const phase: SyncState['phase'] = same
      ? 'succeeded'
      : found.status === 'failure' && (found.repositoryMatches || pending)
        ? 'failed'
        : found.repositoryMatches && found.status === 'in_progress'
          ? 'in_progress'
          : (found.repositoryMatches && found.status === 'queued') || waiting
            ? 'queued'
            : 'idle';
    await update({
      snapshotHash: snapshot.hash,
      clientVersion: snapshot.clientVersion,
      localMatches: local,
      repositoryMatches: found.repositoryMatches,
      pagesMatches: found.pagesMatches,
      repositoryHash: found.repositoryHash,
      pagesHash: found.pagesHash,
      commitSha: found.commitSha,
      runId: found.runId,
      url: found.url,
      phase,
      upToDate: same,
      message: same
        ? 'Данные PostgreSQL и GitHub Pages синхронизированы.'
        : phase === 'failed'
          ? 'GitHub Pages не подтвердил развёртывание. Повторите синхронизацию.'
          : phase === 'in_progress'
            ? 'GitHub Pages публикует снимок.'
            : phase === 'queued'
              ? 'Снимок отправлен. Ожидаем развёртывание Pages.'
              : 'Снимок отличается от опубликованной версии.',
    });
    checkedAt = Date.now();
    return readState();
  }
  async function fail() {
    await update({ phase: 'failed', upToDate: false, message: genericFailure }).catch(() => {});
    return readState();
  }
  async function execute(): Promise<SyncState> {
    try {
      await save();
      const snapshot = await capture();
      await update({ snapshotHash: snapshot.hash, clientVersion: snapshot.clientVersion });
      const local = await matchesLocal(snapshot);
      const found = await inspect(snapshot);
      if (local && found.repositoryMatches && found.pagesMatches)
        return await applyInspection(snapshot, found, true, false);
      if (!local) {
        await update({ phase: 'saving', message: 'Сохраняем точный снимок PostgreSQL.' });
        await mirror(options.root, snapshot);
        await update({ localSaved: true, localMatches: true });
        try {
          await options.onSaved?.();
        } catch {
          /* Public synchronization is independent of private evidence indexing. */
        }
      }
      if (found.repositoryMatches && found.pagesMatches)
        return await applyInspection(snapshot, found, true, false);
      let commitSha = found.commitSha,
        url = found.url,
        runId = found.runId;
      await update({ phase: 'publishing', message: 'Отправляем снимок в GitHub.' });
      if (!found.repositoryMatches) {
        const sent = await publish(snapshot);
        commitSha = sent.commitSha;
        url = sent.url;
        runId = sent.runId;
      } else if (!['queued', 'in_progress'].includes(found.status)) {
        const sent = await retry(commitSha, snapshot.hash);
        url = sent.url;
        runId = sent.runId;
      }
      queuedAt = Date.now();
      await update({
        phase: 'queued',
        commitSha,
        url,
        runId,
        message: 'Снимок отправлен. Ожидаем развёртывание Pages.',
      });
      const after = await inspect(snapshot, { commitSha });
      return await applyInspection(snapshot, after, true, true);
    } catch {
      return await fail();
    } finally {
      working = false;
    }
  }
  const isBusy = () =>
    working || checkPromise !== null || ['queued', 'in_progress'].includes(state.phase);
  function reserve() {
    if (isBusy()) throw new SyncConflictError();
    working = true;
    queuedAt = 0;
    state = {
      available: true,
      source: 'postgresql',
      phase: 'checking',
      localSaved: false,
      updatedAt: new Date().toISOString(),
      message: 'Проверяем данные PostgreSQL и GitHub Pages.',
    };
  }
  return {
    readState,
    isBusy,
    waitForJob: () => job ?? Promise.resolve(readState()),
    start() {
      reserve();
      job = Promise.resolve().then(execute);
      return readState();
    },
    async publishCurrent() {
      reserve();
      job = execute();
      const done = await job;
      if (done.phase === 'failed') throw new Error(genericFailure);
      return {
        status:
          done.phase === 'succeeded'
            ? 'success'
            : done.phase === 'in_progress'
              ? 'in_progress'
              : 'queued',
        url: done.url ?? workflow,
        commitSha: done.commitSha,
        hash: done.snapshotHash,
        runId: done.runId,
      };
    },
    async getState({ refresh = false } = {}) {
      if (working) return readState();
      if (checkPromise) return checkPromise;
      if (!refresh && checkedAt && Date.now() - checkedAt < (options.checkIntervalMs ?? 5000))
        return readState();
      checkPromise = (async () => {
        try {
          const snapshot = await capture();
          const pending =
            state.snapshotHash === snapshot.hash && ['queued', 'in_progress'].includes(state.phase);
          const found = await inspect(
            snapshot,
            pending ? { commitSha: state.commitSha } : undefined,
          );
          return await applyInspection(snapshot, found, await matchesLocal(snapshot), pending);
        } catch {
          return await fail();
        } finally {
          checkPromise = null;
        }
      })();
      return checkPromise;
    },
  };
}
