import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { PublicSnapshot, SnapshotManifest } from './types';
import { existingCredential, type PublicationDependencies } from '../updates/publish';

const repository = 'Roman17-bot/deadlock-archive';
const api = `https://api.github.com/repos/${repository}`;
const workflowUrl = `https://github.com/${repository}/actions/workflows/pages.yml`;
const pagesUrl = 'https://roman17-bot.github.io/deadlock-archive/';
const manifestPath = 'data/snapshot-manifest.json';
const dataPaths = [
  'data/heroes.json',
  'data/mechanics.json',
  'data/mechanics.en.json',
  'data/provenance.json',
  'data/version-history.json',
];
const maxFileBytes = 4 * 1024 * 1024;
const maxFiles = 200;
const maxTotalBytes = 32 * 1024 * 1024;
const safeError = () =>
  new Error(
    'GitHub synchronization could not be completed. Check owner authorization, remote changes and retry.',
  );
const sha1 = (value: Buffer) =>
  createHash('sha1').update(`blob ${value.length}\0`).update(value).digest('hex');
const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const validSha = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const validHash = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw safeError();
  return value as Record<string, unknown>;
};
function canonical(value: unknown): string {
  const sort = (item: unknown): unknown =>
    Array.isArray(item)
      ? item.map(sort)
      : item && typeof item === 'object'
        ? Object.fromEntries(
            Object.entries(item)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([key, v]) => [key, sort(v)]),
          )
        : item;
  return JSON.stringify(sort(value), null, 2) + '\n';
}
function approvedPath(path: string): boolean {
  return (
    dataPaths.includes(path) ||
    /^public\/assets\/heroes\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:webp|png|jpe?g|avif)$/.test(path)
  );
}
function parseManifest(value: unknown): SnapshotManifest {
  const v = object(value),
    files = object(v.files);
  if (
    v.schemaVersion !== 1 ||
    !positive(v.clientVersion) ||
    !positive(v.reviewedClientVersion) ||
    v.reviewedClientVersion > v.clientVersion ||
    !validHash(v.hash)
  )
    throw safeError();
  const entries = Object.entries(files);
  if (
    entries.length < dataPaths.length ||
    entries.length >= maxFiles ||
    dataPaths.some((p) => !Object.hasOwn(files, p)) ||
    entries.some(([path, hash]) => !approvedPath(path) || !validHash(hash)) ||
    sha256(canonical(files)) !== v.hash
  )
    throw safeError();
  return value as SnapshotManifest;
}
function validateSnapshot(snapshot: PublicSnapshot): void {
  const manifest = parseManifest(snapshot.manifest);
  if (
    snapshot.hash !== manifest.hash ||
    snapshot.clientVersion !== manifest.clientVersion ||
    !Array.isArray(snapshot.files) ||
    snapshot.files.length !== Object.keys(manifest.files).length + 1 ||
    snapshot.files.length > maxFiles
  )
    throw safeError();
  const seen = new Set<string>();
  let total = 0;
  for (const file of snapshot.files) {
    if (
      !file ||
      typeof file.path !== 'string' ||
      seen.has(file.path) ||
      !Buffer.isBuffer(file.content) ||
      file.content.length > maxFileBytes ||
      (file.path !== manifestPath &&
        (!approvedPath(file.path) || manifest.files[file.path] !== sha256(file.content)))
    )
      throw safeError();
    seen.add(file.path);
    total += file.content.length;
    if (total > maxTotalBytes) throw safeError();
    if (
      file.path === manifestPath &&
      !isDeepStrictEqual(JSON.parse(file.content.toString('utf8')), manifest)
    )
      throw safeError();
  }
  if (!seen.has(manifestPath) || Object.keys(manifest.files).some((path) => !seen.has(path)))
    throw safeError();
}

export type DeploymentStatus = 'queued' | 'in_progress' | 'success' | 'failure' | 'unknown';
export interface SnapshotPublication {
  changed: boolean;
  commitSha: string;
  hash: string;
  url: string;
  runId?: number;
}
export interface PublicationInspection {
  repositoryMatches: boolean;
  pagesMatches: boolean;
  repositoryHash: string | null;
  pagesHash: string | null;
  commitSha: string;
  status: DeploymentStatus;
  url: string;
  runId?: number;
}
export interface PublicationRetry {
  dispatched: boolean;
  status: DeploymentStatus;
  url: string;
  runId?: number;
}
interface Context {
  request: (path: string, method?: string, body?: unknown) => Promise<unknown>;
  fetchPublic: (path: string, hash: string) => Promise<Buffer>;
}
async function readBounded(response: Response, maxBytes: number): Promise<Buffer> {
  const length = response.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    await response.body?.cancel();
    throw safeError();
  }
  const reader = response.body?.getReader();
  if (!reader) throw safeError();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw safeError();
      }
      chunks.push(chunk.value);
    }
    return Buffer.concat(chunks);
  } finally {
    reader.releaseLock();
  }
}
async function context(deps: PublicationDependencies): Promise<Context> {
  const token = await (deps.credentialProvider ?? existingCredential)();
  if (!token || token.length > 8192 || /\s/.test(token)) throw safeError();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const deadline = AbortSignal.timeout(90000);
  const verification = randomUUID();
  return {
    request: async (path, method = 'GET', body) => {
      const response = await fetchImpl(api + path, {
        method,
        redirect: 'error',
        signal: AbortSignal.any([deadline, AbortSignal.timeout(20000)]),
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2026-03-10',
          'User-Agent': 'deadlock-archive-local-sync',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw safeError();
      }
      if (response.status === 204) return null;
      return JSON.parse((await readBounded(response, 8 * 1024 * 1024)).toString('utf8')) as unknown;
    },
    fetchPublic: async (path, hash) => {
      const response = await fetchImpl(
        `${pagesUrl}${path}?snapshot=${hash}&verification=${verification}`,
        {
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.any([deadline, AbortSignal.timeout(15000)]),
          headers: { Accept: 'application/octet-stream', 'Cache-Control': 'no-cache' },
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw safeError();
      }
      return readBounded(response, maxFileBytes);
    },
  };
}
async function currentHead(ctx: Context): Promise<string> {
  const sha = object(object(await ctx.request('/git/ref/heads/main')).object).sha;
  if (!validSha(sha)) throw safeError();
  return sha;
}
interface RemoteTree {
  commitSha: string;
  treeSha: string;
  files: Map<string, { sha: string; mode: string; type: string }>;
}
async function readTree(ctx: Context, commitSha: string): Promise<RemoteTree> {
  const commit = object(await ctx.request(`/git/commits/${commitSha}`));
  if (commit.sha !== commitSha) throw safeError();
  const treeSha = object(commit.tree).sha;
  if (!validSha(treeSha)) throw safeError();
  const tree = object(await ctx.request(`/git/trees/${treeSha}?recursive=1`));
  if (
    tree.sha !== treeSha ||
    tree.truncated !== false ||
    !Array.isArray(tree.tree) ||
    tree.tree.length > 20000
  )
    throw safeError();
  const files: RemoteTree['files'] = new Map();
  for (const item of tree.tree) {
    const entry = object(item);
    if (
      typeof entry.path !== 'string' ||
      entry.path.length > 2048 ||
      files.has(entry.path) ||
      !validSha(entry.sha) ||
      typeof entry.type !== 'string' ||
      typeof entry.mode !== 'string'
    )
      throw safeError();
    files.set(entry.path, { sha: entry.sha, type: entry.type, mode: entry.mode });
  }
  return { commitSha, treeSha, files };
}
async function readBlob(ctx: Context, sha: string): Promise<Buffer> {
  const result = object(await ctx.request(`/git/blobs/${sha}`));
  if (
    result.sha !== sha ||
    result.encoding !== 'base64' ||
    typeof result.content !== 'string' ||
    typeof result.size !== 'number' ||
    result.size < 0 ||
    result.size > maxFileBytes ||
    !/^[A-Za-z0-9+/=\s]*$/.test(result.content)
  )
    throw safeError();
  const content = Buffer.from(result.content, 'base64');
  if (content.length !== result.size || sha1(content) !== sha) throw safeError();
  return content;
}
async function remoteManifest(ctx: Context, tree: RemoteTree): Promise<SnapshotManifest | null> {
  const entry = tree.files.get(manifestPath);
  if (!entry) return null;
  return parseManifest(JSON.parse((await readBlob(ctx, entry.sha)).toString('utf8')));
}
function sameFiles(snapshot: PublicSnapshot, tree: RemoteTree): boolean {
  return snapshot.files.every((file) => {
    const remote = tree.files.get(file.path);
    return remote?.type === 'blob' && remote.mode === '100644' && remote.sha === sha1(file.content);
  });
}
async function rejectDowngrade(
  ctx: Context,
  snapshot: PublicSnapshot,
  tree: RemoteTree,
): Promise<void> {
  for (const path of ['data/heroes.json', 'data/mechanics.json', 'data/mechanics.en.json']) {
    const localFile = snapshot.files.find((f) => f.path === path)!;
    const local = object(object(JSON.parse(localFile.content.toString('utf8'))).meta);
    const entry = tree.files.get(path);
    if (!entry) continue;
    if (entry.type !== 'blob' || entry.mode !== '100644') throw safeError();
    const remote = object(
      object(JSON.parse((await readBlob(ctx, entry.sha)).toString('utf8'))).meta,
    );
    const versionKey = path === 'data/heroes.json' ? 'clientVersion' : 'reviewedClientVersion';
    if (
      !positive(local[versionKey]) ||
      !positive(local.sourceRevision) ||
      !positive(remote[versionKey]) ||
      !positive(remote.sourceRevision) ||
      remote[versionKey] > local[versionKey] ||
      remote.sourceRevision > local.sourceRevision
    )
      throw safeError();
  }
  const manifest = await remoteManifest(ctx, tree);
  if (
    manifest &&
    (manifest.clientVersion > snapshot.clientVersion ||
      manifest.reviewedClientVersion > snapshot.manifest.reviewedClientVersion)
  )
    throw safeError();
}

/** Commit only approved bytes on the observed main tree. Normal push triggers Pages. */
export async function publishSnapshot(
  snapshot: PublicSnapshot,
  deps: PublicationDependencies = {},
): Promise<SnapshotPublication> {
  try {
    validateSnapshot(snapshot);
    const ctx = await context(deps),
      head = await currentHead(ctx),
      tree = await readTree(ctx, head);
    await rejectDowngrade(ctx, snapshot, tree);
    if (sameFiles(snapshot, tree))
      return {
        changed: false,
        commitSha: head,
        hash: snapshot.hash,
        url: `https://github.com/${repository}/commit/${head}`,
      };
    const entries: { path: string; mode: '100644'; type: 'blob'; sha: string }[] = [];
    for (const file of snapshot.files) {
      const previous = tree.files.get(file.path),
        sha = sha1(file.content);
      // Existing symlinks/submodules are never followed or silently replaced.
      if (previous && (previous.type !== 'blob' || previous.mode !== '100644')) throw safeError();
      const ancestors = file.path.split('/');
      ancestors.pop();
      while (ancestors.length) {
        const parent = tree.files.get(ancestors.join('/'));
        if (parent && (parent.type !== 'tree' || parent.mode !== '040000')) throw safeError();
        ancestors.pop();
      }
      if (previous?.sha === sha) continue;
      const created = object(
        await ctx.request('/git/blobs', 'POST', {
          content: file.content.toString('base64'),
          encoding: 'base64',
        }),
      );
      if (created.sha !== sha) throw safeError();
      entries.push({ path: file.path, mode: '100644', type: 'blob', sha });
    }
    const createdTree = object(
      await ctx.request('/git/trees', 'POST', { base_tree: tree.treeSha, tree: entries }),
    );
    if (!validSha(createdTree.sha)) throw safeError();
    const commit = object(
      await ctx.request('/git/commits', 'POST', {
        message: `Publish exact public snapshot ${snapshot.clientVersion} ${snapshot.hash}`,
        tree: createdTree.sha,
        parents: [head],
      }),
    );
    if (!validSha(commit.sha)) throw safeError();
    // No ref retry: GitHub rejects non-fast-forward changes if main advanced.
    const updated = object(
      await ctx.request('/git/refs/heads/main', 'PATCH', { sha: commit.sha, force: false }),
    );
    if (object(updated.object).sha !== commit.sha) throw safeError();
    return {
      changed: true,
      commitSha: commit.sha,
      hash: snapshot.hash,
      url: `https://github.com/${repository}/commit/${commit.sha}`,
    };
  } catch {
    throw safeError();
  }
}

interface Run {
  status: DeploymentStatus;
  url: string;
  runId?: number;
}
async function workflowRun(ctx: Context, commitSha: string): Promise<Run> {
  const result = object(
    await ctx.request(
      `/actions/workflows/pages.yml/runs?head_sha=${commitSha}&branch=main&per_page=100&exclude_pull_requests=true`,
    ),
  );
  if (
    !Array.isArray(result.workflow_runs) ||
    result.workflow_runs.length > 100 ||
    !Number.isSafeInteger(result.total_count) ||
    (result.total_count as number) > 100
  )
    throw safeError();
  const runs = result.workflow_runs
    .map(object)
    .filter(
      (run) =>
        run.head_sha === commitSha &&
        run.head_branch === 'main' &&
        run.path === '.github/workflows/pages.yml',
    );
  runs.sort((a, b) => Number(b.id) - Number(a.id));
  if (!runs.length) return { status: 'unknown', url: workflowUrl };
  const run = runs[0];
  if (
    !positive(run.id) ||
    run.html_url !== `https://github.com/${repository}/actions/runs/${run.id}`
  )
    throw safeError();
  const status =
    run.status === 'in_progress'
      ? 'in_progress'
      : ['queued', 'waiting', 'pending', 'requested'].includes(String(run.status))
        ? 'queued'
        : run.status === 'completed'
          ? run.conclusion === 'success'
            ? 'success'
            : 'failure'
          : 'unknown';
  return { status, runId: run.id, url: run.html_url };
}
async function inspectPages(
  ctx: Context,
  snapshot: PublicSnapshot,
): Promise<{ hash: string | null; matches: boolean }> {
  let hash: string | null = null;
  try {
    const manifest = parseManifest(
      JSON.parse((await ctx.fetchPublic(manifestPath, snapshot.hash)).toString('utf8')),
    );
    hash = manifest.hash;
    if (!isDeepStrictEqual(manifest, snapshot.manifest)) return { hash, matches: false };
    const files = snapshot.files.filter((file) => file.path !== manifestPath);
    let index = 0,
      matches = true;
    // Workers cap both sockets and memory. Never follow a URL supplied by the remote manifest.
    await Promise.all(
      Array.from({ length: Math.min(4, files.length) }, async () => {
        while (index < files.length && matches) {
          const file = files[index++];
          try {
            const path = file.path.startsWith('public/') ? file.path.slice(7) : file.path;
            if (
              sha256(await ctx.fetchPublic(path, snapshot.hash)) !==
              snapshot.manifest.files[file.path]
            )
              matches = false;
          } catch {
            matches = false;
          }
        }
      }),
    );
    return { hash, matches };
  } catch {
    return { hash, matches: false };
  }
}

/** Workflow acceptance is not success: verify the actual public manifest and bytes. */
export async function inspectPublication(
  snapshot: PublicSnapshot,
  options: { commitSha?: string } = {},
  deps: PublicationDependencies = {},
): Promise<PublicationInspection> {
  try {
    validateSnapshot(snapshot);
    if (options.commitSha !== undefined && !validSha(options.commitSha)) throw safeError();
    const ctx = await context(deps),
      main = await currentHead(ctx),
      tree = await readTree(ctx, main);
    const commitSha = options.commitSha ?? main;
    const manifest = await remoteManifest(ctx, tree);
    const repositoryMatches = commitSha === main && sameFiles(snapshot, tree);
    const [run, pages] = await Promise.all([
      workflowRun(ctx, commitSha),
      inspectPages(ctx, snapshot),
    ]);
    const status =
      !repositoryMatches || run.status === 'failure'
        ? 'failure'
        : pages.matches
          ? 'success'
          : run.status === 'success'
            ? 'failure'
            : run.status;
    return {
      repositoryMatches,
      pagesMatches: pages.matches,
      repositoryHash: manifest?.hash ?? null,
      pagesHash: pages.hash,
      commitSha,
      status,
      url: run.url,
      ...(run.runId ? { runId: run.runId } : {}),
    };
  } catch {
    throw safeError();
  }
}

interface RetryGuard {
  pending?: Promise<PublicationRetry>;
  result?: PublicationRetry;
  priorRunId?: number;
  expiresAt: number;
}
// A dispatch may take time to appear in the run list. Scope guards to the HTTP
// transport and bound their lifetime; the owner's checkpoint also persists queued state.
const retryGuards = new WeakMap<typeof fetch, Map<string, RetryGuard>>();
async function performRetry(
  commitSha: string,
  hash: string,
  deps: PublicationDependencies,
  guard: RetryGuard,
): Promise<PublicationRetry> {
  const ctx = await context(deps);
  if ((await currentHead(ctx)) !== commitSha) throw safeError();
  const tree = await readTree(ctx, commitSha),
    manifest = await remoteManifest(ctx, tree);
  if (!manifest || manifest.hash !== hash) throw safeError();
  const run = await workflowRun(ctx, commitSha);
  if (run.status !== 'unknown' && run.status !== 'failure') {
    guard.result = undefined;
    return { ...run, dispatched: false };
  }
  if (
    guard.result &&
    guard.expiresAt > Date.now() &&
    (run.status === 'unknown' || run.runId === guard.priorRunId)
  )
    return { ...guard.result, dispatched: false };
  if ((await currentHead(ctx)) !== commitSha) throw safeError();
  guard.priorRunId = run.runId;
  guard.expiresAt = Date.now() + 120000;
  // Retain a queued guard even if the connection loses the accepted response.
  guard.result = { dispatched: true, status: 'queued', url: workflowUrl };
  // Exact inputs protect against main advancing after the final read.
  const response = await ctx.request('/actions/workflows/pages.yml/dispatches', 'POST', {
    ref: 'main',
    inputs: { expected_commit: commitSha, expected_hash: hash },
  });
  let result: PublicationRetry = { dispatched: true, status: 'queued', url: workflowUrl };
  if (response !== null) {
    const details = object(response);
    if (
      !positive(details.workflow_run_id) ||
      details.html_url !==
        `https://github.com/${repository}/actions/runs/${details.workflow_run_id}`
    )
      throw safeError();
    result = { ...result, runId: details.workflow_run_id, url: details.html_url };
  }
  guard.result = result;
  return result;
}
/** Retry an absent/failed exact-head Pages run, without producing another data commit. */
export async function retryPublication(
  commitSha: string,
  hash: string,
  deps: PublicationDependencies = {},
): Promise<PublicationRetry> {
  try {
    if (!validSha(commitSha) || !validHash(hash)) throw safeError();
    const transport = deps.fetchImpl ?? fetch;
    let guards = retryGuards.get(transport);
    if (!guards) {
      guards = new Map();
      retryGuards.set(transport, guards);
    }
    const key = `${commitSha}:${hash}`,
      existing = guards.get(key);
    if (existing?.pending) return { ...(await existing.pending), dispatched: false };
    const guard = existing ?? { expiresAt: 0 };
    if (guards.size >= 100 && !existing) {
      const removable = [...guards.entries()].find(([, entry]) => !entry.pending);
      if (!removable) throw safeError();
      guards.delete(removable[0]);
    }
    const pending = performRetry(commitSha, hash, deps, guard);
    guard.pending = pending;
    guards.set(key, guard);
    try {
      return await pending;
    } finally {
      guard.pending = undefined;
    }
  } catch {
    throw safeError();
  }
}
