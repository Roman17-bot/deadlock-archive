import { readFile } from 'node:fs/promises';
import { createApp } from './app';
import type { HeroSnapshot } from '../shared/types';
import { fileURLToPath } from 'node:url';
import { createUpdateManager } from './updates/manager';

const snapshot = JSON.parse(
  await readFile(new URL('../data/heroes.json', import.meta.url), 'utf8'),
) as HeroSnapshot;
const port = Number(process.env.API_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid API_PORT');
const root = fileURLToPath(new URL('../', import.meta.url));
const updates = createUpdateManager({
  snapshot,
  root,
  onSaved: async () => {
    const { importKnowledge } = await import(
      new URL('../scripts/knowledge/import.mjs', import.meta.url).href
    );
    importKnowledge({ root });
  },
});
const app = createApp(snapshot, { updates });
app.listen(port, '127.0.0.1', () => console.log(`API: http://127.0.0.1:${port}/api/health`));
process.once('SIGINT', () => app.close());
process.once('SIGTERM', () => app.close());
