import type { HeroSnapshot } from '../../../shared/types';
import type { UpdateState } from '../../../shared/update-types';

export const workflow =
  'https://github.com/Roman17-bot/deadlock-archive/actions/workflows/refresh-data.yml';
export const localCenter = 'http://127.0.0.1:5173/#/updates';
export const activePhases = new Set(['checking', 'saving', 'publishing']);
export const maxPolls = 150;

export function isState(value: unknown): value is UpdateState {
  if (!value || typeof value !== 'object') return false;
  const state = value as UpdateState;
  return (
    ['idle', 'checking', 'saving', 'publishing', 'succeeded', 'failed'].includes(state.phase) &&
    Number.isInteger(state.clientVersion) &&
    typeof state.localSaved === 'boolean' &&
    typeof state.changed === 'boolean' &&
    typeof state.message === 'string'
  );
}

export function safePublicationUrl(state: UpdateState): string | undefined {
  const url = state.publication?.url;
  if (
    url === workflow ||
    url === 'https://github.com/Roman17-bot/deadlock-archive/actions/workflows/pages.yml'
  )
    return url;
  const runId = state.publication?.runId;
  if (
    Number.isSafeInteger(runId) &&
    Number(runId) > 0 &&
    url === `https://github.com/Roman17-bot/deadlock-archive/actions/runs/${runId}`
  )
    return url;
  const commit = state.publication?.commitSha;
  if (
    typeof commit === 'string' &&
    /^[a-f0-9]{40}$/.test(commit) &&
    url === `https://github.com/Roman17-bot/deadlock-archive/commit/${commit}`
  )
    return url;
  return undefined;
}

export function isNewerOrEqual(candidate: HeroSnapshot, current: HeroSnapshot): boolean {
  return (
    candidate.meta.clientVersion >= current.meta.clientVersion &&
    candidate.meta.sourceRevision >= current.meta.sourceRevision
  );
}
