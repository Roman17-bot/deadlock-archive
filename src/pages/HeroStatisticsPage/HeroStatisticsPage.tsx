import { useId, useState } from 'react';
import type { HeroSnapshot } from '../../../shared/types';
import type { HeroStatScope } from '../../../shared/hero-reference';
import { aggregateHeroStats, heroHistory, windowDays } from '../../../shared/hero-reference';
import { useI18n } from '../../i18n';
import { asset, format, formatDate } from '../../lib/format';
import { loadHeroStatistics } from '../../services/heroReferenceApi';
import { useReference } from '../../features/heroes/useReference';
import { HeroNavigation } from '../../features/heroes/HeroNavigation';
import './HeroStatisticsPage.css';

type Point = ReturnType<typeof heroHistory>[number];
const dayTime = (date: string) => Date.parse(`${date}T00:00:00Z`);
function Trend({
  points,
  start,
  end,
  max,
  label,
  en,
}: {
  points: Point[];
  start: number;
  end: number;
  max: number;
  label: string;
  en: boolean;
}) {
  const tooltipId = useId();
  const [active, setActive] = useState<number | null>(null);
  const valid = points.filter((p) => p.value !== null);
  if (valid.length < 2)
    return <span className="statistics-no-history">{en ? 'No history' : 'Нет истории'}</span>;
  let previous: Point | undefined;
  const path = points
    .map((p) => {
      if (p.value === null) {
        previous = undefined;
        return '';
      }
      const x = 4 + ((dayTime(p.date) - start) / Math.max(end - start, 86400000)) * 88;
      const y = 25 - (p.value / max) * 22;
      const connected = previous && dayTime(p.date) - dayTime(previous.date) === 86400000;
      previous = p;
      return `${connected ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  const change = valid[valid.length - 1].value! - valid[0].value!;
  const changeText = `${change > 0 ? '+' : ''}${format(change, 1)} ${en ? 'pp' : 'п.п.'}`;
  const point = active === null ? undefined : points[active];
  const tooltip = point
    ? `${formatDate(point.date)} · ${point.value === null ? (en ? 'No matches' : 'Нет матчей') : `${format(point.value, 1)}%`} · ${en ? 'matches' : 'матчей'}: ${format(point.matches, 0)}`
    : '';
  return (
    <span
      className="statistics-trend"
      data-change={change > 0 ? 'up' : change < 0 ? 'down' : 'flat'}
    >
      <button
        type="button"
        className="statistics-trend-button"
        aria-label={`${label}: ${formatDate(valid[0].date)} — ${formatDate(valid[valid.length - 1].date)}, ${changeText}. ${en ? 'Use arrow keys for daily values.' : 'Стрелки — значения по дням.'}`}
        aria-describedby={point ? tooltipId : undefined}
        onFocus={() => setActive(points.length - 1)}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const time =
            start + Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)) * (end - start);
          let nearest = 0;
          points.forEach((p, i) => {
            if (Math.abs(dayTime(p.date) - time) < Math.abs(dayTime(points[nearest].date) - time))
              nearest = i;
          });
          setActive(nearest);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setActive(null);
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            setActive((i) =>
              Math.max(
                0,
                Math.min(
                  points.length - 1,
                  (i ?? points.length - 1) + (e.key === 'ArrowLeft' ? -1 : 1),
                ),
              ),
            );
          }
        }}
      >
        <svg viewBox="0 0 96 28" width="96" height="28" aria-hidden="true">
          <path d={path} />
          {points
            .filter((p) => p.value !== null)
            .map((p) => (
              <circle
                key={p.date}
                cx={4 + ((dayTime(p.date) - start) / Math.max(end - start, 86400000)) * 88}
                cy={25 - (p.value! / max) * 22}
                r="1.6"
              />
            ))}
        </svg>
      </button>
      <span className="statistics-change">{changeText}</span>
      {point && (
        <span className="statistics-trend-tooltip" role="tooltip" id={tooltipId}>
          {tooltip}
        </span>
      )}
    </span>
  );
}

function scopeLabel(scope: HeroStatScope, en: boolean) {
  const mode = {
    all: en ? 'Normal · all matches' : 'Обычные · все матчи',
    ranked: en ? 'Ranked' : 'Рейтинговые',
    unranked: en ? 'Unranked' : 'Без рейтинга',
    brawl: en ? 'Street Brawl' : 'Уличная драка',
  }[scope.mode];
  const rankNames = [
    '',
    'Initiate',
    'Seeker',
    'Acolyte',
    'Sentinel',
    'Mystic',
    'Ritualist',
    'Emissary',
    'Oracle',
    'Phantom',
    'Ascendant',
    'Eternus',
  ];
  const rankName = (badge: number) => rankNames[Math.floor(badge / 10)] ?? String(badge);
  const ranks =
    scope.rankMin === null && scope.rankMax === null
      ? en
        ? 'all ranks'
        : 'все ранги'
      : `${en ? 'average match rank' : 'средний ранг матча'}: ${scope.rankMin !== null ? rankName(scope.rankMin) : '—'}${scope.rankMax !== null && rankName(scope.rankMax) !== rankName(scope.rankMin ?? 0) ? `–${rankName(scope.rankMax)}` : ''}`;
  return `${mode} · ${ranks}`;
}

type Sort = 'name' | 'matches' | 'selectionShare' | 'winRate';
export function HeroStatisticsPage({ data }: { data: HeroSnapshot }) {
  const { language } = useI18n();
  const en = language === 'en';
  const reference = useReference(loadHeroStatistics);
  const [scopeId, setScopeId] = useState('');
  const [period, setPeriod] = useState(7);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('winRate');
  const [ascending, setAscending] = useState(false);
  const statistics = reference.data;
  const scope =
    statistics?.scopes.find((s) => s.id === scopeId) ??
    statistics?.scopes.find(
      (s) =>
        s.mode === 'all' && s.gameMode === 'normal' && s.rankMin === null && s.rankMax === null,
    ) ??
    statistics?.scopes[0];
  const days = scope ? windowDays(scope, period) : [];
  const aggregated = aggregateHeroStats(days);
  const rows = data.heroes
    .filter((h) =>
      `${h.name} ${h.aliases}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    )
    .map((hero) => ({ hero, stats: aggregated.find((r) => r.heroId === hero.id) }));
  rows.sort((a, b) => {
    const compare =
      sort === 'name'
        ? a.hero.name.localeCompare(b.hero.name)
        : (a.stats?.[sort] ?? -1) - (b.stats?.[sort] ?? -1);
    return (ascending ? 1 : -1) * compare || a.hero.name.localeCompare(b.hero.name);
  });
  const end = scope ? dayTime(scope.to.slice(0, 10)) : 0;
  const start = end - (period - 1) * 86400000;
  const selectionMax = Math.max(
    1,
    ...days.flatMap((day) =>
      day.rows.map((r) => (day.totalSelections ? (r.matches / day.totalSelections) * 100 : 0)),
    ),
  );
  const order = (key: Sort) => {
    if (sort === key) setAscending((v) => !v);
    else {
      setSort(key);
      setAscending(key === 'name');
    }
  };
  const titles: Record<Sort, string> = {
    name: en ? 'Hero' : 'Герой',
    matches: en ? 'Matches' : 'Матчи',
    selectionShare: en ? 'Pick share' : 'Доля выборов',
    winRate: en ? 'Win rate' : 'Победы',
  };
  return (
    <div className="hero-statistics-page expansion-surface">
      <HeroNavigation active="statistics" />
      <h1>{en ? 'Hero match statistics' : 'Статистика матчей героев'}</h1>
      <p>
        {en
          ? 'Pick share is the hero’s share of all hero selections. Changes compare the first and last observed day, in percentage points.'
          : 'Доля выборов — часть героя среди всех выборов героев. Изменение — разница первого и последнего дня с матчами в процентных пунктах.'}
      </p>
      <p className="statistics-version-note">
        {en
          ? 'Statistics for this exact client version are unavailable; the selected period may span several versions.'
          : 'Статистика для точной версии клиента недоступна; выбранный период может включать несколько версий.'}
      </p>
      <div className="expansion-filters">
        <label>
          {en ? 'Find a hero' : 'Найти героя'}
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          {en ? 'Matches and rank' : 'Матчи и ранг'}
          <select
            value={scope?.id ?? ''}
            onChange={(e) => setScopeId(e.target.value)}
            disabled={!statistics}
          >
            {statistics?.scopes.map((s) => (
              <option key={s.id} value={s.id}>
                {scopeLabel(s, en)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {en ? 'Period' : 'Период'}
          <select value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
            {(statistics?.periods ?? [7, 30]).map((p) => (
              <option key={p} value={p}>
                {p} {en ? 'days' : 'дней'}
              </option>
            ))}
          </select>
        </label>
        {query && (
          <button onClick={() => setQuery('')}>{en ? 'Clear search' : 'Очистить поиск'}</button>
        )}
      </div>
      {!statistics && !reference.error && (
        <p role="status">{en ? 'Loading match statistics…' : 'Загружаем статистику матчей…'}</p>
      )}
      {reference.error && (
        <p role="alert">
          {en ? 'Could not load statistics.' : 'Не удалось загрузить статистику.'}{' '}
          <button onClick={reference.retry}>{en ? 'Retry' : 'Повторить'}</button>
        </p>
      )}
      {statistics && (
        <>
          <p className="statistics-dates">
            {scope
              ? `${formatDate(new Date(start).toISOString())} — ${formatDate(scope.to)} · UTC`
              : en
                ? 'No matches for this period.'
                : 'Нет матчей за этот период.'}{' '}
            · {en ? 'Updated' : 'Обновлено'}: {formatDate(scope?.updatedAt ?? statistics.updatedAt)}
          </p>
          {!days.length && (
            <p>{en ? 'No matches for this period.' : 'Нет матчей за этот период.'}</p>
          )}
          <p className="statistics-note">
            {en
              ? 'The current day is partial. Daily values use the selected mode and average match rank; missing days remain gaps.'
              : 'Текущий день неполный. Значения по дням относятся к выбранному режиму и среднему рангу матча; дни без данных остаются пропусками.'}
          </p>
          <details className="statistics-counting">
            <summary>
              {en ? 'How matches and pick share are counted' : 'Как считаются матчи и доля выборов'}
            </summary>
            <p>
              {en
                ? 'Each player’s appearance on a hero in a recorded match counts once. Mirror selections by different players count separately. Pick share divides a hero’s appearances by all recorded hero appearances in the same group. Coverage is limited to matches recorded by the data provider.'
                : 'Каждая игра игрока на герое считается один раз. Зеркальные выборы разных игроков учитываются отдельно. Доля — число появлений героя, делённое на все учтённые появления героев в той же группе. Выборка ограничена матчами, собранными источником данных.'}
            </p>
          </details>
          <p className="statistics-scroll-hint">
            {en
              ? 'Scroll the table horizontally to compare trends. Focus a trend and use ← → for daily values.'
              : 'Прокрути таблицу по горизонтали для сравнения. На графике используй ← → для значений по дням.'}
          </p>
          <div
            className="expansion-table-scroll"
            role="region"
            aria-label={en ? 'Hero match statistics table' : 'Таблица статистики матчей'}
            tabIndex={0}
          >
            <table className="expansion-stats">
              <caption className="sr-only">
                {en ? 'Hero match statistics' : 'Статистика матчей героев'}
              </caption>
              <thead>
                <tr>
                  {(Object.keys(titles) as Sort[]).map((key) => (
                    <th
                      key={key}
                      scope="col"
                      aria-sort={sort === key ? (ascending ? 'ascending' : 'descending') : 'none'}
                    >
                      <button onClick={() => order(key)}>
                        {titles[key]} {sort === key ? (ascending ? '↑' : '↓') : '↕'}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ hero, stats }) => (
                  <tr key={hero.id}>
                    <th scope="row">
                      <a href={`#/heroes/${hero.slug}`}>
                        <img src={asset(hero.portrait)} alt="" loading="lazy" />
                        <span>{hero.name}</span>
                      </a>
                    </th>
                    <td>{stats ? format(stats.matches, 0) : '—'}</td>
                    {(['selectionShare', 'winRate'] as const).map((metric) => (
                      <td key={metric}>
                        <span className="expansion-stat-value">
                          <strong>
                            {stats?.[metric] == null ? '—' : `${format(stats[metric]!, 1)}%`}
                          </strong>
                          <Trend
                            key={`${scope?.id}-${period}-${hero.id}-${metric}`}
                            points={heroHistory(days, hero.id, metric)}
                            start={start}
                            end={end}
                            max={metric === 'winRate' ? 100 : selectionMax}
                            label={`${hero.name} ${titles[metric]}`}
                            en={en}
                          />
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <p>
              {en ? 'No heroes found.' : 'Герои не найдены.'}{' '}
              <button onClick={() => setQuery('')}>{en ? 'Reset search' : 'Сбросить поиск'}</button>
            </p>
          )}
        </>
      )}
    </div>
  );
}
