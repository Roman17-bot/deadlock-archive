import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import original from '../../data/heroes.json';
import { persistSnapshot } from './storage.ts';
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, rename: vi.fn(actual.rename) };
});
let root: string;
afterEach(async () => {
  vi.mocked(rename).mockReset();
  if (root) await rm(root, { recursive: true, force: true });
});
it('rolls back provenance and portraits when canonical replacement fails after provenance rename', async () => {
  root = await mkdtemp(join(tmpdir(), 'deadlock-storage-'));
  await mkdir(join(root, 'data'));
  const bytes = JSON.stringify(original);
  await writeFile(join(root, 'data/heroes.json'), bytes);
  await writeFile(join(root, 'data/provenance.json'), 'previous provenance');
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  let calls = 0;
  vi.mocked(rename).mockImplementation(async (from, to) => {
    calls++;
    if (calls === 2) throw new Error('simulated rename failure');
    await actual.rename(from, to);
  });
  await expect(
    persistSnapshot(
      root,
      original,
      bytes,
      new Map([['assets/heroes/new.webp', new Uint8Array([1, 2])]]),
    ),
  ).rejects.toThrow('simulated rename failure');
  expect(await readFile(join(root, 'data/heroes.json'), 'utf8')).toBe(bytes);
  expect(await readFile(join(root, 'data/provenance.json'), 'utf8')).toBe('previous provenance');
  await expect(readFile(join(root, 'public/assets/heroes/new.webp'))).rejects.toThrow();
});
