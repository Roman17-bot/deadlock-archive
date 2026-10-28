import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readCuratedBundle, validateCuratedBundle } from './bundle';
import heroesFixture from '../../data/heroes.json';
import mechanicsFixture from '../../data/mechanics.json';
import englishMechanicsFixture from '../../data/mechanics.en.json';
import { itemFixture } from './item-fixture';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('curated bundle', () => {
  it('accepts legacy bundles but rejects incomplete or mismatched item pairs', async () => {
    const bundle = await readCuratedBundle(root);
    const fresh = { ...bundle, ...itemFixture(bundle.heroes.meta.clientVersion) };
    expect(() => validateCuratedBundle(fresh)).not.toThrow();
    expect(() => validateCuratedBundle({ ...fresh, itemStatistics: undefined })).toThrow(/item/i);
    fresh.itemStatistics.meta.clientVersion += 1;
    expect(() => validateCuratedBundle(fresh)).toThrow(/item/i);
  });
  it('reads the four public files and rejects a cross-language source mismatch', async () => {
    const bundle = await readCuratedBundle(root);
    expect(bundle.heroes.heroes).toHaveLength(heroesFixture.heroes.length);
    expect(bundle.mechanics.ru.formulas).toHaveLength(mechanicsFixture.formulas.length);
    expect(bundle.mechanics.en.sources).toHaveLength(englishMechanicsFixture.sources.length);
    const bad = structuredClone(bundle);
    bad.mechanics.en.formulas[0].sourceIds = ['missing-evidence'];
    expect(() => validateCuratedBundle(bad)).toThrow(/source|evidence/i);
  });

  it('rejects a history that does not contain the hero version', async () => {
    const bad = structuredClone(await readCuratedBundle(root));
    bad.history.versions = [];
    expect(() => validateCuratedBundle(bad)).toThrow(/history/i);
  });

  it('rejects a catalogue for another client before any database write', async () => {
    const bad = structuredClone(await readCuratedBundle(root));
    bad.mechanics.ru.meta.reviewedClientVersion = bad.heroes.meta.clientVersion + 1;
    bad.mechanics.en.meta.reviewedClientVersion = bad.heroes.meta.clientVersion + 1;
    expect(() => validateCuratedBundle(bad)).toThrow(/metadata/i);
  });

  it('rejects malformed mechanics checkedAt timestamps', async () => {
    const bad = structuredClone(await readCuratedBundle(root));
    bad.mechanics.ru.meta.checkedAt = 'yesterday';
    bad.mechanics.en.meta.checkedAt = 'yesterday';
    expect(() => validateCuratedBundle(bad)).toThrow(/metadata/i);
  });

  it('accepts a newer hero snapshot while mechanics remain reviewed for the prior client', async () => {
    const bundle = structuredClone(await readCuratedBundle(root));
    delete bundle.items;
    delete bundle.itemStatistics;
    const futureClient = bundle.heroes.meta.clientVersion + 1;
    const reviewedClient = bundle.mechanics.ru.meta.reviewedClientVersion;
    const futureBuildDate = new Date(Date.parse(bundle.heroes.meta.buildDate) + 86_400_000)
      .toISOString()
      .slice(0, 10);
    const publishedAt = `${futureBuildDate}T00:00:00.000Z`;
    bundle.heroes.meta.clientVersion = futureClient;
    bundle.heroes.meta.buildDate = futureBuildDate;
    bundle.heroes.meta.sourceRevision += 1;
    bundle.heroes.meta.gameCommit = 'a'.repeat(40);
    const provenance = bundle.provenance as {
      meta: {
        clientVersion: number;
        buildDate: string;
        sourceRevision: number;
        gameCommit: string;
      };
    };
    provenance.meta.clientVersion = futureClient;
    provenance.meta.buildDate = futureBuildDate;
    provenance.meta.sourceRevision = bundle.heroes.meta.sourceRevision;
    provenance.meta.gameCommit = bundle.heroes.meta.gameCommit;
    bundle.history.versions.unshift({
      clientVersion: futureClient,
      buildDate: futureBuildDate,
      firstPublishedAt: publishedAt,
      provenance: { kind: 'snapshot-save', reference: publishedAt },
    });
    expect(() => validateCuratedBundle(bundle)).not.toThrow();
    expect(bundle.mechanics.ru.meta.reviewedClientVersion).toBe(reviewedClient);
  });

  it('rejects provenance metadata that diverges from the hero snapshot', async () => {
    const bundle = structuredClone(await readCuratedBundle(root));
    (bundle.provenance as { meta: { heroCount: number } }).meta.heroCount -= 1;
    expect(() => validateCuratedBundle(bundle)).toThrow(/provenance/i);
  });
});
