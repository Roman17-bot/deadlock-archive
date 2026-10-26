import { lazy, Suspense } from 'react';
import type { HeroSnapshot } from '../../shared/types';
import { ArchiveLoading } from '../components/ui/ArchiveLoading/ArchiveLoading';
import { HomePage } from '../pages/HomePage/HomePage';
import { HeroesPage } from '../pages/HeroesPage/HeroesPage';
import { UpdatesPage } from '../pages/UpdatesPage/UpdatesPage';
import type { PageRoute } from './useHashRoute';

const MechanicsPage = lazy(() =>
  import('../pages/MechanicsPage/MechanicsPage').then((module) => ({
    default: module.MechanicsPage,
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
  if (route === 'mechanics') {
    return (
      <Suspense fallback={<ArchiveLoading />}>
        <MechanicsPage data={data} />
      </Suspense>
    );
  }
  if (route === 'updates') return <UpdatesPage data={data} onSnapshot={onSnapshot} />;
  if (route === 'heroes') return <HeroesPage key={routeHash} data={data} onMethod={onMethod} />;
  return <HomePage data={data} onMethod={onMethod} />;
}
