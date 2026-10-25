import { open, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { HeroSnapshot } from '../../shared/types.ts';
import {
  validateVersionHistory,
  type VersionHistory,
  type VersionHistoryEntry,
} from '../../shared/version-history.ts';
import { writeExclusive } from './storage.ts';

/** Read only the fixed public history file, with a hard allocation/read limit. */
export async function readVersionHistory(root: string): Promise<VersionHistory> {
  const limit = 256_000;
  const handle = await open(join(root, 'data/version-history.json'), 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) throw new Error('Invalid history file');
    const bytes = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await handle.read(bytes, length, bytes.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > limit) throw new Error('History too large');
    const history: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length)),
    );
    if (!validateVersionHistory(history)) throw new Error('Invalid version history');
    return history;
  } finally {
    await handle.close();
  }
}

/** Append only after canonical save. Failure must never roll back the saved snapshot. */
export async function recordSavedVersion(root: string, snapshot: HeroSnapshot): Promise<void> {
  const path = join(root, 'data/version-history.json');
  const previous = await readFile(path, 'utf8');
  const history: unknown = JSON.parse(previous);
  if (!validateVersionHistory(history)) throw new Error('Invalid version history');
  const entry = history.versions.find(
    (entry) => entry.clientVersion === snapshot.meta.clientVersion,
  );
  if (entry) {
    if (entry.buildDate !== snapshot.meta.buildDate) throw new Error('History build date conflict');
    return;
  }
  if (history.versions.some((entry) => entry.clientVersion > snapshot.meta.clientVersion))
    throw new Error('Refusing history downgrade');
  const firstPublishedAt = new Date().toISOString();
  const next: VersionHistoryEntry = {
    clientVersion: snapshot.meta.clientVersion,
    buildDate: snapshot.meta.buildDate,
    firstPublishedAt,
    provenance: { kind: 'snapshot-save', reference: firstPublishedAt },
  };
  history.versions.unshift(next);
  if (!validateVersionHistory(history)) throw new Error('Invalid saved version');
  const temporary = join(root, `data/.version-history-${randomUUID()}.tmp`);
  try {
    await writeExclusive(temporary, JSON.stringify(history, null, 2) + '\n');
    if ((await readFile(path, 'utf8')) !== previous) throw new Error('History changed during save');
    // A concurrent external save must not attach history to a different canonical version.
    const canonical = JSON.parse(await readFile(join(root, 'data/heroes.json'), 'utf8'));
    if (
      canonical.meta.clientVersion !== snapshot.meta.clientVersion ||
      canonical.meta.buildDate !== snapshot.meta.buildDate
    )
      throw new Error('Canonical snapshot changed before history save');
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
