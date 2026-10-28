import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCuratedBundle } from '../database/bundle';
import { itemFixture } from '../database/item-fixture';
import { canonicalJson, mirrorSnapshot, prepareSnapshot, readFileSnapshot } from '../sync/snapshot';
import { refreshArchiveData, refreshArchiveItems } from './archive-refresh';
import type { refreshData } from '../updates/source';
import type { refreshItems } from './source';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'deadlock-archive-refresh-'));
  roots.push(root);
  const bundle = await readCuratedBundle(fileURLToPath(new URL('../../', import.meta.url)));
  delete bundle.items;
  delete bundle.itemStatistics;
  for (const hero of bundle.heroes.heroes) hero.portrait = 'assets/heroes/test.webp';
  await mkdir(path.join(root, 'public/assets/heroes'), { recursive: true });
  await writeFile(path.join(root, 'public/assets/heroes/test.webp'), Buffer.from([1, 2, 3]));
  await mirrorSnapshot(root, await prepareSnapshot(root, bundle));
  await writeFile(path.join(root, 'data/updater-policy.json'), '{}');
  const before = await readFileSnapshot(root);
  const next = structuredClone(bundle);
  next.heroes.meta.clientVersion += 1;
  next.heroes.meta.buildDate = '2026-10-29';
  (next.provenance as { meta: unknown }).meta = structuredClone(next.heroes.meta);
  next.history.versions.unshift({
    clientVersion: next.heroes.meta.clientVersion,
    buildDate: next.heroes.meta.buildDate,
    firstPublishedAt: '2026-10-29T00:00:00Z',
    provenance: { kind: 'snapshot-save', reference: '2026-10-29T00:00:00Z' },
  });
  const heroRefresh: typeof refreshData = async ({ root: stage }) => {
    for (const [file, value] of [
      ['heroes.json', next.heroes],
      ['provenance.json', next.provenance],
      ['version-history.json', next.history],
    ] as const)
      await writeFile(path.join(stage, 'data', file), canonicalJson(value));
    return {
      snapshot: next.heroes,
      changed: true,
      checkedAt: '2026-10-29T00:00:00Z',
      sourceCommit: next.heroes.meta.gameCommit,
      historySaved: true,
      summary: {
        heroCount: next.heroes.heroes.length,
        added: 0,
        removed: 0,
        updated: 0,
        text: 'updated',
      },
    };
  };
  const itemsRefresh: typeof refreshItems = async ({ root: stage }) => {
    const pair = itemFixture(next.heroes.meta.clientVersion);
    await mkdir(path.join(stage, 'public/assets/items'), { recursive: true });
    await writeFile(path.join(stage, 'public/assets/items/test-item.webp'), Buffer.from([4, 5, 6]));
    await writeFile(path.join(stage, 'data/items.json'), canonicalJson(pair.items));
    await writeFile(
      path.join(stage, 'data/item-statistics.json'),
      canonicalJson(pair.itemStatistics),
    );
    return { catalog: pair.items, statistics: pair.itemStatistics, changed: true };
  };
  return { root, before, heroRefresh, itemsRefresh, next };
}

it('leaves canonical data unchanged on failed item ingestion and succeeds on retry', async () => {
  const { root, before, heroRefresh, itemsRefresh, next } = await fixture();
  await expect(
    refreshArchiveData(
      { root },
      {
        refreshData: heroRefresh,
        refreshItems: async () => {
          throw new Error('source failed');
        },
      },
    ),
  ).rejects.toThrow('source failed');
  expect((await readFileSnapshot(root)).hash).toBe(before.hash);
  await refreshArchiveData({ root }, { refreshData: heroRefresh, refreshItems: itemsRefresh });
  expect((await readCuratedBundle(root)).heroes.meta.clientVersion).toBe(
    next.heroes.meta.clientVersion,
  );
  expect(await readFile(path.join(root, 'public/assets/items/test-item.webp'))).toEqual(
    Buffer.from([4, 5, 6]),
  );
  expect(await readdir(path.join(root, 'work/update-stage'))).toEqual([]);
});

it('preserves concurrent owner edits and dry-run leaves all original public bytes unchanged', async () => {
  const { root, before, heroRefresh, itemsRefresh } = await fixture();
  await refreshArchiveData(
    { root, dryRun: true },
    { refreshData: heroRefresh, refreshItems: itemsRefresh },
  );
  expect((await readFileSnapshot(root)).hash).toBe(before.hash);
  const edited = Buffer.concat([
    await readFile(path.join(root, 'data/heroes.json')),
    Buffer.from('\n'),
  ]);
  await expect(
    refreshArchiveData(
      { root },
      {
        refreshData: heroRefresh,
        refreshItems: async (options) => {
          const result = await itemsRefresh(options);
          await writeFile(path.join(root, 'data/heroes.json'), edited);
          return result;
        },
      },
    ),
  ).rejects.toThrow(/changed during refresh/);
  expect(await readFile(path.join(root, 'data/heroes.json'))).toEqual(edited);
  expect((await readCuratedBundle(root)).items).toBeUndefined();
});

it('refreshes the configured database bundle and reports DB save separately; dry-run never imports', async () => {
  const { root, before, next, itemsRefresh } = await fixture();
  const companion = structuredClone(next);
  companion.heroes.heroes[0].base.health = 1234;
  const imported: unknown[] = [];
  let migrations = 0;
  const archive = {
    getBundle: async () => companion,
    migrate: async () => {
      migrations++;
    },
    importBundle: async (bundle: unknown) => {
      imported.push(bundle);
      return { imported: true, snapshotId: 1, clientVersion: next.heroes.meta.clientVersion };
    },
  };
  const dry = await refreshArchiveItems(
    { root, dryRun: true, archive },
    { refreshItems: itemsRefresh },
  );
  expect(dry.databaseSaved).toBe(false);
  expect(migrations).toBe(0);
  expect(imported).toEqual([]);
  expect((await readFileSnapshot(root)).hash).toBe(before.hash);
  const saved = await refreshArchiveItems({ root, archive }, { refreshItems: itemsRefresh });
  expect(saved.databaseSaved).toBe(true);
  expect(saved.publication).toBe('not_requested');
  expect(imported).toHaveLength(1);
  expect((await readCuratedBundle(root)).heroes.heroes[0].base.health).toBe(1234);
  expect((imported[0] as typeof companion).heroes).toEqual(companion.heroes);
});
