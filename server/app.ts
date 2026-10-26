import { createServer } from 'node:http';
import type { HeroSnapshot } from '../shared/types';
import type { ArchiveStatus, MechanicsCatalog, MechanicsFormula } from '../shared/database-types';
import type { VersionHistory } from '../shared/version-history';
import { validateSnapshot } from '../shared/heroes';
import mechanicsRu from '../data/mechanics.json';
import mechanicsEn from '../data/mechanics.en.json';
import initialHistory from '../data/version-history.json';
import type { UpdateManager } from './updates/manager';
import { handleUpdateRequest } from './updates/http';

/** Only public, bounded archive reads are exposed to HTTP. */
export interface ArchiveReader {
  getHeroes(): Promise<HeroSnapshot | null>;
  getMechanics(language: 'ru' | 'en'): Promise<MechanicsCatalog | null>;
  getHistory(): Promise<VersionHistory | null>;
  status(): Promise<ArchiveStatus>;
  searchHeroes(query: string, limit: number): Promise<HeroSnapshot['heroes']>;
  getFormula(id: string, language: 'ru' | 'en'): Promise<MechanicsFormula | null>;
}

export interface AppOptions {
  updates?: UpdateManager;
  archive?: ArchiveReader;
  mechanics?: { ru: MechanicsCatalog; en: MechanicsCatalog };
  readMechanics?: (language: 'ru' | 'en') => Promise<MechanicsCatalog>;
  history?: VersionHistory;
}

function language(value: string | null): 'ru' | 'en' | null {
  return value === null || value === 'ru' ? 'ru' : value === 'en' ? 'en' : null;
}

function searchInput(url: URL): { query: string; limit: number } | null {
  const raw = url.searchParams.get('q') ?? '';
  const query = raw.trim();
  const rawLimit = url.searchParams.get('limit');
  if (query.length > 80 || /[\u0000-\u001f\u007f]/.test(query)) return null;
  if (rawLimit !== null && !/^(?:[1-9]|1[0-9]|20)$/.test(rawLimit)) return null;
  return { query, limit: rawLimit === null ? 20 : Number(rawLimit) };
}

export function createApp(snapshot: HeroSnapshot, options: AppOptions = {}) {
  if (!validateSnapshot(snapshot)) throw new Error('Invalid hero snapshot');
  const catalogs = options.mechanics ?? {
    ru: mechanicsRu as MechanicsCatalog,
    en: mechanicsEn as MechanicsCatalog,
  };
  const history = options.history ?? (initialHistory as VersionHistory);
  return createServer(async (request, response) => {
    const reply = (status: number, body: unknown, headers?: Record<string, string>) => {
      response
        .writeHead(status, headers)
        .end(request.method === 'HEAD' ? undefined : JSON.stringify(body));
    };
    try {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      if (options.updates && (await handleUpdateRequest(request, response, options.updates)))
        return;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        reply(405, { error: 'Read-only API' }, { Allow: 'GET, HEAD' });
        return;
      }
      let url: URL;
      try {
        if (request.url?.startsWith('//')) throw new Error('Invalid request target');
        url = new URL(request.url ?? '/', 'http://localhost');
      } catch {
        reply(400, { error: 'Invalid request target' });
        return;
      }
      const pathname = url.pathname;
      if (pathname === '/api/heroes') {
        response.setHeader('Cache-Control', 'no-cache');
        const heroes = options.archive
          ? await options.archive.getHeroes()
          : (options.updates?.getSnapshot() ?? snapshot);
        if (!heroes) throw new Error('Archive has no current snapshot');
        reply(200, heroes);
      } else if (pathname === '/api/health') {
        const heroes = options.archive
          ? await options.archive.getHeroes()
          : (options.updates?.getSnapshot() ?? snapshot);
        if (!heroes) throw new Error('Archive has no current snapshot');
        const database = options.archive ? await options.archive.status() : undefined;
        reply(200, {
          status: 'ok',
          storage: options.archive ? 'postgresql' : 'json',
          clientVersion: heroes.meta.clientVersion,
          heroCount: heroes.meta.heroCount,
          ...(database ? { database } : {}),
        });
      } else if (pathname === '/api/mechanics') {
        const lang = language(url.searchParams.get('language'));
        if (!lang) {
          reply(400, { error: 'Invalid language' });
          return;
        }
        const catalog = options.archive
          ? await options.archive.getMechanics(lang)
          : options.readMechanics
            ? await options.readMechanics(lang)
            : catalogs[lang];
        if (!catalog) throw new Error('Archive has no mechanics');
        reply(200, catalog);
      } else if (pathname === '/api/version-history') {
        const current = options.archive ? await options.archive.getHistory() : history;
        if (!current) throw new Error('Archive has no version history');
        reply(200, current);
      } else if (pathname === '/api/heroes/search') {
        const input = searchInput(url);
        if (!input) {
          reply(400, { error: 'Invalid search query' });
          return;
        }
        const matches = options.archive
          ? await options.archive.searchHeroes(input.query, input.limit)
          : (options.updates?.getSnapshot() ?? snapshot).heroes
              .filter((hero) =>
                `${hero.name} ${hero.slug} ${hero.aliases}`
                  .toLocaleLowerCase()
                  .includes(input.query.toLocaleLowerCase()),
              )
              .slice(0, input.limit);
        reply(200, matches);
      } else if (pathname.startsWith('/api/formulas/')) {
        const id = pathname.slice('/api/formulas/'.length);
        const lang = language(url.searchParams.get('language'));
        if (!lang || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) {
          reply(400, { error: 'Invalid formula request' });
          return;
        }
        const formula = options.archive
          ? await options.archive.getFormula(id, lang)
          : (catalogs[lang].formulas.find((item) => item.id === id) ?? null);
        if (!formula) {
          reply(404, { error: 'Formula not found' });
          return;
        }
        reply(200, formula);
      } else reply(404, { error: 'Not found' });
    } catch {
      if (!response.headersSent)
        reply(options.archive ? 503 : 500, {
          error: options.archive ? 'Archive unavailable' : 'Request failed',
        });
      else response.end();
    }
  });
}
