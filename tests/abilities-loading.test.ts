import { afterEach, expect, it, vi } from 'vitest';
import data from './fixtures/6819/heroes.json';
import type { HeroSnapshot } from '../shared/types';
import { abilityCatalogFixture } from './fixtures/hero-abilities';
const catalog = abilityCatalogFixture(data as HeroSnapshot);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it('shares catalogue transport, isolates cancellation, retries changed data and never requests statistics', async () => {
  const { loadAbilities } = await import('../src/services/abilitiesApi');
  let complete!: (value: unknown) => void;
  const fetcher = vi.fn().mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  vi.stubGlobal('fetch', fetcher);
  const first = new AbortController();
  const cancelled = loadAbilities(first.signal);
  const kept = loadAbilities(new AbortController().signal);
  first.abort();
  complete({ ok: true, json: async () => catalog });
  await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
  await expect(kept).resolves.toEqual(catalog);
  await loadAbilities(new AbortController().signal);
  expect(fetcher).toHaveBeenCalledTimes(1);
  fetcher.mockResolvedValueOnce({ ok: true, json: async () => catalog });
  await loadAbilities(new AbortController().signal, true);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(
    fetcher.mock.calls.every(
      ([url]) => String(url).includes('abilities') && !String(url).includes('statistics'),
    ),
  ).toBe(true);
});
it('rejects malformed data without caching it', async () => {
  const { loadAbilities } = await import('../src/services/abilitiesApi');
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: true, json: async () => catalog });
  vi.stubGlobal('fetch', fetcher);
  await expect(loadAbilities(new AbortController().signal)).rejects.toThrow();
  await expect(loadAbilities(new AbortController().signal)).resolves.toEqual(catalog);
});
