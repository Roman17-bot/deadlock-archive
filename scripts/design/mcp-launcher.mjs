// Run the pinned, project-local MCP bin in this process: no shell, npm or child profile.
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const providers = {
  playwright: ['@playwright/mcp', 'playwright-mcp'],
  devtools: ['chrome-devtools-mcp', 'chrome-devtools-mcp'],
};

try {
  const [provider, ...args] = process.argv.slice(2);
  if (!Object.hasOwn(providers, provider))
    throw new Error('Expected provider: playwright or devtools');
  const [name, binName] = providers[provider];
  const runtime = fileURLToPath(new URL('../../tools/design-runtime/', import.meta.url));
  const manifest = JSON.parse(await readFile(resolve(runtime, 'package.json'), 'utf8'));
  const packageRoot = resolve(runtime, 'node_modules', name);
  const installed = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
  if (installed.version !== manifest.dependencies[name])
    throw new Error(`Expected ${name}@${manifest.dependencies[name]}, found ${installed.version}`);
  const bin = installed.bin?.[binName];
  if (typeof bin !== 'string') throw new Error(`Missing ${name} bin: ${binName}`);
  const entry = resolve(packageRoot, bin);
  process.argv = [process.execPath, entry, ...args];
  await import(pathToFileURL(entry).href);
} catch (error) {
  console.error(`Browser MCP launcher: ${error.message}`);
  console.error('Install the pinned runtime: npm ci --prefix tools/design-runtime --ignore-scripts');
  process.exitCode = 1;
}
