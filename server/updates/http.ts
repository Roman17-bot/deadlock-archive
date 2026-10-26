import type { IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { UpdateConflictError, type UpdateManager } from './manager';
import { SyncConflictError, type SyncManager } from '../sync/manager';

const origins = new Set(['http://127.0.0.1:5173', 'http://localhost:5173']);
const routes = new Set([
  '/api/update',
  '/api/update/session',
  '/api/update/status',
  '/api/version-history',
  '/api/sync',
  '/api/sync/status',
]);
const maxBytes = 4096;

function loopbackHost(host: string | undefined) {
  const match = /^(localhost|127\.0\.0\.1)(?::([0-9]{1,5}))?$/.exec(host ?? '');
  return !!match && (!match[2] || (Number(match[2]) >= 1 && Number(match[2]) <= 65535));
}
function nonceMatches(value: string | string[] | undefined, token: string) {
  if (typeof value !== 'string') return false;
  const actual = Buffer.from(value),
    expected = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
class BodyError extends Error {
  constructor(readonly status: number) {
    super('Invalid request body');
  }
}
function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks: Buffer[] = [];
    const finish = (error?: BodyError) => {
      clearTimeout(timer);
      req.off('data', data);
      req.off('end', end);
      req.off('error', failed);
      req.off('aborted', failed);
      if (error) {
        req.resume();
        reject(error);
      }
    };
    const data = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) finish(new BodyError(413));
      else chunks.push(chunk);
    };
    const failed = () => finish(new BodyError(400));
    const end = () => {
      finish();
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new BodyError(400));
      }
    };
    const timer = setTimeout(() => finish(new BodyError(408)), 5000);
    timer.unref();
    req.on('data', data);
    req.on('end', end);
    req.on('error', failed);
    req.on('aborted', failed);
  });
}

/** Returns false for unrelated routes; it owns and finishes every matching response. */
export async function handleUpdateRequest(
  req: IncomingMessage,
  res: ServerResponse,
  manager: UpdateManager,
  sync?: SyncManager,
): Promise<boolean> {
  let pathname: string;
  let url: URL;
  try {
    url = new URL(req.url ?? '/', 'http://localhost');
    pathname = url.pathname;
  } catch {
    return false;
  }
  if (!routes.has(pathname)) return false;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const reply = (status: number, body?: unknown) => {
    res
      .writeHead(status)
      .end(req.method === 'HEAD' || body === undefined ? undefined : JSON.stringify(body));
    return true;
  };
  const origin = req.headers.origin;
  if (
    !loopbackHost(req.headers.host) ||
    (origin !== undefined && !origins.has(origin)) ||
    req.headers['sec-fetch-site'] === 'cross-site'
  )
    return reply(403, { error: 'Local access only' });
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    if (!origin) return reply(403, { error: 'Local Origin required' });
    res.setHeader(
      'Access-Control-Allow-Methods',
      pathname === '/api/update' || pathname === '/api/sync'
        ? 'POST, OPTIONS'
        : 'GET, HEAD, OPTIONS',
    );
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Archive-Token');
    return reply(204);
  }
  if (pathname !== '/api/update' && pathname !== '/api/sync') {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD, OPTIONS');
      return reply(405, { error: 'Method not allowed' });
    }
    if (pathname === '/api/version-history') {
      try {
        return reply(200, await manager.getHistory());
      } catch {
        return reply(503, { error: 'Version history unavailable' });
      }
    }
    if (pathname === '/api/sync/status') {
      if (!sync)
        return reply(200, {
          available: false,
          source: 'json',
          phase: 'idle',
          localSaved: false,
          updatedAt: new Date().toISOString(),
          message: 'Для синхронизации настройте локальную PostgreSQL.',
        });
      try {
        return reply(
          200,
          ['checking', 'saving', 'publishing'].includes(manager.getState().phase)
            ? sync.readState()
            : await sync.getState({ refresh: url.searchParams.get('refresh') === '1' }),
        );
      } catch {
        return reply(503, { error: 'Synchronization status unavailable' });
      }
    }
    return reply(
      200,
      pathname === '/api/update/session'
        ? { token: manager.getSessionToken(), state: manager.getState() }
        : manager.getState(),
    );
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return reply(405, { error: 'Method not allowed' });
  }
  if (!origin || !nonceMatches(req.headers['x-archive-token'], manager.getSessionToken()))
    return reply(403, { error: 'Local session required' });
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? ''))
    return reply(415, { error: 'JSON content type required' });
  if (req.headers['content-encoding'])
    return reply(415, { error: 'Content encoding is unsupported' });
  if (Number(req.headers['content-length']) > maxBytes) {
    req.resume();
    return reply(413, { error: 'Request body too large' });
  }
  try {
    const body = await readBody(req);
    if (pathname === '/api/sync') {
      if (!sync) return reply(503, { error: 'PostgreSQL is required' });
      if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).length !== 0
      )
        return reply(400, { error: 'Expected an empty object' });
      if (['checking', 'saving', 'publishing'].includes(manager.getState().phase))
        throw new UpdateConflictError();
      return reply(202, sync.start());
    }
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !('publish' in body) ||
      typeof body.publish !== 'boolean'
    )
      return reply(400, { error: 'Expected {publish:boolean}' });
    if (sync?.isBusy()) throw new SyncConflictError();
    return reply(202, manager.start({ publish: body.publish }));
  } catch (error) {
    if (error instanceof BodyError)
      return reply(error.status, {
        error: error.status === 413 ? 'Request body too large' : 'Invalid JSON request',
      });
    if (error instanceof UpdateConflictError || error instanceof SyncConflictError)
      return reply(409, { error: 'An update is already in progress', state: manager.getState() });
    return reply(500, { error: 'Unable to start update' });
  }
}
