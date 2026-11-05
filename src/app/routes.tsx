import { lazy } from 'react';
import type { HeroSnapshot } from '../../shared/types';
import type { ArchivePageSkeletonKind } from '../components/ui/ArchivePageSkeleton/ArchivePageSkeleton';
import { HomePage } from '../pages/HomePage/HomePage';
import { HeroesPage } from '../pages/HeroesPage/HeroesPage';
import type { PageRoute } from './useHashRoute';

const HeroRosterPage = lazy(() =>
  import('../pages/HeroRosterPage/HeroRosterPage').then((m) => ({ default: m.HeroRosterPage })),
);
const HeroStatisticsPage = lazy(() =>
  import('../pages/HeroStatisticsPage/HeroStatisticsPage').then((m) => ({
    default: m.HeroStatisticsPage,
  })),
);
const HeroDetailPage = lazy(() =>
  import('../pages/HeroDetailPage/HeroDetailPage').then((m) => ({ default: m.HeroDetailPage })),
);
const MapPage = lazy(() =>
  import('../pages/MapPage/MapPage').then((m) => ({ default: m.MapPage })),
);

const MechanicsPage = lazy(() =>
  import('../pages/MechanicsPage/MechanicsPage').then((module) => ({
    default: module.MechanicsPage,
  })),
);
const ItemsPage = lazy(() =>
  import('../pages/ItemsPage/ItemsPage').then((module) => ({ default: module.ItemsPage })),
);
const ItemDetailPage = lazy(() =>
  import('../pages/ItemDetailPage/ItemDetailPage').then((module) => ({
    default: module.ItemDetailPage,
  })),
);
const UpdatesPage = lazy(() =>
  import('../pages/UpdatesPage/UpdatesPage').then((module) => ({
    default: module.UpdatesPage,
  })),
);

type ArchivePageKind = ArchivePageSkeletonKind | 'map';

export function archivePageKind(route: PageRoute, path: string): ArchivePageKind {
  if (route === 'items') return path.startsWith('#/items/') ? 'item-detail' : 'items';
  if (route !== 'heroes') return route;
  if (path === '#/heroes/roster') return 'hero-roster';
  if (path === '#/heroes/statistics') return 'hero-statistics';
  return path.startsWith('#/heroes/') ? 'hero-detail' : 'hero-table';
}

export function AppRoutes({
  kind,
  routeHash,
  data,
  onMethod,
  onSnapshot,
}: {
  kind: ArchivePageKind;
  routeHash: string;
  data: HeroSnapshot;
  onMethod: () => void;
  onSnapshot: (snapshot: HeroSnapshot) => void;
}) {
  switch (kind) {
    case 'home':
      return <HomePage data={data} onMethod={onMethod} />;
    case 'hero-table':
      return <HeroesPage key={routeHash} data={data} onMethod={onMethod} />;
    case 'hero-roster':
      return <HeroRosterPage data={data} />;
    case 'hero-statistics':
      return <HeroStatisticsPage data={data} />;
    case 'hero-detail': {
      const slug = routeHash.split('?')[0].slice('#/heroes/'.length);
      return <HeroDetailPage key={slug} data={data} slug={slug} />;
    }
    case 'items':
      return <ItemsPage />;
    case 'item-detail': {
      const slug = routeHash.split('?')[0].slice('#/items/'.length);
      return <ItemDetailPage key={slug} slug={slug} heroes={data} />;
    }
    case 'mechanics':
      return <MechanicsPage data={data} />;
    case 'updates':
      return <UpdatesPage data={data} onSnapshot={onSnapshot} />;
    case 'map':
      return <MapPage data={data} />;
  }
}
