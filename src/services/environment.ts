import { asset } from '../lib/format';

export type SiteMode = 'local' | 'public';

export function siteMode(): SiteMode {
  const { hostname, port } = window.location;
  return (hostname === 'localhost' || hostname === '127.0.0.1') && port === '5173'
    ? 'local'
    : 'public';
}

export function heroSnapshotUrl(): string {
  return (
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? '/api/heroes' : asset('data/heroes.json'))
  );
}
