import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { refreshData, type RefreshOptions, type RefreshResult } from '../updates/source';
import { refreshItems } from './source';
import { mirrorSnapshot, prepareSnapshot, readFileSnapshot } from '../sync/snapshot';
import type { CuratedBundle } from '../../shared/database-types';
import { readCuratedBundle } from '../database/bundle';
import type { PostgresArchive } from '../database/repository';
import { isDeepStrictEqual } from 'node:util';

export class ItemDatabaseSaveError extends Error {
  readonly localSaved = true;
  constructor() {
    super('Local item files saved; PostgreSQL import failed or changed concurrently');
  }
}

const optional = async (file: string): Promise<Buffer | null> => {
  try {
    return await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
};

/** Stage the complete public version; a failed companion fetch never advances canonical heroes. */
export async function stageArchiveRefresh<T>(
  root: string,
  run: (stage: string) => Promise<T>,
  options: { dryRun?: boolean; bundle?: CuratedBundle } = {},
): Promise<T> {
  const baseline = await readFileSnapshot(root);
  const originals = new Map<string, Buffer | null>();
  for (const file of baseline.files)
    originals.set(file.path, await optional(path.join(root, file.path)));
  for (const relative of [
    'data/items.json',
    'data/item-statistics.json',
    'data/updater-policy.json',
  ])
    originals.set(relative, await optional(path.join(root, relative)));
  // Include unreferenced approved assets: a newly referenced icon must not overwrite an owner edit.
  for (const folder of ['public/assets/items', 'public/assets/heroes']) {
    try {
      for (const entry of await readdir(path.join(root, folder), { withFileTypes: true }))
        if (entry.isFile())
          originals.set(
            `${folder}/${entry.name}`,
            await readFile(path.join(root, folder, entry.name)),
          );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  const base = path.join(root, 'work/update-stage');
  for (const directory of [path.join(root, 'work'), base]) {
    await mkdir(directory, { recursive: true });
    if ((await lstat(directory)).isSymbolicLink())
      throw new Error('Unsafe update staging directory');
  }
  const stage = path.join(base, randomUUID());
  await mkdir(stage);
  try {
    const source = options.bundle ? await prepareSnapshot(root, options.bundle) : baseline;
    for (const file of source.files) {
      await mkdir(path.dirname(path.join(stage, file.path)), { recursive: true });
      await writeFile(path.join(stage, file.path), file.content, { flag: 'wx' });
    }
    const policy = originals.get('data/updater-policy.json');
    if (policy) await writeFile(path.join(stage, 'data/updater-policy.json'), policy);
    const result = await run(stage);
    const candidate = await readFileSnapshot(stage);
    for (const [relative, original] of originals) {
      const current = await optional(path.join(root, relative));
      if (original === null ? current !== null : current === null || !current.equals(original))
        throw new Error('Local curated file changed during refresh');
    }
    for (const file of candidate.files)
      if (!originals.has(file.path)) originals.set(file.path, null);
    if (!options.dryRun) await mirrorSnapshot(root, candidate, { expectedFiles: originals });
    return result;
  } finally {
    // stage is an owned UUID child of the verified update-stage directory.
    if (path.dirname(stage) !== base) throw new Error('Unsafe update staging cleanup');
    await rm(stage, { recursive: true, force: true });
  }
}

export async function refreshArchiveData(
  options: RefreshOptions,
  dependencies: { refreshData?: typeof refreshData; refreshItems?: typeof refreshItems } = {},
): Promise<RefreshResult> {
  return stageArchiveRefresh(
    options.root,
    async (stage) => {
      const result = await (dependencies.refreshData ?? refreshData)({
        ...options,
        root: stage,
        dryRun: false,
      });
      if (result.historySaved === false) throw new Error('Version history could not be staged');
      if (result.changed)
        await (dependencies.refreshItems ?? refreshItems)({
          root: stage,
          expectedVersion: result.snapshot.meta.clientVersion,
          fetchImpl: options.fetchImpl,
        });
      return { ...result, backupPath: undefined };
    },
    { dryRun: options.dryRun },
  );
}

/** Explicit shop refresh respects PostgreSQL ownership without requesting publication. */
export async function refreshArchiveItems(
  options: {
    root: string;
    dryRun?: boolean;
    archive?: Pick<PostgresArchive, 'getBundle' | 'migrate' | 'importBundle'>;
  },
  dependencies: { refreshItems?: typeof refreshItems } = {},
) {
  const companion = options.archive
    ? await options.archive.getBundle()
    : await readCuratedBundle(options.root);
  if (!companion) throw new Error('Archive has no current public bundle');
  const result = await stageArchiveRefresh(
    options.root,
    async (stage) => {
      const refreshed = await (dependencies.refreshItems ?? refreshItems)({
        root: stage,
        expectedVersion: companion.heroes.meta.clientVersion,
      });
      return { ...refreshed, bundle: await readCuratedBundle(stage) };
    },
    { dryRun: options.dryRun, bundle: companion },
  );
  let databaseSaved = false;
  if (options.archive && !options.dryRun) {
    try {
      if (!isDeepStrictEqual(await options.archive.getBundle(), companion))
        throw new Error('Archive changed during item refresh');
      await options.archive.migrate();
      await options.archive.importBundle(result.bundle, 'explicit-item-refresh');
      databaseSaved = true;
    } catch {
      throw new ItemDatabaseSaveError();
    }
  }
  return {
    ...result,
    localSaved: !options.dryRun,
    databaseSaved,
    publication: 'not_requested' as const,
  };
}
