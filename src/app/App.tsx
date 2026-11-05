import { Suspense, useEffect, useState } from 'react';
import { CircleAlert, RefreshCw } from '../components/ui/ArchiveIcon/ArchiveIcons';
import type { HeroSnapshot } from '../../shared/types';
import { SiteLayout } from '../components/layout/SiteLayout';
import { ArchiveLoading } from '../components/ui/ArchiveLoading/ArchiveLoading';
import { MethodDialog } from '../components/ui/MethodDialog/MethodDialog';
import { useHeroSnapshot } from '../hooks/useHeroSnapshot';
import { useI18n } from '../i18n';
import { AppRoutes, archivePageKind } from './routes';
import { useHashRoute } from './useHashRoute';
import { PageLoadBoundary, PageLoading } from './page-loading/PageLoadBoundary';
import { PendingPageSection } from '../hooks/usePageDataPending';
import { HeroNavigation } from '../features/heroes/HeroNavigation';

export function App({ initialSnapshot }: { initialSnapshot?: HeroSnapshot }) {
  const { t } = useI18n();
  const { route, routeHash } = useHashRoute();
  const { data, setData, error, retry } = useHeroSnapshot(initialSnapshot);
  const [method, setMethod] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const openMethod = () => setMethod(true);
  const path = route === 'home' ? '#/' : routeHash.split('?')[0];
  const kind = archivePageKind(route, path);
  const page = data && (
    <AppRoutes
      kind={kind}
      routeHash={routeHash}
      data={data}
      onMethod={openMethod}
      onSnapshot={setData}
    />
  );

  useEffect(() => {
    document.title = `Deadlock Archive — ${t({ home: 'справочник', heroes: 'реестр героев', mechanics: 'механики и калькуляторы', updates: 'обновление данных', items: 'Предметы', map: 'Карта' }[route])}`;
  }, [route, t]);

  return (
    <>
      <SiteLayout
        data={data}
        route={route}
        loading={kind !== 'map' && !error && (!data || pageLoading)}
        onMethod={openMethod}
      >
        {error ? (
          <section className="load-state" role="alert">
            <CircleAlert size={38} />
            <h1>{t('Не удалось загрузить данные')}</h1>
            <p>{t('Проверь подключение и попробуй ещё раз.')}</p>
            <button className="button button-primary" onClick={retry}>
              <RefreshCw size={16} />
              {t('Повторить загрузку')}
            </button>
          </section>
        ) : kind === 'map' ? (
          <Suspense fallback={<ArchiveLoading />}>{page || <ArchiveLoading />}</Suspense>
        ) : (
          <>
            {route === 'heroes' && (
              <div className="hero-navigation-shell">
                <HeroNavigation
                  active={
                    kind === 'hero-statistics'
                      ? 'statistics'
                      : kind === 'hero-table'
                        ? 'table'
                        : 'roster'
                  }
                />
              </div>
            )}
            {data ? (
              <PageLoadBoundary key={path} kind={kind} onLoadingChange={setPageLoading}>
                <Suspense fallback={<PendingPageSection />}>{page}</Suspense>
              </PageLoadBoundary>
            ) : (
              <PageLoading kind={kind} />
            )}
          </>
        )}
      </SiteLayout>
      {method && data && <MethodDialog data={data} onClose={() => setMethod(false)} />}
    </>
  );
}
