import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function skillFiles(root) {
  return [
    'SKILL.md',
    'agents/openai.yaml',
    'references/protocol.md',
    ...loadRegistry(root).roles.map((role) => `references/roles/${role.id}.md`),
  ];
}

export function loadRegistry(root) {
  const registry = JSON.parse(readFileSync(resolve(root, 'tools/agents/roles.json'), 'utf8'));
  if (
    !registry ||
    registry.schemaVersion !== 1 ||
    !Array.isArray(registry.roles) ||
    !registry.roles.length ||
    !Number.isSafeInteger(registry.maxConcurrentChildren) ||
    registry.maxConcurrentChildren < 1 ||
    !registry.profiles ||
    typeof registry.profiles !== 'object' ||
    Array.isArray(registry.profiles)
  )
    throw new Error('Unsupported team registry');
  const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
  const depths = ['quick', 'standard', 'deep', 'audit'];
  const efforts = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
  for (const depth of depths) {
    const profile = registry.profiles[depth];
    if (!profile || !nonempty(profile.model) || !efforts.includes(profile.effort))
      throw new Error('Invalid team profile');
  }
  const ids = new Set();
  for (const role of registry.roles) {
    if (
      !role ||
      typeof role.id !== 'string' ||
      !/^[a-z]+$/.test(role.id) ||
      ids.has(role.id) ||
      !depths.includes(role.depth) ||
      !nonempty(role.label) ||
      !nonempty(role.description) ||
      !Number.isSafeInteger(role.outputWords) ||
      role.outputWords < 1 ||
      typeof role.canEditCode !== 'boolean' ||
      (role.readOnly !== undefined && typeof role.readOnly !== 'boolean') ||
      (role.readOnly && role.canEditCode)
    )
      throw new Error('Invalid team role');
    ids.add(role.id);
  }
  return registry;
}

export function findRole(root, id) {
  const registry = loadRegistry(root);
  const role = registry.roles.find((entry) => entry.id === id);
  if (!role) throw new Error(`Unknown team role: ${id}`);
  return { role, registry };
}

export function nativeFiles(root) {
  const registry = loadRegistry(root);
  const header = '# Managed by Deadlock team: npm run team -- configure\n';
  // Explicit role layers also work with the installed0.133 client, which treats
  // newer agents.default_subagent_* scalars as malformed role declarations.
  const declarations = registry.roles
    .map(
      (role) =>
        `[agents.deadlock_${role.id}]\ndescription = ${JSON.stringify(role.description)}\nconfig_file = "agents/deadlock-${role.id}.toml"\n`,
    )
    .join('\n');
  const files = new Map([
    [
      '.codex/config.toml',
      `${header}[agents]\nmax_threads = ${registry.maxConcurrentChildren}\n\n${declarations}`,
    ],
  ]);
  for (const role of registry.roles) {
    const profile = registry.profiles[role.depth];
    const reporting = role.readOnly
      ? 'Read-only review: do not create, edit or delete files, including private reports. Return findings in your response; the coordinator saves the report and merges context.'
      : 'Save results in your assigned report directory; the coordinator merges durable context.';
    const instructions = `Work only on this parent's assigned Deadlock task. Read tools/skills/deadlock-team/SKILL.md and references/roles/${role.id}.md relative to that skill. Run npm run team -- context ${role.id} to recover private role memory, then use bounded project retrieval. Follow references/protocol.md. ${reporting} Do not spawn children or publish. Instructions limit intended scope; they do not create a separate filesystem sandbox.`;
    files.set(
      `.codex/agents/deadlock-${role.id}.toml`,
      `${header}name = "deadlock_${role.id}"\ndescription = ${JSON.stringify(role.description)}\nmodel = ${JSON.stringify(profile.model)}\nmodel_reasoning_effort = ${JSON.stringify(profile.effort)}\ndeveloper_instructions = ${JSON.stringify(instructions)}\n`,
    );
  }
  return files;
}
