import { useEffect, useState } from 'react';
import type { HeroSnapshot } from '../../shared/types';
import { loadHeroSnapshot } from '../services/heroesApi';

export function useHeroSnapshot(initialSnapshot?: HeroSnapshot) {
  const [data, setData] = useState<HeroSnapshot | null>(initialSnapshot ?? null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (initialSnapshot) return;
    const controller = new AbortController();
    setError(false);
    loadHeroSnapshot(controller.signal)
      .then(setData)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [initialSnapshot, attempt]);

  function retry() {
    setError(false);
    setAttempt((value) => value + 1);
  }

  return { data, setData, error, retry };
}
