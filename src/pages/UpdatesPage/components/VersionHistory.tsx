import { ArrowUpRight, RefreshCw } from 'lucide-react';
import type { HeroSnapshot } from '../../../../shared/types';
import type { VersionHistory as HistoryData } from '../../../../shared/version-history';
import { formatDate } from '../../../lib/format';
import { useI18n } from '../../../i18n';
import { PatchDetails } from './PatchDetails';

interface Props {
  data: HeroSnapshot;
  mode: 'local' | 'public';
  history: HistoryData;
  historyStatus: 'loading' | 'ready' | 'failed';
  historyVisible: boolean;
  retryHistory: () => void;
}

export function VersionHistory({
  data,
  mode,
  history,
  historyStatus,
  historyVisible,
  retryHistory,
}: Props) {
  const { t } = useI18n();
  return (
    <section className="version-history" aria-labelledby="version-history-title">
      <div className="version-history-heading">
        <span className="updates-label">{t('ЖУРНАЛ АРХИВА')}</span>
        <h2 id="version-history-title">{t('История версий')}</h2>
        <p>{t('Версии игры, даты выхода и изменения в каждом обновлении.')}</p>
      </div>
      {mode === 'local' && historyStatus === 'loading' && (
        <p className="history-note">{t('Загружаем историю версий…')}</p>
      )}
      {mode === 'local' && historyStatus === 'failed' && (
        <div>
          <p className="updates-error" role="alert">
            {t('Не удалось загрузить историю версий.')}
          </p>
          <button className="updates-button" type="button" onClick={retryHistory}>
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
                  {entry.patch ? (
                    <a
                      className="history-version-link"
                      href={entry.patch.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t('Версия {{version}} — открыть изменения', {
                        version: entry.clientVersion,
                      })}
                    >
                      <strong>{entry.clientVersion}</strong>
                      <ArrowUpRight size={20} aria-hidden="true" />
                    </a>
                  ) : (
                    <strong>{entry.clientVersion}</strong>
                  )}
                  {entry.clientVersion === data.meta.clientVersion && (
                    <span className="version-current">{t('Текущая')}</span>
                  )}
                </div>
                <dl>
                  <div>
                    <dt>{t('Дата выхода')}</dt>
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
                <PatchDetails patch={entry.patch} />
              </li>
            ))}
        </ol>
      )}
      {historyVisible && history.versions.length === 1 && (
        <p className="history-note">
          {t('Новые версии будут появляться здесь после обновления данных.')}
        </p>
      )}
      {historyVisible &&
        !history.versions.some((entry) => entry.clientVersion === data.meta.clientVersion) && (
          <p className="updates-pending">
            {t('Запись текущей версии ещё не загружена. Показана последняя доступная история.')}
          </p>
        )}
    </section>
  );
}
