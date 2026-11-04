import { useEffect, useState } from 'react';

export function useReference<T>(loader: (signal: AbortSignal, force?: boolean) => Promise<T>) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    loader(controller.signal, attempt > 0)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [loader, attempt]);
  return { data, error, retry: () => setAttempt((value) => value + 1) };
}
