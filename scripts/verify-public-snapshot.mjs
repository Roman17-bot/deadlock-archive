import { runBackend } from './backend.mjs';
process.exitCode = await runBackend('verify-publication', process.argv.slice(2));
