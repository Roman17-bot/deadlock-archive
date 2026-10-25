import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// @ts-ignore Native ESM installer.
import { installSkill } from '../install-skill.mjs';

it('installs only the maintained skill and writes a local repository locator', () => {
  const target = mkdtempSync(join(tmpdir(), 'deadlock-skill-'));
  try {
    const result = installSkill({ target });
    expect(result.name).toBe('deadlock-project');
    expect(readFileSync(join(target, 'SKILL.md'), 'utf8')).toContain('name: deadlock-project');
    const profile = JSON.parse(readFileSync(join(target, 'references/local-profile.json'), 'utf8'));
    expect(profile.repoRoot).toBe(process.cwd());
    expect(installSkill({ target }).path).toBe(target);
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});
