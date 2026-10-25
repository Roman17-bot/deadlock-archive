import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { HeroSnapshot } from '../../shared/types.ts';

export async function persistSnapshot(
  root: string,
  snapshot: HeroSnapshot,
  previousBytes: string,
  icons: Map<string, Uint8Array>,
): Promise<string> {
  const canonical = join(root, 'data/heroes.json');
  const provenancePath = join(root, 'data/provenance.json');
  const previousProvenance = await readFile(provenancePath, 'utf8');
  // Optimistic guard: never overwrite a different update that completed while fetching.
  if ((await readFile(canonical, 'utf8')) !== previousBytes)
    throw new Error('Canonical snapshot changed during refresh');
  const backupDir = join(root, 'work/backups/updates');
  const id = randomUUID();
  const backup = join(backupDir, `heroes-${snapshot.meta.clientVersion}-${id}.json`);
  const provenanceBackup = join(backupDir, `provenance-${snapshot.meta.clientVersion}-${id}.json`);
  const temporary = join(root, `data/.heroes-${id}.tmp`);
  const provenanceTemporary = join(root, `data/.provenance-${id}.tmp`);
  const restoreTemporary = join(root, `data/.provenance-restore-${id}.tmp`);
  const createdIcons: string[] = [];
  let provenanceReplaced = false;
  let committed = false;
  try {
    // All network reads have finished and passed validation before touching disk.
    for (const [relative, bytes] of icons) {
      const path = join(root, 'public', relative);
      await mkdir(dirname(path), { recursive: true });
      try {
        await stat(path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        await writeExclusive(path, bytes);
        createdIcons.push(path);
      }
    }
    await mkdir(backupDir, { recursive: true });
    await writeExclusive(backup, previousBytes);
    await writeExclusive(provenanceBackup, previousProvenance);
    await writeExclusive(temporary, JSON.stringify(snapshot, null, 2) + '\n');
    const provenance = {
      meta: snapshot.meta,
      allRawStatsVerified: true,
      runtimeMeasured: false,
      verification: {
        adapter: 'materialized-kv3-v1',
        clientVersion: snapshot.meta.clientVersion,
        sourceCommit: snapshot.meta.gameCommit,
        heroCount: snapshot.heroes.length,
        checkedAt: snapshot.meta.checkedAt,
        scope:
          'Snapshot base/growth/scaling/raw primary weapon parameters cross-checked against version-pinned API and GameTracking; special flags read from raw; DPS is an explicit model.',
      },
    };
    await writeExclusive(provenanceTemporary, JSON.stringify(provenance, null, 2) + '\n');
    // Temp and canonical share a directory/filesystem; rename is atomic.
    if ((await readFile(canonical, 'utf8')) !== previousBytes)
      throw new Error('Canonical snapshot changed during refresh');
    if ((await readFile(provenancePath, 'utf8')) !== previousProvenance)
      throw new Error('Provenance changed during refresh');
    // Canonical heroes acts as the commit marker. Restore provenance if that final rename fails.
    await rename(provenanceTemporary, provenancePath);
    provenanceReplaced = true;
    await rename(temporary, canonical);
    committed = true;
    return backup;
  } catch (error) {
    if (provenanceReplaced) {
      try {
        await writeExclusive(restoreTemporary, previousProvenance);
        await rename(restoreTemporary, provenancePath);
      } catch (restoreError) {
        throw new AggregateError(
          [error, restoreError],
          `Snapshot save failed; restore provenance from ${provenanceBackup}`,
        );
      }
    }
    throw error;
  } finally {
    await Promise.all(
      [temporary, provenanceTemporary, restoreTemporary].map((path) => rm(path, { force: true })),
    );
    // Existing portraits are never removed. Only files created by a failed transaction are discarded.
    if (!committed) await Promise.all(createdIcons.map((path) => rm(path, { force: true })));
  }
}

export async function writeExclusive(path: string, bytes: string | Uint8Array) {
  const handle = await open(path, 'wx');
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}
