import type { RefObject } from 'react';
import { Search, Check, FlaskConical } from 'lucide-react';
import { useI18n } from '../../../i18n';
import type { useFormulaLibrary } from '../hooks/useFormulaLibrary';

const confidence: Record<string, { label: string; icon: 'check' | 'model' }> = {
  math_identity: { label: 'Математика при заданных условиях', icon: 'check' },
  config_confirmed: { label: 'Параметры и флаги из файлов игры', icon: 'check' },
  community_documented: { label: 'Рабочее правило по источникам', icon: 'check' },
  inferred: { label: 'Модель · есть ограничения проверки', icon: 'model' },
};

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
            'У каждого правила — область действия, числовой пример и происхождение. Согласованные наблюдения принимаем за рабочую основу; конкретные расхождения сохраняем.',
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
          const proof = confidence[entry.confidence];
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
              <span className={`formula-confidence ${proof.icon === 'model' ? 'is-model' : ''}`}>
                {proof.icon === 'check' ? <Check size={15} /> : <FlaskConical size={15} />}{' '}
                {t(proof.label)}
              </span>
              <p className="formula-preview">{entry.explanation[0]}</p>
              <details open={target?.id === entry.id ? true : undefined}>
                <summary>{t('Разбор, пример и источники')}</summary>
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
                  <h4>{t('Границы применения')}</h4>
                  <ul>
                    {entry.caveats.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <h4>{t('Источники')}</h4>
                  <ul className="formula-sources">
                    {entry.sourceIds.map((id) => {
                      const source = catalog.sources.find((s) => s.id === id)!;
                      return (
                        <li key={id}>
                          <a href={source.url} target="_blank" rel="noreferrer">
                            {source.label}
                          </a>
                          <small>
                            {source.kind === 'raw'
                              ? t('Файлы / схема')
                              : source.kind === 'official'
                                ? t('Публикация Valve')
                                : t('Наблюдения / описание')}
                          </small>
                        </li>
                      );
                    })}
                  </ul>
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
