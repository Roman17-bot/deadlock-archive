import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import type { HeroSnapshot } from '../../../shared/types';
import type { UpdateSession, UpdateState } from '../../../shared/update-types';
import { validateSnapshot } from '../../../shared/heroes';
import { asset } from '../../lib/format';
import '../../styles/updates.css';

const workflow =
  'https://github.com/Roman17-bot/deadlock-archive/actions/workflows/refresh-data.yml';
const localCenter = 'http://127.0.0.1:5173/#/updates';
const steamInfo = 'https://api.deadlock-api.com/v1/assets/steam-info';
const activePhases = new Set(['checking', 'saving', 'publishing']);
const maxPolls = 150;

async function readJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

function isState(value: unknown): value is UpdateState {
  if (!value || typeof value !== 'object') return false;
  const state = value as UpdateState;
  return (
    ['idle', 'checking', 'saving', 'publishing', 'succeeded', 'failed'].includes(state.phase) &&
    Number.isInteger(state.clientVersion) &&
    typeof state.localSaved === 'boolean' &&
    typeof state.changed === 'boolean' &&
    typeof state.message === 'string'
  );
}

function safePublicationUrl(state: UpdateState): string | undefined {
  const url = state.publication?.url;
  if (url === workflow) return url;
  if (
    state.publication?.runId &&
    url ===
      `https://github.com/Roman17-bot/deadlock-archive/actions/runs/${state.publication.runId}`
  )
    return url;
  return undefined;
}

function isNewerOrEqual(candidate: HeroSnapshot, current: HeroSnapshot): boolean {
  return (
    candidate.meta.clientVersion >= current.meta.clientVersion &&
    candidate.meta.sourceRevision >= current.meta.sourceRevision
  );
}

function modeForLocation(): 'local' | 'public' {
  const { hostname, port } = window.location;
  return (hostname === 'localhost' || hostname === '127.0.0.1') && port === '5173'
    ? 'local'
    : 'public';
}

interface UpdatePageProps {
  data: HeroSnapshot;
  onSnapshot: (data: HeroSnapshot) => void;
  mode?: 'local' | 'public';
}

export function UpdatePage({ data, onSnapshot, mode: modeOverride }: UpdatePageProps) {
  const mode = modeOverride ?? modeForLocation();
  const [state, setState] = useState<UpdateState | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [publish, setPublish] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [upstream, setUpstream] = useState<number | null>(null);
  const current = useRef(data);
  const live = useRef(true);
  const requestLock = useRef(false);
  const loadedJob = useRef<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const polls = useRef(0);

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
      if (!next.localSaved || activePhases.has(next.phase)) return;
      const key = next.jobId ?? next.updatedAt;
      if (loadedJob.current === key) return;
      loadedJob.current = key;
      try {
        const candidate = await readJson('/api/heroes', { cache: 'no-store' });
        if (!validateSnapshot(candidate) || !isNewerOrEqual(candidate, current.current))
          throw new Error('Invalid or older snapshot');
        if (live.current) {
          current.current = candidate;
          onSnapshot(candidate);
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

  const connect = useCallback(async () => {
    setConnecting(true);
    setError('');
    try {
      const value = (await readJson('/api/update/session', { cache: 'no-store' })) as UpdateSession;
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
        const value = await readJson('/api/update/status', { cache: 'no-store' });
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
    if (!token || !connected || requestLock.current || (state && activePhases.has(state.phase)))
      return;
    requestLock.current = true;
    setRequesting(true);
    setError('');
    setNotice('');
    polls.current = 0;
    try {
      const value = await readJson('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Archive-Token': token },
        body: JSON.stringify({ publish }),
      });
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
      readJson(asset('data/heroes.json'), { cache: 'no-store' }),
      readJson(steamInfo, { cache: 'no-store' }),
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
  return (
    <section className="updates-page" aria-labelledby="updates-title">
      <div className="updates-hero">
        <span className="updates-eyebrow">АРХИВ / ДАННЫЕ</span>
        <h1 id="updates-title">Центр обновлений</h1>
        <p>
          Проверяйте версию игры и состояние снимка героев. Изменения механик требуют отдельной
          сверки.
        </p>
      </div>
      <div className="updates-grid">
        <div className="updates-panel">
          <span className="updates-label">ТЕКУЩИЙ СНИМОК</span>
          <p className="updates-version">{data.meta.clientVersion}</p>
          <p>
            Ревизия {data.meta.sourceRevision} · {data.meta.heroCount} героев
          </p>
          <p>Проверен {data.meta.checkedAt.slice(0, 10)}</p>
        </div>
        {mode === 'local' ? (
          <div className="updates-panel updates-control">
            <span className="updates-label">ЛОКАЛЬНЫЙ ЦЕНТР</span>
            <h2>Проверить и сохранить</h2>
            <p>
              Новые данные сначала проходят проверку, затем сохраняются локально. Публикация
              запускается отдельной задачей GitHub Actions.
            </p>
            <label className="updates-option">
              <input
                type="checkbox"
                checked={publish}
                onChange={(event) => setPublish(event.target.checked)}
              />
              <span>Опубликовать после сохранения</span>
            </label>
            <button
              className="updates-button"
              type="button"
              disabled={
                !connected || connecting || requesting || !!(state && activePhases.has(state.phase))
              }
              onClick={() => void start()}
            >
              <RefreshCw size={18} />
              Обновить данные
            </button>
            {state && (
              <div className="updates-state" role="status" aria-live="polite">
                <strong>
                  {state.localSaved
                    ? 'Сохранено локально'
                    : state.phase === 'failed'
                      ? 'Обновление не удалось'
                      : activePhases.has(state.phase)
                        ? 'Обновление выполняется'
                        : 'Готово к проверке'}
                </strong>
                <p>{state.message}</p>
                {state.localSaved &&
                  (state.publication?.status === 'queued' ||
                    state.publication?.status === 'in_progress') && (
                    <p>Публикация в очереди. Развёртывание пока не подтверждено.</p>
                  )}
                {state.localSaved && state.phase === 'failed' && (
                  <>
                    <p>Публикация не отправлена</p>
                    <p>Локальный снимок сохранён.</p>
                  </>
                )}
                {publicationUrl && (
                  <a href={publicationUrl} target="_blank" rel="noopener noreferrer">
                    Открыть задачу GitHub <ArrowUpRight size={15} />
                  </a>
                )}
              </div>
            )}
            {error && (
              <p className="updates-error" role="alert">
                {error}
              </p>
            )}
            {(!connected || (!!error && !!state && activePhases.has(state.phase))) && (
              <button
                className="updates-secondary"
                type="button"
                disabled={connecting}
                onClick={() => void connect()}
              >
                Повторить подключение
              </button>
            )}
          </div>
        ) : (
          <div className="updates-panel updates-control">
            <span className="updates-label">ОПУБЛИКОВАННЫЕ ДАННЫЕ</span>
            <h2>Проверить снимок</h2>
            <p>Загрузим актуальный опубликованный снимок и сравним его с доступной версией игры.</p>
            <button
              className="updates-button"
              type="button"
              disabled={checking}
              onClick={() => void checkPublic()}
            >
              <RefreshCw size={18} />
              Проверить обновления
            </button>
            {notice && (
              <p className="updates-notice" role="status" aria-live="polite">
                {notice}
              </p>
            )}
            {error && (
              <p className="updates-error" role="alert">
                {error}
              </p>
            )}
            {upstream !== null && upstream > data.meta.clientVersion && (
              <p className="updates-pending">
                Клиент {upstream} уже доступен, но снимок для этой версии ещё не опубликован.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="updates-links">
        <a href={workflow} target="_blank" rel="noopener noreferrer">
          GitHub Actions <ArrowUpRight size={16} />
        </a>
        {mode === 'public' && (
          <a href={localCenter} target="_blank" rel="noopener noreferrer">
            Открыть локальный центр <ArrowUpRight size={16} />
          </a>
        )}
      </div>
    </section>
  );
}
