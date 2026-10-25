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
import { asset, format, formatDate } from '../../lib/format';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { useI18n, translateDataText } from '../../i18n';

const columns: {
  key: keyof HeroStats;
  label: string;
  unit: string;
  growth?: boolean;
  className?: string;
  mobileLabel?: string;
  mobileUnit?: string;
}[] = [
  {
    key: 'shotDamage',
    label: 'Урон выстрела',
    mobileLabel: 'Урон',
    unit: 'HP',
    className: 'weapon-stat',
  },
  { key: 'dps', label: 'DPS', unit: 'расчётный', mobileUnit: 'HP/с', className: 'weapon-stat' },
  {
    key: 'health',
    label: 'Здоровье',
    mobileLabel: 'HP',
    unit: 'HP',
    mobileUnit: '',
    className: 'health-stat',
  },
  { key: 'spirit', label: 'Spirit', unit: 'мощь', mobileUnit: '', className: 'spirit-stat' },
  {
    key: 'regen',
    label: 'Регенерация',
    mobileLabel: 'Реген.',
    unit: 'HP/с',
    className: 'health-stat',
  },
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
  const { t, language } = useI18n();
  const [query, setQuery] = useState(() => initialSearch(data));
  const [level, setLevel] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [direction, setDirection] = useState<SortDirection>('asc');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [statView, setStatView] = useState<'stats' | 'growth'>('stats');
  const isMobile = useMediaQuery('(max-width: 760px)');
  const visibleColumns = isMobile
    ? columns.filter((column) => Boolean(column.growth) === (statView === 'growth'))
    : columns;
  const activeSortKey =
    sortKey === 'name' || visibleColumns.some((column) => column.key === sortKey)
      ? sortKey
      : 'name';
  const activeDirection = activeSortKey === sortKey ? direction : 'asc';
  const selected = useMemo(
    () => selectHeroes(data.heroes, query, activeSortKey, activeDirection, level),
    [data, query, activeSortKey, activeDirection, level],
  );
  const sort = (key: SortKey) => {
    setSortKey(key);
    setDirection(
      activeSortKey === key
        ? activeDirection === 'asc'
          ? 'desc'
          : 'asc'
        : key === 'name'
          ? 'asc'
          : 'desc',
    );
  };
  const reset = () => {
    setQuery('');
    setLevel(1);
    setSortKey('name');
    setDirection('asc');
    setExpanded(null);
    setStatView('stats');
  };
  const changeStatView = (next: 'stats' | 'growth') => {
    setStatView(next);
    if (
      sortKey !== 'name' &&
      !columns.some(
        (column) => column.key === sortKey && Boolean(column.growth) === (next === 'growth'),
      )
    ) {
      setSortKey('name');
      setDirection('asc');
    }
  };
  const icon = (key: SortKey) =>
    activeSortKey !== key ? (
      <ArrowUpDown size={12} />
    ) : activeDirection === 'asc' ? (
      <ArrowUp size={13} />
    ) : (
      <ArrowDown size={13} />
    );
  const exportCsv = () => {
    const url = URL.createObjectURL(
      new Blob(['\ufeff' + toCsv(selected, level, language)], { type: 'text/csv;charset=utf-8;' }),
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
        <a href="#/">{t('Архив')}</a>
        <ChevronRight size={12} />
        <span>{t('Реестр героев')}</span>
      </div>
      <section className="register-heading">
        <div>
          <div className="section-kicker">{t('ЛИЧНЫЕ ДЕЛА · ВЫПУСК 001')}</div>
          <h1>
            {t('Реестр героев')}
            <span className="title-star">✦</span>
          </h1>
          <p>
            {t('Разные характеры. Разные возможности. Все базовые характеристики — в одном месте.')}
          </p>
        </div>
        <div className="snapshot-plaque">
          <span className="status-dot" />
          {t('СВЕРЕНО С КЛИЕНТОМ')}
          <strong>{data.meta.clientVersion}</strong>
          <span>
            {t('ПРОВЕРЕНО')} {formatDate(data.meta.snapshotDate)}
          </span>
        </div>
      </section>
      <section className="register-workspace" aria-label={t('Параметры сравнения')}>
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
        <div className="level-toolbar">
          <div className="level-label">
            <span>{t('УРОВЕНЬ ГЕРОЯ')}</span>
            <strong>
              LVL <span>{String(level).padStart(2, '0')}</span>
            </strong>
          </div>
          <div className="level-control">
            <button
              className="level-step"
              aria-label={t('Уменьшить уровень')}
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
              aria-label={t('Уровень героя')}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              style={{ '--range-progress': `${((level - 1) / 35) * 100}%` } as React.CSSProperties}
            />
            <button
              className="level-step"
              aria-label={t('Увеличить уровень')}
              disabled={level === 36}
              onClick={() => setLevel((n) => n + 1)}
            >
              <Plus size={13} />
            </button>
          </div>
          <p>
            {level === 1
              ? t('Базовые параметры')
              : t('С учётом {{count}} Boons', { count: level - 1 })}
            <span>{t('Без предметов и активных эффектов')}</span>
          </p>
          <button className="reset-button" aria-label={t('Сбросить настройки')} onClick={reset}>
            <RotateCcw size={14} />
            <span>{t('Сбросить')}</span>
          </button>
        </div>
      </section>
      {isMobile && (
        <div className="mobile-table-tools">
          <div className="stat-view-switch" role="group" aria-label={t('Показатели таблицы')}>
            <button aria-pressed={statView === 'stats'} onClick={() => changeStatView('stats')}>
              {t('Характеристики')}
            </button>
            <button aria-pressed={statView === 'growth'} onClick={() => changeStatView('growth')}>
              {t('Приросты за LVL')}
            </button>
          </div>
          <p>{t('Листай столбцы вбок. Нажми на героя для примечаний.')}</p>
        </div>
      )}
      <div className="table-caption">
        <span aria-live="polite">
          {t('В реестре {{selected}} из {{count}} героев', {
            selected: selected.length,
            count: data.heroes.length,
          })}
        </span>
        <div>
          <span className="legend-square" />
          {t('Приросты учитывают встроенный Spirit-скейл')}
        </div>
        <button aria-label={t('Как считаем характеристики')} onClick={onMethod}>
          <Info size={14} />
          {t('Как считаем')}
        </button>
      </div>
      <div className="table-frame" data-stat-view={isMobile ? statView : 'all'}>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label={t('Таблица характеристик героев')}
        >
          <table aria-label={t('Характеристики героев')}>
            <caption className="sr-only">
              {t('Параметры героев на уровне {{level}}. Нажми на заголовок для сортировки.', {
                level,
              })}
            </caption>
            <thead>
              <tr>
                <th
                  className="hero-column"
                  scope="col"
                  aria-sort={
                    activeSortKey === 'name'
                      ? activeDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button aria-label={t('Герой: сортировать')} onClick={() => sort('name')}>
                    {t('ГЕРОЙ')}
                    {icon('name')}
                  </button>
                </th>
                {visibleColumns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`${column.growth ? 'growth-column' : ''} ${column.key === 'damageGrowth' ? 'growth-first' : ''} ${activeSortKey === column.key ? 'sorted-column' : ''}`}
                    aria-sort={
                      activeSortKey === column.key
                        ? activeDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      aria-label={t('{{label}}: сортировать', { label: t(column.label) })}
                      onClick={() => sort(column.key)}
                    >
                      <span>
                        {t(isMobile ? (column.mobileLabel ?? column.label) : column.label)}
                        <small>
                          {t(
                            isMobile
                              ? column.growth
                                ? ''
                                : (column.mobileUnit ?? column.unit)
                              : column.unit,
                          )}
                        </small>
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
                        <button
                          className="hero-cell"
                          aria-label={t('Примечания: {{hero}}', { hero: hero.name })}
                          aria-expanded={expanded === hero.id}
                          onClick={() => setExpanded(expanded === hero.id ? null : hero.id)}
                        >
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
                            {hero.isNew && <small>{t('НОВЫЙ ГЕРОЙ')}</small>}
                          </span>
                          <Info className="row-info-icon" size={18} aria-hidden="true" />
                        </button>
                      </th>
                      {visibleColumns.map((column) => (
                        <td
                          key={column.key}
                          data-testid={`stat-${hero.slug}-${column.key}`}
                          className={`${column.className ?? ''} ${column.growth ? 'growth-column' : ''} ${column.key === 'damageGrowth' ? 'growth-first' : ''} ${activeSortKey === column.key ? 'sorted-column' : ''}`}
                        >
                          <span>
                            {column.growth && stats[column.key] > 0 ? '+' : ''}
                            {format(stats[column.key], column.growth ? 3 : 2)}
                          </span>
                          {column.key === 'shotDamage' && hero.weapon.projectiles > 1 && (
                            <small className="pellet-note">
                              {hero.weapon.hitOnce
                                ? t('Одно попадание')
                                : `${hero.weapon.projectiles} × ${format(stats.bulletDamage)}`}
                            </small>
                          )}
                        </td>
                      ))}
                    </tr>
                    {expanded === hero.id && (
                      <tr className="details-row">
                        <td colSpan={visibleColumns.length + 1}>
                          <div>
                            <strong>{t('{{hero}} / параметры оружия', { hero: hero.name })}</strong>
                            <p>
                              {t(
                                'Пуля или дробина: {{damage}} · Траекторий: {{projectiles}} · Выстрелов в очереди: {{burst}} · Магазин: {{clip}}.',
                                {
                                  damage: format(stats.bulletDamage, 4),
                                  projectiles: hero.weapon.projectiles,
                                  burst: hero.weapon.burst,
                                  clip: hero.weapon.clipSize,
                                },
                              )}
                            </p>
                            {hero.weapon.notes.map((note) => (
                              <p key={note}>{translateDataText(note)}</p>
                            ))}
                            <p>
                              {t('Прямой прирост пули: +{{growth}} / LVL', {
                                growth: format(hero.growth.bulletDamage, 5),
                              })}
                              {hero.scaling.bulletDamagePerSpirit > 0
                                ? t(' · Дополнительно +{{scale}} урона за Spirit.', {
                                    scale: format(hero.scaling.bulletDamagePerSpirit, 5),
                                  })
                                : '.'}
                            </p>
                            <a href={hero.source.weaponUrl} target="_blank" rel="noreferrer">
                              {t('Открыть исходные параметры')}
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
              <h2>{t('Таких героев в досье нет')}</h2>
              <p>{t('Попробуй другое имя — можно на русском или английском.')}</p>
              <button className="text-link" onClick={() => setQuery('')}>
                {t('Показать всех героев')}
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
            {t(
              'Урон выстрела учитывает обычные дробины и исключение hit-once. DPS — расчёт без перезарядки; особые режимы отмечены в строках. Нулевой Spirit на LVL 1 — корректное базовое значение.',
            )}
          </span>
        </p>
        <span className="data-stamp">
          BUILD {data.meta.clientVersion} / {data.meta.gameCommit.slice(0, 7)}
        </span>
      </div>
      <aside className="register-aside">
        <span className="note-mark">✦</span>
        <p>
          <strong>{t('Смотри на сочетания, а не на одну цифру.')}</strong>{' '}
          {t(
            'Высокий урон выстрела не гарантирует высокий DPS. Приросты и выбранный уровень меняют картину.',
          )}
        </p>
        <button className="text-link" onClick={onMethod}>
          {t('Читать методику')}
          <ArrowUpRight size={16} />
        </button>
      </aside>
    </div>
  );
}

function ArrowRightFallback() {
  return <ChevronRight size={16} />;
}
