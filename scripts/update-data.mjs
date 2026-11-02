import { runBackend } from './backend.mjs';
process.exitCode = await runBackend('update', process.argv.slice(2));
