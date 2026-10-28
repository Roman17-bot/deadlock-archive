import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readCuratedBundle } from '../database/bundle';
import { itemFixture } from '../database/item-fixture';
import { canonicalJson, mirrorSnapshot, prepareSnapshot, readFileSnapshot } from './snapshot';

vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>();
  return { ...actual, rename: vi.fn(actual.rename) };
});
const repository = fileURLToPath(new URL('../../', import.meta.url));
const directories: string[] = [];
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'deadlock-sync-'));
  directories.push(root);
  const bundle = await readCuratedBundle(repository);
  delete bundle.items;
  delete bundle.itemStatistics;
  for (const hero of bundle.heroes.heroes) hero.portrait = 'assets/heroes/test.webp';
  await mkdir(join(root, 'public/assets/heroes'), { recursive: true });
  await writeFile(join(root, 'public/assets/heroes/test.webp'), Buffer.from([1, 2, 3]));
  return { root, bundle };
}
afterEach(async () => {
  vi.mocked(rename).mockRestore();
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  vi.mocked(rename).mockImplementation(actual.rename);
  await Promise.all(
    directories.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('public snapshot', () => {
  it('includes the paired item JSON and exact local WebP icon bytes', async () => {
    const { root, bundle } = await fixture();
    Object.assign(bundle, itemFixture(bundle.heroes.meta.clientVersion));
    await mkdir(join(root, 'public/assets/items'), { recursive: true });
    await writeFile(join(root, 'public/assets/items/test-item.webp'), Buffer.from([4, 5, 6]));
    const snapshot = await prepareSnapshot(root, bundle);
    expect(snapshot.manifest.files).toHaveProperty('data/items.json');
    expect(snapshot.manifest.files).toHaveProperty('data/item-statistics.json');
    expect(
      snapshot.files.find((f) => f.path === 'public/assets/items/test-item.webp')?.content,
    ).toEqual(Buffer.from([4, 5, 6]));
    await mirrorSnapshot(root, snapshot);
    expect((await readFileSnapshot(root)).hash).toBe(snapshot.hash);
    bundle.items!.items[0].icon = 'assets/items/../secret.webp';
    await expect(prepareSnapshot(root, bundle)).rejects.toThrow();
  });
  it('sorts nested object keys, retains array order and numeric precision with a final newline', () => {
    expect(canonicalJson({ z: [{ b: 0.123456789123, a: 2 }, 1], a: null })).toBe(
      '{\n  "a": null,\n  "z": [\n    {\n      "a": 2,\n      "b": 0.123456789123\n    },\n    1\n  ]\n}\n',
    );
  });

  it('sorts numeric-looking object keys lexically at every depth', () => {
    expect(canonicalJson({ '2': { z: 1, '10': 2, '2': 3 }, '10': 4 })).toBe(
      '{\n  "10": 4,\n  "2": {\n    "10": 2,\n    "2": 3,\n    "z": 1\n  }\n}\n',
    );
  });

  it('hashes only approved canonical data and referenced portrait bytes, stably across key insertion order', async () => {
    const { root, bundle } = await fixture();
    const snapshot = await prepareSnapshot(root, bundle);
    const reordered = {
      history: bundle.history,
      provenance: bundle.provenance,
      mechanics: bundle.mechanics,
      heroes: bundle.heroes,
    };
    expect((await prepareSnapshot(root, reordered)).hash).toBe(snapshot.hash);
    expect(snapshot.files.map((file) => file.path).sort()).toEqual([
      'data/heroes.json',
      'data/mechanics.en.json',
      'data/mechanics.json',
      'data/provenance.json',
      'data/snapshot-manifest.json',
      'data/version-history.json',
      'public/assets/heroes/test.webp',
    ]);
    expect(snapshot.manifest.files['public/assets/heroes/test.webp']).toBe(
      '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
    );
    const hashes: Record<string, string> = {};
    for (const file of snapshot.files.filter((file) => file.path !== 'data/snapshot-manifest.json'))
      hashes[file.path] = createHash('sha256').update(file.content).digest('hex');
    const serialized =
      JSON.stringify(Object.fromEntries(Object.entries(hashes).sort()), null, 2) + '\n';
    expect(snapshot.hash).toBe(createHash('sha256').update(serialized).digest('hex'));
    expect(snapshot.manifest).toMatchObject({
      schemaVersion: 1,
      clientVersion: bundle.heroes.meta.clientVersion,
      reviewedClientVersion: bundle.mechanics.ru.meta.reviewedClientVersion,
      hash: snapshot.hash,
      files: hashes,
    });
    expect(snapshot.manifest.files).not.toHaveProperty('data/snapshot-manifest.json');
  });

  it('detects same-client field or portrait changes without retagging the mechanics review', async () => {
    const { root, bundle } = await fixture();
    const original = await prepareSnapshot(root, bundle);
    bundle.heroes.heroes[0].base.regen = 0.123456789123;
    const edited = await prepareSnapshot(root, bundle);
    expect(edited.hash).not.toBe(original.hash);
    expect(edited.clientVersion).toBe(original.clientVersion);
    expect(edited.bundle.heroes.heroes[0].base.regen).toBe(0.123456789123);
    expect(original.bundle.heroes.heroes[0].base.regen).not.toBe(0.123456789123);
    await writeFile(join(root, 'public/assets/heroes/test.webp'), 'changed');
    expect((await prepareSnapshot(root, bundle)).hash).not.toBe(edited.hash);
  });

  it('validates the complete bundle before attempting any asset reads', async () => {
    const { root, bundle } = await fixture();
    bundle.history.versions = [];
    await rm(join(root, 'public'), { recursive: true });
    await expect(prepareSnapshot(root, bundle)).rejects.toThrow(/history/i);
  });

  it.each([
    '../.env.local',
    'assets/heroes/../../.env.local',
    'assets/heroes/nested/test.webp',
    'assets/heroes/test.webp?x',
    'https://example.com/a.webp',
    'assets\\heroes\\test.webp',
  ])('refuses unapproved portrait path %s', async (portrait) => {
    const { root, bundle } = await fixture();
    bundle.heroes.heroes[0].portrait = portrait;
    await expect(prepareSnapshot(root, bundle)).rejects.toThrow(/portrait|path/i);
  });

  it('refuses a symlinked portrait directory even when its destination contains valid files', async () => {
    const { root, bundle } = await fixture();
    await rename(join(root, 'public/assets/heroes'), join(root, 'outside'));
    await symlink(join(root, 'outside'), join(root, 'public/assets/heroes'), 'junction');
    await expect(prepareSnapshot(root, bundle)).rejects.toThrow(/symbolic|symlink/i);
  });

  it('refuses oversized individual files', async () => {
    const { root, bundle } = await fixture();
    await writeFile(
      join(root, 'public/assets/heroes/test.webp'),
      Buffer.alloc(4 * 1024 * 1024 + 1),
    );
    await expect(prepareSnapshot(root, bundle)).rejects.toThrow(/size|limit|large/i);
  });

  it('enforces total size and file count before publication', async () => {
    const { root, bundle } = await fixture();
    for (let i = 0; i < 8; i++) {
      bundle.heroes.heroes[i].portrait = `assets/heroes/large${i}.webp`;
      await writeFile(
        join(root, `public/assets/heroes/large${i}.webp`),
        Buffer.alloc(4 * 1024 * 1024),
      );
    }
    await expect(prepareSnapshot(root, bundle)).rejects.toThrow(/size|limit|large/i);
    const hero = bundle.heroes.heroes[0];
    bundle.heroes.heroes = Array.from({ length: 507 }, (_, i) => ({
      ...structuredClone(hero),
      id: i + 1,
      portrait: `assets/heroes/${i}.webp`,
    }));
    bundle.heroes.meta.heroCount = 507;
    (bundle.provenance as { meta: unknown }).meta = structuredClone(bundle.heroes.meta);
    await expect(prepareSnapshot(root, bundle)).rejects.toThrow(/count|limit|many/i);
  });
});

describe('local snapshot mirror', () => {
  it('writes only changed curated files and manifest, backs up originals and makes repeated saves a no-op', async () => {
    const { root, bundle } = await fixture();
    await mkdir(join(root, 'data'));
    await writeFile(join(root, 'data/heroes.json'), 'previous bytes');
    await writeFile(join(root, 'data/private.txt'), 'private');
    const snapshot = await prepareSnapshot(root, bundle);
    expect(await mirrorSnapshot(root, snapshot)).toEqual({ changed: true });
    expect((await readFileSnapshot(root)).hash).toBe(snapshot.hash);
    expect(await readFile(join(root, 'data/private.txt'), 'utf8')).toBe('private');
    const backups = await readdir(join(root, 'work/backups/sync'));
    expect(backups).toHaveLength(1);
    expect(
      await readFile(join(root, 'work/backups/sync', backups[0], 'data/heroes.json'), 'utf8'),
    ).toBe('previous bytes');
    expect(await mirrorSnapshot(root, snapshot)).toEqual({ changed: false });
    expect(await readdir(join(root, 'work/backups/sync'))).toEqual(backups);
  });

  it('restores changed files and removes newly created files when a rename fails midway', async () => {
    const { root, bundle } = await fixture();
    await mkdir(join(root, 'data'));
    await writeFile(join(root, 'data/heroes.json'), 'old heroes');
    const snapshot = await prepareSnapshot(root, bundle);
    const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    let calls = 0;
    vi.mocked(rename).mockImplementation(async (from, to) => {
      if (++calls === 3) throw new Error('injected disk failure');
      await actual.rename(from, to);
    });
    await expect(mirrorSnapshot(root, snapshot)).rejects.toThrow('injected disk failure');
    expect(await readFile(join(root, 'data/heroes.json'), 'utf8')).toBe('old heroes');
    expect((await readdir(join(root, 'data'))).sort()).toEqual(['heroes.json']);
  });

  it('rejects symlinked data directories before altering their targets', async () => {
    const { root, bundle } = await fixture();
    const snapshot = await prepareSnapshot(root, bundle);
    await mkdir(join(root, 'outside-data'));
    await writeFile(join(root, 'outside-data/heroes.json'), 'protected');
    await symlink(join(root, 'outside-data'), join(root, 'data'), 'junction');
    await expect(mirrorSnapshot(root, snapshot)).rejects.toThrow(/symbolic|symlink/i);
    expect(await readFile(join(root, 'outside-data/heroes.json'), 'utf8')).toBe('protected');
  });
});
