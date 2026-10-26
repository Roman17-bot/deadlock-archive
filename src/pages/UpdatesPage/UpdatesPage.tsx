import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { formatDate } from '../../lib/format';
import { useI18n, translateError } from '../../i18n';
import { siteMode } from '../../services/environment';
import { SyncPanel } from '../../features/synchronization/SyncPanel';
import { activePhases, localCenter, workflow } from './model';
import { VersionHistory } from './components/VersionHistory';
import { useUpdatesPage, type UpdatesPageProps } from './hooks/useUpdatesPage';

export function UpdatesPage({ data, onSnapshot, mode: modeOverride }: UpdatesPageProps) {
  const { t } = useI18n();
  const mode = modeOverride ?? siteMode();
  const {
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
    retryHistory,
  } = useUpdatesPage({ data, onSnapshot, mode });
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
                'Новые данные сначала проходят проверку, затем сохраняются локально. При публикации Pages получает точный снимок PostgreSQL.',
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
                !connected ||
                connecting ||
                requesting ||
                syncBusy ||
                !!(state && activePhases.has(state.phase))
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
                    <p>{t('Публикация не подтверждена')}</p>
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
      {mode === 'local' && (
        <SyncPanel
          token={token}
          updateBusy={requesting || !!(state && activePhases.has(state.phase))}
          onBusyChange={setSyncBusy}
          onLocalSnapshot={receiveSyncSnapshot}
        />
      )}
      <VersionHistory {...{ data, mode, history, historyStatus, historyVisible, retryHistory }} />
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
