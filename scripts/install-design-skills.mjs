import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { resolveArchiveRoot, safePath } from './agents/paths.mjs';

const packages = {
  'deadlock-design': [
    'references/assets.md',
    'references/motion.md',
    'references/creative-graphics.md',
  ],
  'deadlock-design-review': ['references/rubric.md', 'references/rendered-evidence.md'],
};
const inside = (parent, child) => {
  const part = relative(parent, child);
  return !part || (part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part));
};

export function installDesignSkills({
  root = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  archiveRoot,
  target,
  scope = 'project',
} = {}) {
  root = resolve(root);
  if (!['project', 'global'].includes(scope)) throw new Error('Unknown skill installation scope');
  archiveRoot = resolveArchiveRoot({ root, archiveRoot });
  target = resolve(
    target ??
      (scope === 'project'
        ? resolve(root, '.agents/skills')
        : resolve(process.env.CODEX_HOME ?? resolve(homedir(), '.codex'), 'skills')),
  );
  if (existsSync(target) && lstatSync(target).isSymbolicLink())
    throw new Error('Symlink skill target');
  const outputs = [];
  // Preflight both packages before copying either one.
  for (const [name, references] of Object.entries(packages)) {
    const source = safePath(root, `tools/skills/${name}`);
    const destination = resolve(target, name);
    if (inside(source, destination) || inside(destination, source))
      throw new Error('Skill targets overlap sources');
    if (existsSync(target)) safePath(target, name);
    const files = ['SKILL.md', 'agents/openai.yaml', ...references];
    for (const file of files) readFileSync(safePath(source, file));
    const declaration = new RegExp(`^---\\r?\\nname: ${name}\\r?\\n`);
    if (!declaration.test(readFileSync(resolve(source, 'SKILL.md'), 'utf8')))
      throw new Error('Invalid managed skill source');
    const existing = resolve(destination, 'SKILL.md');
    if (existsSync(existing) && !declaration.test(readFileSync(existing, 'utf8')))
      throw new Error('Existing target is not the managed design skill');
    if (existsSync(target))
      for (const file of [...files, 'references/local-profile.json'])
        safePath(target, `${name}/${file}`);
    outputs.push({ name, source, destination, files });
  }
  mkdirSync(target, { recursive: true });
  for (const entry of outputs) {
    for (const file of entry.files) {
      const output = safePath(target, `${entry.name}/${file}`);
      mkdirSync(dirname(output), { recursive: true });
      copyFileSync(resolve(entry.source, file), output);
    }
    writeFileSync(
      safePath(target, `${entry.name}/references/local-profile.json`),
      JSON.stringify({ repoRoot: archiveRoot }, null, 2) + '\n',
    );
  }
  return {
    archiveRoot,
    skills: outputs.map(({ name, destination }) => ({ name, path: destination })),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      options: { scope: { type: 'string', default: 'project' } },
      strict: true,
    });
    console.log(JSON.stringify(installDesignSkills({ scope: values.scope })));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
