import { ArrowUpRight, RefreshCw } from '../../components/ui/ArchiveIcon/ArchiveIcons';
import { formatDate } from '../../lib/format';
import { useI18n, translateError } from '../../i18n';
import { siteMode } from '../../services/environment';
import { SyncPanel } from '../../features/synchronization/SyncPanel';
import { activePhases, workflow } from './model';
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
        <p>{t('Проверь наличие обновлений и посмотри, что изменилось в новых версиях игры.')}</p>
      </div>
      <div className="updates-grid">
        <div className="updates-panel">
          <span className="updates-label">{t('ТЕКУЩАЯ ВЕРСИЯ')}</span>
          <p className="updates-version">{data.meta.clientVersion}</p>
          <p>
            {t('{{count}} героев', {
              count: data.meta.heroCount,
            })}
          </p>
          <p>{t('Данные от {{date}}', { date: formatDate(data.meta.checkedAt) })}</p>
        </div>
        {mode === 'local' ? (
          <div className="updates-panel updates-control">
            <span className="updates-label">{t('ЛОКАЛЬНЫЙ ЦЕНТР')}</span>
            <h2>{t('Проверить и сохранить')}</h2>
            <p>
              {t(
                'Обнови характеристики героев после патча. Можно сразу отправить изменения на сайт для друзей.',
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
                      ? 'Не удалось сохранить в базу данных'
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
                    <p>{t('Изменения отправлены. Ожидаем обновление сайта.')}</p>
                  )}
                {state.localSaved && state.phase === 'failed' && (
                  <>
                    <p>{t('Сайт пока не обновлён')}</p>
                    <p>{t('Локальные данные сохранены.')}</p>
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
            <h2>{t('Проверить обновления')}</h2>
            <p>{t('Проверь, есть ли новая версия данных для этого сайта.')}</p>
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
                {t('Вышла версия игры {{version}}. Данные для неё ещё не опубликованы.', {
                  version: upstream,
                })}
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
      {mode === 'local' && (
        <div className="updates-links">
          <a href={workflow} target="_blank" rel="noopener noreferrer">
            GitHub Actions <ArrowUpRight size={16} />
          </a>
        </div>
      )}
    </section>
  );
}
