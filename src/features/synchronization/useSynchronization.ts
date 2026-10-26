import { useCallback, useEffect, useRef, useState } from 'react';
import type { SyncState } from '../../../shared/sync-types';
import { fetchSyncState } from '../../services/synchronizationApi';
import { active, safeUrl, verified } from './model';

export interface SyncPanelProps {
  token: string | null;
  updateBusy: boolean;
  onBusyChange: (busy: boolean) => void;
  onLocalSnapshot: (hash: string) => void;
}

export function useSynchronization({
  token,
  updateBusy,
  onBusyChange,
  onLocalSnapshot,
}: SyncPanelProps) {
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
      const value = await fetchSyncState(url, {
        ...init,
        cache: 'no-store',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
      });
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

  return { state, busy, error, check, sync, success, url, retry };
}
