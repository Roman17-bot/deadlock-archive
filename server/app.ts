import { createServer } from 'node:http';
import type { HeroSnapshot } from '../shared/types';
import { validateSnapshot } from '../shared/heroes';
import type { UpdateManager } from './updates/manager';
import { handleUpdateRequest } from './updates/http';

export function createApp(snapshot: HeroSnapshot, options: { updates?: UpdateManager } = {}) {
  if (!validateSnapshot(snapshot)) throw new Error('Invalid hero snapshot');
  return createServer(async (request, response) => {
    try {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      if (options.updates && (await handleUpdateRequest(request, response, options.updates)))
        return;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response
          .writeHead(405, { Allow: 'GET, HEAD' })
          .end(JSON.stringify({ error: 'Read-only API' }));
        return;
      }
      let pathname: string;
      try {
        pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      } catch {
        response.writeHead(400).end(JSON.stringify({ error: 'Invalid request target' }));
        return;
      }
      if (pathname === '/api/heroes') {
        response.setHeader('Cache-Control', 'no-cache');
        response
          .writeHead(200)
          .end(
            request.method === 'HEAD'
              ? undefined
              : JSON.stringify(options.updates?.getSnapshot() ?? snapshot),
          );
      } else if (pathname === '/api/health') {
        response.writeHead(200).end(
          request.method === 'HEAD'
            ? undefined
            : JSON.stringify({
                status: 'ok',
                clientVersion: (options.updates?.getSnapshot() ?? snapshot).meta.clientVersion,
                heroCount: (options.updates?.getSnapshot() ?? snapshot).meta.heroCount,
              }),
        );
      } else response.writeHead(404).end(JSON.stringify({ error: 'Not found' }));
    } catch {
      if (!response.headersSent)
        response.writeHead(500).end(JSON.stringify({ error: 'Request failed' }));
      else response.end();
    }
  });
}
