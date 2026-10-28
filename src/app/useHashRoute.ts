import { useEffect, useState } from 'react';

export type PageRoute = 'home' | 'heroes' | 'mechanics' | 'updates' | 'items';

function resolveRoute(hash: string): PageRoute {
  return /^#\/items(?:\/|\?|$)/.test(hash)
    ? 'items'
    : hash.startsWith('#/heroes')
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
