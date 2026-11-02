import { runBackend } from '../backend.mjs';
process.exitCode = await runBackend('db:' + (process.argv[2] ?? 'status'), process.argv.slice(3));
