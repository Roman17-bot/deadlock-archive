import { useRef } from 'react';
import { ArrowDown, BookOpen, Download } from 'lucide-react';
import { useMechanicsData } from './hooks/useMechanicsData';
import { useFormulaLibrary } from './hooks/useFormulaLibrary';
import { FormulaLibrary } from './components/FormulaLibrary';
import { useI18n } from '../../i18n';
import type { HeroSnapshot } from '../../../shared/types';
import { asset } from '../../lib/format';
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
        <p>{t('Загружаем механики…')}</p>
      </section>
    );
  if (error)
    return (
      <section className="load-state" role="alert">
        <h1>{t('Не удалось загрузить механики')}</h1>
        <p>{t('Проверь подключение и попробуй ещё раз.')}</p>
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
            {t('{{count}} формул · версия {{version}}', {
              count: catalog.formulas.length,
              version: catalog.meta.reviewedClientVersion,
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
          <span>{t('СПРАВОЧНИК МЕХАНИК')}</span>
          <strong>
            {catalog.formulas.length}
            <small>{t('формул')}</small>
          </strong>
          <p>
            {t('Версия игры {{version}}', {
              version: catalog.meta.reviewedClientVersion,
            })}
          </p>
        </aside>
      </section>
      {data.meta.clientVersion !== catalog.meta.reviewedClientVersion && (
        <p className="mechanics-stale" role="status">
          {t(
            'Формулы относятся к версии {{reviewed}}. Характеристики героев уже обновлены до {{current}}.',
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
            'В формулах проценты записаны долями: 30% = 0,30. В калькулятор вводи 30. Результат округляется только при выводе.',
          )}
        </p>
      </aside>
    </div>
  );
}
