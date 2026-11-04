import { useEffect, useState } from 'react';
import type { HeroSnapshot } from '../../../shared/types';
import type { HeroStatScope } from '../../../shared/hero-reference';
import { aggregateHeroStats, heroHistory, windowDays } from '../../../shared/hero-reference';
import { HERO_RANKS } from '../../../shared/hero-ranks';
import { useI18n } from '../../i18n';
import { asset, format, formatDate } from '../../lib/format';
import { loadHeroHistory, loadHeroStatistics } from '../../services/heroReferenceApi';
import { useReference } from '../../features/heroes/useReference';
import { StyledSelect } from '../../components/ui/StyledSelect/StyledSelect';
import {
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronRight,
} from '../../components/ui/ArchiveIcon/ArchiveIcons';
import { Trend } from './Trend';
import { StatisticsTable } from './StatisticsTable';
import { dayTime } from './chart-model';
import './HeroStatisticsPage.css';

type Sort = 'name' | 'matches' | 'winRate' | 'selectionShare';
export function HeroStatisticsPage({ data }: { data: HeroSnapshot }) {
  const { language } = useI18n();
  const en = language === 'en';
  const reference = useReference(loadHeroStatistics);
  const [scopeId, setScopeId] = useState('');
  const [period, setPeriod] = useState<7 | 30 | 365>(7);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('winRate');
  const [ascending, setAscending] = useState(false);
  const [histories, setHistories] = useState<Record<string, HeroStatScope>>({});
  const [historyState, setHistoryState] = useState<{ id: string; error: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const statistics = reference.data;
  const scope =
    statistics?.scopes.find((s) => s.id === scopeId) ??
    statistics?.scopes.find(
      (s) =>
        s.mode === 'all' && s.gameMode === 'normal' && s.rankMin === null && s.rankMax === null,
    ) ??
    statistics?.scopes[0];
  const needsHistory = period === 365 && !!scope && !!statistics?.historyScopes?.includes(scope.id);
  const historyId = needsHistory ? scope!.id : '';
  useEffect(() => {
    if (!historyId || histories[historyId]) return;
    const controller = new AbortController();
    setHistoryState({ id: historyId, error: false });
    loadHeroHistory(historyId, controller.signal, retry > 0)
      .then((result) => {
        if (controller.signal.aborted) return;
        setHistories((previous) => ({ ...previous, [historyId]: result }));
        setHistoryState(null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setHistoryState({ id: historyId, error: true });
      });
    return () => controller.abort();
  }, [historyId, histories, retry]);
  const selectedScope = historyId ? (histories[historyId] ?? scope) : scope;
  const days = selectedScope ? windowDays(selectedScope, period) : [];
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
  const end = selectedScope ? dayTime(selectedScope.to.slice(0, 10)) : 0;
  // Year without a saved history uses only the available dates, never a fictitious year.
  const requestedStart = end - (period - 1) * 86400000;
  const start =
    period === 365 && selectedScope?.days.length
      ? Math.max(
          requestedStart,
          dayTime(
            selectedScope.days.reduce(
              (first, d) => (d.date < first ? d.date : first),
              selectedScope.days[0].date,
            ),
          ),
        )
      : requestedStart;
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
    winRate: en ? 'Win rate' : 'Винрейт',
    selectionShare: en ? 'Pick share' : 'Доля выборов',
  };
  const modeLabels = {
    all: en ? 'All matches' : 'Все матчи',
    ranked: en ? 'Ranked' : 'Ранкед',
    unranked: en ? 'Unranked' : 'Анранкед',
    brawl: en ? 'Street Brawl' : 'Уличная драка',
  };
  const modes = (['all', 'ranked', 'unranked', 'brawl'] as const).filter((mode) =>
    statistics?.scopes.some((s) => s.mode === mode),
  );
  const rankScopes = statistics?.scopes.filter((s) => s.mode === 'ranked') ?? [];
  const rankOptions = rankScopes.map((s) => {
    const rank = HERO_RANKS.find((r) => r.tier === Math.floor((s.rankMin ?? 0) / 10));
    return {
      value: s.id,
      label: rank ? rank.name[en ? 'en' : 'ru'] : en ? 'All ranks' : 'Все ранги',
      icon: rank ? (
        <img src={asset(rank.icon)} alt="" />
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 2 8 5v10l-8 5-8-5V7Z M8 10l4-3 4 3-4 7Z" fill="none" stroke="currentColor" />
        </svg>
      ),
    };
  });
  return (
    <div className="hero-statistics-page expansion-surface">
      <div className="breadcrumbs statistics-breadcrumbs">
        <a href="#/">{en ? 'Archive' : 'Архив'}</a>
        <ChevronRight size={12} aria-hidden="true" />
        <a href="#/heroes">{en ? 'Hero register' : 'Реестр героев'}</a>
        <ChevronRight size={12} aria-hidden="true" />
        <span>{en ? 'Statistics' : 'Статистика'}</span>
      </div>
      <section className="statistics-heading" aria-labelledby="statistics-heading">
        <div className="section-kicker">
          {en ? 'HERO REGISTER · MATCHES' : 'РЕЕСТР ГЕРОЕВ · МАТЧИ'}
        </div>
        <h1 id="statistics-heading">
          {en ? 'Match ' : 'Статистика '}
          <span className="statistics-title-ending">
            {en ? 'statistics' : 'матчей'}
            <span className="title-star" aria-hidden="true">
              ✦
            </span>
          </span>
        </h1>
      </section>
      <div className="statistics-toolbar">
        <label className="statistics-search">
          <span className="sr-only">{en ? 'Find a hero' : 'Найти героя'}</span>
          <Search size={20} />
          <input
            type="search"
            placeholder={en ? 'Find a hero' : 'Найти героя'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="statistics-filters">
          <div className="statistics-mode">
            <span id="statistics-mode-label" className="statistics-control-label">
              {en ? 'Mode' : 'Режим'}
            </span>
            <StyledSelect
              id="statistics-mode"
              labelledBy="statistics-mode-label"
              value={scope?.mode ?? 'all'}
              options={modes.map((mode) => ({ value: mode, label: modeLabels[mode] }))}
              onChange={(mode) =>
                setScopeId(
                  statistics?.scopes.find(
                    (s) => s.mode === mode && s.rankMin === null && s.rankMax === null,
                  )?.id ??
                    statistics?.scopes.find((s) => s.mode === mode)?.id ??
                    '',
                )
              }
            />
          </div>
          {scope?.mode === 'ranked' && (
            <div className="statistics-rank">
              <span id="statistics-rank-label" className="statistics-control-label">
                {en ? 'Rank' : 'Ранг'}
              </span>
              <StyledSelect
                id="statistics-rank"
                labelledBy="statistics-rank-label"
                value={scope.id}
                options={rankOptions}
                onChange={setScopeId}
              />
            </div>
          )}
          <fieldset className="statistics-period">
            <legend>{en ? 'Period' : 'Период'}</legend>
            {([7, 30, 365] as const).map((p, i) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
              >
                {(en ? ['Week', 'Month', 'Year'] : ['Неделя', 'Месяц', 'Год'])[i]}
              </button>
            ))}
          </fieldset>
        </div>
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
          <div className="statistics-summary">
            <span>
              {scope
                ? `${formatDate(new Date(start).toISOString())} — ${formatDate(new Date(end).toISOString())}`
                : en
                  ? 'No matches for this period.'
                  : 'Нет матчей за этот период.'}
            </span>
          </div>
          {historyId &&
            !histories[historyId] &&
            (historyState?.id === historyId && historyState.error ? (
              <p role="alert">
                {en ? 'Could not load history.' : 'Не удалось загрузить историю.'}{' '}
                <button onClick={() => setRetry((v) => v + 1)}>{en ? 'Retry' : 'Повторить'}</button>
              </p>
            ) : (
              <p role="status">{en ? 'Loading history…' : 'Загружаем историю…'}</p>
            ))}
          {!days.length && (
            <p>{en ? 'No matches for this period.' : 'Нет матчей за этот период.'}</p>
          )}
          <StatisticsTable en={en}>
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
                        {titles[key]}
                        {sort === key ? (
                          ascending ? (
                            <ArrowUp size={16} />
                          ) : (
                            <ArrowDown size={16} />
                          )
                        ) : (
                          <ArrowUpDown size={16} />
                        )}
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
                    {(['winRate', 'selectionShare'] as const).map((metric) => (
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
                            period={period}
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
          </StatisticsTable>
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
