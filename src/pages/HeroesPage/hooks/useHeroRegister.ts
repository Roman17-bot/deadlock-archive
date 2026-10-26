import { useMemo, useState } from 'react';
import type { HeroSnapshot, SortDirection, SortKey } from '../../../../shared/types';
import { selectHeroes, toCsv } from '../../../../shared/heroes';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { useI18n } from '../../../i18n';
import { columns } from '../model/columns';

function initialSearch(data: HeroSnapshot) {
  const slug = new URLSearchParams(window.location.hash.split('?')[1]).get('hero');
  return data.heroes.find((h) => h.slug === slug)?.name ?? '';
}

export function useHeroRegister(data: HeroSnapshot) {
  const { language } = useI18n();
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
  return {
    query,
    setQuery,
    level,
    setLevel,
    expanded,
    setExpanded,
    statView,
    isMobile,
    visibleColumns,
    activeSortKey,
    activeDirection,
    selected,
    sort,
    reset,
    changeStatView,
    exportCsv,
  };
}

export type HeroRegisterState = ReturnType<typeof useHeroRegister>;
