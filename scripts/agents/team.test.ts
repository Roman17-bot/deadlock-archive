import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// @ts-ignore Native ESM team helpers.
import {
  createBrief,
  initTeam,
  installTeam,
  readContext,
  resolveArchiveRoot,
  teamStatus,
  writeNativeConfig,
} from './team.mjs';

let sandbox: string;
let root: string;
let archive: string;
let locator: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'deadlock-team-'));
  root = join(sandbox, 'checkout');
  archive = join(sandbox, 'original');
  for (const dir of [root, archive]) {
    mkdirSync(join(dir, 'scripts/knowledge'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'deadlock-archive' }));
    writeFileSync(join(dir, 'scripts/knowledge/cli.mjs'), '// fixture');
  }
  mkdirSync(join(root, 'tools'), { recursive: true });
  cpSync(join(process.cwd(), 'tools/agents'), join(root, 'tools/agents'), { recursive: true });
  cpSync(
    join(process.cwd(), 'tools/skills/deadlock-team'),
    join(root, 'tools/skills/deadlock-team'),
    { recursive: true },
  );
  mkdirSync(join(archive, 'knowledge'));
  writeFileSync(
    join(archive, 'knowledge/archive.sqlite'),
    'fixture: team helpers do not open SQLite',
  );
  locator = join(sandbox, 'locator.json');
  writeFileSync(locator, JSON.stringify({ repoRoot: archive }));
});

afterEach(() => rmSync(sandbox, { recursive: true, force: true }));
const options = () => ({ root, locator });

describe('durable specialist context', () => {
  it('gives the design critic a return-only read-only brief without creating report files', () => {
    const brief = createBrief({ ...options(), role: 'designcritic', task: 'Review supplied UI.' });
    expect(brief.readOnly).toBe(true);
    expect(brief.reportMode).toBe('return');
    expect(brief.writeFiles).toEqual([]);
    expect(existsSync(brief.reportDirectory)).toBe(false);
  });
  it('resolves the original archive from a worktree without creating another evidence index', () => {
    expect(resolveArchiveRoot(options())).toBe(archive);
    expect(existsSync(join(root, 'knowledge'))).toBe(false);
    expect(() => resolveArchiveRoot({ root, locator: join(sandbox, 'absent.json') })).toThrow(
      /archive/i,
    );
  });

  it('initializes all registered role folders once and preserves existing memory on another run', () => {
    const first = initTeam(options());
    expect(first.created).toEqual([
      'heroes',
      'items',
      'mechanics',
      'website',
      'data',
      'critic',
      'scout',
      'designer',
      'designcritic',
    ]);
    const context = join(archive, 'knowledge/agents/heroes/CONTEXT.md');
    writeFileSync(context, 'Accepted research pointer: knowledge/research/heroes-example.md');
    expect(initTeam(options()).created).toHaveLength(0);
    expect(readContext({ ...options(), role: 'heroes' }).content).toBe(
      'Accepted research pointer: knowledge/research/heroes-example.md',
    );
    expect(
      teamStatus(options()).roles.every((role: { initialized: boolean }) => role.initialized),
    ).toBe(true);
  });

  it.each(['designer', 'designcritic'])('recovers and preserves %s private context', (role) => {
    expect(readContext({ ...options(), role }).initialized).toBe(false);
    initTeam(options());
    const context = readContext({ ...options(), role });
    expect(context.initialized).toBe(true);
    expect(context.path).toBe(join(archive, `knowledge/agents/${role}/CONTEXT.md`));
    writeFileSync(context.path, 'Accepted design decision: keep the bilingual catalogue.');
    initTeam(options());
    expect(readContext({ ...options(), role }).content).toBe(
      'Accepted design decision: keep the bilingual catalogue.',
    );
    expect(existsSync(join(root, 'knowledge'))).toBe(false);
  });

  it('supports additional registered roles rather than requiring an exact role count', () => {
    const path = join(root, 'tools/agents/roles.json');
    const registry = JSON.parse(readFileSync(path, 'utf8'));
    registry.roles.push({
      id: 'example',
      label: 'Example',
      description: 'A bounded example role.',
      depth: 'standard',
      outputWords: 200,
      canEditCode: false,
    });
    writeFileSync(path, JSON.stringify(registry));
    expect(initTeam(options()).created).toContain('example');
    expect(teamStatus(options()).maxConcurrentChildren).toBe(3);
    const instructions = '# Example\nA custom registered instruction.';
    writeFileSync(
      join(root, 'tools/skills/deadlock-team/references/roles/example.md'),
      instructions,
    );
    const target = join(sandbox, 'skills/deadlock-team');
    installTeam({ ...options(), target });
    expect(readFileSync(join(target, 'references/roles/example.md'), 'utf8')).toBe(instructions);
  });

  it.each([
    [
      'empty roles',
      (registry: any) => {
        registry.roles = [];
      },
    ],
    [
      'duplicate role',
      (registry: any) => {
        registry.roles.push(registry.roles[0]);
      },
    ],
    [
      'unsafe role id',
      (registry: any) => {
        registry.roles[0].id = '../escape';
      },
    ],
    [
      'unknown profile',
      (registry: any) => {
        registry.roles[0].depth = 'unknown';
      },
    ],
    [
      'invalid profile',
      (registry: any) => {
        registry.profiles.standard.model = '';
      },
    ],
    [
      'invalid effort',
      (registry: any) => {
        registry.profiles.standard.effort = 'invalid';
      },
    ],
    [
      'invalid output bound',
      (registry: any) => {
        registry.roles[0].outputWords = 0;
      },
    ],
    [
      'invalid ownership',
      (registry: any) => {
        registry.roles[0].canEditCode = 'false';
      },
    ],
    [
      'invalid concurrency',
      (registry: any) => {
        registry.maxConcurrentChildren = 0;
      },
    ],
  ])('rejects %s before initializing any private files', (_name, mutate) => {
    const path = join(root, 'tools/agents/roles.json');
    const registry = JSON.parse(readFileSync(path, 'utf8'));
    mutate(registry);
    writeFileSync(path, JSON.stringify(registry));
    expect(() => initTeam(options())).toThrow(/registry|role|profile/i);
    expect(existsSync(join(archive, 'knowledge/agents'))).toBe(false);
  });

  it('bounds large context reads and rejects unknown roles rather than using an arbitrary path', () => {
    initTeam(options());
    writeFileSync(join(archive, 'knowledge/agents/items/CONTEXT.md'), 'я'.repeat(8000));
    const context = readContext({ ...options(), role: 'items' });
    expect(context.content.length).toBe(6000);
    expect(context.truncated).toBe(true);
    expect(() => readContext({ ...options(), role: '../../outside' })).toThrow(/role/i);
  });

  it('refuses a symlinked memory directory and leaves its target untouched', () => {
    const outside = join(sandbox, 'outside');
    mkdirSync(outside);
    symlinkSync(outside, join(archive, 'knowledge/agents'), 'junction');
    expect(() => initTeam(options())).toThrow(/symlink/i);
    expect(readdirSync(outside)).toEqual([]);
  });
});

describe('economical task briefs', () => {
  it.each(['designer', 'designcritic'])(
    'dispatches %s at Sol/medium with isolated artifacts',
    (role) => {
      const brief = createBrief({
        ...options(),
        role,
        task: 'Review the catalogue visual hierarchy.',
      });
      expect([brief.spawn.model, brief.spawn.reasoning_effort, brief.spawn.fork_turns]).toEqual([
        'gpt-6.1-sol',
        'medium',
        'none',
      ]);
      expect(brief.outputWords).toBe(450);
      expect(brief.writeFiles).toEqual([]);
      expect(brief.reportDirectory).toContain(join(archive, `knowledge/agents/${role}/runs`));
      expect(brief.spawn.message).toContain(
        join(root, `tools/skills/deadlock-team/references/roles/${role}.md`),
      );
      expect(brief.spawn.message).toContain(brief.reportDirectory);
      expect(() =>
        createBrief({
          ...options(),
          role,
          task: 'Review it.',
          writeFiles: ['src/App.tsx'],
        }),
      ).toThrow(/read.only/i);
      expect(existsSync(brief.reportDirectory)).toBe(false);
    },
  );
  it('uses Luna/low for a quick check with a fresh bounded prompt and no filesystem writes', () => {
    const before = readdirSync(join(archive, 'knowledge'));
    const brief = createBrief({
      ...options(),
      role: 'scout',
      task: 'Find the owner of the hero table CSS.',
    });
    expect(brief.spawn.model).toBe('gpt-6-luna');
    expect(brief.spawn.reasoning_effort).toBe('low');
    expect(brief.spawn.fork_turns).toBe('none');
    expect(brief.spawn.message).toContain(root);
    expect(brief.spawn.message).toContain(archive);
    expect(brief.spawn.message).toContain('Find the owner of the hero table CSS.');
    expect(brief.outputWords).toBe(180);
    expect(readdirSync(join(archive, 'knowledge'))).toEqual(before);
  });

  it('selects both model and effort for specialist work and explicit escalation', () => {
    const normal = createBrief({ ...options(), role: 'heroes', task: 'Analyze a build.' });
    expect([normal.spawn.model, normal.spawn.reasoning_effort]).toEqual(['gpt-6.1-sol', 'medium']);
    const mechanic = createBrief({
      ...options(),
      role: 'mechanics',
      task: 'Compare two stacking models.',
    });
    expect([mechanic.spawn.model, mechanic.spawn.reasoning_effort]).toEqual([
      'gpt-6.1-sol',
      'high',
    ]);
    const audit = createBrief({
      ...options(),
      role: 'critic',
      depth: 'audit',
      task: 'Audit a contested formula.',
      escalationReason: 'Independent sources conflict.',
    });
    expect([audit.spawn.model, audit.spawn.reasoning_effort]).toEqual(['gpt-6-astra', 'high']);
    expect(() =>
      createBrief({ ...options(), role: 'scout', depth: 'audit', task: 'Check one file.' }),
    ).toThrow(/audit/i);
  });

  it('requires an explicit reason for expensive escalation and validates write ownership', () => {
    expect(() =>
      createBrief({ ...options(), role: 'critic', depth: 'audit', task: 'Audit it.' }),
    ).toThrow(/reason/i);
    expect(() =>
      createBrief({
        ...options(),
        role: 'website',
        task: 'Fix it.',
        writeFiles: ['../other/file.ts'],
      }),
    ).toThrow(/outside|relative/i);
    expect(() =>
      createBrief({ ...options(), role: 'website', task: 'Fix it.', writeFiles: ['.env.local'] }),
    ).toThrow(/private|reserved/i);
    expect(() =>
      createBrief({
        ...options(),
        role: 'critic',
        task: 'Review it.',
        writeFiles: ['src/main.tsx'],
      }),
    ).toThrow(/read.only/i);
    const brief = createBrief({
      ...options(),
      role: 'website',
      task: 'Fix the table.',
      writeFiles: ['src/pages/HeroesPage/HeroesPage.css'],
    });
    expect(brief.writeFiles).toEqual(['src/pages/HeroesPage/HeroesPage.css']);
  });

  it('gives simultaneous work on one role separate report destinations', () => {
    const first = createBrief({ ...options(), role: 'heroes', task: 'Read Abrams.' });
    const second = createBrief({ ...options(), role: 'heroes', task: 'Read Violet.' });
    expect(first.reportDirectory).not.toBe(second.reportDirectory);
    expect(first.spawn.task_name).not.toBe(second.spawn.task_name);
    expect(first.contextPath).toBe(second.contextPath);
  });

  it('rejects normalized escapes into private ownership and emits canonical relative code paths', () => {
    for (const path of [
      'src/../.env.local',
      'src/../knowledge/private.md',
      'src/../.git/config',
      'src\\..\\.env.local',
    ]) {
      expect(() =>
        createBrief({ ...options(), role: 'website', task: 'Fix one file.', writeFiles: [path] }),
      ).toThrow(/private|reserved/i);
    }
    const brief = createBrief({
      ...options(),
      role: 'website',
      task: 'Fix one file.',
      writeFiles: ['src/ui/../pages/HeroesPage/HeroesPage.css'],
    });
    expect(brief.writeFiles).toEqual(['src/pages/HeroesPage/HeroesPage.css']);
  });

  it('supplies executable archive retrieval arguments rather than relying on the worktree cwd', () => {
    const brief = createBrief({ ...options(), role: 'scout', task: 'Locate one component.' });
    expect(brief.knowledgeCommand).toEqual({
      cwd: archive,
      argv: ['npm', 'run', 'knowledge', '--', 'status'],
    });
    expect(brief.spawn.message).toContain(`Knowledge commands: run with workdir ${archive}`);
  });
});

describe('installation boundaries', () => {
  it('installs only the team skill, locates the canonical archive and preserves sibling/user files', () => {
    const target = join(sandbox, 'skills/deadlock-team');
    mkdirSync(join(sandbox, 'skills/other'), { recursive: true });
    writeFileSync(join(sandbox, 'skills/other/SKILL.md'), 'User skill');
    installTeam({ ...options(), target });
    writeFileSync(join(target, 'personal-note.txt'), 'Keep me');
    installTeam({ ...options(), target });
    const profile = JSON.parse(readFileSync(join(target, 'references/local-profile.json'), 'utf8'));
    expect(profile.repoRoot).toBe(archive);
    expect(readFileSync(join(target, 'personal-note.txt'), 'utf8')).toBe('Keep me');
    expect(readFileSync(join(sandbox, 'skills/other/SKILL.md'), 'utf8')).toBe('User skill');
    for (const role of ['critic', 'designer', 'designcritic']) {
      expect(readFileSync(join(target, `references/roles/${role}.md`), 'utf8')).toBe(
        readFileSync(join(root, `tools/skills/deadlock-team/references/roles/${role}.md`), 'utf8'),
      );
    }
    expect(() => installTeam({ ...options(), target: root })).toThrow(/source|target/i);
  });

  it('creates native project roles without changing an existing project config', () => {
    const result = writeNativeConfig({ root });
    expect(result.files).toHaveLength(10);
    const config = join(root, '.codex/config.toml');
    writeFileSync(config, '[custom]\nvalue = "user"\n');
    expect(() => writeNativeConfig({ root })).toThrow(/existing|owned/i);
    expect(readFileSync(config, 'utf8')).toBe('[custom]\nvalue = "user"\n');
  });

  it('keeps unrelated MCP, agent options and project settings on regeneration', () => {
    writeNativeConfig({ root });
    const config = join(root, '.codex/config.toml');
    const extra =
      '\n[mcp_servers.custom_browser]\ncommand = "keep-me"\n\n[custom]\nvalue = "user"\n';
    writeFileSync(
      config,
      readFileSync(config, 'utf8').replace(
        '[agents]\n',
        '[agents] # project controls\ninterrupt_message = false\n',
      ) + extra,
    );
    const native = join(root, '.codex/agents/deadlock-designer.toml');
    writeFileSync(native, readFileSync(native, 'utf8') + '\n[features]\nmemories = false\n');
    writeNativeConfig({ root });
    writeNativeConfig({ root });
    expect(readFileSync(config, 'utf8')).toContain(extra);
    expect(readFileSync(config, 'utf8')).toContain('interrupt_message = false');
    expect(readFileSync(native, 'utf8')).toContain('[features]\nmemories = false');
    expect(readFileSync(config, 'utf8').match(/\[mcp_servers.custom_browser\]/g)).toHaveLength(1);
    expect(readFileSync(config, 'utf8').match(/\[agents\]/g)).toHaveLength(1);
  });

  it.each(['designer', 'designcritic'])(
    'generates a project native %s role at the standard profile',
    (role) => {
      writeNativeConfig({ root });
      const config = readFileSync(join(root, '.codex/config.toml'), 'utf8');
      expect(config).toContain('max_threads = 3');
      expect(config).toContain(`[agents.deadlock_${role}]`);
      const native = readFileSync(join(root, `.codex/agents/deadlock-${role}.toml`), 'utf8');
      expect(native).toContain('model = "gpt-6.1-sol"');
      expect(native).toContain('model_reasoning_effort = "medium"');
      expect(native).toContain(`references/roles/${role}.md`);
    },
  );
});
