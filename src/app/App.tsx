import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, CircleAlert, RefreshCw } from 'lucide-react';
import type { HeroSnapshot } from '../../shared/types';
import { validateSnapshot } from '../../shared/heroes';
import { asset, formatDate } from '../lib/format';
import { Home } from '../pages/Home';
import { HeroRegister } from '../features/heroes/HeroRegister';
import { MethodDialog } from '../components/MethodDialog';
import { UpdatePage } from '../features/updates/UpdatePage';
import { useI18n } from '../i18n';

const MechanicsPage = lazy(() =>
  import('../features/mechanics/MechanicsPage').then((module) => ({
    default: module.MechanicsPage,
  })),
);

export function App({ initialSnapshot }: { initialSnapshot?: HeroSnapshot }) {
  const { t, language, setLanguage } = useI18n();
  const [routeHash, setRouteHash] = useState(() => window.location.hash);
  const route = routeHash.startsWith('#/heroes')
    ? 'heroes'
    : routeHash.startsWith('#/mechanics')
      ? 'mechanics'
      : routeHash.startsWith('#/updates')
        ? 'updates'
        : 'home';
  const [data, setData] = useState<HeroSnapshot | null>(initialSnapshot ?? null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [method, setMethod] = useState(false);
  useEffect(() => {
    document.title = `Deadlock Archive — ${t({ home: 'справочник', heroes: 'реестр героев', mechanics: 'механики и калькуляторы', updates: 'обновление данных' }[route])}`;
  }, [route, t]);
  useEffect(() => {
    const changed = () => {
      setRouteHash(window.location.hash);
      window.scrollTo?.({ top: 0 });
    };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => {
    if (initialSnapshot) return;
    const controller = new AbortController();
    setError(false);
    const url =
      import.meta.env.VITE_API_URL ||
      (import.meta.env.DEV ? '/api/heroes' : asset('data/heroes.json'));
    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Data request failed');
        return response.json();
      })
      .then((value) => {
        if (!validateSnapshot(value)) throw new Error('Invalid data');
        setData(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [initialSnapshot, attempt]);
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        {t('К содержимому')}
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#/" aria-label={t('Deadlock Archive — главная')}>
            <span className="brand-sigil" aria-hidden="true">
              D
            </span>
            <span className="brand-wordmark">
              DEADLOCK<span>ARCHIVE</span>
            </span>
          </a>
          <nav aria-label={t('Основная навигация')}>
            <a
              className={route === 'home' ? 'active' : ''}
              aria-current={route === 'home' ? 'page' : undefined}
              href="#/"
            >
              {t('Главная')}
            </a>
            <a
              className={route === 'heroes' ? 'active' : ''}
              aria-current={route === 'heroes' ? 'page' : undefined}
              href="#/heroes"
            >
              {t('Реестр героев')} <span className="nav-count">{data?.heroes.length ?? '—'}</span>
            </a>
            <a
              className={route === 'mechanics' ? 'active' : ''}
              aria-current={route === 'mechanics' ? 'page' : undefined}
              href="#/mechanics"
            >
              {t('Механики')}
            </a>
            <a
              className={route === 'updates' ? 'active' : ''}
              aria-current={route === 'updates' ? 'page' : undefined}
              href="#/updates"
            >
              {t('Обновления')}
            </a>
          </nav>
          <div className="header-edition">
            <span className="status-dot" />
            {t('КЛИЕНТ')} {data?.meta.clientVersion ?? '…'}
            <span className="edition-date">
              {data
                ? t('Срез от {{date}}', { date: formatDate(data.meta.snapshotDate, true) })
                : t('Загрузка данных')}
            </span>
          </div>
          <div className="language-switch" role="group" aria-label={t('Язык сайта')}>
            <button
              type="button"
              lang="ru"
              aria-label="Русский"
              aria-pressed={language === 'ru'}
              onClick={() => void setLanguage('ru')}
            >
              RU
            </button>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              lang="en"
              aria-label="English"
              aria-pressed={language === 'en'}
              onClick={() => void setLanguage('en')}
            >
              EN
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {error ? (
          <section className="load-state" role="alert">
            <CircleAlert size={38} />
            <h1>{t('Не удалось загрузить досье')}</h1>
            <p>
              {t(
                'Проверь подключение и попробуй ещё раз. Данные не будут заменены случайными значениями.',
              )}
            </p>
            <button
              className="button button-primary"
              onClick={() => {
                setError(false);
                setAttempt((n) => n + 1);
              }}
            >
              <RefreshCw size={16} />
              {t('Повторить загрузку')}
            </button>
          </section>
        ) : !data ? (
          <section className="load-state" aria-busy="true">
            <span className="loader" />
            <p>{t('Поднимаем материалы из архива…')}</p>
          </section>
        ) : route === 'mechanics' ? (
          <Suspense
            fallback={
              <section className="load-state" aria-busy="true">
                <span className="loader" />
                <p>{t('Поднимаем материалы из архива…')}</p>
              </section>
            }
          >
            <MechanicsPage data={data} />
          </Suspense>
        ) : route === 'updates' ? (
          <UpdatePage data={data} onSnapshot={setData} />
        ) : route === 'heroes' ? (
          <HeroRegister key={routeHash} data={data} onMethod={() => setMethod(true)} />
        ) : (
          <Home data={data} onMethod={() => setMethod(true)} />
        )}
      </main>
      <footer className="site-footer">
        <div>
          <a className="footer-wordmark" href="#/">
            DEADLOCK / ARCHIVE
          </a>
          <p>{t('Независимый справочник. Игра и изображения принадлежат Valve.')}</p>
        </div>
        <div className="footer-actions">
          {data && (
            <button onClick={() => setMethod(true)}>
              <BookOpen size={15} />
              {t('Источники и методика')}
            </button>
          )}
          <a
            href="https://github.com/Roman17-bot/deadlock-archive"
            target="_blank"
            rel="noreferrer"
          >
            {t('Исходный код')}
            <ArrowUpRight size={16} />
          </a>
        </div>
        <span className="footer-stamp">MANHATTAN · EST. 2026</span>
      </footer>
      {method && data && <MethodDialog data={data} onClose={() => setMethod(false)} />}
    </>
  );
}
