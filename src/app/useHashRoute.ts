import { useEffect, useState } from 'react';

export type PageRoute = 'home' | 'heroes' | 'mechanics' | 'updates';

function resolveRoute(hash: string): PageRoute {
  return hash.startsWith('#/heroes')
    ? 'heroes'
    : hash.startsWith('#/mechanics')
      ? 'mechanics'
      : hash.startsWith('#/updates')
        ? 'updates'
        : 'home';
}

export function useHashRoute() {
  const [routeHash, setRouteHash] = useState(() => window.location.hash);

  useEffect(() => {
    const changed = () => {
      setRouteHash(window.location.hash);
      window.scrollTo?.({ top: 0 });
    };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);

  return { routeHash, route: resolveRoute(routeHash) };
}
