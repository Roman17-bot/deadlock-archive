/** Public archive history. firstPublishedAt dates archive presence, not the game patch. */
export interface VersionPatch {
  source: 'steamdb' | 'game-tracking';
  url: string;
  gameCommit: string;
  steamBuildId?: number;
  notes: 'unknown' | 'published' | 'unpublished';
  checkedAt: string;
  title?: string;
  summary?: { ru: string; en: string };
}

export interface VersionHistoryEntry {
  clientVersion: number;
  buildDate: string;
  firstPublishedAt: string;
  provenance: { kind: 'repository-commit' | 'snapshot-save'; reference: string };
  patch?: VersionPatch;
}

export interface VersionHistory {
  schemaVersion: 1;
  versions: VersionHistoryEntry[];
}

function validDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
function validTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    validDate(value.slice(0, 10))
  );
}

function shortText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

export function validateVersionPatch(input: unknown): input is VersionPatch {
  if (!input || typeof input !== 'object') return false;
  const patch = input as VersionPatch;
  if (
    typeof patch.gameCommit !== 'string' ||
    !/^[a-f0-9]{40}$/.test(patch.gameCommit) ||
    !validTimestamp(patch.checkedAt) ||
    !['unknown', 'published', 'unpublished'].includes(patch.notes) ||
    (patch.title !== undefined && !shortText(patch.title, 240)) ||
    (patch.summary !== undefined &&
      (!patch.summary || !shortText(patch.summary.ru, 600) || !shortText(patch.summary.en, 600)))
  )
    return false;
  if (patch.source === 'steamdb') {
    return (
      Number.isSafeInteger(patch.steamBuildId) &&
      Number(patch.steamBuildId) > 0 &&
      patch.url === `https://steamdb.info/patchnotes/${patch.steamBuildId}/`
    );
  }
  return (
    patch.source === 'game-tracking' &&
    patch.notes === 'unknown' &&
    patch.steamBuildId === undefined &&
    patch.url ===
      `https://github.com/SteamTracking/GameTracking-Deadlock/commit/${patch.gameCommit}`
  );
}

export function validateVersionHistory(input: unknown): input is VersionHistory {
  if (!input || typeof input !== 'object') return false;
  const history = input as VersionHistory;
  if (history.schemaVersion !== 1 || !Array.isArray(history.versions)) return false;
  const seen = new Set<number>();
  for (const entry of history.versions) {
    if (
      !entry ||
      !Number.isSafeInteger(entry.clientVersion) ||
      entry.clientVersion < 1 ||
      seen.has(entry.clientVersion) ||
      !validDate(entry.buildDate) ||
      !validTimestamp(entry.firstPublishedAt) ||
      (entry.patch !== undefined && !validateVersionPatch(entry.patch)) ||
      !entry.provenance ||
      (entry.provenance.kind === 'repository-commit'
        ? !/^[a-f0-9]{40}$/.test(entry.provenance.reference)
        : entry.provenance.kind !== 'snapshot-save' || !validTimestamp(entry.provenance.reference))
    )
      return false;
    seen.add(entry.clientVersion);
  }
  return true;
}
