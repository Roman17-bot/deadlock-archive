import { ArrowUpRight } from '../../../components/ui/ArchiveIcon/ArchiveIcons';
import { useI18n } from '../../../i18n';

export function ArchiveNote({ onMethod }: { onMethod: () => void }) {
  const { t } = useI18n();
  return (
    <section className="archive-note">
      <span className="note-mark">✦</span>
      <div>
        <h2>{t('Сравнивай героев на одном уровне.')}</h2>
        <p>
          {t(
            'Выбери уровень в таблице, чтобы увидеть, как меняются урон, здоровье и Spirit. В подробностях героя разобраны его оружие и приросты.',
          )}
        </p>
      </div>
      <button className="button button-outline" onClick={onMethod}>
        {t('Как считаем')}
        <ArrowUpRight size={17} />
      </button>
    </section>
  );
}
