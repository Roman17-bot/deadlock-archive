import { useEffect, useState } from 'react';
import type { ItemCatalog, ItemStatistics } from '../../../shared/item-types';
import { loadItems, loadItemStatistics } from '../../services/itemsApi';

export function useItems(
  initialCatalog?: ItemCatalog,
  initialStatistics?: ItemStatistics,
  withStatistics = false,
) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [statistics, setStatistics] = useState(initialStatistics);
  const [error, setError] = useState(false);
  const [statisticsState, setStatisticsState] = useState<'loading' | 'ready' | 'error'>(
    initialStatistics ? 'ready' : 'loading',
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (initialCatalog) return;
    const controller = new AbortController();
    setError(false);
    void loadItems(controller.signal)
      .then(setCatalog)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [initialCatalog, attempt]);
  useEffect(() => {
    if (!withStatistics || !catalog || initialStatistics) return;
    const controller = new AbortController();
    setStatisticsState('loading');
    void loadItemStatistics(controller.signal, catalog)
      .then((value) => {
        setStatistics(value);
        setStatisticsState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatisticsState('error');
      });
    return () => controller.abort();
  }, [catalog, initialStatistics, withStatistics]);
  return {
    catalog,
    statistics,
    error,
    statisticsState,
    retry: () => setAttempt((value) => value + 1),
  };
}
