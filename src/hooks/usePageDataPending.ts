import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';

type BeginPageRequest = () => () => void;
export const PageDataContext = createContext<BeginPageRequest | null>(null);

/** Register data needed to render the initial view. Outside that view this is a no-op. */
export function usePageDataPending(pending: boolean) {
  const begin = useContext(PageDataContext);
  useLayoutEffect(() => {
    if (pending) return begin?.();
  }, [begin, pending]);
}

/** Use as a Suspense fallback when a lazy section belongs to the initial view. */
export function PendingPageSection({ children }: { children?: ReactNode }) {
  usePageDataPending(true);
  return children ?? null;
}
