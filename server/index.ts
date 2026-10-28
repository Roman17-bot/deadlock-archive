import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { HeroSnapshot } from '../shared/types';
import { createApp } from './app';
import { readCuratedBundle } from './database/bundle';
import { createDatabasePool, loadDatabaseEnvironment } from './database/config';
import { PostgresArchive } from './database/repository';
import { syncCuratedDatabase } from './database/sync';
import { createUpdateManager } from './updates/manager';
import { createSyncManager } from './sync/manager';
import { mirrorSnapshot, prepareSnapshot } from './sync/snapshot';

const root = fileURLToPath(new URL('../', import.meta.url));

async function start() {
  const port = Number(process.env.API_PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid API_PORT');

  const databaseConfig = loadDatabaseEnvironment(root);
  const archive = databaseConfig ? new PostgresArchive(createDatabasePool(databaseConfig)) : null;
  try {
    let snapshot: HeroSnapshot;
    if (archive) {
      await archive.migrate();
      let current = await archive.getHeroes();
      if (!current) {
        await archive.importBundle(await readCuratedBundle(root), 'initial-seed');
        current = await archive.getHeroes();
      }
      if (!current) throw new Error('Archive has no current hero snapshot');
      snapshot = current;
    } else {
      snapshot = JSON.parse(
        await readFile(new URL('../data/heroes.json', import.meta.url), 'utf8'),
      ) as HeroSnapshot;
    }

    const onSaved = async () => {
      const { importKnowledge } = await import(
        new URL('../scripts/knowledge/import.mjs', import.meta.url).href
      );
      importKnowledge({ root });
    };
    const readDatabaseBundle = async () => {
      const bundle = await archive!.getBundle();
      if (!bundle) throw new Error('Archive has no current public bundle');
      return bundle;
    };
    const sync = archive
      ? createSyncManager({ root, readBundle: readDatabaseBundle, onSaved })
      : undefined;
    const updates = createUpdateManager({
      snapshot,
      root,
      ...(archive
        ? {
            prepareRefresh: async () => {
              await mirrorSnapshot(root, await prepareSnapshot(root, await readDatabaseBundle()));
            },
            publish: async () => sync!.publishCurrent(),
            readSnapshot: async () => {
              const saved = await archive.getHeroes();
              if (!saved) throw new Error('Archive has no current hero snapshot');
              return saved;
            },
            readHistory: async () => {
              const history = await archive.getHistory();
              if (!history) throw new Error('Archive has no current version history');
              return history;
            },
            syncDatabase: async (saved: HeroSnapshot) => {
              await syncCuratedDatabase(root, saved, archive);
            },
          }
        : {}),
      onSaved,
    });

    const app = createApp(snapshot, {
      updates,
      sync,
      archive: archive ?? undefined,
      ...(!archive
        ? {
            readMechanics: async (language: 'ru' | 'en') =>
              (await readCuratedBundle(root)).mechanics[language],
            readItems: async () => (await readCuratedBundle(root)).items ?? null,
            readItemStatistics: async () => (await readCuratedBundle(root)).itemStatistics ?? null,
          }
        : {}),
    });
    app.listen(port, '127.0.0.1', () => console.log(`API: http://127.0.0.1:${port}/api/health`));
    let closing = false;
    const close = async () => {
      if (closing) return;
      closing = true;
      await new Promise<void>((resolve) => app.close(() => resolve()));
      await archive?.close();
    };
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(signal, () => {
        void close().catch(() => {
          process.exitCode = 1;
        });
      });
    }
  } catch {
    await archive?.close();
    throw new Error('API startup failed; check PostgreSQL configuration and curated data');
  }
}

void start().catch(() => {
  // Never print database client errors: they can include host or credential details.
  console.error('API startup failed; check PostgreSQL configuration and curated data');
  process.exitCode = 1;
});
