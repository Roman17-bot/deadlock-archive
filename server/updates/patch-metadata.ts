import type { HeroSnapshot } from '../../shared/types';
import type { VersionPatch } from '../../shared/version-history';

/** The tracked commit carries Steam's build ID; client version and build ID are different IDs. */
export function patchForSavedVersion(snapshot: HeroSnapshot, commitMessage?: string): VersionPatch {
  const gameCommit = snapshot.meta.gameCommit;
  const base: VersionPatch = {
    source: 'game-tracking',
    gameCommit,
    url: `https://github.com/SteamTracking/GameTracking-Deadlock/commit/${gameCommit}`,
    notes: 'unknown',
    checkedAt: new Date().toISOString(),
  };
  if (
    typeof commitMessage !== 'string' ||
    commitMessage.length > 64_000 ||
    !new RegExp(`^${snapshot.meta.clientVersion}(?:\\s|\\||$)`).test(commitMessage)
  )
    return base;
  const ids = new Set(
    [
      ...commitMessage.matchAll(/https:\/\/steamdb\.info\/patchnotes\/([1-9]\d{0,15})\/(?=\s|$)/g),
    ].map((match) => Number(match[1])),
  );
  if (ids.size !== 1) return base;
  const [steamBuildId] = ids;
  if (!Number.isSafeInteger(steamBuildId)) return base;
  return {
    ...base,
    source: 'steamdb',
    steamBuildId,
    url: `https://steamdb.info/patchnotes/${steamBuildId}/`,
  };
}
