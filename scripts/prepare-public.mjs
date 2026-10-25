import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateVersionHistory } from '../shared/version-history.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = JSON.parse(await readFile(path.join(root, 'data/heroes.json'), 'utf8'));
const history = JSON.parse(await readFile(path.join(root, 'data/version-history.json'), 'utf8'));
if (
  !validateVersionHistory(history) ||
  !history.versions.some(
    (entry) =>
      entry.clientVersion === snapshot.meta.clientVersion &&
      entry.buildDate === snapshot.meta.buildDate,
  )
)
  throw new Error('Invalid or incomplete public version history');
if (snapshot.meta.heroCount !== snapshot.heroes.length) throw new Error('Snapshot roster mismatch');
await mkdir(path.join(root, 'public/data'), { recursive: true });
await copyFile(path.join(root, 'data/heroes.json'), path.join(root, 'public/data/heroes.json'));
await copyFile(
  path.join(root, 'data/version-history.json'),
  path.join(root, 'public/data/version-history.json'),
);
await copyFile(
  path.join(root, 'data/provenance.json'),
  path.join(root, 'public/data/provenance.json'),
);
await copyFile(
  path.join(root, 'data/mechanics.json'),
  path.join(root, 'public/data/mechanics.json'),
);
await copyFile(
  path.join(root, 'data/mechanics.en.json'),
  path.join(root, 'public/data/mechanics.en.json'),
);
await copyFile(
  path.join(root, 'docs/mechanics-reference.md'),
  path.join(root, 'public/data/mechanics-reference.md'),
);
await copyFile(
  path.join(root, 'docs/mechanics-reference.en.md'),
  path.join(root, 'public/data/mechanics-reference.en.md'),
);
console.log(`Prepared ${snapshot.heroes.length} heroes for static deployment.`);
