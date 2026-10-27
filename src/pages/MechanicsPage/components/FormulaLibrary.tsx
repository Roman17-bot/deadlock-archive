import type { RefObject } from 'react';
import { Search } from 'lucide-react';
import { useI18n } from '../../../i18n';
import type { useFormulaLibrary } from '../hooks/useFormulaLibrary';

type FormulaLibraryProps = {
  library: RefObject<HTMLElement | null>;
  state: ReturnType<typeof useFormulaLibrary>;
};

export function FormulaLibrary({ library, state }: FormulaLibraryProps) {
  const { t } = useI18n();
  const {
    catalog,
    query,
    setQuery,
    category,
    setCategory,
    target,
    categories,
    categoryLabel,
    matching,
  } = state;
  return (
    <section className="formula-library" ref={library} aria-labelledby="formula-library-title">
      <div className="library-heading">
        <div>
          <span className="section-kicker">{t('ОТ ОБЩЕГО ПРАВИЛА К ЧАСТНОМУ СЛУЧАЮ')}</span>
          <h2 id="formula-library-title">{t('Справочник механик.')}</h2>
        </div>
        <p>
          {t(
            'Найди нужную механику по названию или выбери тему. В каждом разделе есть формула, объяснение и пример расчёта.',
          )}
        </p>
      </div>
      <div className="library-tools">
        <label className="formula-search">
          <Search size={20} aria-hidden="true" />
          <input
            type="search"
            aria-label={t('Найти формулу')}
            placeholder={t('Урон, сопротивление, лечение…')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button aria-label={t('Очистить поиск формул')} onClick={() => setQuery('')}>
              ×
            </button>
          )}
        </label>
        <span>
          {t('{{count}} из {{total}} правил', {
            count: matching.length,
            total: catalog.formulas.length,
          })}
        </span>
      </div>
      <div className="formula-categories" role="group" aria-label={t('Темы формул')}>
        {categories.map((entry) => (
          <button key={entry} aria-pressed={category === entry} onClick={() => setCategory(entry)}>
            {categoryLabel(entry)}
          </button>
        ))}
      </div>
      <div className="formula-grid">
        {matching.map((entry, index) => {
          return (
            <article className="formula-card" id={`formula-${entry.id}`} key={entry.id}>
              <div className="formula-card-top">
                <span>{entry.category}</span>
                <span>№{String(index + 1).padStart(2, '0')}</span>
              </div>
              <h3 id={`formula-heading-${entry.id}`} tabIndex={-1}>
                {entry.title}
              </h3>
              <div className="formula-expression">{entry.expression}</div>
              <p className="formula-preview">{entry.explanation[0]}</p>
              <details open={target?.id === entry.id ? true : undefined}>
                <summary>{t('Объяснение и пример')}</summary>
                <div className="formula-details">
                  <h4>{t('Обозначения')}</h4>
                  <ul>
                    {entry.variables.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  {entry.explanation.slice(1).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                  <div className="formula-example">
                    <span>{t('НА ЧИСЛАХ')}</span>
                    <p>{entry.example}</p>
                  </div>
                  {entry.caveats.length > 0 && (
                    <>
                      <h4>{t('Что учитывать')}</h4>
                      <ul>
                        {entry.caveats.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </details>
            </article>
          );
        })}
      </div>
      {!matching.length && (
        <div className="formula-empty">
          <h3>{t('Такого правила не нашлось.')}</h3>
          <p>{t('Попробуй короткий термин или другую тему.')}</p>
          <button
            className="button button-paper"
            onClick={() => {
              setQuery('');
              setCategory('Все');
            }}
          >
            {t('Показать весь справочник')}
          </button>
        </div>
      )}
    </section>
  );
}
