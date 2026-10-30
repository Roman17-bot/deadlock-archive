import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safePath } from '../agents/paths.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const lock = JSON.parse(readFileSync(resolve(root, 'tools/design/skills-lock.json'), 'utf8'));
let files = 0;
for (const skill of lock.skills) {
  const directory = safePath(root, `.agents/skills/${skill.name}`);
  for (const entry of skill.files) {
    const contents = readFileSync(safePath(directory, entry.path));
    if (createHash('sha256').update(contents).digest('hex') !== entry.sha256)
      throw new Error(`Installed skill differs from reviewed version: ${skill.name}/${entry.path}`);
    files++;
  }
}
function sourceFiles(directory, prefix = '') {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    if (lstatSync(path).isSymbolicLink()) throw new Error('Unexpected managed skill symlink');
    return lstatSync(path).isDirectory()
      ? sourceFiles(path, `${prefix}${name}/`)
      : [`${prefix}${name}`];
  });
}
for (const name of ['deadlock-design', 'deadlock-design-review']) {
  for (const file of sourceFiles(safePath(root, `tools/skills/${name}`))) {
    if (
      !readFileSync(safePath(root, `.agents/skills/${name}/${file}`)).equals(
        readFileSync(safePath(root, `tools/skills/${name}/${file}`)),
      )
    )
      throw new Error(`Refresh managed skill: ${name}/${file}`);
  }
}
console.log(
  JSON.stringify({
    externalSkills: lock.skills.map(({ name }) => name),
    verifiedExternalFiles: files,
    managedSkills: 2,
  }),
);
