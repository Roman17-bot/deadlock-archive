import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { refreshItems } from './source';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
const steam = {
  client_version: 6821,
  server_version: 6821,
  source_revision: 11170534,
  version_date: 'Oct 26 2026',
  version_time: '11:14:53',
};
const raw = {
  id: 1,
  name: 'Example',
  class_name: 'upgrade_example',
  type: 'upgrade',
  shopable: true,
  item_slot_type: 'weapon',
  item_tier: 1,
  cost: 800,
  is_active_item: false,
  properties: {},
  description: {},
  tooltip_sections: [],
  shop_image_webp:
    'https://assets-bucket.deadlock-api.com/assets-api-res/images/items/weapon/example.webp',
};
const bytes = Buffer.from('RIFF0000WEBPfixture');
const observation = { item_id: 1, bucket: 0, wins: 6, losses: 4, matches: 10, avg_buy_time_s: 360 };
function fetcher(changeVersion = false) {
  let checks = 0;
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.includes('/steam-info'))
      return Response.json(
        changeVersion && ++checks > 1
          ? { ...steam, client_version: 6822, server_version: 6822 }
          : steam,
      );
    if (url.includes('/assets/items?')) return Response.json([raw]);
    if (url.includes('/analytics/item-stats?'))
      return Response.json([{ ...observation, bucket: url.includes('bucket=hero') ? 4 : 0 }]);
    if (url === raw.shop_image_webp) return new Response(bytes);
    throw new Error(`Unexpected test URL ${url}`);
  });
}
async function root() {
  const p = await mkdtemp(path.join(tmpdir(), 'deadlock-item-refresh-'));
  roots.push(p);
  await mkdir(path.join(p, 'data'));
  return p;
}
it('dry-run pins both languages and analytics cohort without changing local files', async () => {
  const p = await root(),
    request = fetcher();
  const result = await refreshItems({
    root: p,
    expectedVersion: 6821,
    dryRun: true,
    fetchImpl: request,
    now: () => new Date('2026-10-28T12:00:00Z'),
  });
  expect(result.catalog.items).toHaveLength(1);
  await expect(readFile(path.join(p, 'data/items.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  const urls = request.mock.calls.map((c) => String(c[0]));
  expect(
    urls
      .filter((u) => u.includes('/assets/items?'))
      .every((u) => u.includes('client_version=6821')),
  ).toBe(true);
  const cohorts = urls.filter((u) => u.includes('item-stats?')).map((u) => new URL(u));
  expect(cohorts.map((u) => u.searchParams.get('min_unix_timestamp'))).toEqual([
    '1793013293',
    '1793013293',
  ]);
  expect(cohorts[0].searchParams.get('max_unix_timestamp')).toBe(
    cohorts[1].searchParams.get('max_unix_timestamp'),
  );
});
it('saves paired validated data and icons, but preserves previous files if version changes in flight', async () => {
  const p = await root();
  await refreshItems({
    root: p,
    expectedVersion: 6821,
    fetchImpl: fetcher(),
    now: () => new Date('2026-10-28T12:00:00Z'),
  });
  expect(JSON.parse(await readFile(path.join(p, 'data/items.json'), 'utf8')).items[0].id).toBe(1);
  expect(await readFile(path.join(p, 'public/assets/items/example.webp'))).toEqual(bytes);
  await writeFile(path.join(p, 'data/items.json'), 'previous owner data');
  await expect(
    refreshItems({
      root: p,
      expectedVersion: 6821,
      fetchImpl: fetcher(true),
      now: () => new Date('2026-10-28T12:00:00Z'),
    }),
  ).rejects.toThrow(/changed|version/i);
  expect(await readFile(path.join(p, 'data/items.json'), 'utf8')).toBe('previous owner data');
});
it('rejects untrusted icon origins before saving data', async () => {
  const p = await root(),
    request = fetcher();
  const unsafe = vi.fn<typeof fetch>(async (input, init) =>
    String(input).includes('/assets/items?')
      ? Response.json([{ ...raw, shop_image_webp: 'https://evil.example/icon.webp' }])
      : request(input, init),
  );
  await expect(
    refreshItems({
      root: p,
      expectedVersion: 6821,
      fetchImpl: unsafe,
      now: () => new Date('2026-10-28T12:00:00Z'),
    }),
  ).rejects.toThrow(/icon|source/i);
  await expect(readFile(path.join(p, 'data/items.json'))).rejects.toMatchObject({ code: 'ENOENT' });
});
