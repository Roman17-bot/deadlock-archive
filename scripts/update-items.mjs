import { fileURLToPath } from 'node:url';
import { refreshArchiveItems, ItemDatabaseSaveError } from '../server/items/archive-refresh.ts';
import { createDatabasePool, loadDatabaseEnvironment } from '../server/database/config.ts';
import { PostgresArchive } from '../server/database/repository.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const dryRun = process.argv.includes('--dry-run');
if (process.argv.slice(2).some((arg) => arg !== '--dry-run'))
  throw new Error('Usage: npm run items:refresh -- [--dry-run]');
let archive;
let localSaved = false;
try {
  const config = loadDatabaseEnvironment(root);
  archive = config ? new PostgresArchive(createDatabasePool(config)) : undefined;
  const result = await refreshArchiveItems({ root, dryRun, archive });
  localSaved = result.localSaved;
  console.log(
    JSON.stringify({
      dryRun,
      localSaved,
      databaseSaved: result.databaseSaved,
      publication: 'not_requested',
      clientVersion: result.catalog.meta.clientVersion,
      items: result.catalog.items.length,
      statistics: result.statistics.items.length,
      from: result.statistics.meta.from,
      to: result.statistics.meta.to,
      changed: result.changed,
    }),
  );
} catch (error) {
  if (error instanceof ItemDatabaseSaveError) localSaved = true;
  console.error(
    JSON.stringify({
      localSaved,
      databaseSaved: false,
      publication: 'not_requested',
      error: 'Item refresh failed; inspect curated data and PostgreSQL configuration, then retry.',
    }),
  );
  process.exitCode = 1;
} finally {
  await archive?.close();
}
