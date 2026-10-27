import {
  createBrief,
  initTeam,
  installTeam,
  readContext,
  teamStatus,
  writeNativeConfig,
} from './team.mjs';

function main(args) {
  const positional = [];
  const options = { writeFiles: [], readFiles: [] };
  const keys = {
    '--root': 'root',
    '--archive-root': 'archiveRoot',
    '--target': 'target',
    '--task': 'task',
    '--depth': 'depth',
    '--reason': 'escalationReason',
    '--write': 'writeFiles',
    '--read': 'readFiles',
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) positional.push(arg);
    else {
      const key = keys[arg];
      if (!key) throw new Error(`Unknown option ${arg}`);
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      if (Array.isArray(options[key])) options[key].push(value);
      else options[key] = value;
    }
  }
  const [command = 'status', role, ...extra] = positional;
  if (extra.length) throw new Error('Unexpected positional argument');
  options.role = role;
  const commands = {
    status: teamStatus,
    init: initTeam,
    context: readContext,
    brief: createBrief,
    install: installTeam,
    configure: writeNativeConfig,
  };
  if (!commands[command])
    throw new Error('Use status|init|context ROLE|brief ROLE --task TEXT|install|configure');
  return commands[command](options);
}

try {
  process.stdout.write(`${JSON.stringify(main(process.argv.slice(2)), null, 2)}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exitCode = 1;
}
