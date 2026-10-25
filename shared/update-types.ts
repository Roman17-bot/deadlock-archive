export type UpdatePhase = 'idle' | 'checking' | 'saving' | 'publishing' | 'succeeded' | 'failed';

export interface PublicationState {
  status: 'queued' | 'in_progress' | 'success' | 'failure' | 'unknown';
  runId?: number;
  url: string;
}

export interface UpdateState {
  phase: UpdatePhase;
  clientVersion: number;
  localSaved: boolean;
  changed: boolean;
  upToDate?: boolean;
  historySaved?: boolean;
  message: string;
  updatedAt: string;
  jobId?: string;
  error?: string;
  publication?: PublicationState;
}

export interface UpdateSession {
  token: string;
  state: UpdateState;
}
