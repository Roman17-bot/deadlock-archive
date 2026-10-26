import { useRef } from 'react';
import { ArrowDown, BookOpen, Download, Check } from 'lucide-react';
import { useMechanicsData } from './hooks/useMechanicsData';
import { useFormulaLibrary } from './hooks/useFormulaLibrary';
import { FormulaLibrary } from './components/FormulaLibrary';
import { useI18n } from '../../i18n';
import type { HeroSnapshot } from '../../../shared/types';
import { asset, formatDate } from '../../lib/format';
import { Calculator } from '../../features/calculator/Calculator';

export function MechanicsPage({ data, localApi }: { data: HeroSnapshot; localApi?: boolean }) {
  const { t, language } = useI18n();
  const { catalogs, loading, error, retry } = useMechanicsData(data.meta.clientVersion, localApi);
  const libraryState = useFormulaLibrary(catalogs, language);
  const { catalog, onRule } = libraryState;
  const library = useRef<HTMLElement>(null);
  if (loading)
    return (
      <section className="load-state" aria-busy="true">
        <span className="loader" />
        <p>{t('Загружаем механики из локального API…')}</p>
      </section>
    );
  if (error)
    return (
      <section className="load-state" role="alert">
        <h1>{t('Не удалось загрузить механики')}</h1>
        <p>{t('Проверь подключение к локальному серверу и PostgreSQL.')}</p>
        <button className="button button-primary" onClick={retry}>
          {t('Повторить загрузку')}
        </button>
      </section>
    );
  return (
    <div className="mechanics-page">
      <section className="mechanics-intro">
        <div>
          <div className="section-kicker light">
            <span />
            {t('БЮРО ПРИКЛАДНОЙ МАТЕМАТИКИ')}
          </div>
          <h1>
            {t('Механики')} <br />
            {t('и')} <em>{t('формулы.')}</em>
          </h1>
          <p>
            {t(
              'Понимай, откуда берутся цифры. Сравнивай защиту, рассчитывай лечение и проверяй идеи для следующего билда.',
            )}
          </p>
          <p className="mechanics-checkline">
            {t('{{count}} правил · клиент {{version}} · проверено {{date}}', {
              count: catalog.formulas.length,
              version: catalog.meta.reviewedClientVersion,
              date: formatDate(catalog.meta.checkedAt),
            })}
          </p>
          <div className="mechanics-intro-actions">
            <a
              className="button button-paper"
              href="#/mechanics"
              onClick={(e) => {
                e.preventDefault();
                library.current?.scrollIntoView?.({ behavior: 'smooth' });
              }}
            >
              <BookOpen size={18} />
              {t('К справочнику')}
              <ArrowDown size={18} />
            </a>
            <a
              className="text-link"
              href={asset(
                language === 'en'
                  ? 'data/mechanics-reference.en.md'
                  : 'data/mechanics-reference.md',
              )}
              download
            >
              <Download size={17} />
              {t('Скачать разбор')}
            </a>
          </div>
        </div>
        <aside className="research-stamp">
          <span className="stamp-symbol">∑</span>
          <span>{t('ПРОВЕРЕННЫЕ МАТЕРИАЛЫ')}</span>
          <strong>
            {catalog.formulas.length}
            <small>{t('правил и моделей')}</small>
          </strong>
          <p>
            {t('{{count}} источника · клиент {{version}}', {
              count: catalog.sources.length,
              version: catalog.meta.reviewedClientVersion,
            })}
            <br />
            {formatDate(catalog.meta.checkedAt)}
          </p>
          <div>
            <Check size={16} />
            {t('Файлы игры и наблюдения игроков')}
          </div>
        </aside>
      </section>
      {data.meta.clientVersion !== catalog.meta.reviewedClientVersion && (
        <p className="mechanics-stale" role="status">
          {t(
            'Механики проверены для клиента {{reviewed}}. В таблице уже клиент {{current}}: числовые данные героев обновлены, правила ещё требуют повторной сверки.',
            { reviewed: catalog.meta.reviewedClientVersion, current: data.meta.clientVersion },
          )}
        </p>
      )}
      <Calculator onRule={onRule} />
      <FormulaLibrary library={library} state={libraryState} />
      <aside className="mechanics-footnote">
        <BookOpen size={24} />
        <p>
          {t(
            'Проценты в уравнениях записаны долями:30%=0,30. В калькулятор вводи30. Округляется только вывод. Проверка источников не является собственным замером движка; игра при исследовании не запускалась.',
          )}
        </p>
      </aside>
    </div>
  );
}
