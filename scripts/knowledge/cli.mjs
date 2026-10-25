import { resolve } from 'node:path';
import { openKnowledge } from './database.mjs';
import { importKnowledge } from './import.mjs';

function main(args) {
  let root = process.cwd();
  let path;
  const options = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' || args[i] === '--db' || args[i] === '--limit') {
      const key = args[i];
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
      if (key === '--root') root = resolve(value);
      else if (key === '--db') path = resolve(value);
      else options.limit = Number(value);
    } else if (args[i] === '--history') options.history = true;
    else if (args[i].startsWith('--')) throw new Error(`Unknown option ${args[i]}`);
    else positional.push(args[i]);
  }
  const [command = 'status', ...words] = positional;
  if (!['status', 'import', 'search', 'entity', 'formula', 'decision'].includes(command))
    throw new Error('Unknown command; use status|import|search|entity|formula|decision');
  if (command === 'import') return importKnowledge({ root, path });
  const db = openKnowledge({ root, path, writable: command === 'decision' });
  try {
    if (command === 'status') return db.status();
    return db[command](words.join(' '), options);
  } finally {
    db.close();
  }
}

try {
  process.stdout.write(`${JSON.stringify(main(process.argv.slice(2)))}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exitCode = 1;
}
