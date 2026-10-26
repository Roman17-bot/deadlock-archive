export type SyncPhase =
  'idle' | 'checking' | 'saving' | 'publishing' | 'queued' | 'in_progress' | 'succeeded' | 'failed';

export interface SyncState {
  available: boolean;
  source: 'postgresql' | 'json';
  phase: SyncPhase;
  clientVersion?: number;
  snapshotHash?: string;
  repositoryHash?: string | null;
  pagesHash?: string | null;
  localMatches?: boolean;
  repositoryMatches?: boolean;
  pagesMatches?: boolean;
  localSaved: boolean;
  upToDate?: boolean;
  commitSha?: string;
  runId?: number;
  url?: string;
  updatedAt: string;
  message: string;
}
