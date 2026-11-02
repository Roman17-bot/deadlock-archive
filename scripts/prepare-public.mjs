import { runBackend } from './backend.mjs';
process.exitCode = await runBackend('prepare-public', process.argv.slice(2));
