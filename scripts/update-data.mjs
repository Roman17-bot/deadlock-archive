import { fileURLToPath } from 'node:url';
import { refreshData } from '../server/updates/source.ts';
import { loadDatabaseEnvironment, createDatabasePool } from '../server/database/config.ts';
import { PostgresArchive } from '../server/database/repository.ts';
import { syncCuratedDatabase } from '../server/database/sync.ts';

const root = fileURLToPath(new URL('../', import.meta.url));

const args = process.argv.slice(2);
let dryRun = false;
let expectedVersion;
for (let index = 0; index < args.length; index++) {
  const arg = args[index];
  if (arg === '--dry-run') dryRun = true;
  else if (arg === '--expected-version') {
    const value = args[++index];
    if (!value || !/^\d+$/.test(value) || Number(value) < 1)
      throw new Error('--expected-version requires a positive integer');
    expectedVersion = Number(value);
  } else throw new Error(`Unknown option ${arg}`);
}
let savedLocally = false;
let syncingDatabase = false;
try {
  const result = await refreshData({
    root,
    dryRun,
    expectedVersion,
  });
  const { snapshot, ...report } = result;
  savedLocally = !dryRun && result.changed;
  let databaseSaved;
  if (!dryRun && result.historySaved !== false) {
    const config = loadDatabaseEnvironment(root);
    if (config) {
      syncingDatabase = true;
      const archive = new PostgresArchive(createDatabasePool(config));
      try {
        await archive.migrate();
        await syncCuratedDatabase(root, snapshot, archive);
        databaseSaved = true;
      } finally {
        await archive.close();
      }
      syncingDatabase = false;
    }
  }
  console.log(
    JSON.stringify(
      { ...report, dryRun, databaseSaved, clientVersion: snapshot.meta.clientVersion },
      null,
      2,
    ),
  );
  if (result.historySaved === false) {
    console.error(
      'Локальные данные сохранены, но история версий не сохранена. Публикация остановлена; исправьте историю перед публикацией.',
    );
    process.exitCode = 1;
  }
} catch (error) {
  console.error(
    syncingDatabase
      ? savedLocally
        ? 'Локальные JSON сохранены, но PostgreSQL не обновлён. Проверьте БД и запустите npm run db:import.'
        : 'PostgreSQL не синхронизирован. Проверьте БД и запустите npm run db:import.'
      : `Обновление не применено: ${error instanceof Error ? error.message : 'Unknown failure'}`,
  );
  process.exitCode = 1;
}
