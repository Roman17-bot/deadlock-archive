import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { ItemCatalog, ItemStatistics } from '../../shared/item-types';
import { canonicalJson } from '../sync/snapshot';
import { normalizeCatalog, normalizeStatistics } from './normalize';
import type { RawItem } from './traits';

const api = 'https://api.deadlock-api.com/v1';
const approved = new Set(['api.deadlock-api.com', 'assets-bucket.deadlock-api.com']);
async function request(fetchImpl: typeof fetch, url: string, max = 16_000_000): Promise<Buffer> {
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    !approved.has(parsed.hostname) ||
    parsed.port ||
    parsed.username ||
    parsed.password
  )
    throw new Error('Untrusted item source or icon');
  const response = await fetchImpl(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(45_000),
    headers: { accept: 'application/json,image/webp', 'user-agent': 'DeadlockArchive-Items/1.0' },
  });
  if (!response.ok) throw new Error(`Item source HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > max || !response.body)
    throw new Error('Invalid item source size');
  const chunks: Uint8Array[] = [],
    reader = response.body.getReader();
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw new Error('Item source exceeds size limit');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks, size);
}
interface SteamInfo {
  client_version: number;
  server_version: number;
  source_revision: number;
  version_date: string;
  version_time: string;
}
function steam(value: unknown): SteamInfo {
  const s = value as SteamInfo;
  if (
    !s ||
    !Number.isSafeInteger(s.client_version) ||
    s.client_version < 1 ||
    s.server_version !== s.client_version ||
    !Number.isSafeInteger(s.source_revision) ||
    !Number.isFinite(Date.parse(`${s.version_date} ${s.version_time} UTC`))
  )
    throw new Error('Invalid item client version');
  return s;
}
const readOptional = async (file: string): Promise<Buffer | null> => {
  try {
    return await readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
};

export interface ItemRefreshOptions {
  root: string;
  expectedVersion: number;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}
export async function refreshItems({
  root,
  expectedVersion,
  dryRun = false,
  fetchImpl = fetch,
  now = () => new Date(),
}: ItemRefreshOptions): Promise<{
  catalog: ItemCatalog;
  statistics: ItemStatistics;
  changed: boolean;
}> {
  const files = ['data/items.json', 'data/item-statistics.json'];
  const previous = await Promise.all(files.map((f) => readOptional(path.join(root, f))));
  const json = async (url: string) =>
    JSON.parse((await request(fetchImpl, url)).toString('utf8')) as unknown;
  const initial = steam(await json(`${api}/assets/steam-info`));
  if (initial.client_version !== expectedVersion)
    throw new Error('Item client version changed before refresh');
  const query = `client_version=${expectedVersion}`;
  const [en, ru] = await Promise.all([
    json(`${api}/assets/items?${query}&language=english`),
    json(`${api}/assets/items?${query}&language=russian`),
  ]);
  const end = now();
  end.setMilliseconds(0);
  const from = new Date(
    Math.max(
      Date.parse(`${initial.version_date} ${initial.version_time} UTC`),
      end.getTime() - 14 * 86400_000,
    ),
  );
  if (from >= end) throw new Error('Invalid item statistics period');
  const updatedAt = end.toISOString();
  const catalog = normalizeCatalog(en, ru, {
    clientVersion: expectedVersion,
    sourceRevision: initial.source_revision,
    updatedAt,
  });
  const params = new URLSearchParams({
    game_mode: 'normal',
    match_mode: 'ranked,unranked',
    min_unix_timestamp: String(from.getTime() / 1000),
    max_unix_timestamp: String(end.getTime() / 1000),
    min_matches: '1',
    corrupted_items: 'exclude',
  });
  // Sequential heavy analytics requests share the same explicit cohort and avoid rate-limit bursts.
  const overall = await json(`${api}/analytics/item-stats?bucket=no_bucket&${params}`);
  const heroes = await json(`${api}/analytics/item-stats?bucket=hero&${params}`);
  const statistics = normalizeStatistics(
    overall,
    heroes,
    { clientVersion: expectedVersion, updatedAt, from: from.toISOString(), to: end.toISOString() },
    catalog,
  );
  const upstream = new Map((en as RawItem[]).map((i) => [i.id, i]));
  const icons = new Map<string, Buffer>();
  // Four bounded workers keep network and memory usage independent of total item count.
  let index = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (;;) {
        const i = index++;
        if (i >= catalog.items.length) return;
        const item = catalog.items[i];
        const source = upstream.get(item.id)?.shop_image_webp ?? upstream.get(item.id)?.image_webp;
        if (!source || new URL(source).hostname !== 'assets-bucket.deadlock-api.com')
          throw new Error(`Missing trusted item icon: ${item.name}`);
        if (!/^assets\/items\/[a-z0-9-]+\.webp$/.test(item.icon))
          throw new Error('Unsafe item icon path');
        const bytes = await request(fetchImpl, source, 1_000_000);
        if (
          bytes.length < 12 ||
          bytes.subarray(0, 4).toString() !== 'RIFF' ||
          bytes.subarray(8, 12).toString() !== 'WEBP'
        )
          throw new Error('Invalid WebP item icon');
        icons.set(`public/${item.icon}`, bytes);
      }
    }),
  );
  const final = steam(await json(`${api}/assets/steam-info`));
  if (
    final.client_version !== initial.client_version ||
    final.source_revision !== initial.source_revision
  )
    throw new Error('Item client version changed during refresh');
  const values = [Buffer.from(canonicalJson(catalog)), Buffer.from(canonicalJson(statistics))];
  const changed = values.some((value, i) => !previous[i]?.equals(value));
  if (dryRun) return { catalog, statistics, changed };
  for (const [i, file] of files.entries()) {
    const current = await readOptional(path.join(root, file));
    if (!((!current && !previous[i]) || current?.equals(previous[i]!)))
      throw new Error('Item files changed during refresh; refusing overwrite');
  }
  const id = randomUUID();
  const staged = [
    ...icons.entries(),
    ...files.map((f, i) => [f, values[i]] as [string, Buffer]),
  ].map(([relative, bytes]) => ({
    relative,
    bytes,
    target: path.join(root, relative),
    temporary: path.join(root, `${relative}.${id}.tmp`),
  }));
  const replaced: { target: string; previous: Buffer | null }[] = [];
  const backup = path.join(root, 'work/backups/items', id);
  try {
    await mkdir(backup, { recursive: true });
    for (const entry of staged) {
      await mkdir(path.dirname(entry.target), { recursive: true });
      await writeFile(entry.temporary, entry.bytes, { flag: 'wx' });
    }
    for (const entry of staged) {
      const old = await readOptional(entry.target);
      if (old?.equals(entry.bytes)) {
        await rm(entry.temporary);
        continue;
      }
      if (old) {
        const saved = path.join(backup, entry.relative);
        await mkdir(path.dirname(saved), { recursive: true });
        await writeFile(saved, old, { flag: 'wx', mode: 0o600 });
      }
      await rename(entry.temporary, entry.target);
      replaced.push({ target: entry.target, previous: old });
    }
  } catch (error) {
    for (const entry of replaced.reverse()) {
      if (entry.previous) await writeFile(entry.target, entry.previous);
      else await rm(entry.target, { force: true });
    }
    throw error;
  } finally {
    await Promise.all(staged.map((s) => rm(s.temporary, { force: true })));
  }
  return { catalog, statistics, changed };
}
