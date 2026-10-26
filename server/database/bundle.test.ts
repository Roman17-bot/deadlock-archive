import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readCuratedBundle, validateCuratedBundle } from './bundle';

const root = fileURLToPath(new URL('../../', import.meta.url));

describe('curated bundle', () => {
  it('reads the four public files and rejects a cross-language source mismatch', async () => {
    const bundle = await readCuratedBundle(root);
    expect(bundle.heroes.heroes).toHaveLength(44);
    expect(bundle.mechanics.ru.formulas).toHaveLength(27);
    expect(bundle.mechanics.en.sources).toHaveLength(43);
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
    bad.mechanics.ru.meta.reviewedClientVersion += 1;
    bad.mechanics.en.meta.reviewedClientVersion += 1;
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
    bundle.heroes.meta.clientVersion = 6820;
    bundle.heroes.meta.buildDate = '2026-10-26';
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
    provenance.meta.clientVersion = 6820;
    provenance.meta.buildDate = '2026-10-26';
    provenance.meta.sourceRevision = bundle.heroes.meta.sourceRevision;
    provenance.meta.gameCommit = bundle.heroes.meta.gameCommit;
    bundle.history.versions.unshift({
      clientVersion: 6820,
      buildDate: '2026-10-26',
      firstPublishedAt: '2026-10-26T00:00:00.000Z',
      provenance: { kind: 'snapshot-save', reference: '2026-10-26T00:00:00.000Z' },
    });
    expect(() => validateCuratedBundle(bundle)).not.toThrow();
    expect(bundle.mechanics.ru.meta.reviewedClientVersion).toBe(6819);
  });

  it('rejects provenance metadata that diverges from the hero snapshot', async () => {
    const bundle = structuredClone(await readCuratedBundle(root));
    (bundle.provenance as { meta: { heroCount: number } }).meta.heroCount -= 1;
    expect(() => validateCuratedBundle(bundle)).toThrow(/provenance/i);
  });
});
