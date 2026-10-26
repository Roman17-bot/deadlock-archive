import { readJson } from './http';
import type { SyncState } from '../../shared/sync-types';

export const syncActivePhases = new Set([
  'checking',
  'saving',
  'publishing',
  'queued',
  'in_progress',
]);
const phases = new Set([...syncActivePhases, 'idle', 'succeeded', 'failed']);
const hashPattern = /^[a-f0-9]{64}$/;

function isSyncState(value: unknown): value is SyncState {
  if (!value || typeof value !== 'object') return false;
  const state = value as SyncState;
  return (
    typeof state.available === 'boolean' &&
    ['postgresql', 'json'].includes(state.source) &&
    phases.has(state.phase) &&
    typeof state.localSaved === 'boolean' &&
    typeof state.message === 'string' &&
    typeof state.updatedAt === 'string' &&
    Number.isFinite(Date.parse(state.updatedAt)) &&
    (state.clientVersion === undefined ||
      (Number.isSafeInteger(state.clientVersion) && state.clientVersion >= 0)) &&
    [state.snapshotHash, state.repositoryHash, state.pagesHash].every(
      (hash) => hash == null || (typeof hash === 'string' && hashPattern.test(hash)),
    ) &&
    state.snapshotHash !== null &&
    [state.localMatches, state.repositoryMatches, state.pagesMatches, state.upToDate].every(
      (flag) => flag === undefined || typeof flag === 'boolean',
    ) &&
    (state.commitSha === undefined ||
      (typeof state.commitSha === 'string' && /^[a-f0-9]{40}$/.test(state.commitSha))) &&
    (state.runId === undefined || (Number.isSafeInteger(state.runId) && state.runId > 0)) &&
    (state.url === undefined || typeof state.url === 'string')
  );
}

export async function fetchSyncState(url: string, init?: RequestInit): Promise<SyncState> {
  const value = await readJson(url, init);
  if (!isSyncState(value)) throw new Error('Invalid sync response');
  return value;
}
