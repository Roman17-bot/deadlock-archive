import { useEffect, useMemo, useRef, useState } from 'react';
import type { HeroSnapshot } from '../../../shared/types';
import type { AbilityCatalog } from '../../../shared/ability-types';
import { loadAbilities } from '../../services/abilitiesApi';
import { usePageDataPending } from '../../hooks/usePageDataPending';

export function useAbilities(data: HeroSnapshot) {
  const [catalog, setCatalog] = useState<AbilityCatalog>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  usePageDataPending(!catalog && !error);
  const identity = `${data.meta.clientVersion}/${data.meta.sourceRevision}/${data.meta.gameCommit}`;
  const previousIdentity = useRef(identity);
  useEffect(() => {
    const controller = new AbortController();
    const changed = previousIdentity.current !== identity;
    previousIdentity.current = identity;
    setError(false);
    void loadAbilities(controller.signal, attempt > 0 || changed)
      .then((value) => {
        if (!controller.signal.aborted) setCatalog(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [identity, attempt]);
  const mismatch = useMemo(() => {
    if (!catalog) return false;
    const ids = new Set(data.heroes.map((hero) => hero.id));
    return (
      catalog.meta.clientVersion !== data.meta.clientVersion ||
      catalog.meta.sourceRevision !== data.meta.sourceRevision ||
      catalog.meta.gameCommit !== data.meta.gameCommit ||
      catalog.heroes.length !== ids.size ||
      catalog.heroes.some((hero) => !ids.has(hero.heroId))
    );
  }, [catalog, data]);
  return { catalog, error, mismatch, retry: () => setAttempt((value) => value + 1) };
}
