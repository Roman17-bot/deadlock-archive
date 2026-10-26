import { useEffect, useRef, useState } from 'react';
import { ArrowDown, BookOpen, Search, Download, Check, FlaskConical } from 'lucide-react';
import { useMechanicsData } from './useMechanicsData';
import { useI18n } from '../../i18n';
import type { HeroSnapshot } from '../../../shared/types';
import { asset, formatDate } from '../../lib/format';
import { Calculator } from './Calculator';

const confidence: Record<string, { label: string; icon: 'check' | 'model' }> = {
  math_identity: { label: 'Математика при заданных условиях', icon: 'check' },
  config_confirmed: { label: 'Параметры и флаги из файлов игры', icon: 'check' },
  community_documented: { label: 'Рабочее правило по источникам', icon: 'check' },
  inferred: { label: 'Модель · есть ограничения проверки', icon: 'model' },
};
const normalize = (text: string) => text.toLocaleLowerCase('ru').replaceAll('ё', 'е');

export function MechanicsPage({ data, localApi }: { data: HeroSnapshot; localApi?: boolean }) {
  const { t, language } = useI18n();
  const { catalogs, loading, error, retry } = useMechanicsData(data.meta.clientVersion, localApi);
  const { ru: ruCatalog, en: enCatalog } = catalogs;
  const catalog = language === 'en' ? enCatalog : ruCatalog;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Все');
  const [target, setTarget] = useState<{ id: string; request: number } | null>(null);
  const library = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!target) return;
    const heading = document.getElementById(`formula-heading-${target.id}`);
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [target]);
  const categories = ['Все', ...new Set(ruCatalog.formulas.map((entry) => entry.category))];
  const categoryLabel = (key: string) => {
    if (key === 'Все') return t('Все');
    const source = ruCatalog.formulas.find((entry) => entry.category === key)!;
    return catalog.formulas.find((entry) => entry.id === source.id)!.category;
  };
  const matching = catalog.formulas.filter((entry) => {
    const original = ruCatalog.formulas.find((formula) => formula.id === entry.id)!;
    const english = enCatalog.formulas.find((formula) => formula.id === entry.id)!;
    const searchable = [original, english]
      .flatMap((formula) => [
        formula.title,
        formula.id,
        formula.expression,
        ...formula.variables,
        ...formula.explanation,
        ...formula.caveats,
        formula.example,
      ])
      .join(' ');
    return (
      (category === 'Все' || original.category === category) &&
      normalize(searchable).includes(normalize(query.trim()))
    );
  });
  const onRule = (id: string) => {
    const formula = catalog.formulas.find((entry) => entry.id === id);
    if (!formula) return;
    setCategory('Все');
    setQuery(formula.title);
    setTarget((current) => ({ id, request: (current?.request ?? 0) + 1 }));
  };
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
            <button
              key={entry}
              aria-pressed={category === entry}
              onClick={() => setCategory(entry)}
            >
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
