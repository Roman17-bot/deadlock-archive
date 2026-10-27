import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export function safePath(root, path) {
  root = realpathSync(root);
  const target = resolve(root, path);
  const remainder = relative(root, target);
  if (!remainder || remainder === '..' || remainder.startsWith(`..${sep}`) || isAbsolute(remainder))
    throw new Error('Path must be relative and inside its owner, not the owner itself');
  let current = root;
  for (const part of remainder.split(sep)) {
    current = resolve(current, part);
    try {
      if (lstatSync(current).isSymbolicLink())
        throw new Error('Symlink/junction paths are not allowed for team-owned files');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return target;
}

function validArchive(root) {
  if (!root || !existsSync(resolve(root, 'knowledge/archive.sqlite'))) return false;
  if (!existsSync(resolve(root, 'scripts/knowledge/cli.mjs'))) return false;
  try {
    return (
      JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).name === 'deadlock-archive'
    );
  } catch {
    return false;
  }
}

export function resolveArchiveRoot({ root, archiveRoot, locator } = {}) {
  if (archiveRoot) {
    if (!validArchive(archiveRoot))
      throw new Error('Explicit archive root has no existing Deadlock evidence archive');
    return realpathSync(archiveRoot);
  }
  if (validArchive(root)) return realpathSync(root);
  locator ??= resolve(
    process.env.CODEX_HOME ?? resolve(homedir(), '.codex'),
    'skills/deadlock-project/references/local-profile.json',
  );
  if (existsSync(locator)) {
    const profile = JSON.parse(readFileSync(locator, 'utf8'));
    if (
      typeof profile.repoRoot === 'string' &&
      isAbsolute(profile.repoRoot) &&
      validArchive(profile.repoRoot)
    )
      return realpathSync(profile.repoRoot);
  }
  throw new Error(
    'Existing private archive not found; pass --archive-root for the original repository. No replacement archive was created.',
  );
}
