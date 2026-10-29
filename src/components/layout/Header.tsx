import type { HeroSnapshot } from '../../../shared/types';
import type { PageRoute } from '../../app/useHashRoute';
import { useI18n } from '../../i18n';
import { formatDate } from '../../lib/format';
import { ArchiveLogo } from '../ui/ArchiveLogo/ArchiveLogo';
import { LanguageSwitch } from './LanguageSwitch';

export function Header({ data, route }: { data: HeroSnapshot | null; route: PageRoute }) {
  const { t } = useI18n();
  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="brand" href="#/" aria-label={t('Deadlock Archive — главная')}>
          <span className="brand-sigil" aria-hidden="true">
            <ArchiveLogo />
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
            href="#/items"
            className={route === 'items' ? 'active' : ''}
            aria-current={route === 'items' ? 'page' : undefined}
          >
            {t('Предметы')}
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
          {t('ВЕРСИЯ')} {data?.meta.clientVersion ?? '…'}
          <span className="edition-date">
            {data ? formatDate(data.meta.snapshotDate, true) : t('Загрузка данных')}
          </span>
        </div>
        <LanguageSwitch />
      </div>
    </header>
  );
}
