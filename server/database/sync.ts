import { isDeepStrictEqual } from 'node:util';
import type { HeroSnapshot } from '../../shared/types';
import type { PostgresArchive } from './repository';
import { readCuratedBundle } from './bundle';

/** Recheck the saved snapshot before importing its companion files as one DB transaction. */
export async function syncCuratedDatabase(
  root: string,
  saved: HeroSnapshot,
  archive: Pick<PostgresArchive, 'importBundle'>,
) {
  const bundle = await readCuratedBundle(root);
  if (!isDeepStrictEqual(bundle.heroes, saved))
    throw new Error('Saved curated snapshot changed before database import');
  await archive.importBundle(bundle, 'verified-data-update');
}
