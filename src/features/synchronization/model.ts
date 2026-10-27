import type { SyncState } from '../../../shared/sync-types';
import { syncActivePhases } from '../../services/synchronizationApi';

export const active = syncActivePhases;
const repo = 'https://github.com/Roman17-bot/deadlock-archive';
const failure = 'Синхронизация не удалась. Локальные данные сохранены; повторите попытку.';
const unavailable = 'Для синхронизации настройте локальную PostgreSQL.';
const mismatch = 'На сайте опубликована другая версия данных.';

export function verified(state: SyncState): boolean {
  return (
    !!state.snapshotHash &&
    state.repositoryMatches === true &&
    state.pagesMatches === true &&
    state.snapshotHash === state.repositoryHash &&
    state.snapshotHash === state.pagesHash
  );
}

export function safeUrl(state: SyncState): string | undefined {
  if (state.url === `${repo}/actions/workflows/pages.yml`) return state.url;
  if (state.runId && state.url === `${repo}/actions/runs/${state.runId}`) return state.url;
  if (state.commitSha && state.url === `${repo}/commit/${state.commitSha}`) return state.url;
  return undefined;
}

export function messageFor(state: SyncState): string {
  if (!state.available) return unavailable;
  if (state.phase === 'failed') return failure;
  if (state.phase === 'checking') return 'Проверяем данные PostgreSQL и GitHub Pages.';
  if (state.phase === 'saving') return 'Сохраняем данные из базы.';
  if (state.phase === 'publishing') return 'Отправляем данные на GitHub.';
  if (state.phase === 'queued') return 'Данные отправлены. Публикация в очереди.';
  if (state.phase === 'in_progress') return 'GitHub Pages обновляет сайт.';
  if (verified(state)) return 'Данные PostgreSQL и GitHub Pages синхронизированы.';
  if (state.phase === 'succeeded')
    return 'Не удалось дождаться обновления сайта. Проверьте синхронизацию ещё раз.';
  if (state.repositoryMatches === false || state.pagesMatches === false) return mismatch;
  return 'Можно проверить синхронизацию.';
}
