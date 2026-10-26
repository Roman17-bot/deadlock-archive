import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSnapshot, canonicalJson } from './snapshot';
import { verifyPublicSnapshot } from './verification';
const source = fileURLToPath(new URL('../../', import.meta.url));
let root: string;
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'deadlock-sync-verification-'));
  for (const file of (await readFileSnapshot(source)).files) {
    await mkdir(path.dirname(path.join(root, file.path)), { recursive: true });
    await writeFile(path.join(root, file.path), file.content);
  }
});
afterAll(async () => {
  if (
    path.dirname(root) !== path.resolve(tmpdir()) ||
    !path.basename(root).startsWith('deadlock-sync-verification-')
  )
    throw Error('Invalid owned fixture');
  await rm(root, { recursive: true, force: true });
});
describe('publication build verification', () => {
  it('accepts the exact tracked snapshot and rejects another hash or client', async () => {
    const snapshot = await readFileSnapshot(root);
    expect(
      (
        await verifyPublicSnapshot(root, {
          hash: snapshot.hash,
          clientVersion: snapshot.clientVersion,
        })
      ).hash,
    ).toBe(snapshot.hash);
    await expect(verifyPublicSnapshot(root, { hash: 'f'.repeat(64) })).rejects.toThrow(/hash/i);
    await expect(
      verifyPublicSnapshot(root, { clientVersion: snapshot.clientVersion + 1 }),
    ).rejects.toThrow(/version/i);
  });
  it('rejects a stale tracked manifest while permitting the first bootstrap without one', async () => {
    const snapshot = await readFileSnapshot(root);
    await writeFile(
      path.join(root, 'data/snapshot-manifest.json'),
      canonicalJson({ ...snapshot.manifest, hash: 'f'.repeat(64) }),
    );
    await expect(verifyPublicSnapshot(root)).rejects.toThrow(/manifest/i);
    await rm(path.join(root, 'data/snapshot-manifest.json'));
    expect((await verifyPublicSnapshot(root)).hash).toBe(snapshot.hash);
  });
});
