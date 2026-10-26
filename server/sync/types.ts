import type { CuratedBundle } from '../../shared/database-types';

export interface SnapshotFile {
  path: string;
  content: Buffer;
}
export interface SnapshotManifest {
  schemaVersion: 1;
  clientVersion: number;
  reviewedClientVersion: number;
  hash: string;
  files: Record<string, string>;
}
export interface PublicSnapshot {
  bundle: CuratedBundle;
  clientVersion: number;
  hash: string;
  manifest: SnapshotManifest;
  files: SnapshotFile[];
}
