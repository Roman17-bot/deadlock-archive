import { runBackend } from './backend.mjs';
process.exitCode = await runBackend('items:refresh', process.argv.slice(2));
