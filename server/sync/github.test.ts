import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { inspectPublication, publishSnapshot, retryPublication } from './github';
import type { PublicSnapshot } from './types';

const pages = 'https://roman17-bot.github.io/deadlock-archive/';
const head = 'a'.repeat(40),
  tree = 'b'.repeat(40),
  next = 'c'.repeat(40);
const manifestPath = 'data/snapshot-manifest.json';
const sha256 = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const blob = (value: Buffer) =>
  createHash('sha1').update(`blob ${value.length}\0`).update(value).digest('hex');
const canonical = (value: unknown): string => {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, sort(x)]),
          )
        : v;
  return JSON.stringify(sort(value), null, 2) + '\n';
};
function snapshot(): PublicSnapshot {
  const files = [
    {
      path: 'data/heroes.json',
      content: Buffer.from(
        canonical({ meta: { clientVersion: 6819, sourceRevision: 111 }, heroes: [] }),
      ),
    },
    {
      path: 'data/mechanics.json',
      content: Buffer.from(
        canonical({ meta: { reviewedClientVersion: 6819, sourceRevision: 111 } }),
      ),
    },
    {
      path: 'data/mechanics.en.json',
      content: Buffer.from(
        canonical({ meta: { reviewedClientVersion: 6819, sourceRevision: 111 } }),
      ),
    },
    { path: 'data/provenance.json', content: Buffer.from('{}\n') },
    { path: 'data/version-history.json', content: Buffer.from('{}\n') },
    { path: 'public/assets/heroes/harrow.png', content: Buffer.from('portrait-fixture') },
  ];
  const hashes = Object.fromEntries(files.map((f) => [f.path, sha256(f.content)]));
  const hash = sha256(canonical(hashes));
  const manifest = {
    schemaVersion: 1 as const,
    clientVersion: 6819,
    reviewedClientVersion: 6819,
    hash,
    files: hashes,
  };
  files.push({ path: manifestPath, content: Buffer.from(canonical(manifest)) });
  return { bundle: {} as PublicSnapshot['bundle'], clientVersion: 6819, hash, manifest, files };
}
type Request = { url: URL; method: string; body: any; headers: Headers };
function remote(
  s = snapshot(),
  options: {
    changed?: boolean;
    conflict?: boolean;
    newer?: 'client' | 'revision' | 'review';
    pagesManifest?: unknown;
    corruptFile?: boolean;
    runStatus?: string;
    conclusion?: string;
    runs?: number;
    foreignRun?: boolean;
    truncated?: boolean;
    changeHead?: boolean;
    runId?: number;
    symlink?: boolean;
    oversized?: boolean;
  } = {},
) {
  const calls: Request[] = [];
  let refs = 0;
  const data = new Map(s.files.map((f) => [blob(f.content), f.content]));
  const entries = s.files.map((f) => ({
    path: f.path,
    type: 'blob',
    mode: '100644',
    sha: blob(f.content),
  }));
  entries.push({
    path: 'knowledge/private.txt',
    type: 'blob',
    mode: '100644',
    sha: 'd'.repeat(40),
  });
  if (options.symlink)
    entries.push({ path: 'public/assets', type: 'blob', mode: '120000', sha: 'd'.repeat(40) });
  if (options.changed) entries.find((e) => e.path === 'data/provenance.json')!.sha = 'e'.repeat(40);
  if (options.newer) {
    const path = options.newer === 'review' ? 'data/mechanics.json' : 'data/heroes.json';
    const content = Buffer.from(
      JSON.stringify({
        meta:
          options.newer === 'review'
            ? { reviewedClientVersion: 6820, sourceRevision: 111 }
            : {
                clientVersion: options.newer === 'client' ? 6820 : 6819,
                sourceRevision: options.newer === 'revision' ? 112 : 111,
              },
      }),
    );
    const sha = blob(content);
    data.set(sha, content);
    entries.find((e) => e.path === path)!.sha = sha;
  }
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const req = {
      url,
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : null,
      headers: new Headers(init?.headers),
    };
    calls.push(req);
    expect(init?.redirect).toBe('error');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    if (url.origin === 'https://roman17-bot.github.io') {
      expect(req.headers.has('Authorization')).toBe(false);
      expect(url.searchParams.get('snapshot')).toBe(s.hash);
      if (url.pathname.endsWith('snapshot-manifest.json'))
        return Response.json(options.pagesManifest ?? s.manifest);
      if (options.oversized) return new Response('x'.repeat(4 * 1024 * 1024 + 1));
      const path = url.pathname.replace('/deadlock-archive/', '');
      const file = s.files.find(
        (f) => (f.path.startsWith('public/') ? f.path.slice(7) : f.path) === path,
      );
      if (file) return new Response(options.corruptFile ? 'wrong' : Uint8Array.from(file.content));
    }
    expect(url.origin).toBe('https://api.github.com');
    expect(req.headers.get('Authorization')).toBe('Bearer fixture-token');
    const route = url.pathname.replace('/repos/Roman17-bot/deadlock-archive', '');
    if (route === '/git/ref/heads/main')
      return Response.json({
        object: { sha: options.changeHead && ++refs > 1 ? 'f'.repeat(40) : head },
      });
    if (route === `/git/commits/${head}`) return Response.json({ sha: head, tree: { sha: tree } });
    if (route === `/git/trees/${tree}`)
      return Response.json({ sha: tree, truncated: options.truncated ?? false, tree: entries });
    if (route.startsWith('/git/blobs/') && req.method === 'GET') {
      const sha = route.split('/').at(-1)!;
      const content = data.get(sha);
      if (content)
        return Response.json({
          encoding: 'base64',
          sha,
          size: content.length,
          content: content.toString('base64'),
        });
    }
    if (route === '/git/blobs' && req.method === 'POST')
      return Response.json({ sha: blob(Buffer.from(req.body.content, 'base64')) }, { status: 201 });
    if (route === '/git/trees' && req.method === 'POST')
      return Response.json({ sha: 'f'.repeat(40) }, { status: 201 });
    if (route === '/git/commits' && req.method === 'POST')
      return Response.json({ sha: next }, { status: 201 });
    if (route === '/git/refs/heads/main' && req.method === 'PATCH')
      return Response.json({ object: { sha: next } }, { status: options.conflict ? 422 : 200 });
    if (route === '/actions/workflows/pages.yml/runs')
      return Response.json({
        total_count: options.runs ?? 1,
        workflow_runs:
          options.runs === 0
            ? []
            : [
                {
                  id: options.runId ?? 123,
                  head_sha: options.foreignRun ? next : head,
                  head_branch: 'main',
                  path: '.github/workflows/pages.yml',
                  status: options.runStatus ?? 'completed',
                  conclusion: options.conclusion ?? 'success',
                  html_url: `https://github.com/Roman17-bot/deadlock-archive/actions/runs/${options.runId ?? 123}`,
                },
              ],
      });
    if (route === '/actions/workflows/pages.yml/dispatches' && req.method === 'POST')
      return Response.json({
        workflow_run_id: 124,
        html_url: 'https://github.com/Roman17-bot/deadlock-archive/actions/runs/124',
      });
    throw new Error(`Unexpected fixture route ${req.method} ${route}`);
  };
  return { calls, deps: { fetchImpl, credentialProvider: async () => 'fixture-token' } };
}

describe('exact approved GitHub snapshot publication', () => {
  it('creates only changed public blobs on the observed tree, then fast-forwards without dispatch', async () => {
    const s = snapshot(),
      r = remote(s, { changed: true });
    expect(await publishSnapshot(s, r.deps)).toMatchObject({
      changed: true,
      commitSha: next,
      hash: s.hash,
    });
    const writes = r.calls.filter((c) => c.method !== 'GET');
    expect(writes.map((c) => [c.method, c.url.pathname.split('/').at(-1)])).toEqual([
      ['POST', 'blobs'],
      ['POST', 'trees'],
      ['POST', 'commits'],
      ['PATCH', 'main'],
    ]);
    expect(writes[0].body).toEqual({
      content: Buffer.from('{}\n').toString('base64'),
      encoding: 'base64',
    });
    expect(writes[1].body).toEqual({
      base_tree: tree,
      tree: [
        {
          path: 'data/provenance.json',
          mode: '100644',
          type: 'blob',
          sha: blob(Buffer.from('{}\n')),
        },
      ],
    });
    expect(writes[2].body.parents).toEqual([head]);
    expect(writes[3].body).toEqual({ sha: next, force: false });
  });
  it('makes identical content a strict no-op even for a repeated same-client publication', async () => {
    const s = snapshot(),
      r = remote(s);
    expect(await publishSnapshot(s, r.deps)).toMatchObject({ changed: false, commitSha: head });
    expect(r.calls.every((c) => c.method === 'GET')).toBe(true);
  });
  it.each([
    '.env.local',
    'knowledge/private.txt',
    'public/assets/heroes/../secret.png',
    'public/assets/heroes/x.svg',
    'public/assets/heroes/x.png?query',
  ])('rejects unapproved input %s before credentials', async (path) => {
    const s = snapshot();
    s.files.push({ path, content: Buffer.from('private') });
    let credentials = false;
    await expect(
      publishSnapshot(s, {
        credentialProvider: async () => {
          credentials = true;
          return 'fixture';
        },
      }),
    ).rejects.toThrow();
    expect(credentials).toBe(false);
  });
  it.each(['client', 'revision', 'review'] as const)(
    'refuses remote %s downgrade before any mutation',
    async (newer) => {
      const s = snapshot(),
        r = remote(s, { newer });
      await expect(publishSnapshot(s, r.deps)).rejects.toThrow();
      expect(r.calls.every((c) => c.method === 'GET')).toBe(true);
    },
  );
  it('never retries a concurrent ref conflict', async () => {
    const s = snapshot(),
      r = remote(s, { changed: true, conflict: true });
    await expect(publishSnapshot(s, r.deps)).rejects.toThrow();
    expect(r.calls.filter((c) => c.method === 'PATCH')).toHaveLength(1);
  });
  it('refuses an incomplete remote tree', async () => {
    const r = remote(snapshot(), { truncated: true });
    await expect(publishSnapshot(snapshot(), r.deps)).rejects.toThrow();
    expect(r.calls.every((c) => c.method === 'GET')).toBe(true);
  });
  it('rejects a remote symlink ancestor instead of publishing through it', async () => {
    const s = snapshot(),
      r = remote(s, { symlink: true, changed: true });
    await expect(publishSnapshot(s, r.deps)).rejects.toThrow();
    expect(r.calls.filter((c) => c.method === 'PATCH')).toHaveLength(0);
  });
  it.each(['hash', 'bytes', 'duplicate', 'missing'] as const)(
    'rejects an internally inconsistent snapshot (%s)',
    async (change) => {
      const s = snapshot(),
        r = remote(s);
      if (change === 'hash') s.hash = '0'.repeat(64);
      if (change === 'bytes') s.files[0].content = Buffer.from('altered');
      if (change === 'duplicate') s.files.push(s.files[0]);
      if (change === 'missing') s.files.pop();
      await expect(publishSnapshot(s, r.deps)).rejects.toThrow();
      expect(r.calls).toHaveLength(0);
    },
  );
  it('redacts credential and HTTP error details', async () => {
    for (const credentialProvider of [
      async () => {
        throw new Error('secret-token');
      },
      async () => 'secret-token',
    ]) {
      await expect(
        publishSnapshot(snapshot(), {
          credentialProvider,
          fetchImpl: async () => {
            throw new Error('secret-token body');
          },
        }),
      ).rejects.toThrow(/^GitHub synchronization could not be completed/);
    }
  });
});

describe('verified Pages publication', () => {
  it('checks fresh public bytes after an earlier pre-deployment response was cached', async () => {
    const s = snapshot(),
      r = remote(s);
    const fetchRemote = r.deps.fetchImpl!;
    const cache = new Map<string, Uint8Array>();
    let deployed = false;
    const deps = {
      ...r.deps,
      fetchImpl: (async (input, init) => {
        const url = new URL(String(input));
        if (url.origin !== new URL(pages).origin) return fetchRemote(input, init);
        if (!cache.has(url.href)) {
          const response =
            !deployed && url.pathname.endsWith('snapshot-manifest.json')
              ? Response.json({
                  ...s.manifest,
                  clientVersion: s.clientVersion - 1,
                  reviewedClientVersion: s.clientVersion - 1,
                })
              : await fetchRemote(input, init);
          cache.set(url.href, new Uint8Array(await response.arrayBuffer()));
        }
        return new Response(Uint8Array.from(cache.get(url.href)!));
      }) as typeof fetch,
    };
    expect(await inspectPublication(s, {}, deps)).toMatchObject({ pagesMatches: false });
    deployed = true;
    expect(await inspectPublication(s, {}, deps)).toMatchObject({
      repositoryMatches: true,
      pagesMatches: true,
      pagesHash: s.hash,
      status: 'success',
    });
  });
  it('requires the exact repo blobs, exact workflow commit and all served file hashes', async () => {
    const s = snapshot(),
      r = remote(s);
    expect(await inspectPublication(s, { commitSha: head }, r.deps)).toMatchObject({
      repositoryMatches: true,
      pagesMatches: true,
      repositoryHash: s.hash,
      pagesHash: s.hash,
      commitSha: head,
      status: 'success',
      runId: 123,
    });
    expect(r.calls.filter((c) => c.url.origin === new URL(pages).origin)).toHaveLength(
      s.files.length,
    );
    expect(
      r.calls.find((c) => c.url.pathname.endsWith('/runs'))!.url.searchParams.get('head_sha'),
    ).toBe(head);
  });
  it('detects dishonest served files despite a matching manifest', async () => {
    const s = snapshot(),
      r = remote(s, { corruptFile: true });
    expect(await inspectPublication(s, {}, r.deps)).toMatchObject({
      repositoryMatches: true,
      pagesMatches: false,
      status: 'failure',
    });
  });
  it('rejects oversized public responses', async () => {
    const s = snapshot(),
      r = remote(s, { oversized: true });
    expect(await inspectPublication(s, {}, r.deps)).toMatchObject({
      pagesMatches: false,
      status: 'failure',
    });
  });
  it.each([{ hash: '0'.repeat(64) }, { schemaVersion: 1, hash: snapshot().hash }, []])(
    'short-circuits malformed/mismatched served manifest',
    async (pagesManifest) => {
      const s = snapshot(),
        r = remote(s, { pagesManifest });
      expect(await inspectPublication(s, {}, r.deps)).toMatchObject({
        pagesMatches: false,
        status: 'failure',
      });
      expect(r.calls.filter((c) => c.url.origin === new URL(pages).origin)).toHaveLength(1);
    },
  );
  it.each(['queued', 'in_progress'])('retains %s while Pages is behind', async (runStatus) => {
    const s = snapshot(),
      r = remote(s, { runStatus, pagesManifest: {} });
    expect(await inspectPublication(s, {}, r.deps)).toMatchObject({
      status: runStatus,
      pagesMatches: false,
    });
  });
  it('does not claim success for a failed workflow even when old Pages bytes match', async () => {
    const s = snapshot(),
      r = remote(s, { conclusion: 'failure' });
    expect(await inspectPublication(s, {}, r.deps)).toMatchObject({ status: 'failure' });
  });
  it('does not trust a run for another commit or claim repository match from manifest alone', async () => {
    const s = snapshot(),
      r = remote(s, { foreignRun: true, changed: true });
    expect(await inspectPublication(s, {}, r.deps)).toMatchObject({
      repositoryMatches: false,
      status: 'failure',
    });
  });
});

describe('safe deployment retry', () => {
  it.each([{ runs: 0 }, { conclusion: 'failure' }])(
    'dispatches only absent or failed exact-head deployment, pinned to the expected commit/hash',
    async (options) => {
      const s = snapshot(),
        r = remote(s, options);
      expect(await retryPublication(head, s.hash, r.deps)).toMatchObject({
        dispatched: true,
        status: 'queued',
        runId: 124,
      });
      expect(r.calls.find((c) => c.method === 'POST')!.body).toEqual({
        ref: 'main',
        inputs: { expected_commit: head, expected_hash: s.hash },
      });
    },
  );
  it.each(['queued', 'in_progress', 'completed'])(
    'does not duplicate an existing %s run',
    async (runStatus) => {
      const s = snapshot(),
        r = remote(s, { runStatus });
      expect(await retryPublication(head, s.hash, r.deps)).toMatchObject({ dispatched: false });
      expect(r.calls.every((c) => c.method === 'GET')).toBe(true);
    },
  );
  it('refuses dispatch if main advances while preparing the retry', async () => {
    const s = snapshot(),
      r = remote(s, { runs: 0, changeHead: true });
    await expect(retryPublication(head, s.hash, r.deps)).rejects.toThrow();
    expect(r.calls.every((c) => c.method === 'GET')).toBe(true);
  });
  it('coalesces concurrent retries and the list-visibility delay into one dispatch', async () => {
    const s = snapshot(),
      r = remote(s, { runs: 0 });
    const results = await Promise.all([
      retryPublication(head, s.hash, r.deps),
      retryPublication(head, s.hash, r.deps),
    ]);
    expect(results.filter((result) => result.dispatched)).toHaveLength(1);
    expect(await retryPublication(head, s.hash, r.deps)).toMatchObject({
      dispatched: false,
      status: 'queued',
      runId: 124,
    });
    expect(r.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  });
  it('allows a new retry when the dispatched attempt itself subsequently fails', async () => {
    const s = snapshot(),
      options = { conclusion: 'failure', runId: 123 },
      r = remote(s, options);
    expect(await retryPublication(head, s.hash, r.deps)).toMatchObject({ dispatched: true });
    options.runId = 124;
    expect(await retryPublication(head, s.hash, r.deps)).toMatchObject({ dispatched: true });
    expect(r.calls.filter((c) => c.method === 'POST')).toHaveLength(2);
  });
});
