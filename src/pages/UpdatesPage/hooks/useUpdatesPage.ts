import { useCallback, useEffect, useRef, useState } from 'react';
import type { HeroSnapshot } from '../../../../shared/types';
import type { UpdateSession, UpdateState } from '../../../../shared/update-types';
import { validateSnapshot } from '../../../../shared/heroes';
import initialHistory from '../../../../data/version-history.json';
import { validateVersionHistory, type VersionHistory } from '../../../../shared/version-history';
import {
  fetchUpdateSession,
  fetchUpdateStatus,
  fetchLocalSnapshot,
  fetchPublishedSnapshot,
  fetchSteamInfo,
  fetchVersionHistory,
  startUpdateRequest,
} from '../../../services/updatesApi';
import { activePhases, isNewerOrEqual, isState, maxPolls, safePublicationUrl } from '../model';

export interface UpdatesPageProps {
  data: HeroSnapshot;
  onSnapshot: (data: HeroSnapshot) => void;
  mode?: 'local' | 'public';
}

export function useUpdatesPage({
  data,
  onSnapshot,
  mode,
}: UpdatesPageProps & { mode: 'local' | 'public' }) {
  const [history, setHistory] = useState<VersionHistory>(initialHistory as VersionHistory);
  const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'failed'>(
    mode === 'local' ? 'loading' : 'ready',
  );
  const [historyEpoch, setHistoryEpoch] = useState(0);
  const [state, setState] = useState<UpdateState | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [publish, setPublish] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [upstream, setUpstream] = useState<number | null>(null);
  const current = useRef(data);
  const live = useRef(true);
  const requestLock = useRef(false);
  const loadedJob = useRef<string | null>(null);
  const loadedSync = useRef(new Set<string>());
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const polls = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    if (mode === 'local') setHistoryStatus('loading');
    void fetchVersionHistory(
      mode,
      AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
    )
      .then((value) => {
        if (!validateVersionHistory(value)) throw new Error('Invalid version history');
        if (!controller.signal.aborted) {
          setHistory(value);
          setHistoryStatus('ready');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted && mode === 'local') setHistoryStatus('failed');
        /* Public builds retain the validated history bundled with the release. */
      });
    return () => controller.abort();
  }, [mode, data.meta.clientVersion, historyEpoch]);

  useEffect(() => {
    current.current = data;
  }, [data]);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const receiveState = useCallback(
    async (next: UpdateState) => {
      if (!live.current) return;
      setState(next);
      if (!next.localSaved || next.databaseSaved === false || activePhases.has(next.phase)) return;
      const key = next.jobId ?? next.updatedAt;
      if (loadedJob.current === key) return;
      loadedJob.current = key;
      try {
        const candidate = await fetchLocalSnapshot();
        if (!validateSnapshot(candidate) || !isNewerOrEqual(candidate, current.current))
          throw new Error('Invalid or older snapshot');
        if (live.current) {
          current.current = candidate;
          onSnapshot(candidate);
          setHistoryEpoch((n) => n + 1);
        }
      } catch {
        if (live.current)
          setError(
            'Локальные данные сохранены, но загрузить новый снимок не удалось. Обновите страницу.',
          );
      }
    },
    [onSnapshot],
  );

  const receiveSyncSnapshot = useCallback(
    async (hash: string) => {
      if (loadedSync.current.has(hash)) return;
      loadedSync.current.add(hash);
      try {
        const candidate = await fetchLocalSnapshot();
        if (!validateSnapshot(candidate) || !isNewerOrEqual(candidate, current.current))
          throw new Error('Invalid or older snapshot');
        if (live.current) {
          current.current = candidate;
          onSnapshot(candidate);
          setHistoryEpoch((n) => n + 1);
        }
      } catch {
        loadedSync.current.delete(hash);
        if (live.current)
          setError(
            'Локальные данные сохранены, но загрузить новый снимок не удалось. Обновите страницу.',
          );
      }
    },
    [onSnapshot],
  );

  const connect = useCallback(async () => {
    setConnecting(true);
    setError('');
    try {
      const value = (await fetchUpdateSession()) as UpdateSession;
      if (!value || typeof value.token !== 'string' || !value.token || !isState(value.state))
        throw new Error('Invalid session');
      if (!live.current) return;
      setToken(value.token);
      setConnected(true);
      await receiveState(value.state);
    } catch {
      if (live.current) {
        setToken(null);
        setConnected(false);
        setError(
          'Локальный сервер недоступен. Запустите npm run dev в проекте и повторите подключение.',
        );
      }
    } finally {
      if (live.current) setConnecting(false);
    }
  }, [receiveState]);

  useEffect(() => {
    if (mode === 'local') void connect();
  }, [mode, connect]);

  useEffect(() => {
    if (mode !== 'local' || !state || !activePhases.has(state.phase)) return;
    if (polls.current >= maxPolls) {
      setError(
        'Ожидание заняло слишком много времени. Повторите подключение, чтобы проверить состояние задачи.',
      );
      return;
    }
    pollTimer.current = setTimeout(async () => {
      polls.current += 1;
      try {
        const value = await fetchUpdateStatus();
        if (!isState(value)) throw new Error('Invalid state');
        await receiveState(value);
      } catch {
        if (live.current) setError('Не удалось получить статус задачи. Повторите подключение.');
      }
    }, 1500);
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [mode, state, receiveState]);

  const start = async () => {
    if (
      !token ||
      !connected ||
      syncBusy ||
      requestLock.current ||
      (state && activePhases.has(state.phase))
    )
      return;
    requestLock.current = true;
    setRequesting(true);
    setError('');
    setNotice('');
    polls.current = 0;
    try {
      const value = await startUpdateRequest(token, publish);
      if (!isState(value)) throw new Error('Invalid state');
      await receiveState(value);
    } catch {
      if (live.current)
        setError(
          'Не удалось запустить обновление. Проверьте локальный сервер и повторите попытку.',
        );
    } finally {
      requestLock.current = false;
      if (live.current) setRequesting(false);
    }
  };

  const checkPublic = async () => {
    if (requestLock.current) return;
    requestLock.current = true;
    setChecking(true);
    setError('');
    setNotice('');
    setUpstream(null);
    const [published, latest] = await Promise.allSettled([
      fetchPublishedSnapshot(),
      fetchSteamInfo(),
    ]);
    if (!live.current) return;
    const version =
      latest.status === 'fulfilled' && latest.value && typeof latest.value === 'object'
        ? (latest.value as { client_version?: unknown }).client_version
        : undefined;
    const gameVersion = Number.isInteger(version) ? Number(version) : null;
    setUpstream(gameVersion);
    if (
      published.status !== 'fulfilled' ||
      !validateSnapshot(published.value) ||
      !isNewerOrEqual(published.value, current.current)
    ) {
      setError('Опубликованный снимок недоступен или устарел. Текущий снимок сохранён.');
    } else {
      const candidate = published.value;
      setHistoryEpoch((n) => n + 1);
      if (JSON.stringify(candidate) !== JSON.stringify(current.current)) {
        current.current = candidate;
        onSnapshot(candidate);
        setNotice('Опубликованный снимок загружен.');
      } else {
        setNotice('Опубликованный снимок уже актуален.');
      }
      if (latest.status !== 'fulfilled' || gameVersion === null)
        setNotice((value) => `${value} Версию игры проверить не удалось.`);
    }
    requestLock.current = false;
    setChecking(false);
  };

  const publicationUrl = state ? safePublicationUrl(state) : undefined;
  const historyVisible = mode === 'public' || historyStatus === 'ready';
  return {
    history,
    historyStatus,
    state,
    token,
    connected,
    connecting,
    publish,
    setPublish,
    requesting,
    checking,
    syncBusy,
    setSyncBusy,
    notice,
    error,
    upstream,
    connect,
    start,
    checkPublic,
    receiveSyncSnapshot,
    publicationUrl,
    historyVisible,
    retryHistory: () => setHistoryEpoch((n) => n + 1),
  };
}
