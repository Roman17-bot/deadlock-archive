import type { Hero, HeroSnapshot } from './types';
import type { VersionHistory } from './version-history';
import type { ItemCatalog, ItemStatistics } from './item-types';

export interface MechanicsSource {
  id: string;
  label: string;
  url: string;
  kind: 'raw' | 'community' | 'official';
}

export interface MechanicsFormula {
  id: string;
  category: string;
  title: string;
  expression: string;
  variables: string[];
  explanation: string[];
  example: string;
  caveats: string[];
  sourceIds: string[];
  confidence: string;
}

export interface MechanicsCatalog {
  meta: {
    schemaVersion: number;
    reviewedClientVersion: number;
    sourceRevision: number;
    gameCommit: string;
    checkedAt: string;
    title: string;
    policy: string;
  };
  sources: MechanicsSource[];
  formulas: MechanicsFormula[];
}

export interface CuratedBundle {
  items?: ItemCatalog;
  itemStatistics?: ItemStatistics;
  heroes: HeroSnapshot;
  mechanics: { ru: MechanicsCatalog; en: MechanicsCatalog };
  provenance: unknown;
  history: VersionHistory;
}

export interface ArchiveStatus {
  storage: 'postgresql';
  schemaVersion: number;
  currentSnapshotId: number | null;
  currentClientVersion: number | null;
  snapshots: number;
  heroes: number;
  formulas: number;
  sources: number;
  historyVersions: number;
}

export type ArchiveHero = Hero;
