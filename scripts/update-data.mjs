import { fileURLToPath } from 'node:url';
import { refreshData } from '../server/updates/source.ts';

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
try {
  const result = await refreshData({
    root: fileURLToPath(new URL('../', import.meta.url)),
    dryRun,
    expectedVersion,
  });
  const { snapshot, ...report } = result;
  console.log(
    JSON.stringify({ ...report, dryRun, clientVersion: snapshot.meta.clientVersion }, null, 2),
  );
  if (result.historySaved === false) {
    console.error(
      'Локальные данные сохранены, но история версий не сохранена. Публикация остановлена; исправьте историю перед публикацией.',
    );
    process.exitCode = 1;
  }
} catch (error) {
  console.error(
    `Обновление не применено: ${error instanceof Error ? error.message : 'Unknown failure'}`,
  );
  process.exitCode = 1;
}
