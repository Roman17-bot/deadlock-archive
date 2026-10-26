import { Download, Search, X } from 'lucide-react';
import { useI18n } from '../../../i18n';
import type { HeroRegisterState } from '../hooks/useHeroRegister';

type Props = Pick<HeroRegisterState, 'query' | 'setQuery' | 'exportCsv' | 'selected'>;

export function RegisterToolbar({ query, setQuery, exportCsv, selected }: Props) {
  const { t } = useI18n();
  return (
    <div className="register-toolbar">
      <div className="search-field">
        <Search size={18} />
        <input
          type="search"
          aria-label={t('Найти героя')}
          placeholder={t('Найти героя…')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button aria-label={t('Очистить поиск')} onClick={() => setQuery('')}>
            <X size={16} />
          </button>
        )}
      </div>
      <div className="quick-filters">
        <button
          className={query === 'Nurse Harrow' ? 'selected' : ''}
          onClick={() => setQuery(query === 'Nurse Harrow' ? '' : 'Nurse Harrow')}
        >
          Nurse Harrow<span>{t('НОВЫЙ')}</span>
        </button>
        <button
          className={query === 'Violet' ? 'selected' : ''}
          onClick={() => setQuery(query === 'Violet' ? '' : 'Violet')}
        >
          Violet<span>{t('НОВЫЙ')}</span>
        </button>
      </div>
      <button className="export-button" onClick={exportCsv} disabled={!selected.length}>
        <Download size={16} />
        <span>{t('Скачать CSV')}</span>
      </button>
    </div>
  );
}
