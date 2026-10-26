import { useEffect, useState } from 'react';
import {
  bundledMechanics,
  loadMechanicsCatalogs,
  type Catalogs,
} from '../../../services/mechanicsApi';
import { siteMode } from '../../../services/environment';

export function useMechanicsData(clientVersion: number, enabled = siteMode() === 'local') {
  const [catalogs, setCatalogs] = useState<Catalogs>(bundledMechanics);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    void loadMechanicsCatalogs(controller.signal)
      .then((catalogs) => {
        if (!controller.signal.aborted) setCatalogs(catalogs);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [enabled, clientVersion, attempt]);
  return { catalogs, loading, error, retry: () => setAttempt((n) => n + 1) };
}
