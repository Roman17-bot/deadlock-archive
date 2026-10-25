import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { validateSnapshot } from '../../shared/heroes.ts';
import type { RefreshOptions, RefreshResult } from './types.ts';
import { parseKv3 } from './kv3.ts';
import { buildSnapshot } from './snapshot.ts';
import { persistSnapshot } from './storage.ts';
export type { RefreshOptions, RefreshResult } from './types.ts';

const api = 'https://api.deadlock-api.com/v1/assets';
const github = 'https://api.github.com/repos/SteamTracking/GameTracking-Deadlock/commits/master';
const permitted = new Set([
  'api.deadlock-api.com',
  'api.github.com',
  'raw.githubusercontent.com',
  'assets-bucket.deadlock-api.com',
]);
async function request(
  fetchImpl: typeof fetch,
  url: string,
  limit = 16_000_000,
): Promise<Uint8Array> {
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    !permitted.has(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.port
  )
    throw new Error('Untrusted source URL');
  const response = await fetchImpl(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(45_000),
    headers: {
      'user-agent': 'DeadlockArchive-Updater/1.0',
      accept: 'application/json,text/plain,*/*',
    },
  });
  if (!response.ok) throw new Error(`Upstream ${parsed.hostname}: HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > limit)
    throw new Error('Upstream body too large');
  if (!response.body) throw new Error('Empty upstream body');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > limit) throw new Error('Upstream body too large');
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
const text = (bytes: Uint8Array) => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
async function batch<T>(jobs: Promise<T>[]): Promise<T[]> {
  const results = await Promise.allSettled(jobs);
  const failed = results.find((result) => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
  return results.map((result) => (result as PromiseFulfilledResult<T>).value);
}
function steamInfo(input: any): { version: number; revision: number; buildDate: string } {
  const version = input.client_version,
    revision = input.source_revision;
  if (
    !Number.isInteger(version) ||
    version < 1 ||
    !Number.isInteger(revision) ||
    revision < 1 ||
    input.server_version !== version
  )
    throw new Error('Invalid/mismatched steam version');
  const date = new Date(`${input.version_date} ${input.version_time ?? '00:00:00'} UTC`);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid build date');
  return { version, revision, buildDate: date.toISOString().slice(0, 10) };
}
function rawSteam(source: string) {
  const result: Record<string, string> = {};
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const i = line.indexOf('=');
    if (i < 1 || Object.hasOwn(result, line.slice(0, i))) throw new Error('Malformed steam.inf');
    result[line.slice(0, i)] = line.slice(i + 1).trim();
  }
  return steamInfo({
    client_version: Number(result.ClientVersion),
    server_version: Number(result.ServerVersion),
    source_revision: Number(result.SourceRevision),
    version_date: result.VersionDate,
    version_time: result.VersionTime,
  });
}

export async function refreshData({
  root,
  fetchImpl = fetch,
  dryRun = false,
  expectedVersion,
}: RefreshOptions): Promise<RefreshResult> {
  const previousBytes = await readFile(join(root, 'data/heroes.json'), 'utf8');
  const current = JSON.parse(previousBytes);
  if (!validateSnapshot(current)) throw new Error('Invalid canonical snapshot');
  const policy = JSON.parse(await readFile(join(root, 'data/updater-policy.json'), 'utf8'));
  const json = async (url: string) => JSON.parse(text(await request(fetchImpl, url)));
  const [latest, head] = await batch([json(`${api}/steam-info`), json(github)]);
  const info = steamInfo(latest);
  const commit = head.sha;
  if (typeof commit !== 'string' || !/^[a-f0-9]{40}$/.test(commit))
    throw new Error('Invalid GameTracking commit');
  if (expectedVersion !== undefined && info.version !== expectedVersion)
    throw new Error(`Expected version ${expectedVersion}, found ${info.version}`);
  if (info.version < current.meta.clientVersion)
    throw new Error('Refusing client version downgrade');
  const pinned = `https://raw.githubusercontent.com/SteamTracking/GameTracking-Deadlock/${commit}/game/citadel`;
  const versionQuery = `client_version=${info.version}`;
  const [pinnedInfo, allHeroes, activeHeroes, items, rawInfo, heroesText, abilitiesText] =
    await batch<any>([
      json(`${api}/steam-info?${versionQuery}`),
      json(`${api}/heroes?${versionQuery}&language=english`),
      json(`${api}/heroes?${versionQuery}&only_active=true`),
      json(`${api}/items?${versionQuery}&language=english`),
      request(fetchImpl, `${pinned}/steam.inf`, 100_000).then(text),
      request(fetchImpl, `${pinned}/pak01_dir/scripts/heroes.vdata`).then(text),
      request(fetchImpl, `${pinned}/pak01_dir/scripts/abilities.vdata`).then(text),
    ]);
  if (
    !isDeepStrictEqual(info, steamInfo(pinnedInfo)) ||
    !isDeepStrictEqual(info, rawSteam(rawInfo))
  )
    throw new Error('API/GameTracking version or revision disagreement');
  if (!Array.isArray(allHeroes) || !Array.isArray(activeHeroes) || !Array.isArray(items))
    throw new Error('Malformed asset arrays');
  const checkedAt = new Date().toISOString();
  const candidate = buildSnapshot({
    current,
    heroes: parseKv3(heroesText),
    abilities: parseKv3(abilitiesText),
    apiHeroes: allHeroes,
    activeHeroes,
    apiItems: items,
    heroesText,
    abilitiesText,
    policy,
    version: info.version,
    revision: info.revision,
    commit,
    checkedAt,
    buildDate: info.buildDate,
  });
  // Model/source documentation can evolve separately; avoid rewriting same-version canonical metadata on every check.
  const changed =
    info.version !== current.meta.clientVersion ||
    info.revision !== current.meta.sourceRevision ||
    commit !== current.meta.gameCommit ||
    !isDeepStrictEqual(
      candidate.heroes.map(({ source: _, ...h }) => h),
      current.heroes.map(({ source: _, ...h }) => h),
    );
  const icons = new Map<string, Uint8Array>();
  for (const hero of candidate.heroes) {
    if (!/^assets\/heroes\/[a-z0-9-]+\.webp$/.test(hero.portrait))
      throw new Error('Unsafe portrait path');
    try {
      const file = await stat(join(root, 'public', hero.portrait));
      if (file.size > 0) continue;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const source = allHeroes.find((entry: any) => entry.id === hero.id)?.images
      ?.icon_image_small_webp;
    if (typeof source !== 'string' || new URL(source).hostname !== 'assets-bucket.deadlock-api.com')
      throw new Error(`Missing/trusted WebP icon ${hero.id}`);
    const bytes = await request(fetchImpl, source, 2_000_000);
    if (
      bytes.length < 12 ||
      text(bytes.slice(0, 4)) !== 'RIFF' ||
      text(bytes.slice(8, 12)) !== 'WEBP'
    )
      throw new Error('Invalid WebP portrait');
    icons.set(hero.portrait, bytes);
  }
  // Recheck the latest version after every dependent/portrait fetch. A patch in flight cannot be saved.
  if (!isDeepStrictEqual(info, steamInfo(await json(`${api}/steam-info`))))
    throw new Error('Client version changed during refresh');
  const oldIds = new Set(current.heroes.map((h) => h.id));
  const newIds = new Set(candidate.heroes.map((h) => h.id));
  const added = candidate.heroes.filter((h) => !oldIds.has(h.id)).length;
  const removed = current.heroes.filter((h) => !newIds.has(h.id)).length;
  const updated = candidate.heroes.filter(
    (h) =>
      oldIds.has(h.id) &&
      !isDeepStrictEqual(
        { ...h, source: null },
        { ...current.heroes.find((old) => old.id === h.id), source: null },
      ),
  ).length;
  const summary = {
    heroCount: candidate.heroes.length,
    added,
    removed,
    updated,
    text: `Клиент ${info.version}: ${candidate.heroes.length} героев; +${added}, −${removed}, изменено ${updated}. ${changed ? 'Кандидат проверен.' : 'Изменений нет.'}`,
  };
  const snapshot = changed ? candidate : current;
  const backupPath =
    changed && !dryRun ? await persistSnapshot(root, snapshot, previousBytes, icons) : undefined;
  return { snapshot, changed, checkedAt, sourceCommit: commit, backupPath, summary };
}
