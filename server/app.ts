import { createServer } from 'node:http';
import type { HeroSnapshot } from '../shared/types';
import { validateSnapshot } from '../shared/heroes';

export function createApp(snapshot: HeroSnapshot) {
  if (!validateSnapshot(snapshot)) throw new Error('Invalid hero snapshot');
  const payload = JSON.stringify(snapshot);
  return createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response
        .writeHead(405, { Allow: 'GET, HEAD' })
        .end(JSON.stringify({ error: 'Read-only API' }));
      return;
    }
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/api/heroes') {
      response.setHeader('Cache-Control', 'no-cache');
      response.writeHead(200).end(request.method === 'HEAD' ? undefined : payload);
    } else if (pathname === '/api/health') {
      response
        .writeHead(200)
        .end(
          request.method === 'HEAD'
            ? undefined
            : JSON.stringify({
                status: 'ok',
                clientVersion: snapshot.meta.clientVersion,
                heroCount: snapshot.meta.heroCount,
              }),
        );
    } else response.writeHead(404).end(JSON.stringify({ error: 'Not found' }));
  });
}
