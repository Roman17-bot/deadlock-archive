import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

export function installSkill({
  root = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  target,
} = {}) {
  root = resolve(root);
  const source = resolve(root, 'tools/skills/deadlock-project');
  target = resolve(
    target ??
      resolve(process.env.CODEX_HOME ?? resolve(homedir(), '.codex'), 'skills/deadlock-project'),
  );
  if (target === source || target === root)
    throw new Error('Installation target must differ from tracked source');
  const content = readFileSync(resolve(source, 'SKILL.md'), 'utf8');
  if (
    !/^---\r?\nname: deadlock-project\r?\ndescription: .+/m.test(content) ||
    /\bTODO\b|\[INSERT/.test(content)
  )
    throw new Error('Skill source failed basic validation');
  for (const filename of ['SKILL.md', 'agents/openai.yaml', 'references/retrieval.md']) {
    const output = resolve(target, filename);
    mkdirSync(dirname(output), { recursive: true });
    copyFileSync(resolve(source, filename), output);
  }
  writeFileSync(
    resolve(target, 'references/local-profile.json'),
    `${JSON.stringify({ repoRoot: root }, null, 2)}\n`,
  );
  return { name: 'deadlock-project', path: target, repoRoot: root };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args[0] !== '--target' || args.length !== 2))
      throw new Error('Use --target PATH or no arguments');
    if (args[1] && !existsSync(dirname(resolve(args[1]))))
      mkdirSync(dirname(resolve(args[1])), { recursive: true });
    process.stdout.write(`${JSON.stringify(installSkill({ target: args[1] }))}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ error: error.message })}\n`);
    process.exitCode = 1;
  }
}
