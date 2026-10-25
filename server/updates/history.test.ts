import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rename, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import snapshot from '../../data/heroes.json';
import history from '../../data/version-history.json';
import { validateVersionHistory } from '../../shared/version-history';
import { recordSavedVersion } from './history';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, rename: vi.fn(actual.rename) };
});
let root: string;
beforeEach(async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  vi.mocked(rename).mockImplementation(actual.rename);
  root = await mkdtemp(join(tmpdir(), 'deadlock-history-'));
  await mkdir(join(root, 'data'));
  await writeFile(join(root, 'data/heroes.json'), JSON.stringify(snapshot));
  await writeFile(join(root, 'data/version-history.json'), JSON.stringify(history));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

it('retains the original archive date and provenance when a saved client is already recorded', async () => {
  const bytes = await readFile(join(root, 'data/version-history.json'), 'utf8');
  await recordSavedVersion(root, snapshot);
  expect(await readFile(join(root, 'data/version-history.json'), 'utf8')).toBe(bytes);
});
it('roundtrips an appended client with distinct client build and archive dates', async () => {
  const next = {
    ...snapshot,
    meta: { ...snapshot.meta, clientVersion: 6820, buildDate: '2026-10-23' },
  };
  await writeFile(join(root, 'data/heroes.json'), JSON.stringify(next));
  await recordSavedVersion(root, next);
  const saved = JSON.parse(await readFile(join(root, 'data/version-history.json'), 'utf8'));
  expect(validateVersionHistory(saved)).toBe(true);
  expect(saved.versions).toHaveLength(2);
  expect(saved.versions[0]).toMatchObject({
    clientVersion: 6820,
    buildDate: '2026-10-23',
    provenance: { kind: 'snapshot-save' },
  });
  expect(Date.parse(saved.versions[0].firstPublishedAt)).toBeGreaterThan(Date.parse('2026-10-23'));
  expect(saved.versions[1]).toEqual(history.versions[0]);
});
it('preserves both the saved snapshot and previous history if history rename fails', async () => {
  const next = { ...snapshot, meta: { ...snapshot.meta, clientVersion: 6820 } };
  const canonical = JSON.stringify(next);
  const previous = await readFile(join(root, 'data/version-history.json'), 'utf8');
  await writeFile(join(root, 'data/heroes.json'), canonical);
  vi.mocked(rename).mockRejectedValueOnce(new Error('simulated history rename failure'));
  await expect(recordSavedVersion(root, next)).rejects.toThrow('simulated history rename failure');
  expect(await readFile(join(root, 'data/heroes.json'), 'utf8')).toBe(canonical);
  expect(await readFile(join(root, 'data/version-history.json'), 'utf8')).toBe(previous);
  expect(await readdir(join(root, 'data'))).toEqual(['heroes.json', 'version-history.json']);
});
it('rejects duplicate clients, malformed dates and invented provenance', () => {
  expect(
    validateVersionHistory({ ...history, versions: [...history.versions, history.versions[0]] }),
  ).toBe(false);
  for (const patch of [
    { buildDate: '2026-02-30' },
    { firstPublishedAt: '2026-10-25' },
    { provenance: { kind: 'guess', reference: 'unknown' } },
  ])
    expect(
      validateVersionHistory({ ...history, versions: [{ ...history.versions[0], ...patch }] }),
    ).toBe(false);
});
it('rejects conflicting build dates without rewriting existing history', async () => {
  await expect(
    recordSavedVersion(root, { ...snapshot, meta: { ...snapshot.meta, buildDate: '2026-10-23' } }),
  ).rejects.toThrow(/conflict/);
  expect(JSON.parse(await readFile(join(root, 'data/version-history.json'), 'utf8'))).toEqual(
    history,
  );
});
