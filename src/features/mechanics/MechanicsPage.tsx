import { useEffect, useRef, useState } from 'react';
import { ArrowDown, BookOpen, Search, Download, Check, FlaskConical } from 'lucide-react';
import catalog from '../../../data/mechanics.json';
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

export function MechanicsPage({ data }: { data: HeroSnapshot }) {
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
  const categories = ['Все', ...new Set(catalog.formulas.map((entry) => entry.category))];
  const matching = catalog.formulas.filter(
    (entry) =>
      (category === 'Все' || entry.category === category) &&
      normalize(
        [
          entry.title,
          entry.id,
          entry.expression,
          ...entry.variables,
          ...entry.explanation,
          ...entry.caveats,
          entry.example,
        ].join(' '),
      ).includes(normalize(query.trim())),
  );
  const onRule = (id: string) => {
    const formula = catalog.formulas.find((entry) => entry.id === id);
    if (!formula) return;
    setCategory('Все');
    setQuery(formula.title);
    setTarget((current) => ({ id, request: (current?.request ?? 0) + 1 }));
  };
  return (
    <div className="mechanics-page">
      <section className="mechanics-intro">
        <div>
          <div className="section-kicker light">
            <span />
            БЮРО ПРИКЛАДНОЙ МАТЕМАТИКИ
          </div>
          <h1>
            Механики <br />и <em>формулы.</em>
          </h1>
          <p>
            Понимай, откуда берутся цифры. Сравнивай защиту, рассчитывай лечение и проверяй идеи для
            следующего билда.
          </p>
          <p className="mechanics-checkline">
            {catalog.formulas.length} правил · клиент {catalog.meta.reviewedClientVersion} ·
            проверено {formatDate(catalog.meta.checkedAt)}
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
              <BookOpen size={18} />К справочнику
              <ArrowDown size={18} />
            </a>
            <a className="text-link" href={asset('data/mechanics-reference.md')} download>
              <Download size={17} />
              Скачать разбор
            </a>
          </div>
        </div>
        <aside className="research-stamp">
          <span className="stamp-symbol">∑</span>
          <span>ПРОВЕРЕННЫЕ МАТЕРИАЛЫ</span>
          <strong>
            {catalog.formulas.length}
            <small>правил и моделей</small>
          </strong>
          <p>
            {catalog.sources.length} источника · клиент{catalog.meta.reviewedClientVersion}
            <br />
            {formatDate(catalog.meta.checkedAt)}
          </p>
          <div>
            <Check size={16} />
            Файлы игры и наблюдения игроков
          </div>
        </aside>
      </section>
      {data.meta.clientVersion !== catalog.meta.reviewedClientVersion && (
        <p className="mechanics-stale" role="status">
          Механики проверены для клиента {catalog.meta.reviewedClientVersion}. В таблице уже клиент{' '}
          {data.meta.clientVersion}: числовые данные героев обновлены, правила ещё требуют повторной
          сверки.
        </p>
      )}
      <Calculator onRule={onRule} />
      <section className="formula-library" ref={library} aria-labelledby="formula-library-title">
        <div className="library-heading">
          <div>
            <span className="section-kicker">ОТ ОБЩЕГО ПРАВИЛА К ЧАСТНОМУ СЛУЧАЮ</span>
            <h2 id="formula-library-title">Справочник механик.</h2>
          </div>
          <p>
            У каждого правила — область действия, числовой пример и происхождение. Согласованные
            наблюдения принимаем за рабочую основу; конкретные расхождения сохраняем.
          </p>
        </div>
        <div className="library-tools">
          <label className="formula-search">
            <Search size={20} aria-hidden="true" />
            <input
              type="search"
              aria-label="Найти формулу"
              placeholder="Урон, сопротивление, лечение…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button aria-label="Очистить поиск формул" onClick={() => setQuery('')}>
                ×
              </button>
            )}
          </label>
          <span>
            {matching.length} из {catalog.formulas.length} правил
          </span>
        </div>
        <div className="formula-categories" role="group" aria-label="Темы формул">
          {categories.map((entry) => (
            <button
              key={entry}
              aria-pressed={category === entry}
              onClick={() => setCategory(entry)}
            >
              {entry}
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
                  {proof.label}
                </span>
                <p className="formula-preview">{entry.explanation[0]}</p>
                <details open={target?.id === entry.id ? true : undefined}>
                  <summary>Разбор, пример и источники</summary>
                  <div className="formula-details">
                    <h4>Обозначения</h4>
                    <ul>
                      {entry.variables.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    {entry.explanation.slice(1).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    <div className="formula-example">
                      <span>НА ЧИСЛАХ</span>
                      <p>{entry.example}</p>
                    </div>
                    <h4>Границы применения</h4>
                    <ul>
                      {entry.caveats.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <h4>Источники</h4>
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
                                ? 'Файлы / схема'
                                : source.kind === 'official'
                                  ? 'Публикация Valve'
                                  : 'Наблюдения / описание'}
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
            <h3>Такого правила не нашлось.</h3>
            <p>Попробуй короткий термин или другую тему.</p>
            <button
              className="button button-paper"
              onClick={() => {
                setQuery('');
                setCategory('Все');
              }}
            >
              Показать весь справочник
            </button>
          </div>
        )}
      </section>
      <aside className="mechanics-footnote">
        <BookOpen size={24} />
        <p>
          Проценты в уравнениях записаны долями:30%=0,30. В калькулятор вводи30. Округляется только
          вывод. Проверка источников не является собственным замером движка; игра при исследовании
          не запускалась.
        </p>
      </aside>
    </div>
  );
}
