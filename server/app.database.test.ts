import { afterEach, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import snapshot from '../data/heroes.json';
import mechanicsRu from '../data/mechanics.json';
import mechanicsEn from '../data/mechanics.en.json';
import history from '../data/version-history.json';
import type { HeroSnapshot } from '../shared/types';
import type { ArchiveStatus, MechanicsCatalog } from '../shared/database-types';
import type { VersionHistory } from '../shared/version-history';
import { createApp } from './app';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

async function baseUrl(server: Server) {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function archive(overrides: Record<string, unknown> = {}) {
  const stored = structuredClone(snapshot) as HeroSnapshot;
  stored.meta.clientVersion = 9999;
  stored.heroes = stored.heroes.slice(0, 1);
  stored.meta.heroCount = 1;
  return {
    getHeroes: async () => stored,
    getMechanics: async (language: 'ru' | 'en') =>
      (language === 'ru' ? mechanicsRu : mechanicsEn) as MechanicsCatalog,
    getHistory: async () => history as VersionHistory,
    status: async () =>
      ({
        storage: 'postgresql',
        schemaVersion: 1,
        currentSnapshotId: 1,
        currentClientVersion: 9999,
        snapshots: 2,
        heroes: 1,
        formulas: 27,
        sources: 43,
        historyVersions: 1,
      }) as ArchiveStatus,
    searchHeroes: async (_query: string, _limit: number) => stored.heroes,
    getFormula: async (id: string, language: 'ru' | 'en') =>
      (language === 'ru' ? mechanicsRu : mechanicsEn).formulas.find(
        (formula) => formula.id === id,
      ) ?? null,
    ...overrides,
  };
}

it('reads live heroes, mechanics, history, and health from configured archive', async () => {
  const url = await baseUrl(createApp(snapshot as HeroSnapshot, { archive: archive() }));
  const heroes = await (await fetch(`${url}/api/heroes`)).json();
  expect(heroes.meta.clientVersion).toBe(9999);
  expect(heroes.heroes).toHaveLength(1);
  expect((await (await fetch(`${url}/api/mechanics?language=en`)).json()).meta.title).toBe(
    mechanicsEn.meta.title,
  );
  expect((await (await fetch(`${url}/api/version-history`)).json()).versions).toHaveLength(1);
  expect(await (await fetch(`${url}/api/health`)).json()).toMatchObject({
    status: 'ok',
    storage: 'postgresql',
    clientVersion: 9999,
    heroCount: 1,
    database: { schemaVersion: 1, snapshots: 2 },
  });
});

it('does not fall back to JSON or expose database failures', async () => {
  const url = await baseUrl(
    createApp(snapshot as HeroSnapshot, {
      archive: archive({
        getHeroes: async () => {
          throw new Error('password=private host=internal');
        },
      }),
    }),
  );
  const response = await fetch(`${url}/api/heroes`);
  expect(response.status).toBe(503);
  expect(await response.text()).toBe('{"error":"Archive unavailable"}');
  expect((await fetch(`${url}/api/health`)).status).toBe(503);
});

it('bounds search and validates language, limit, and formula ids before store calls', async () => {
  const calls: unknown[][] = [];
  const store = archive({
    searchHeroes: async (...args: unknown[]) => {
      calls.push(args);
      return [];
    },
    getFormula: async (...args: unknown[]) => {
      calls.push(args);
      return null;
    },
  });
  const url = await baseUrl(createApp(snapshot as HeroSnapshot, { archive: store }));
  expect((await fetch(`${url}/api/heroes/search?q=harrow&limit=2`)).status).toBe(200);
  expect(calls).toEqual([['harrow', 2]]);
  expect((await fetch(`${url}/api/heroes/search?q=x&limit=21`)).status).toBe(400);
  expect((await fetch(`${url}/api/heroes/search?q=${'x'.repeat(81)}`)).status).toBe(400);
  expect((await fetch(`${url}/api/mechanics?language=zz`)).status).toBe(400);
  expect((await fetch(`${url}/api/formulas/%25?language=ru`)).status).toBe(400);
  expect((await fetch(`${url}/api/formulas/unknown?language=ru`)).status).toBe(404);
  expect(calls).toEqual([
    ['harrow', 2],
    ['unknown', 'ru'],
  ]);
});

it('keeps JSON mechanics and history available without database settings', async () => {
  const url = await baseUrl(createApp(snapshot as HeroSnapshot));
  expect((await (await fetch(`${url}/api/mechanics`)).json()).meta.title).toBe(
    mechanicsRu.meta.title,
  );
  expect((await (await fetch(`${url}/api/version-history`)).json()).versions).toHaveLength(1);
  expect((await (await fetch(`${url}/api/health`)).json()).storage).toBe('json');
  const head = await fetch(`${url}/api/mechanics`, { method: 'HEAD' });
  expect(head.status).toBe(200);
  expect(await head.text()).toBe('');
});

it('reads JSON-mode mechanics again after a local data update', async () => {
  let title = 'before';
  const url = await baseUrl(
    createApp(snapshot as HeroSnapshot, {
      readMechanics: async () =>
        ({ ...mechanicsRu, meta: { ...mechanicsRu.meta, title } }) as MechanicsCatalog,
    }),
  );
  expect((await (await fetch(`${url}/api/mechanics`)).json()).meta.title).toBe('before');
  title = 'after';
  expect((await (await fetch(`${url}/api/mechanics`)).json()).meta.title).toBe('after');
});
