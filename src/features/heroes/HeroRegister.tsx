import { Fragment, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  ChevronRight,
  Download,
  Info,
  Minus,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import type { HeroSnapshot, HeroStats, SortDirection, SortKey } from '../../../shared/types';
import { selectHeroes, statsAtLevel, toCsv } from '../../../shared/heroes';
import { asset, format } from '../../lib/format';

const columns: {
  key: keyof HeroStats;
  label: string;
  unit: string;
  growth?: boolean;
  className?: string;
}[] = [
  { key: 'shotDamage', label: 'Урон выстрела', unit: 'HP', className: 'weapon-stat' },
  { key: 'dps', label: 'DPS', unit: 'расчётный', className: 'weapon-stat' },
  { key: 'health', label: 'Здоровье', unit: 'HP', className: 'health-stat' },
  { key: 'spirit', label: 'Spirit', unit: 'мощь', className: 'spirit-stat' },
  { key: 'regen', label: 'Регенерация', unit: 'HP/с', className: 'health-stat' },
  { key: 'damageGrowth', label: '+ Урон', unit: 'за уровень', growth: true },
  { key: 'healthGrowth', label: '+ HP', unit: 'за уровень', growth: true },
  { key: 'spiritGrowth', label: '+ Spirit', unit: 'за уровень', growth: true },
  { key: 'regenGrowth', label: '+ Реген.', unit: 'HP/с за LVL', growth: true },
];

function initialSearch(data: HeroSnapshot) {
  const slug = new URLSearchParams(window.location.hash.split('?')[1]).get('hero');
  return data.heroes.find((h) => h.slug === slug)?.name ?? '';
}

export function HeroRegister({ data, onMethod }: { data: HeroSnapshot; onMethod: () => void }) {
  const [query, setQuery] = useState(() => initialSearch(data));
  const [level, setLevel] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [direction, setDirection] = useState<SortDirection>('asc');
  const [expanded, setExpanded] = useState<number | null>(null);
  const selected = useMemo(
    () => selectHeroes(data.heroes, query, sortKey, direction, level),
    [data, query, sortKey, direction, level],
  );
  const sort = (key: SortKey) => {
    setSortKey(key);
    setDirection(
      sortKey === key ? (direction === 'asc' ? 'desc' : 'asc') : key === 'name' ? 'asc' : 'desc',
    );
  };
  const reset = () => {
    setQuery('');
    setLevel(1);
    setSortKey('name');
    setDirection('asc');
    setExpanded(null);
  };
  const icon = (key: SortKey) =>
    sortKey !== key ? (
      <ArrowUpDown size={12} />
    ) : direction === 'asc' ? (
      <ArrowUp size={13} />
    ) : (
      <ArrowDown size={13} />
    );
  const exportCsv = () => {
    const url = URL.createObjectURL(
      new Blob(['\ufeff' + toCsv(selected, level)], { type: 'text/csv;charset=utf-8;' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `deadlock-heroes-${data.meta.snapshotDate}-lvl${level}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="register-page">
      <div className="breadcrumbs">
        <a href="#/">Архив</a>
        <ChevronRight size={12} />
        <span>Реестр героев</span>
      </div>
      <section className="register-heading">
        <div>
          <div className="section-kicker">ЛИЧНЫЕ ДЕЛА · ВЫПУСК 001</div>
          <h1>
            Реестр героев<span className="title-star">✦</span>
          </h1>
          <p>Разные характеры. Разные возможности. Все базовые характеристики — в одном месте.</p>
        </div>
        <div className="snapshot-plaque">
          <span className="status-dot" />
          СВЕРЕНО С КЛИЕНТОМ<strong>{data.meta.clientVersion}</strong>
          <span>ПРОВЕРЕНО 24.10.2026</span>
        </div>
      </section>
      <section className="register-workspace" aria-label="Параметры сравнения">
        <div className="register-toolbar">
          <div className="search-field">
            <Search size={18} />
            <input
              type="search"
              aria-label="Найти героя"
              placeholder="Найти героя…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button aria-label="Очистить поиск" onClick={() => setQuery('')}>
                <X size={16} />
              </button>
            )}
          </div>
          <div className="quick-filters">
            <button
              className={query === 'Nurse Harrow' ? 'selected' : ''}
              onClick={() => setQuery(query === 'Nurse Harrow' ? '' : 'Nurse Harrow')}
            >
              Nurse Harrow<span>НОВЫЙ</span>
            </button>
            <button
              className={query === 'Violet' ? 'selected' : ''}
              onClick={() => setQuery(query === 'Violet' ? '' : 'Violet')}
            >
              Violet<span>НОВЫЙ</span>
            </button>
          </div>
          <button className="export-button" onClick={exportCsv} disabled={!selected.length}>
            <Download size={16} />
            <span>Скачать CSV</span>
          </button>
        </div>
        <div className="level-toolbar">
          <div className="level-label">
            <span>УРОВЕНЬ ГЕРОЯ</span>
            <strong>
              LVL <span>{String(level).padStart(2, '0')}</span>
            </strong>
          </div>
          <div className="level-control">
            <button
              className="level-step"
              aria-label="Уменьшить уровень"
              disabled={level === 1}
              onClick={() => setLevel((n) => n - 1)}
            >
              <Minus size={13} />
            </button>
            <input
              type="range"
              min="1"
              max="36"
              step="1"
              aria-label="Уровень героя"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              style={{ '--range-progress': `${((level - 1) / 35) * 100}%` } as React.CSSProperties}
            />
            <button
              className="level-step"
              aria-label="Увеличить уровень"
              disabled={level === 36}
              onClick={() => setLevel((n) => n + 1)}
            >
              <Plus size={13} />
            </button>
          </div>
          <p>
            {level === 1 ? 'Базовые параметры' : 'С учётом ' + (level - 1) + ' Boons'}
            <span>Без предметов и активных эффектов</span>
          </p>
          <button className="reset-button" aria-label="Сбросить настройки" onClick={reset}>
            <RotateCcw size={14} />
            <span>Сбросить</span>
          </button>
        </div>
      </section>
      <div className="table-caption">
        <span aria-live="polite">
          В реестре <strong>{selected.length}</strong> из {data.heroes.length} героев
        </span>
        <div>
          <span className="legend-square" />
          Приросты учитывают встроенный Spirit-скейл
        </div>
        <button aria-label="Как считаем характеристики" onClick={onMethod}>
          <Info size={14} />
          Как считаем
        </button>
      </div>
      <div className="table-frame">
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Таблица характеристик героев"
        >
          <table aria-label="Характеристики героев">
            <caption className="sr-only">
              Параметры героев на уровне {level}. Нажми на заголовок для сортировки.
            </caption>
            <thead>
              <tr>
                <th
                  className="hero-column"
                  scope="col"
                  aria-sort={
                    sortKey === 'name' ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                >
                  <button aria-label="Герой: сортировать" onClick={() => sort('name')}>
                    ГЕРОЙ{icon('name')}
                  </button>
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`${column.growth ? 'growth-column' : ''} ${column.key === 'damageGrowth' ? 'growth-first' : ''} ${sortKey === column.key ? 'sorted-column' : ''}`}
                    aria-sort={
                      sortKey === column.key
                        ? direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      aria-label={`${column.label}: сортировать`}
                      onClick={() => sort(column.key)}
                    >
                      <span>
                        {column.label}
                        <small>{column.unit}</small>
                      </span>
                      {icon(column.key)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selected.map((hero, index) => {
                const stats = statsAtLevel(hero, level);
                return (
                  <Fragment key={hero.id}>
                    <tr
                      data-hero={hero.slug}
                      className={expanded === hero.id ? 'expanded-row' : ''}
                    >
                      <th className="hero-column" scope="row">
                        <div className="hero-cell">
                          <span className="row-index">{String(index + 1).padStart(2, '0')}</span>
                          <img
                            src={asset(hero.portrait)}
                            alt=""
                            width="42"
                            height="42"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.visibility = 'hidden';
                            }}
                          />
                          <span className="hero-cell-name">
                            {hero.name}
                            {hero.isNew && <small>НОВЫЙ ГЕРОЙ</small>}
                          </span>
                          <button
                            className="row-info"
                            aria-label={`Примечания: ${hero.name}`}
                            aria-expanded={expanded === hero.id}
                            onClick={() => setExpanded(expanded === hero.id ? null : hero.id)}
                          >
                            <Info size={14} />
                          </button>
                        </div>
                      </th>
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          data-testid={`stat-${hero.slug}-${column.key}`}
                          className={`${column.className ?? ''} ${column.growth ? 'growth-column' : ''} ${column.key === 'damageGrowth' ? 'growth-first' : ''} ${sortKey === column.key ? 'sorted-column' : ''}`}
                        >
                          <span>
                            {column.growth && stats[column.key] > 0 ? '+' : ''}
                            {format(stats[column.key], column.growth ? 3 : 2)}
                          </span>
                          {column.key === 'shotDamage' && hero.weapon.projectiles > 1 && (
                            <small className="pellet-note">
                              {hero.weapon.projectiles} × {format(stats.bulletDamage)}
                            </small>
                          )}
                        </td>
                      ))}
                    </tr>
                    {expanded === hero.id && (
                      <tr className="details-row">
                        <td colSpan={10}>
                          <div>
                            <strong>{hero.name} / параметры оружия</strong>
                            <p>
                              Пуля или дробина: {format(stats.bulletDamage, 4)} · Траекторий:{' '}
                              {hero.weapon.projectiles} · Выстрелов в очереди: {hero.weapon.burst} ·
                              Магазин: {hero.weapon.clipSize}.
                            </p>
                            {hero.weapon.notes.map((note) => (
                              <p key={note}>{note}</p>
                            ))}
                            <p>
                              Прямой прирост пули: +{format(hero.growth.bulletDamage, 5)} / LVL
                              {hero.scaling.bulletDamagePerSpirit > 0
                                ? ` · Дополнительно +${format(hero.scaling.bulletDamagePerSpirit, 5)} урона за Spirit.`
                                : '.'}
                            </p>
                            <a href={hero.source.weaponUrl} target="_blank" rel="noreferrer">
                              Открыть исходные параметры
                              <ArrowUpRight size={13} />
                            </a>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {!selected.length && (
            <div className="empty-state">
              <Search size={28} />
              <h2>Таких героев в досье нет</h2>
              <p>Попробуй другое имя — можно на русском или английском.</p>
              <button className="text-link" onClick={() => setQuery('')}>
                Показать всех героев
                <ArrowRightFallback />
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="register-footnote">
        <p>
          <Info size={14} />
          <span>
            Урон выстрела включает дробины. DPS — расчёт без перезарядки; особые режимы отмечены в
            строках. Нулевой Spirit на LVL 1 — корректное базовое значение.
          </span>
        </p>
        <span className="data-stamp">
          BUILD {data.meta.clientVersion} / {data.meta.gameCommit.slice(0, 7)}
        </span>
      </div>
      <aside className="register-aside">
        <span className="note-mark">✦</span>
        <p>
          <strong>Смотри на сочетания, а не на одну цифру.</strong> Высокий урон выстрела не
          гарантирует высокий DPS. Приросты и выбранный уровень меняют картину.
        </p>
        <button className="text-link" onClick={onMethod}>
          Читать методику
          <ArrowUpRight size={16} />
        </button>
      </aside>
    </div>
  );
}

function ArrowRightFallback() {
  return <ChevronRight size={16} />;
}
