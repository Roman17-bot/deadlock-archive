import { HttpError, readJson } from './http';
import type { UpdateSession } from '../../shared/update-types';

function isSession(value: unknown): value is UpdateSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as UpdateSession;
  const state = session.state;
  return (
    typeof session.token === 'string' &&
    session.token.trim().length > 0 &&
    !!state &&
    typeof state === 'object' &&
    ['idle', 'checking', 'saving', 'publishing', 'succeeded', 'failed'].includes(state.phase) &&
    Number.isSafeInteger(state.clientVersion) &&
    state.clientVersion >= 0 &&
    typeof state.localSaved === 'boolean' &&
    typeof state.changed === 'boolean' &&
    typeof state.message === 'string' &&
    typeof state.updatedAt === 'string' &&
    Number.isFinite(Date.parse(state.updatedAt))
  );
}

/** A rejected nonce may belong to the API process before its last restart. */
export async function readLocalMutation(
  url: '/api/update' | '/api/sync',
  init: RequestInit,
): Promise<unknown> {
  const request = { ...init, signal: init.signal ?? AbortSignal.timeout(20_000) };
  try {
    return await readJson(url, request);
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 403) throw error;
    const session = await readJson('/api/update/session', {
      cache: 'no-store',
      signal: request.signal,
    });
    const headers = new Headers(request.headers);
    if (!isSession(session) || session.token === headers.get('X-Archive-Token')) throw error;
    request.signal.throwIfAborted();
    headers.set('X-Archive-Token', session.token);
    // Return directly so a retry failure cannot start another recovery.
    return readJson(url, { ...request, headers });
  }
}
