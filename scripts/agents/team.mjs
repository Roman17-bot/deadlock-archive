import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  closeSync,
  readSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { safePath, resolveArchiveRoot } from './paths.mjs';
import { findRole, loadRegistry, nativeFiles, skillFiles } from './registry.mjs';

export { resolveArchiveRoot } from './paths.mjs';
const slash = (value) => value.replaceAll('\\', '/');
const defaultRoot = () => process.cwd();

function rolePaths(options) {
  const root = resolve(options.root ?? defaultRoot());
  const { role, registry } = findRole(root, options.role);
  const archiveRoot = resolveArchiveRoot({ ...options, root });
  const directory = safePath(archiveRoot, `knowledge/agents/${role.id}`);
  const contextPath = safePath(archiveRoot, `knowledge/agents/${role.id}/CONTEXT.md`);
  return { root, role, registry, archiveRoot, directory, contextPath };
}

export function initTeam(options = {}) {
  const root = resolve(options.root ?? defaultRoot());
  const archiveRoot = resolveArchiveRoot({ ...options, root });
  const registry = loadRegistry(root);
  const created = [];
  // Resolve every path before creating anything, so a later role cannot redirect a write.
  const paths = registry.roles.map((role) =>
    rolePaths({ ...options, root, archiveRoot, role: role.id }),
  );
  for (const entry of paths) {
    mkdirSync(entry.directory, { recursive: true });
    if (existsSync(entry.contextPath)) continue;
    const text = `# ${entry.role.label}: рабочий контекст\n\nПамять роли ${entry.role.id}. Общий архив: knowledge/archive.sqlite; текущие данные сайта: PostgreSQL при наличии локальной настройки.\n\nСначала knowledge status; время этой записи не подтверждает текущий патч. Инструкции: tools/skills/deadlock-team/references/roles/${entry.role.id}.md в активном checkout.\n\n## Принятые выводы и ссылки\n\nИсследования этой роли ещё не объединены координатором. Уже собранные материалы искать адресно в существующем архиве, не начинать заново.\n\n## Незавершённое\n\nАктивного задания в этой памяти не назначено. Конкретную задачу и каталог отчёта передаёт координатор.\n\nКонтекст обновляет координатор после проверки; отчёты исполнителей лежат в отдельных runs. Здесь не хранить credentials или полную переписку.\n`;
    writeFileSync(entry.contextPath, text, { flag: 'wx' });
    created.push(entry.role.id);
  }
  return { archiveRoot, created, preserved: registry.roles.length - created.length };
}

export function readContext(options) {
  const entry = rolePaths(options);
  if (!existsSync(entry.contextPath))
    return {
      role: entry.role.id,
      path: entry.contextPath,
      initialized: false,
      content: '',
      truncated: false,
    };
  const file = openSync(entry.contextPath, 'r');
  try {
    const bytes = Buffer.alloc(24000);
    const count = readSync(file, bytes, 0, bytes.length, 0);
    const text = bytes.subarray(0, count).toString('utf8');
    return {
      role: entry.role.id,
      path: entry.contextPath,
      initialized: true,
      content: text.slice(0, 6000),
      truncated: statSync(entry.contextPath).size > count || text.length > 6000,
    };
  } finally {
    closeSync(file);
  }
}

export function teamStatus(options = {}) {
  const root = resolve(options.root ?? defaultRoot());
  const archiveRoot = resolveArchiveRoot({ ...options, root });
  const registry = loadRegistry(root);
  return {
    archiveRoot,
    maxConcurrentChildren: registry.maxConcurrentChildren,
    roles: registry.roles.map((role) => {
      const entry = rolePaths({ ...options, root, archiveRoot, role: role.id });
      return {
        id: role.id,
        label: role.label,
        ...registry.profiles[role.depth],
        initialized: existsSync(entry.contextPath),
        contextPath: entry.contextPath,
        readOnly: role.readOnly === true,
      };
    }),
    runtimeHandles:
      'Not persisted: inspect live agents, reuse an existing compatible agent, otherwise spawn from the role and its files.',
  };
}

export function createBrief(options) {
  const entry = rolePaths(options);
  const { role, registry, root, archiveRoot, contextPath } = entry;
  const task = options.task?.trim();
  if (!task || task.length > 4000) throw new Error('Task must contain 1–4000 characters');
  const depth = options.depth ?? role.depth;
  const profile = registry.profiles[depth];
  if (!profile) throw new Error('Unknown depth; use quick|standard|deep|audit');
  if (depth === 'audit' && !['critic', 'mechanics'].includes(role.id))
    throw new Error('Audit profile is only for critic or mechanics');
  if (depth === 'audit' && !options.escalationReason?.trim())
    throw new Error('Audit requires an explicit escalation reason');
  const requestedWrites = options.writeFiles ?? [];
  if (requestedWrites.length && !role.canEditCode)
    throw new Error('This role is read-only outside its assigned private report');
  const writeFiles = requestedWrites.map((raw) => {
    const path = raw.replaceAll('\\', '/');
    if (isAbsolute(path) || /^(?:\.?[\\/]|[A-Za-z]:)/.test(path))
      throw new Error('Write paths must be relative inside the active checkout');
    const normalized = slash(relative(realpathSync(root), safePath(root, path)));
    if (/^(?:\.git|\.env[^/\\]*|knowledge|node_modules)(?:[\\/]|$)/i.test(normalized))
      throw new Error('Private/reserved paths cannot be assigned as code ownership');
    return normalized;
  });
  const runId = randomUUID();
  const reportDirectory = safePath(archiveRoot, `knowledge/agents/${role.id}/runs/${runId}`);
  const skill = resolve(root, 'tools/skills/deadlock-team/SKILL.md');
  const workflow = resolve(dirname(skill), `references/roles/${role.id}.md`);
  const message = [
    `Role: deadlock_${role.id}. Active code checkout: ${root}. Existing evidence archive: ${archiveRoot}.`,
    `Task: ${task}`,
    `Read ${skill}, then ${workflow} and the skill's references/protocol.md. Recover role memory at ${contextPath} (if absent, use the existing archive; do not create a replacement index).`,
    `Knowledge commands: run with workdir ${archiveRoot}; start with npm run knowledge -- status, then bounded queries there. Implementation searches and tests use workdir ${root}.`,
    `Read scope: ${(options.readFiles ?? []).join(', ') || 'the smallest relevant source files and bounded knowledge/DB queries'}.`,
    role.readOnly
      ? `File access: read-only. Do not create, edit or delete any files, including private reports. Return findings to the coordinator, who alone may save them at ${reportDirectory}. Do not update CONTEXT.md or the evidence index.`
      : `Code write ownership: ${writeFiles.join(', ') || 'none'}. You may create only your assigned private report directory: ${reportDirectory}. Do not update shared CONTEXT.md or the evidence index; the coordinator merges accepted results.`,
    role.id === 'designer'
      ? 'You may draw assets and build design prototypes inside that assigned private run directory. The coordinator or website role integrates production changes.'
      : '',
    `Return at most ${role.outputWords} words: result; exact evidence paths/URLs and version/date; what was actually verified; uncertainty/conflicts; next useful action. ${role.readOnly ? 'Return the report as text; do not write a report file.' : 'Put necessary detail in the assigned report.'} Do not copy the whole chat or spawn further agents.`,
    options.escalationReason ? `Escalation reason: ${options.escalationReason}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return {
    role: role.id,
    depth,
    archiveRoot,
    contextPath,
    reportDirectory,
    knowledgeCommand: { cwd: archiveRoot, argv: ['npm', 'run', 'knowledge', '--', 'status'] },
    writeFiles,
    readOnly: role.readOnly === true,
    reportMode: role.readOnly ? 'return' : 'file',
    outputWords: role.outputWords,
    spawn: {
      task_name: `deadlock_${role.id}_${runId.slice(0, 8)}`,
      fork_turns: 'none',
      model: profile.model,
      reasoning_effort: profile.effort,
      message,
    },
  };
}

export function installTeam(options = {}) {
  const root = resolve(options.root ?? defaultRoot());
  const archiveRoot = resolveArchiveRoot({ ...options, root });
  const source = resolve(root, 'tools/skills/deadlock-team');
  const target = resolve(
    options.target ??
      resolve(process.env.CODEX_HOME ?? resolve(homedir(), '.codex'), 'skills/deadlock-team'),
  );
  const contains = (parent, child) => {
    const part = relative(parent, child);
    return !part || (part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part));
  };
  if (target === root || contains(target, source) || contains(source, target))
    throw new Error('Skill target overlaps source');
  if (existsSync(target) && lstatSync(target).isSymbolicLink())
    throw new Error('Symlink skill target is not allowed');
  const files = skillFiles(root).map((file) => ({
    input: safePath(root, `tools/skills/deadlock-team/${file}`),
    file,
  }));
  const skill = readFileSync(resolve(source, 'SKILL.md'), 'utf8');
  if (!/^---\r?\nname: deadlock-team\r?\ndescription: Use when/m.test(skill))
    throw new Error('Team skill source failed validation');
  if (
    existsSync(resolve(target, 'SKILL.md')) &&
    !/^---\r?\nname: deadlock-team\r?\n/.test(readFileSync(resolve(target, 'SKILL.md'), 'utf8'))
  )
    throw new Error('Existing target is not the managed team skill');
  for (const { input } of files)
    if (!existsSync(input)) throw new Error('Missing team skill resource');
  mkdirSync(target, { recursive: true });
  const outputs = files.map(({ input, file }) => ({ input, output: safePath(target, file) }));
  const locator = safePath(target, 'references/local-profile.json');
  for (const { input, output } of outputs) {
    mkdirSync(dirname(output), { recursive: true });
    copyFileSync(input, output);
  }
  writeFileSync(locator, `${JSON.stringify({ repoRoot: archiveRoot }, null, 2)}\n`);
  return { name: 'deadlock-team', path: target, archiveRoot };
}

export function writeNativeConfig({ root = defaultRoot() } = {}) {
  root = resolve(root);
  const files = nativeFiles(root);
  const header = '# Managed by Deadlock team:';
  // Validate all destinations before touching any existing file.
  for (const [file] of files) {
    const path = safePath(root, file);
    if (existsSync(path) && !readFileSync(path, 'utf8').startsWith(header))
      throw new Error(`Existing config is not team-owned: ${slash(file)}`);
  }
  const outputs = [...files].map(([file, content]) => {
    const path = safePath(root, file);
    return {
      path,
      content: existsSync(path) ? mergeManagedConfig(readFileSync(path, 'utf8'), content) : content,
    };
  });
  for (const { path, content } of outputs) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return { files: [...files.keys()] };
}

// Update only generated single-line keys; retain unrelated tables and user options.
function mergeManagedConfig(existing, generated) {
  const lines = existing.split('\n');
  let table = '';
  for (const line of generated.split('\n')) {
    const heading = line.match(/^\[([^\]]+)\]$/);
    if (heading) {
      table = heading[1];
      continue;
    }
    const key = line.match(/^([A-Za-z_][A-Za-z_0-9]*)\s*=/)?.[1];
    if (!key) continue;
    let start = table
      ? lines.findIndex((item) => item.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/)?.[1] === table)
      : -1;
    if (table && start === -1) {
      lines.push('', `[${table}]`);
      start = lines.length - 1;
    }
    let end = lines.findIndex((item, index) => index > start && /^\s*\[/.test(item));
    if (end === -1) end = lines.length;
    const index = lines.findIndex(
      (item, index) => index > start && index < end && new RegExp(`^\\s*${key}\\s*=`).test(item),
    );
    if (index === -1) lines.splice(end, 0, line);
    else {
      if (/=\s*(?:"""|''')/.test(lines[index]))
        throw new Error('Managed multiline config value requires manual reconciliation');
      lines[index] = line;
    }
  }
  return lines.join('\n');
}
