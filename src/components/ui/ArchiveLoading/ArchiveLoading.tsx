import { useI18n } from '../../../i18n';

export function ArchiveLoading() {
  const { t } = useI18n();
  return (
    <section className="load-state" aria-busy="true">
      <span className="loader" />
      <p>{t('Загружаем данные…')}</p>
    </section>
  );
}
