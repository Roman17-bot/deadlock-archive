import { lazy, Suspense, type ReactNode } from 'react';
import type { HeroSnapshot } from '../../shared/types';
import { ArchiveLoading } from '../components/ui/ArchiveLoading/ArchiveLoading';
import { HomePage } from '../pages/HomePage/HomePage';
import { HeroesPage } from '../pages/HeroesPage/HeroesPage';
import type { PageRoute } from './useHashRoute';
import { HeroNavigation } from '../features/heroes/HeroNavigation';

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

export function AppRoutes({
  route,
  routeHash,
  data,
  onMethod,
  onSnapshot,
}: {
  route: PageRoute;
  routeHash: string;
  data: HeroSnapshot;
  onMethod: () => void;
  onSnapshot: (snapshot: HeroSnapshot) => void;
}) {
  if (route === 'items') {
    const slug = routeHash.split('?')[0].slice('#/items/'.length);
    const detail = routeHash.split('?')[0].startsWith('#/items/');
    return (
      <Suspense fallback={<ArchiveLoading />}>
        {detail ? <ItemDetailPage key={slug} slug={slug} heroes={data} /> : <ItemsPage />}
      </Suspense>
    );
  }
  if (route === 'mechanics') {
    return (
      <Suspense fallback={<ArchiveLoading />}>
        <MechanicsPage data={data} />
      </Suspense>
    );
  }
  if (route === 'updates')
    return (
      <Suspense fallback={<ArchiveLoading />}>
        <UpdatesPage data={data} onSnapshot={onSnapshot} />
      </Suspense>
    );
  if (route === 'map')
    return (
      <Suspense fallback={<ArchiveLoading />}>
        <MapPage data={data} />
      </Suspense>
    );
  if (route === 'heroes') {
    const path = routeHash.split('?')[0];
    let page: ReactNode;
    if (path === '#/heroes/roster')
      page = (
        <Suspense fallback={<ArchiveLoading />}>
          <HeroRosterPage data={data} />
        </Suspense>
      );
    else if (path === '#/heroes/statistics')
      page = (
        <Suspense fallback={<ArchiveLoading />}>
          <HeroStatisticsPage data={data} />
        </Suspense>
      );
    else if (path.startsWith('#/heroes/'))
      page = (
        <Suspense fallback={<ArchiveLoading />}>
          <HeroDetailPage key={path} data={data} slug={path.slice('#/heroes/'.length)} />
        </Suspense>
      );
    else page = <HeroesPage key={routeHash} data={data} onMethod={onMethod} />;
    const active =
      path === '#/heroes/statistics' ? 'statistics' : path === '#/heroes' ? 'table' : 'roster';
    return (
      <>
        <div className="hero-navigation-shell">
          <HeroNavigation active={active} />
        </div>
        {page}
      </>
    );
  }
  return <HomePage data={data} onMethod={onMethod} />;
}
