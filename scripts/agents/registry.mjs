import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const skillFiles = [
  'SKILL.md',
  'agents/openai.yaml',
  'references/protocol.md',
  ...['heroes', 'items', 'mechanics', 'website', 'data', 'critic', 'scout'].map(
    (role) => `references/roles/${role}.md`,
  ),
];

export function loadRegistry(root) {
  const registry = JSON.parse(readFileSync(resolve(root, 'tools/agents/roles.json'), 'utf8'));
  if (registry.schemaVersion !== 1 || registry.roles.length !== 7)
    throw new Error('Unsupported team registry');
  const ids = new Set();
  for (const role of registry.roles) {
    if (!/^[a-z]+$/.test(role.id) || ids.has(role.id) || !registry.profiles[role.depth])
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
    const instructions = `Work only on this parent's assigned Deadlock task. Read tools/skills/deadlock-team/SKILL.md and references/roles/${role.id}.md relative to that skill. Run npm run team -- context ${role.id} to recover private role memory, then use bounded project retrieval. Follow references/protocol.md. Save results in your assigned report directory; the coordinator merges durable context. Do not spawn children or publish. Instructions limit intended scope; they do not create a separate filesystem sandbox.`;
    files.set(
      `.codex/agents/deadlock-${role.id}.toml`,
      `${header}name = "deadlock_${role.id}"\ndescription = ${JSON.stringify(role.description)}\nmodel = ${JSON.stringify(profile.model)}\nmodel_reasoning_effort = ${JSON.stringify(profile.effort)}\ndeveloper_instructions = ${JSON.stringify(instructions)}\n`,
    );
  }
  return files;
}
