import { useEffect, useState } from 'react';
import type { HeroSnapshot } from '../../shared/types';
import { loadHeroSnapshot } from '../services/heroesApi';
import { readJson } from '../services/http';

export function useHeroSnapshot(initialSnapshot?: HeroSnapshot) {
  const [data, setData] = useState<HeroSnapshot | null>(initialSnapshot ?? null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (initialSnapshot) return;
    const controller = new AbortController();
    setError(false);
    loadHeroSnapshot(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted)
          setData((current) =>
            !current || next.meta.clientVersion >= current.meta.clientVersion ? next : current,
          );
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [initialSnapshot, attempt]);

  useEffect(() => {
    if (!import.meta.env.DEV || initialSnapshot) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let polls = 0;
    let idle = 0;
    const check = async () => {
      try {
        const state = (await readJson('/api/update/status', {
          cache: 'no-store',
          signal: controller.signal,
        })) as {
          phase?: string;
          localSaved?: boolean;
          databaseSaved?: boolean;
        };
        if (controller.signal.aborted) return;
        if (state.phase === 'idle' && ++idle < 4) timer = setTimeout(check, 1500);
        else if (['checking', 'saving', 'publishing'].includes(state.phase ?? '') && ++polls < 400)
          timer = setTimeout(check, 1500);
        else if (state.localSaved && state.databaseSaved !== false) {
          const next = await loadHeroSnapshot(controller.signal);
          if (!controller.signal.aborted)
            setData((current) =>
              !current || next.meta.clientVersion >= current.meta.clientVersion ? next : current,
            );
        }
      } catch {
        /* Offline checking must not hide the already loaded archive. */
      }
    };
    void check();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [initialSnapshot, attempt]);

  function retry() {
    setError(false);
    setAttempt((value) => value + 1);
  }

  return { data, setData, error, retry };
}
