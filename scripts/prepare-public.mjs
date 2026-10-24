import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = JSON.parse(await readFile(path.join(root, 'data/heroes.json'), 'utf8'));
if (snapshot.meta.heroCount !== snapshot.heroes.length) throw new Error('Snapshot roster mismatch');
await mkdir(path.join(root, 'public/data'), { recursive: true });
await copyFile(path.join(root, 'data/heroes.json'), path.join(root, 'public/data/heroes.json'));
await copyFile(
  path.join(root, 'data/provenance.json'),
  path.join(root, 'public/data/provenance.json'),
);
console.log(`Prepared ${snapshot.heroes.length} heroes for static deployment.`);
