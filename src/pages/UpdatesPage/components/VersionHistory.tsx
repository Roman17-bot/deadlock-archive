import { RefreshCw } from '../../../components/ui/ArchiveIcon/ArchiveIcons';
import type { HeroSnapshot } from '../../../../shared/types';
import type { VersionHistory as HistoryData } from '../../../../shared/version-history';
import { useI18n } from '../../../i18n';
import { PatchDetails } from './PatchDetails';
import { usePatchEntities } from '../hooks/usePatchEntities';

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
  const { lookup, requestItems } = usePatchEntities(data.heroes);
  const patches = [...(history.patches ?? [])]
    .filter((patch) => patch.body.en.trim())
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id.localeCompare(a.id));
  return (
    <section className="version-history" aria-labelledby="version-history-title">
      <div className="version-history-heading">
        <span className="updates-label">{t('ЖУРНАЛ ОБНОВЛЕНИЙ')}</span>
        <h2 id="version-history-title">{t('История обновлений')}</h2>
        <p>
          {t(
            'Изменения героев, предметов и правил игры. Открой обновление, чтобы прочитать подробности.',
          )}
        </p>
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
      {historyVisible && patches.length > 0 && (
        <ol className="version-history-list">
          {patches.map((patch) => (
            <li key={patch.id}>
              <PatchDetails
                patch={patch}
                current={patch.clientVersion === data.meta.clientVersion}
                lookup={lookup}
                requestItems={requestItems}
              />
            </li>
          ))}
        </ol>
      )}
      {historyVisible && patches.length === 0 && (
        <p className="history-note">
          {t('Описания обновлений появятся здесь после следующей проверки.')}
        </p>
      )}
    </section>
  );
}
