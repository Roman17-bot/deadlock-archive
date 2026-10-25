/** Public archive history. firstPublishedAt dates archive presence, not the game patch. */
export interface VersionHistoryEntry {
  clientVersion: number;
  buildDate: string;
  firstPublishedAt: string;
  provenance: { kind: 'repository-commit' | 'snapshot-save'; reference: string };
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
