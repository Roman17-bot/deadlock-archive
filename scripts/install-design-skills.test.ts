import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
// @ts-ignore Native ESM installer.
import { installDesignSkills } from './install-design-skills.mjs';

let sandbox: string, root: string, archiveRoot: string, target: string;
beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'deadlock-design-'));
  vi.stubEnv('CODEX_HOME', join(sandbox, 'user-codex'));
  root = join(sandbox, 'checkout');
  archiveRoot = join(sandbox, 'original');
  target = join(sandbox, 'skills');
  mkdirSync(join(root, 'tools/skills'), { recursive: true });
  for (const name of ['deadlock-design', 'deadlock-design-review'])
    cpSync(join(process.cwd(), 'tools/skills', name), join(root, 'tools/skills', name), {
      recursive: true,
    });
  mkdirSync(join(archiveRoot, 'knowledge'), { recursive: true });
  mkdirSync(join(archiveRoot, 'scripts/knowledge'), { recursive: true });
  writeFileSync(join(archiveRoot, 'knowledge/archive.sqlite'), 'fixture');
  writeFileSync(join(archiveRoot, 'scripts/knowledge/cli.mjs'), '// fixture');
  writeFileSync(join(archiveRoot, 'package.json'), JSON.stringify({ name: 'deadlock-archive' }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  if (dirname(resolve(sandbox)) !== resolve(tmpdir())) throw new Error('Unsafe test cleanup');
  rmSync(sandbox, { recursive: true, force: true });
});
it('installs both skills with the original archive locator and can refresh them', () => {
  for (let n = 0; n < 2; n++)
    expect(installDesignSkills({ root, archiveRoot, target }).skills).toHaveLength(2);
  for (const name of ['deadlock-design', 'deadlock-design-review']) {
    expect(
      JSON.parse(readFileSync(join(target, name, 'references/local-profile.json'), 'utf8'))
        .repoRoot,
    ).toBe(archiveRoot);
    expect(existsSync(join(target, name, 'agents/openai.yaml'))).toBe(true);
  }
  for (const file of ['references/assets.md', 'references/motion.md'])
    expect(readFileSync(join(target, 'deadlock-design', file), 'utf8')).toBe(
      readFileSync(join(root, 'tools/skills/deadlock-design', file), 'utf8'),
    );
});
it('preserves unrelated skills and rejects an unmanaged name collision before copying', () => {
  mkdirSync(join(target, 'other'), { recursive: true });
  writeFileSync(join(target, 'other/SKILL.md'), 'keep');
  mkdirSync(join(target, 'deadlock-design-review'), { recursive: true });
  writeFileSync(join(target, 'deadlock-design-review/SKILL.md'), 'not a managed skill');
  expect(() => installDesignSkills({ root, archiveRoot, target })).toThrow(/managed/);
  expect(existsSync(join(target, 'deadlock-design'))).toBe(false);
  expect(readFileSync(join(target, 'other/SKILL.md'), 'utf8')).toBe('keep');
});
it('validates the entire package before creating the installation target', () => {
  rmSync(join(root, 'tools/skills/deadlock-design-review/references/rubric.md'));
  expect(() => installDesignSkills({ root, archiveRoot, target })).toThrow();
  expect(existsSync(target)).toBe(false);
});
it('rejects installation over tracked sources', () => {
  expect(() =>
    installDesignSkills({ root, archiveRoot, target: join(root, 'tools/skills') }),
  ).toThrow(/overlap/);
});
it('defaults to project skills without writing the user skill directory', () => {
  const result = installDesignSkills({ root, archiveRoot });
  expect(result.skills.map((skill: { path: string }) => skill.path)).toEqual([
    join(root, '.agents/skills/deadlock-design'),
    join(root, '.agents/skills/deadlock-design-review'),
  ]);
});
