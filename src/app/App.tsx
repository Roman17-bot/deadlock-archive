import { useEffect, useState } from 'react';
import { CircleAlert, RefreshCw } from 'lucide-react';
import type { HeroSnapshot } from '../../shared/types';
import { SiteLayout } from '../components/layout/SiteLayout';
import { ArchiveLoading } from '../components/ui/ArchiveLoading/ArchiveLoading';
import { MethodDialog } from '../components/ui/MethodDialog/MethodDialog';
import { useHeroSnapshot } from '../hooks/useHeroSnapshot';
import { useI18n } from '../i18n';
import { AppRoutes } from './routes';
import { useHashRoute } from './useHashRoute';

export function App({ initialSnapshot }: { initialSnapshot?: HeroSnapshot }) {
  const { t } = useI18n();
  const { route, routeHash } = useHashRoute();
  const { data, setData, error, retry } = useHeroSnapshot(initialSnapshot);
  const [method, setMethod] = useState(false);
  const openMethod = () => setMethod(true);

  useEffect(() => {
    document.title = `Deadlock Archive — ${t({ home: 'справочник', heroes: 'реестр героев', mechanics: 'механики и калькуляторы', updates: 'обновление данных' }[route])}`;
  }, [route, t]);

  return (
    <>
      <SiteLayout data={data} route={route} onMethod={openMethod}>
        {error ? (
          <section className="load-state" role="alert">
            <CircleAlert size={38} />
            <h1>{t('Не удалось загрузить досье')}</h1>
            <p>
              {t(
                'Проверь подключение и попробуй ещё раз. Данные не будут заменены случайными значениями.',
              )}
            </p>
            <button className="button button-primary" onClick={retry}>
              <RefreshCw size={16} />
              {t('Повторить загрузку')}
            </button>
          </section>
        ) : !data ? (
          <ArchiveLoading />
        ) : (
          <AppRoutes
            route={route}
            routeHash={routeHash}
            data={data}
            onMethod={openMethod}
            onSnapshot={setData}
          />
        )}
      </SiteLayout>
      {method && data && <MethodDialog data={data} onClose={() => setMethod(false)} />}
    </>
  );
}
