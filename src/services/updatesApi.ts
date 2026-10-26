import { asset } from '../lib/format';
import { readJson } from './http';

const steamInfo = 'https://api.deadlock-api.com/v1/assets/steam-info';

export const fetchUpdateSession = () => readJson('/api/update/session', { cache: 'no-store' });
export const fetchUpdateStatus = () => readJson('/api/update/status', { cache: 'no-store' });
export const fetchLocalSnapshot = () => readJson('/api/heroes', { cache: 'no-store' });
export const fetchPublishedSnapshot = () =>
  readJson(asset('data/heroes.json'), { cache: 'no-store' });
export const fetchSteamInfo = () => readJson(steamInfo, { cache: 'no-store' });
export const fetchVersionHistory = (mode: 'local' | 'public', signal: AbortSignal) =>
  readJson(mode === 'local' ? '/api/version-history' : asset('data/version-history.json'), {
    cache: 'no-store',
    signal,
  });
export const startUpdateRequest = (token: string, publish: boolean) =>
  readJson('/api/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Archive-Token': token },
    body: JSON.stringify({ publish }),
  });
