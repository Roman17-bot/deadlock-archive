import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import type { HeroSnapshot } from '../../../shared/types';
import type { UpdateSession, UpdateState } from '../../../shared/update-types';
import { validateSnapshot } from '../../../shared/heroes';
import { asset, formatDate } from '../../lib/format';
import { useI18n, translateError } from '../../i18n';
import initialHistory from '../../../data/version-history.json';
import { validateVersionHistory, type VersionHistory } from '../../../shared/version-history';
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
  const { t } = useI18n();
  const mode = modeOverride ?? modeForLocation();
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
    const controller = new AbortController();
    if (mode === 'local') setHistoryStatus('loading');
    void readJson(mode === 'local' ? '/api/version-history' : asset('data/version-history.json'), {
      cache: 'no-store',
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
    })
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
        const candidate = await readJson('/api/heroes', { cache: 'no-store' });
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
  return (
    <section className="updates-page" aria-labelledby="updates-title">
      <div className="updates-hero">
        <span className="updates-eyebrow">{t('АРХИВ / ДАННЫЕ')}</span>
        <h1 id="updates-title">{t('Центр обновлений')}</h1>
        <p>
          {t(
            'Проверяйте версию игры и состояние снимка героев. Изменения механик требуют отдельной сверки.',
          )}
        </p>
      </div>
      <div className="updates-grid">
        <div className="updates-panel">
          <span className="updates-label">{t('ТЕКУЩИЙ СНИМОК')}</span>
          <p className="updates-version">{data.meta.clientVersion}</p>
          <p>
            {t('Ревизия {{revision}} · {{count}} героев', {
              revision: data.meta.sourceRevision,
              count: data.meta.heroCount,
            })}
          </p>
          <p>{t('Проверен {{date}}', { date: formatDate(data.meta.checkedAt) })}</p>
        </div>
        {mode === 'local' ? (
          <div className="updates-panel updates-control">
            <span className="updates-label">{t('ЛОКАЛЬНЫЙ ЦЕНТР')}</span>
            <h2>{t('Проверить и сохранить')}</h2>
            <p>
              {t(
                'Новые данные сначала проходят проверку, затем сохраняются локально. Публикация запускается отдельной задачей GitHub Actions.',
              )}
            </p>
            <label className="updates-option">
              <input
                type="checkbox"
                checked={publish}
                onChange={(event) => setPublish(event.target.checked)}
              />
              <span>{t('Опубликовать после сохранения')}</span>
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
              {t('Обновить данные')}
            </button>
            {state && (
              <div className="updates-state" role="status" aria-live="polite">
                <strong>
                  {t(
                    state.databaseSaved === false
                      ? 'JSON сохранён, БД не обновлена'
                      : state.upToDate
                        ? 'Текущая версия актуальна'
                        : state.localSaved
                          ? 'Сохранено локально'
                          : state.phase === 'failed'
                            ? 'Обновление не удалось'
                            : activePhases.has(state.phase)
                              ? 'Обновление выполняется'
                              : 'Готово к проверке',
                  )}
                </strong>
                <p>{translateError(state.message)}</p>
                {state.databaseSaved === true && <p>{t('Данные сохранены в PostgreSQL.')}</p>}
                {state.localSaved &&
                  (state.publication?.status === 'queued' ||
                    state.publication?.status === 'in_progress') && (
                    <p>{t('Публикация в очереди. Развёртывание пока не подтверждено.')}</p>
                  )}
                {state.localSaved && state.phase === 'failed' && (
                  <>
                    <p>{t('Публикация не отправлена')}</p>
                    <p>{t('Локальный снимок сохранён.')}</p>
                  </>
                )}
                {publicationUrl && (
                  <a href={publicationUrl} target="_blank" rel="noopener noreferrer">
                    {t('Открыть задачу GitHub')} <ArrowUpRight size={15} />
                  </a>
                )}
              </div>
            )}
            {error && (
              <p className="updates-error" role="alert">
                {t(error)}
              </p>
            )}
            {(!connected || (!!error && !!state && activePhases.has(state.phase))) && (
              <button
                className="updates-secondary"
                type="button"
                disabled={connecting}
                onClick={() => void connect()}
              >
                {t('Повторить подключение')}
              </button>
            )}
          </div>
        ) : (
          <div className="updates-panel updates-control">
            <span className="updates-label">{t('ОПУБЛИКОВАННЫЕ ДАННЫЕ')}</span>
            <h2>{t('Проверить снимок')}</h2>
            <p>
              {t(
                'Загрузим актуальный опубликованный снимок и сравним его с доступной версией игры.',
              )}
            </p>
            <button
              className="updates-button"
              type="button"
              disabled={checking}
              onClick={() => void checkPublic()}
            >
              <RefreshCw size={18} />
              {t('Проверить обновления')}
            </button>
            {notice && (
              <p className="updates-notice" role="status" aria-live="polite">
                {notice.split(' Версию игры проверить не удалось.').map((part, index) => (
                  <span key={index}>
                    {index > 0 && <> {t('Версию игры проверить не удалось.')}</>}
                    {part && t(part)}
                  </span>
                ))}
              </p>
            )}
            {error && (
              <p className="updates-error" role="alert">
                {t(error)}
              </p>
            )}
            {upstream !== null && upstream > data.meta.clientVersion && (
              <p className="updates-pending">
                {t(
                  'Клиент {{version}} уже доступен, но снимок для этой версии ещё не опубликован.',
                  { version: upstream },
                )}
              </p>
            )}
          </div>
        )}
      </div>
      <section className="version-history" aria-labelledby="version-history-title">
        <div className="version-history-heading">
          <span className="updates-label">{t('ЖУРНАЛ АРХИВА')}</span>
          <h2 id="version-history-title">{t('История версий')}</h2>
          <p>
            {t(
              'Версии клиента, которые появлялись в нашем архиве. Дата сборки клиента и дата появления в архиве указаны отдельно.',
            )}
          </p>
        </div>
        {mode === 'local' && historyStatus === 'loading' && (
          <p className="history-note">{t('Загружаем историю из локального API…')}</p>
        )}
        {mode === 'local' && historyStatus === 'failed' && (
          <div>
            <p className="updates-error" role="alert">
              {t('Не удалось загрузить историю из локального API.')}
            </p>
            <button
              className="updates-button"
              type="button"
              onClick={() => setHistoryEpoch((n) => n + 1)}
            >
              <RefreshCw size={18} />
              {t('Повторить загрузку истории')}
            </button>
          </div>
        )}
        {historyVisible && (
          <ol className="version-history-list">
            {[...history.versions]
              .sort((a, b) => b.clientVersion - a.clientVersion)
              .map((entry) => (
                <li
                  key={entry.clientVersion}
                  className={entry.clientVersion === data.meta.clientVersion ? 'is-current' : ''}
                >
                  <div>
                    <span className="version-history-dot" aria-hidden="true" />
                    <strong>{entry.clientVersion}</strong>
                    {entry.clientVersion === data.meta.clientVersion && (
                      <span className="version-current">{t('Текущая')}</span>
                    )}
                  </div>
                  <dl>
                    <div>
                      <dt>{t('Сборка клиента')}</dt>
                      <dd>
                        <time dateTime={entry.buildDate}>{formatDate(entry.buildDate)}</time>
                      </dd>
                    </div>
                    <div>
                      <dt>{t('В архиве с')}</dt>
                      <dd>
                        <time dateTime={entry.firstPublishedAt}>
                          {formatDate(entry.firstPublishedAt)}
                        </time>
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
          </ol>
        )}
        {historyVisible && history.versions.length === 1 && (
          <p className="history-note">
            {t(
              'Это первая версия клиента, опубликованная в архиве. Новые версии будут добавляться сюда при обновлении данных.',
            )}
          </p>
        )}
        {historyVisible &&
          !history.versions.some((entry) => entry.clientVersion === data.meta.clientVersion) && (
            <p className="updates-pending">
              {t('Запись текущей версии ещё не загружена. Показана последняя доступная история.')}
            </p>
          )}
      </section>
      <div className="updates-links">
        <a href={workflow} target="_blank" rel="noopener noreferrer">
          GitHub Actions <ArrowUpRight size={16} />
        </a>
        {mode === 'public' && (
          <a href={localCenter} target="_blank" rel="noopener noreferrer">
            {t('Открыть локальный центр')} <ArrowUpRight size={16} />
          </a>
        )}
      </div>
    </section>
  );
}
