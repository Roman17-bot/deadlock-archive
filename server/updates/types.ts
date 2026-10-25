import type { HeroSnapshot } from '../../shared/types.ts';
export interface RefreshOptions {
  root: string;
  fetchImpl?: typeof fetch;
  dryRun?: boolean;
  expectedVersion?: number;
}
export interface RefreshResult {
  snapshot: HeroSnapshot;
  changed: boolean;
  checkedAt: string;
  sourceCommit: string;
  backupPath?: string;
  historySaved?: boolean;
  summary: { heroCount: number; added: number; removed: number; updated: number; text: string };
}
