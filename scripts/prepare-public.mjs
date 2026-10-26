import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSnapshot } from '../server/sync/snapshot.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = await readFileSnapshot(root);
await mkdir(path.join(root, 'public/data'), { recursive: true });
for (const file of snapshot.files.filter((file) => file.path.startsWith('data/')))
  await writeFile(path.join(root, 'public', file.path), file.content);
await copyFile(
  path.join(root, 'docs/mechanics-reference.md'),
  path.join(root, 'public/data/mechanics-reference.md'),
);
await copyFile(
  path.join(root, 'docs/mechanics-reference.en.md'),
  path.join(root, 'public/data/mechanics-reference.en.md'),
);
console.log(
  `Prepared ${snapshot.bundle.heroes.heroes.length} heroes and snapshot ${snapshot.hash.slice(0, 12)} for static deployment.`,
);
