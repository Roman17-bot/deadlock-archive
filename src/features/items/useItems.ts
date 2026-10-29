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
    const controller = new AbortController();
    setError(false);
    const catalogRequest = initialCatalog
      ? Promise.resolve(initialCatalog)
      : loadItems(controller.signal);
    void catalogRequest
      .then((value) => {
        if (!controller.signal.aborted) setCatalog(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    // Start both transfers now; only validation needs to wait for the catalog.
    if (withStatistics && !initialStatistics) {
      setStatisticsState('loading');
      void loadItemStatistics(controller.signal, catalogRequest)
        .then((value) => {
          if (controller.signal.aborted) return;
          setStatistics(value);
          setStatisticsState('ready');
        })
        .catch(() => {
          if (!controller.signal.aborted) setStatisticsState('error');
        });
    }
    return () => controller.abort();
  }, [initialCatalog, initialStatistics, withStatistics, attempt]);
  return {
    catalog,
    statistics,
    error,
    statisticsState,
    retry: () => setAttempt((value) => value + 1),
    retryStatistics: () => setAttempt((value) => value + 1),
  };
}
