import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import original from '../../tests/fixtures/6819/heroes.json';
import originalProvenance from '../../tests/fixtures/6819/provenance.json';
import originalHistory from '../../tests/fixtures/6819/version-history.json';
import { getLatestVersion, refreshData } from './source.ts';

const fixture = (name: string) => readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const sha = '17462b250a0ca80e7f80102f2c83cc3eecff5f12';
let root: string;
let heroesText: string;
let weaponsText: string;
let apiHeroes: Record<string, any>[];
let apiItems: Record<string, any>[];
let latestCalls: number;
let changedVersion: boolean;
let revision = 11162696;
let iconUrl: string | undefined;
const info = () => ({
  client_version: 6819,
  server_version: 6819,
  source_revision: revision,
  version_date: 'Oct 22 2026',
  version_time: '16:40:35',
});
const fetchImpl: typeof fetch = async (input) => {
  const url = new URL(String(input));
  if (url.pathname.endsWith('/steam-info')) {
    if (!url.search) latestCalls++;
    return Response.json(
      changedVersion && latestCalls > 1 ? { ...info(), client_version: 6820 } : info(),
    );
  }
  if (url.pathname.endsWith('/commits/master'))
    return Response.json({
      sha,
      commit: { message: '6819 | updated files\n\nhttps://steamdb.info/patchnotes/26147187/' },
    });
  if (url.pathname.endsWith('/steam.inf'))
    return new Response(
      'ClientVersion=6819\nServerVersion=6819\nSourceRevision=11162696\nVersionDate=Oct 22 2026\nVersionTime=16:40:35',
    );
  if (url.pathname.endsWith('/heroes.vdata')) return new Response(heroesText);
  if (url.pathname.endsWith('/abilities.vdata')) return new Response(weaponsText);
  if (url.pathname.endsWith('/heroes')) return Response.json(apiHeroes);
  if (url.pathname.endsWith('/items')) return Response.json(apiItems);
  if (url.hostname === 'assets-bucket.deadlock-api.com')
    return new Response(new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]), {
      headers: { 'content-type': 'image/webp' },
    });
  throw new Error(`Unexpected request ${url}`);
};
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'deadlock-refresh-'));
  await mkdir(join(root, 'data'));
  await writeFile(join(root, 'data/heroes.json'), JSON.stringify(original));
  await writeFile(join(root, 'data/provenance.json'), JSON.stringify(originalProvenance));
  await writeFile(join(root, 'data/version-history.json'), JSON.stringify(originalHistory));
  await writeFile(
    join(root, 'data/updater-policy.json'),
    await readFile(new URL('../../data/updater-policy.json', import.meta.url), 'utf8'),
  );
  heroesText = await fixture('heroes.vdata');
  weaponsText = await fixture('abilities.vdata');
  apiHeroes = JSON.parse(await fixture('heroes.json'));
  apiItems = JSON.parse(await fixture('items.json'));
  latestCalls = 0;
  changedVersion = false;
  revision = 11162696;
  iconUrl = undefined;
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('version-bound refresh transaction', () => {
  it('checks only the bounded steam-info document for preflight', async () => {
    const calls: string[] = [];
    expect(
      await getLatestVersion({
        fetchImpl: async (input) => {
          calls.push(String(input));
          return Response.json(info());
        },
      }),
    ).toEqual({ version: 6819, revision: 11162696, buildDate: '2026-10-22' });
    expect(calls).toEqual(['https://api.deadlock-api.com/v1/assets/steam-info']);
  });
  it.each([
    null,
    { ...info(), client_version: 0 },
    { ...info(), server_version: 6820 },
    { ...info(), source_revision: 0 },
    { ...info(), version_date: 'garbage' },
  ])('rejects invalid version-only responses: %j', async (value) => {
    await expect(
      getLatestVersion({ fetchImpl: async () => Response.json(value) }),
    ).rejects.toThrow();
  });
  it('rejects oversized version-only responses', async () => {
    await expect(
      getLatestVersion({ fetchImpl: async () => new Response(' '.repeat(100_001)) }),
    ).rejects.toThrow(/large/);
  });
  it('records a new saved client in history without duplicating subsequent refreshes', async () => {
    const prior = structuredClone(original);
    prior.meta.clientVersion = 6818;
    await writeFile(join(root, 'data/heroes.json'), JSON.stringify(prior));
    await writeFile(
      join(root, 'data/version-history.json'),
      JSON.stringify({ schemaVersion: 1, versions: [] }),
    );
    const result = await refreshData({ root, fetchImpl });
    const history = JSON.parse(await readFile(join(root, 'data/version-history.json'), 'utf8'));
    expect(history.versions).toHaveLength(1);
    expect(history.versions[0]).toMatchObject({
      clientVersion: 6819,
      buildDate: '2026-10-22',
      provenance: { kind: 'snapshot-save' },
      patch: {
        source: 'steamdb',
        steamBuildId: 26147187,
        url: 'https://steamdb.info/patchnotes/26147187/',
        gameCommit: sha,
        notes: 'unknown',
      },
    });
    expect(result).toMatchObject({ changed: true, historySaved: true });
    latestCalls = 0;
    const bytes = await readFile(join(root, 'data/version-history.json'), 'utf8');
    await refreshData({ root, fetchImpl });
    expect(await readFile(join(root, 'data/version-history.json'), 'utf8')).toBe(bytes);
  });
  it('retains a successful snapshot save and reports a history failure separately', async () => {
    await writeFile(join(root, 'data/version-history.json'), '{broken');
    const result = await refreshData({ root, fetchImpl });
    expect(result).toMatchObject({ changed: true, historySaved: false });
    expect(JSON.parse(await readFile(join(root, 'data/heroes.json'), 'utf8'))).toEqual(
      result.snapshot,
    );
    expect(await readFile(join(root, 'data/version-history.json'), 'utf8')).toBe('{broken');
  });
  it('rejects raw legacy release flags that disagree with the active API roster', async () => {
    const start = heroesText.indexOf('"hero_baba" = ');
    heroesText =
      heroesText.slice(0, start) +
      heroesText.slice(start).replace('"m_eHeroDevelopmentState" = "EHeroDevState_Release"', '');
    await expect(refreshData({ root, fetchImpl, dryRun: true })).rejects.toThrow(
      /raw.*release|roster/i,
    );
    expect(await readFile(join(root, 'data/heroes.json'), 'utf8')).toBe(JSON.stringify(original));
  });
  it('ignores disabled raw development entries without requiring inherited selectable fields', async () => {
    heroesText = heroesText.replace(
      '"hero_base" = {',
      '"hero_disabled" = { m_HeroID=999 m_bDisabled=true }\n"hero_base" = {',
    );
    expect((await refreshData({ root, fetchImpl, dryRun: true })).snapshot.meta.heroCount).toBe(6);
  });
  it('recognizes debug-only source entries without releasing them', async () => {
    heroesText = heroesText.replace(
      '"hero_base" = {',
      '"hero_debug" = { m_HeroID=999 m_eHeroDevelopmentState="EHeroDevState_DebugOnly" m_bDisabled=false }\n"hero_base" = {',
    );
    expect((await refreshData({ root, fetchImpl, dryRun: true })).snapshot.meta.heroCount).toBe(6);
  });
  it('accepts a newly released ordinary hero with the development flag and downloads its icon', async () => {
    const hero = structuredClone(apiHeroes.find((h) => h.id === 88)!);
    hero.id = 999;
    hero.class_name = 'hero_new';
    hero.name = 'New Hero';
    hero.in_development = true;
    apiHeroes.push(hero);
    const start = heroesText.indexOf('"hero_baba" = ');
    const end = heroesText.lastIndexOf('\n}');
    const entry = heroesText
      .slice(start, end)
      .replace('"hero_baba"', '"hero_new"')
      .replace('"m_HeroID" = 88', '"m_HeroID" = 999')
      .replace('"m_bInDevelopment" = false', '"m_bInDevelopment" = true');
    heroesText = heroesText.slice(0, end) + '\n' + entry + heroesText.slice(end);
    const result = await refreshData({ root, fetchImpl });
    const added = result.snapshot.heroes.find((h) => h.id === 999)!;
    expect(added.portrait).toBe('assets/heroes/new-hero.webp');
    expect(await readFile(join(root, 'public', added.portrait))).toHaveLength(12);
    expect(result.summary.added).toBe(1);
  });
  it('preserves Spirit growth, raw hit-once paths, burst model and human notes', async () => {
    const result = await refreshData({ root, fetchImpl, dryRun: true });
    const baba = result.snapshot.heroes.find((h) => h.id === 88)!;
    expect(baba.base.health).toBe(780);
    expect(baba.weapon.projectiles).toBe(3);
    expect(baba.weapon.hitOnce).toBe(true);
    expect(baba.aliases).toBe('Баба бабка');
    expect(result.snapshot.heroes.find((h) => h.id === 2)!.weapon.shotsPerSecond).toBeCloseTo(
      6.96864111498,
    );
    expect(result.snapshot.heroes.find((h) => h.id === 66)!.scaling.regenPerSpirit).toBe(0.08);
    expect(result.snapshot.heroes.find((h) => h.id === 3)!.scaling.bulletDamagePerSpirit).toBe(
      0.022,
    );
    expect(result.snapshot.heroes.find((h) => h.id === 25)!.weapon.notes).toEqual(
      original.heroes.find((h) => h.id === 25)!.weapon.notes,
    );
    expect(result.snapshot.meta.heroCount).toBe(6);
    expect(result.snapshot.heroes[0].source.heroUrl).toContain(sha);
    expect(await readFile(join(root, 'data/heroes.json'), 'utf8')).toBe(JSON.stringify(original));
  });
  it('backs up exact previous bytes and atomically replaces only a fully validated candidate', async () => {
    const result = await refreshData({ root, fetchImpl });
    expect(result.changed).toBe(true);
    expect(result.backupPath).toBeTruthy();
    expect(await readFile(result.backupPath!, 'utf8')).toBe(JSON.stringify(original));
    expect(await readFile(result.backupPath!.replace('heroes-', 'provenance-'), 'utf8')).toBe(
      JSON.stringify(originalProvenance),
    );
    const provenance = JSON.parse(await readFile(join(root, 'data/provenance.json'), 'utf8'));
    expect(provenance.meta).toEqual(result.snapshot.meta);
    expect(provenance.allRawStatsVerified).toBe(true);
    expect(provenance.runtimeMeasured).toBe(false);
    expect(JSON.parse(await readFile(join(root, 'data/heroes.json'), 'utf8')).heroes).toHaveLength(
      6,
    );
    expect(await readdir(join(root, 'data'))).not.toContain('heroes.json.tmp');
  });
  it('does not rewrite dates, files or backups when same-version verified data is unchanged', async () => {
    await refreshData({ root, fetchImpl });
    latestCalls = 0;
    const bytes = await readFile(join(root, 'data/heroes.json'), 'utf8');
    const result = await refreshData({ root, fetchImpl });
    expect(result.changed).toBe(false);
    expect(result.backupPath).toBeUndefined();
    expect(await readFile(join(root, 'data/heroes.json'), 'utf8')).toBe(bytes);
  });
  it.each([
    'unknown scaling',
    'missing required stat',
    'unsupported boon',
    'unsupported regen boon',
    'sparse inheritance',
    'duplicate id',
    'api disagreement',
    'changed version',
    'revision disagreement',
    'untrusted icon',
  ])('keeps canonical bytes untouched on %s', async (fault) => {
    if (fault === 'unknown scaling')
      heroesText = heroesText.replace(
        '"m_mapScalingStats" = {',
        '"m_mapScalingStats" = { EFuturisticDamage = { eScalingStat="ETechPower" flScale=2 }',
      );
    if (fault === 'missing required stat')
      heroesText = heroesText.replace(/"EMaxHealth" = 780/, '"MissingMaxHealth" = 780');
    if (fault === 'unsupported boon')
      heroesText = heroesText.replace(
        '"MODIFIER_VALUE_BOON_COUNT" = 1',
        '"MODIFIER_VALUE_BOON_COUNT" = 2',
      );
    if (fault === 'unsupported regen boon') {
      heroesText = heroesText.replace(
        '"MODIFIER_VALUE_OUT_OF_COMBAT_HEALTH_REGEN" = 0',
        '"MODIFIER_VALUE_OUT_OF_COMBAT_HEALTH_REGEN" = 1',
      );
      apiHeroes[0].standard_level_up_upgrades.MODIFIER_VALUE_OUT_OF_COMBAT_HEALTH_REGEN = 1;
    }
    if (fault === 'sparse inheritance')
      heroesText = heroesText.replace(/"m_mapStartingStats" = \{/g, '"sparseStartingStats" = {');
    if (fault === 'duplicate id') apiHeroes.push(apiHeroes[0]);
    if (fault === 'api disagreement') apiHeroes[0].starting_stats.max_health.value = 999;
    if (fault === 'changed version') changedVersion = true;
    if (fault === 'revision disagreement') revision = 123;
    if (fault === 'untrusted icon') {
      apiHeroes[0].images.icon_image_small_webp = 'https://localhost/private.webp';
      iconUrl = 'https://localhost/private.webp';
    }
    await expect(refreshData({ root, fetchImpl })).rejects.toThrow();
    expect(await readFile(join(root, 'data/heroes.json'), 'utf8')).toBe(JSON.stringify(original));
    expect(await readdir(join(root, 'data'))).toEqual([
      'heroes.json',
      'provenance.json',
      'updater-policy.json',
      'version-history.json',
    ]);
    if (iconUrl)
      await expect(readFile(join(root, 'public/assets/heroes/seven.webp'))).rejects.toThrow();
  });
  it('rejects an expected-version mismatch before persistence', async () => {
    await expect(refreshData({ root, fetchImpl, expectedVersion: 6820 })).rejects.toThrow(
      /version/i,
    );
  });
});
