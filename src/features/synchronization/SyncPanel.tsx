import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Database,
  RefreshCw,
  Upload,
} from '../../components/ui/ArchiveIcon/ArchiveIcons';
import { useI18n } from '../../i18n';
import { messageFor } from './model';
import { useSynchronization, type SyncPanelProps } from './useSynchronization';

export function SyncPanel(props: SyncPanelProps) {
  const { t } = useI18n();
  const { token, updateBusy } = props;
  const { state, busy, error, check, sync, success, url, retry } = useSynchronization(props);
  return (
    <section
      className="updates-panel updates-control sync-panel"
      aria-labelledby="sync-title"
      aria-busy={busy}
    >
      <div className="sync-heading">
        <div>
          <span className="updates-label">{t('ПУБЛИКАЦИЯ')}</span>
          <h2 id="sync-title">{t('Синхронизация с Pages')}</h2>
        </div>
        <Database className="sync-emblem" size={36} aria-hidden="true" />
      </div>
      <p>
        {t(
          'Отправь текущие данные из локальной базы на сайт. Это работает и для исправлений внутри одной версии игры.',
        )}
      </p>
      <div className="sync-route" aria-label={t('Источник и назначение')}>
        <span>PostgreSQL</span>
        <ArrowRight size={18} aria-hidden="true" />
        <span>GitHub Pages</span>
      </div>
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
                ? 'Сайт обновлён'
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
          <p>{t('Ожидаем обновление сайта.')}</p>
        )}
        {success && state?.upToDate && (
          <p>{t('На сайте уже те же данные. Повторная публикация не нужна.')}</p>
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
