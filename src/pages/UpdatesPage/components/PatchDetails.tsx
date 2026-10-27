import type { VersionPatch } from '../../../../shared/version-history';
import { useI18n } from '../../../i18n';

export function PatchDetails({ patch }: { patch?: VersionPatch }) {
  const { t, language } = useI18n();
  if (!patch)
    return (
      <p className="history-patch history-note">{t('Описание обновления пока недоступно.')}</p>
    );
  return (
    <section className="history-patch" aria-label={t('Описание обновления')}>
      <div className="history-patch-meta">
        <span>{patch.source === 'steamdb' ? 'SteamDB' : 'GameTracking'}</span>
        {patch.steamBuildId && (
          <span>{t('Сборка Steam {{build}}', { build: patch.steamBuildId })}</span>
        )}
        {patch.notes === 'published' && (
          <span className="history-patch-badge">{t('Есть патчноут')}</span>
        )}
      </div>
      {patch.title && <p className="history-patch-title">{patch.title}</p>}
      {patch.summary ? (
        <p>{patch.summary[language]}</p>
      ) : (
        <p>
          {t(
            patch.notes === 'unpublished'
              ? 'Описание обновления не опубликовано. Список изменений доступен в SteamDB.'
              : patch.source === 'steamdb'
                ? 'Нажми на версию, чтобы посмотреть изменения в SteamDB.'
                : 'Нажми на версию, чтобы посмотреть изменения игровых файлов.',
          )}
        </p>
      )}
    </section>
  );
}
