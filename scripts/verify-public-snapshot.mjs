import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { verifyPublicSnapshot } from '../server/sync/verification.ts';
const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const commit = process.env.EXPECTED_SYNC_COMMIT;
  if (
    commit &&
    (!/^[a-f0-9]{40}$/.test(commit) ||
      execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() !== commit)
  )
    throw Error('Requested publication commit mismatch');
  const version = process.env.EXPECTED_VERSION;
  if (version && (!/^[1-9][0-9]*$/.test(version) || !Number.isSafeInteger(Number(version))))
    throw Error('Invalid expected version');
  const snapshot = await verifyPublicSnapshot(root, {
    hash: process.env.EXPECTED_SNAPSHOT_HASH || undefined,
    clientVersion: version ? Number(version) : undefined,
  });
  console.log(
    `Verified snapshot ${snapshot.hash}, client ${snapshot.clientVersion}, ${snapshot.files.length} public files.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Snapshot verification failed');
  process.exitCode = 1;
}
