import { fileURLToPath } from 'node:url';
import { createDatabasePool, loadDatabaseEnvironment } from '../server/database/config.ts';
import { PostgresArchive } from '../server/database/repository.ts';
import { createSyncManager, runSynchronization } from '../server/sync/manager.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (
  args.some((arg) => !['--dry-run', '--wait'].includes(arg)) ||
  (args.includes('--dry-run') && args.includes('--wait'))
)
  throw Error('Usage: npm run db:sync -- [--dry-run | --wait]');
const config = loadDatabaseEnvironment(root);
if (!config) throw Error('Configure local PostgreSQL first: npm run db:setup');
const archive = new PostgresArchive(createDatabasePool(config));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  const manager = createSyncManager({
    root,
    persistCheckpoint: !args.includes('--dry-run'),
    readBundle: async () => {
      const bundle = await archive.getBundle();
      if (!bundle) throw Error('Archive is empty');
      return bundle;
    },
    onSaved: async () => {
      const { importKnowledge } = await import('./knowledge/import.mjs');
      importKnowledge({ root });
    },
  });
  let state;
  if (args.includes('--dry-run')) state = await runSynchronization(manager, { dryRun: true });
  else {
    state = await runSynchronization(manager);
    if (args.includes('--wait')) {
      const deadline = Date.now() + 10 * 60_000;
      let phase = '';
      while (['queued', 'in_progress'].includes(state.phase) && Date.now() < deadline) {
        if (state.phase !== phase) {
          console.log(state.message);
          phase = state.phase;
        }
        await pause(5000);
        state = await manager.getState({ refresh: true });
      }
      if (['queued', 'in_progress'].includes(state.phase))
        throw Error('Deployment is still pending; check the local synchronization panel later');
    }
  }
  console.log(JSON.stringify({ ...state, dryRun: args.includes('--dry-run') }, null, 2));
  if (state.phase === 'failed') process.exitCode = 1;
} catch {
  console.error(
    'Synchronization failed. Local database data is preserved; check the local synchronization panel and retry.',
  );
  process.exitCode = 1;
} finally {
  await archive.close();
}
