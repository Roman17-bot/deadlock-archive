import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CuratedBundle } from '../../shared/database-types';
import { validateCuratedBundle } from '../database/bundle';
import type { PublicSnapshot, SnapshotFile, SnapshotManifest } from './types';

export const SNAPSHOT_MANIFEST_PATH = 'data/snapshot-manifest.json';
const DATA_PATHS = [
  'data/heroes.json',
  'data/mechanics.json',
  'data/mechanics.en.json',
  'data/provenance.json',
  'data/version-history.json',
];
const ITEM_DATA_PATHS = ['data/items.json', 'data/item-statistics.json'];
const MAX_FILES = 512;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const portraitPath =
  /^public\/assets\/heroes\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:webp|png|jpe?g|avif)$/;
const itemIconPath = /^public\/assets\/items\/[A-Za-z0-9][A-Za-z0-9._-]*\.webp$/;
const sha256 = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';

/** JSON-only normalization: retain source numbers and array order, sort object keys recursively. */
export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>();
  const serialize = (input: unknown, depth: number): string => {
    if (input === null || typeof input === 'string' || typeof input === 'boolean')
      return JSON.stringify(input);
    if (typeof input === 'number' && Number.isFinite(input)) return JSON.stringify(input);
    if (typeof input !== 'object' || input === null)
      throw new Error('Snapshot contains a non-JSON value');
    if (ancestors.has(input)) throw new Error('Snapshot contains circular JSON');
    ancestors.add(input);
    const indent = '  '.repeat(depth);
    const childIndent = indent + '  ';
    let output: string;
    if (Array.isArray(input))
      output = input.length
        ? '[\n' +
          Array.from(input, (item) => childIndent + serialize(item, depth + 1)).join(',\n') +
          '\n' +
          indent +
          ']'
        : '[]';
    else {
      if (
        Object.getPrototypeOf(input) !== Object.prototype &&
        Object.getPrototypeOf(input) !== null
      )
        throw new Error('Snapshot contains a non-JSON object');
      const keys = Object.keys(input).sort();
      output = keys.length
        ? '{\n' +
          keys
            .map(
              (key) =>
                childIndent +
                JSON.stringify(key) +
                ': ' +
                serialize((input as Record<string, unknown>)[key], depth + 1),
            )
            .join(',\n') +
          '\n' +
          indent +
          '}'
        : '{}';
    }
    ancestors.delete(input);
    return output;
  };
  return serialize(value, 0) + '\n';
}

function validateFileLimits(files: SnapshotFile[]): void {
  if (files.length > MAX_FILES) throw new Error('Snapshot file count exceeds limit');
  let total = 0;
  const paths = new Set<string>();
  for (const file of files) {
    if (
      (!DATA_PATHS.includes(file.path) &&
        !ITEM_DATA_PATHS.includes(file.path) &&
        file.path !== SNAPSHOT_MANIFEST_PATH &&
        !portraitPath.test(file.path) &&
        !itemIconPath.test(file.path)) ||
      paths.has(file.path)
    )
      throw new Error('Unapproved or duplicate snapshot path');
    paths.add(file.path);
    if (!Buffer.isBuffer(file.content) || file.content.length > MAX_FILE_BYTES)
      throw new Error('Snapshot file size exceeds limit');
    total += file.content.length;
  }
  if (total > MAX_TOTAL_BYTES) throw new Error('Snapshot total size exceeds limit');
}

/** Input excludes the generated manifest. This is also used by build/CI without PostgreSQL. */
export function createSnapshotManifest(
  files: SnapshotFile[],
  clientVersion: number,
  reviewedClientVersion: number,
): SnapshotManifest {
  validateFileLimits(files);
  if (files.some((file) => file.path === SNAPSHOT_MANIFEST_PATH))
    throw new Error('Manifest cannot hash itself');
  if (
    !Number.isSafeInteger(clientVersion) ||
    clientVersion < 1 ||
    !Number.isSafeInteger(reviewedClientVersion) ||
    reviewedClientVersion < 1 ||
    reviewedClientVersion > clientVersion
  )
    throw new Error('Invalid snapshot manifest versions');
  const hashes = Object.fromEntries(
    [...files]
      .sort((a, b) => a.path.localeCompare(b.path, 'en'))
      .map((file) => [file.path, sha256(file.content)]),
  );
  return {
    schemaVersion: 1,
    clientVersion,
    reviewedClientVersion,
    hash: sha256(canonicalJson(hashes)),
    files: hashes,
  };
}

/** Reject all symlink/junction components, including existing output and backup paths. */
async function safePath(root: string, relative: string, allowMissing = false): Promise<string> {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, relative);
  if (!target.startsWith(resolvedRoot + path.sep))
    throw new Error('Snapshot path escapes repository');
  const components = [resolvedRoot];
  let current = resolvedRoot;
  for (const part of path.relative(resolvedRoot, target).split(path.sep)) {
    current = path.join(current, part);
    components.push(current);
  }
  for (const component of components) {
    try {
      if ((await lstat(component)).isSymbolicLink())
        throw new Error('Snapshot path contains a symbolic link');
    } catch (error) {
      if (allowMissing && missing(error)) break;
      throw error;
    }
  }
  const existing = allowMissing ? path.dirname(target) : target;
  try {
    const actualRoot = await realpath(resolvedRoot);
    const actual = await realpath(existing);
    if (actual !== actualRoot && !actual.startsWith(actualRoot + path.sep))
      throw new Error('Snapshot path escapes repository');
  } catch (error) {
    if (!allowMissing || !missing(error)) throw error;
  }
  return target;
}

async function readBoundedFile(root: string, relative: string): Promise<Buffer> {
  const filename = await safePath(root, relative);
  const handle = await open(filename, 'r');
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error('Snapshot path is not a regular file');
    if (info.size > MAX_FILE_BYTES) throw new Error('Snapshot file size exceeds limit');
    const content = Buffer.alloc(Math.min(info.size + 1, MAX_FILE_BYTES + 1));
    let length = 0;
    while (length < content.length) {
      const read = await handle.read(content, length, content.length - length, null);
      if (!read.bytesRead) break;
      length += read.bytesRead;
    }
    if (length !== info.size || (await handle.stat()).size !== info.size)
      throw new Error('Snapshot file changed during read or exceeds size limit');
    return content.subarray(0, length);
  } finally {
    await handle.close();
  }
}

function dataFiles(bundle: CuratedBundle): SnapshotFile[] {
  const files = [
    bundle.heroes,
    bundle.mechanics.ru,
    bundle.mechanics.en,
    bundle.provenance,
    bundle.history,
  ].map((value, i) => ({ path: DATA_PATHS[i], content: Buffer.from(canonicalJson(value)) }));
  if (bundle.items && bundle.itemStatistics) {
    files.push(
      { path: ITEM_DATA_PATHS[0], content: Buffer.from(canonicalJson(bundle.items)) },
      { path: ITEM_DATA_PATHS[1], content: Buffer.from(canonicalJson(bundle.itemStatistics)) },
    );
  }
  return files;
}

export async function prepareSnapshot(root: string, input: CuratedBundle): Promise<PublicSnapshot> {
  validateCuratedBundle(input);
  const bundle = structuredClone(input);
  const portraits = [
    ...new Set(bundle.heroes.heroes.map((hero) => `public/${hero.portrait}`)),
  ].sort();
  for (const relative of portraits)
    if (!portraitPath.test(relative)) throw new Error('Unapproved hero portrait path');
  const icons = [...new Set(bundle.items?.items.map((item) => `public/${item.icon}`) ?? [])].sort();
  for (const relative of icons)
    if (!itemIconPath.test(relative)) throw new Error('Unapproved item icon path');
  if (portraits.length + icons.length + dataFiles(bundle).length + 1 > MAX_FILES)
    throw new Error('Snapshot file count exceeds limit');
  const files = dataFiles(bundle);
  validateFileLimits(files);
  // Sequential bounded reads keep allocations bounded when an asset set exceeds the total limit.
  for (const relative of [...portraits, ...icons]) {
    files.push({ path: relative, content: await readBoundedFile(root, relative) });
    validateFileLimits(files);
  }
  const clientVersion = bundle.heroes.meta.clientVersion;
  const manifest = createSnapshotManifest(
    files,
    clientVersion,
    bundle.mechanics.ru.meta.reviewedClientVersion,
  );
  files.push({ path: SNAPSHOT_MANIFEST_PATH, content: Buffer.from(canonicalJson(manifest)) });
  validateFileLimits(files);
  return { bundle, clientVersion, hash: manifest.hash, manifest, files };
}

export async function readFileSnapshot(root: string): Promise<PublicSnapshot> {
  const read = async (relative: string) =>
    JSON.parse((await readBoundedFile(root, relative)).toString('utf8')) as unknown;
  const [heroes, ru, en, provenance, history] = await Promise.all(DATA_PATHS.map(read));
  const optional = async (relative: string) => {
    try {
      return await read(relative);
    } catch (error) {
      if (missing(error)) return undefined;
      throw error;
    }
  };
  const [items, itemStatistics] = await Promise.all(ITEM_DATA_PATHS.map(optional));
  const bundle = {
    heroes,
    mechanics: { ru, en },
    provenance,
    history,
    ...(items === undefined ? {} : { items }),
    ...(itemStatistics === undefined ? {} : { itemStatistics }),
  };
  validateCuratedBundle(bundle);
  return prepareSnapshot(root, bundle);
}

export async function mirrorSnapshot(
  root: string,
  snapshot: PublicSnapshot,
  options: { expectedFiles?: ReadonlyMap<string, Buffer | null> } = {},
): Promise<{ changed: boolean }> {
  validateCuratedBundle(snapshot.bundle);
  validateFileLimits(snapshot.files);
  const expected = dataFiles(snapshot.bundle);
  for (const file of expected) {
    const actual = snapshot.files.find((candidate) => candidate.path === file.path);
    if (!actual || !actual.content.equals(file.content))
      throw new Error('Snapshot data does not match bundle');
  }
  const assets = [
    ...new Set([
      ...snapshot.bundle.heroes.heroes.map((hero) => `public/${hero.portrait}`),
      ...(snapshot.bundle.items?.items.map((item) => `public/${item.icon}`) ?? []),
    ]),
  ];
  for (const asset of assets) {
    const file = snapshot.files.find((candidate) => candidate.path === asset);
    if (!file || (!portraitPath.test(asset) && !itemIconPath.test(asset)))
      throw new Error('Snapshot is missing a referenced public asset');
    expected.push(file);
  }
  if (snapshot.files.length !== expected.length + 1)
    throw new Error('Snapshot contains unreferenced files');
  const manifest = createSnapshotManifest(
    snapshot.files.filter((file) => file.path !== SNAPSHOT_MANIFEST_PATH),
    snapshot.bundle.heroes.meta.clientVersion,
    snapshot.bundle.mechanics.ru.meta.reviewedClientVersion,
  );
  const manifestFile = snapshot.files.find((file) => file.path === SNAPSHOT_MANIFEST_PATH);
  if (
    !manifestFile ||
    !manifestFile.content.equals(Buffer.from(canonicalJson(manifest))) ||
    snapshot.hash !== manifest.hash ||
    canonicalJson(snapshot.manifest) !== canonicalJson(manifest) ||
    snapshot.clientVersion !== manifest.clientVersion
  )
    throw new Error('Snapshot manifest does not match files');
  expected.push(manifestFile);
  const changes: {
    file: SnapshotFile;
    target: string;
    previous: Buffer | null;
    temporary: string;
  }[] = [];
  const id = randomUUID();
  for (const file of expected) {
    const target = await safePath(root, file.path, true);
    let previous: Buffer | null;
    try {
      previous = await readBoundedFile(root, file.path);
    } catch (error) {
      if (!missing(error)) throw error;
      previous = null;
    }
    if (options.expectedFiles?.has(file.path)) {
      const original = options.expectedFiles.get(file.path)!;
      if (original === null ? previous !== null : previous === null || !previous.equals(original))
        throw new Error('Local curated file changed during refresh');
    }
    if (previous?.equals(file.content)) continue;
    changes.push({ file, target, previous, temporary: `${target}.${id}.tmp` });
  }
  if (!changes.length) return { changed: false };
  const backupRelative = `work/backups/sync/${id}`;
  const backup = await safePath(root, `${backupRelative}/data`, true);
  const replaced: typeof changes = [];
  try {
    await mkdir(backup, { recursive: true });
    await safePath(root, `${backupRelative}/data`);
    for (const change of changes) {
      if (change.previous !== null) {
        await mkdir(path.dirname(path.join(root, backupRelative, change.file.path)), {
          recursive: true,
        });
        await writeFile(path.join(root, backupRelative, change.file.path), change.previous, {
          flag: 'wx',
          mode: 0o600,
        });
      }
      await mkdir(path.dirname(change.target), { recursive: true });
      await safePath(root, change.file.path, true);
      await writeFile(change.temporary, change.file.content, { flag: 'wx', mode: 0o600 });
    }
    for (const change of changes) {
      await safePath(root, change.file.path, true);
      let current: Buffer | null;
      try {
        current = await readBoundedFile(root, change.file.path);
      } catch (error) {
        if (!missing(error)) throw error;
        current = null;
      }
      if (
        current === null
          ? change.previous !== null
          : change.previous === null || !current.equals(change.previous)
      )
        throw new Error('Local curated file changed during mirror');
      await rename(change.temporary, change.target);
      replaced.push(change);
    }
    return { changed: true };
  } catch (error) {
    const failures: unknown[] = [];
    for (const change of replaced.reverse()) {
      try {
        await safePath(root, change.file.path);
        if (!(await readBoundedFile(root, change.file.path)).equals(change.file.content))
          throw new Error('Local file changed before rollback');
        if (change.previous === null) await rm(change.target);
        else {
          await writeFile(change.temporary, change.previous, { flag: 'wx', mode: 0o600 });
          await rename(change.temporary, change.target);
        }
      } catch (rollbackError) {
        failures.push(rollbackError);
      }
    }
    if (failures.length)
      throw new AggregateError(
        [error, ...failures],
        `Snapshot mirror failed; restore files from ${backupRelative}`,
      );
    throw error;
  } finally {
    await Promise.all(changes.map((change) => rm(change.temporary, { force: true })));
  }
}
