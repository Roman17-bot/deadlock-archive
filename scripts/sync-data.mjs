import { runBackend } from './backend.mjs';
process.exitCode = await runBackend('sync', process.argv.slice(2));
