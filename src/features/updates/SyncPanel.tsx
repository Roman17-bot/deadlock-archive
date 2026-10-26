import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Database, RefreshCw, Upload } from 'lucide-react';
import type { SyncState } from '../../../shared/sync-types';
import { useI18n } from '../../i18n';

const active = new Set(['checking', 'saving', 'publishing', 'queued', 'in_progress']);
const phases = new Set([...active, 'idle', 'succeeded', 'failed']);
const repo = 'https://github.com/Roman17-bot/deadlock-archive';
const hashPattern = /^[a-f0-9]{64}$/;
const failure = 'Синхронизация не удалась. Локальные данные сохранены; повторите попытку.';
const unavailable = 'Для синхронизации настройте локальную PostgreSQL.';
const mismatch = 'Снимок отличается от опубликованной версии.';

function isSyncState(value: unknown): value is SyncState {
  if (!value || typeof value !== 'object') return false;
  const state = value as SyncState;
  return (
    typeof state.available === 'boolean' &&
    ['postgresql', 'json'].includes(state.source) &&
    phases.has(state.phase) &&
    typeof state.localSaved === 'boolean' &&
    typeof state.message === 'string' &&
    typeof state.updatedAt === 'string' &&
    Number.isFinite(Date.parse(state.updatedAt)) &&
    (state.clientVersion === undefined ||
      (Number.isSafeInteger(state.clientVersion) && state.clientVersion >= 0)) &&
    [state.snapshotHash, state.repositoryHash, state.pagesHash].every(
      (hash) => hash == null || (typeof hash === 'string' && hashPattern.test(hash)),
    ) &&
    state.snapshotHash !== null &&
    [state.localMatches, state.repositoryMatches, state.pagesMatches, state.upToDate].every(
      (flag) => flag === undefined || typeof flag === 'boolean',
    ) &&
    (state.commitSha === undefined ||
      (typeof state.commitSha === 'string' && /^[a-f0-9]{40}$/.test(state.commitSha))) &&
    (state.runId === undefined || (Number.isSafeInteger(state.runId) && state.runId > 0)) &&
    (state.url === undefined || typeof state.url === 'string')
  );
}

function verified(state: SyncState): boolean {
  return (
    !!state.snapshotHash &&
    state.repositoryMatches === true &&
    state.pagesMatches === true &&
    state.snapshotHash === state.repositoryHash &&
    state.snapshotHash === state.pagesHash
  );
}

function safeUrl(state: SyncState): string | undefined {
  if (state.url === `${repo}/actions/workflows/pages.yml`) return state.url;
  if (state.runId && state.url === `${repo}/actions/runs/${state.runId}`) return state.url;
  if (state.commitSha && state.url === `${repo}/commit/${state.commitSha}`) return state.url;
  return undefined;
}

function messageFor(state: SyncState): string {
  if (!state.available) return unavailable;
  if (state.phase === 'failed') return failure;
  if (state.phase === 'checking') return 'Проверяем данные PostgreSQL и GitHub Pages.';
  if (state.phase === 'saving') return 'Сохраняем точный снимок PostgreSQL.';
  if (state.phase === 'publishing') return 'Отправляем снимок в GitHub.';
  if (state.phase === 'queued') return 'Снимок отправлен. Ожидаем развёртывание Pages.';
  if (state.phase === 'in_progress') return 'GitHub Pages публикует снимок.';
  if (verified(state)) return 'Данные PostgreSQL и GitHub Pages синхронизированы.';
  if (state.phase === 'succeeded')
    return 'GitHub Pages не подтвердил развёртывание. Повторите синхронизацию.';
  if (state.repositoryMatches === false || state.pagesMatches === false) return mismatch;
  return 'Можно проверить синхронизацию.';
}

interface SyncPanelProps {
  token: string | null;
  updateBusy: boolean;
  onBusyChange: (busy: boolean) => void;
  onLocalSnapshot: (hash: string) => void;
}
export function SyncPanel({ token, updateBusy, onBusyChange, onLocalSnapshot }: SyncPanelProps) {
  const { t } = useI18n();
  const [state, setState] = useState<SyncState | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const locked = useRef(false);
  const controllers = useRef(new Set<AbortController>());
  const polls = useRef(0);
  const loaded = useRef<string | null>(null);
  const previousUpdateBusy = useRef(updateBusy);
  const callbacks = useRef({ onBusyChange, onLocalSnapshot });
  callbacks.current = { onBusyChange, onLocalSnapshot };
  const running = !!state && active.has(state.phase) && !error;
  const busy = requesting || running;

  const request = useCallback(async (url: string, init?: RequestInit) => {
    if (locked.current) return;
    const controller = new AbortController();
    controllers.current.add(controller);
    locked.current = true;
    setRequesting(true);
    setError('');
    try {
      const response = await fetch(url, {
        ...init,
        cache: 'no-store',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
      });
      if (!response.ok) throw new Error('Sync request failed');
      const value: unknown = await response.json();
      if (!isSyncState(value)) throw new Error('Invalid sync response');
      if (!mounted.current || controller.signal.aborted) return;
      setState(value);
      if (
        value.snapshotHash &&
        (value.localSaved || verified(value)) &&
        loaded.current !== value.snapshotHash
      ) {
        loaded.current = value.snapshotHash;
        callbacks.current.onLocalSnapshot(value.snapshotHash);
      }
    } catch {
      if (mounted.current && !controller.signal.aborted)
        setError(
          init?.method === 'POST'
            ? 'Не удалось запустить синхронизацию. Повторите попытку.'
            : 'Не удалось проверить синхронизацию. Повторите попытку.',
        );
    } finally {
      controllers.current.delete(controller);
      if (!controller.signal.aborted) {
        locked.current = false;
        if (mounted.current) setRequesting(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    locked.current = false;
    void request('/api/sync/status');
    return () => {
      mounted.current = false;
      for (const controller of controllers.current) controller.abort();
      controllers.current.clear();
      callbacks.current.onBusyChange(false);
    };
  }, [request]);

  useEffect(() => {
    callbacks.current.onBusyChange(busy);
  }, [busy]);

  useEffect(() => {
    const finished = previousUpdateBusy.current && !updateBusy;
    previousUpdateBusy.current = updateBusy;
    if (finished) {
      polls.current = 0;
      void request('/api/sync/status');
    }
  }, [updateBusy, request]);

  useEffect(() => {
    if (!running || requesting) return;
    if (polls.current >= 120) {
      setError('Ожидание Pages заняло слишком много времени. Проверьте синхронизацию снова.');
      return;
    }
    const timer = setTimeout(() => {
      polls.current += 1;
      void request('/api/sync/status');
    }, 3000);
    return () => clearTimeout(timer);
  }, [running, requesting, state, request]);

  const check = () => {
    if (busy || updateBusy) return;
    polls.current = 0;
    void request('/api/sync/status?refresh=1');
  };
  const sync = () => {
    if (!token || busy || updateBusy || !state?.available) return;
    polls.current = 0;
    void request('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Archive-Token': token },
      body: '{}',
    });
  };
  const success =
    !!state && ['idle', 'succeeded'].includes(state.phase) && !busy && !error && verified(state);
  const url = state ? safeUrl(state) : undefined;
  const retry = state?.phase === 'failed' || !!error || (state?.phase === 'succeeded' && !success);

  return (
    <section
      className="updates-panel updates-control sync-panel"
      aria-labelledby="sync-title"
      aria-busy={busy}
    >
      <div className="sync-heading">
        <div>
          <span className="updates-label">{t('ТОЧНЫЙ СНИМОК')}</span>
          <h2 id="sync-title">{t('Синхронизация с Pages')}</h2>
        </div>
        <Database className="sync-emblem" size={36} aria-hidden="true" />
      </div>
      <p>
        {t(
          'PostgreSQL — источник публикации. Отправляем все текущие публичные данные, включая правки в той же версии клиента.',
        )}
      </p>
      <div className="sync-route" aria-label={t('Источник и назначение')}>
        <span>PostgreSQL</span>
        <ArrowRight size={18} aria-hidden="true" />
        <span>GitHub Pages</span>
      </div>
      <dl className="sync-hashes">
        {(
          [
            ['PostgreSQL', state?.snapshotHash],
            ['GitHub', state?.repositoryHash],
            ['Pages', state?.pagesHash],
          ] as const
        ).map(([label, hash]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <code title={hash ?? undefined}>
                {hash ? `${hash.slice(0, 12)}…` : t('Не проверено')}
              </code>
            </dd>
          </div>
        ))}
      </dl>
      <div className="sync-actions">
        <button
          className="updates-secondary"
          type="button"
          disabled={busy || updateBusy}
          onClick={check}
        >
          <RefreshCw size={17} aria-hidden="true" />
          {t('Проверить синхронизацию')}
        </button>
        <button
          className="updates-button"
          type="button"
          disabled={!token || !state?.available || busy || updateBusy}
          onClick={sync}
        >
          <Upload size={17} aria-hidden="true" />
          {t(retry ? 'Повторить синхронизацию' : 'Синхронизировать с Pages')}
        </button>
      </div>
      <div
        className={`sync-feedback${success ? ' is-verified' : ''}${state?.phase === 'failed' || error ? ' is-failed' : ''}`}
        aria-live="polite"
        aria-atomic="true"
      >
        <p>
          {success && <Check size={18} aria-hidden="true" />}
          <strong>
            {t(
              success
                ? 'Pages подтверждён'
                : busy
                  ? 'Синхронизация выполняется'
                  : state?.phase === 'failed'
                    ? 'Нужна повторная попытка'
                    : 'Состояние синхронизации',
            )}
          </strong>
        </p>
        <p>{t(error || (state ? messageFor(state) : 'Можно проверить синхронизацию.'))}</p>
        {state && ['queued', 'in_progress'].includes(state.phase) && !success && (
          <p>{t('Развёртывание ещё не подтверждено.')}</p>
        )}
        {success && state?.upToDate && (
          <p>{t('Все три снимка совпадают. Новый коммит не требуется.')}</p>
        )}
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer">
            {t('Открыть публикацию GitHub')}
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        )}
      </div>
    </section>
  );
}
