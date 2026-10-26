import type { VersionPatch } from '../../../../shared/version-history';
import { useI18n } from '../../../i18n';

export function PatchDetails({ patch }: { patch?: VersionPatch }) {
  const { t, language } = useI18n();
  if (!patch)
    return (
      <p className="history-patch history-note">
        {t('Описание патча ещё не привязано к этой версии.')}
      </p>
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
              ? 'Официальный патчноут для этой сборки не опубликован. В SteamDB доступен список изменённых файлов.'
              : patch.source === 'steamdb'
                ? 'Открой версию, чтобы прочитать патчноут в SteamDB. Если Valve не публиковала описание, там будет список изменённых файлов.'
                : 'Открой версию, чтобы посмотреть изменения игровых файлов. Официальное описание к этой записи не привязано.',
          )}
        </p>
      )}
    </section>
  );
}
