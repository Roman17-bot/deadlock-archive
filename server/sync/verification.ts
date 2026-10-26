import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { readFileSnapshot, SNAPSHOT_MANIFEST_PATH } from './snapshot';
import type { PublicSnapshot } from './types';
export async function verifyPublicSnapshot(
  root: string,
  expected: { hash?: string; clientVersion?: number } = {},
): Promise<PublicSnapshot> {
  const snapshot = await readFileSnapshot(root);
  if (
    expected.hash !== undefined &&
    (!/^[a-f0-9]{64}$/.test(expected.hash) || snapshot.hash !== expected.hash)
  )
    throw new Error('Snapshot hash does not match the requested publication');
  if (expected.clientVersion !== undefined && snapshot.clientVersion !== expected.clientVersion)
    throw new Error('Snapshot client version does not match the requested publication');
  try {
    const tracked = JSON.parse(await readFile(path.join(root, SNAPSHOT_MANIFEST_PATH), 'utf8'));
    if (!isDeepStrictEqual(tracked, snapshot.manifest))
      throw new Error('Tracked snapshot manifest does not match the data');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return snapshot;
}
