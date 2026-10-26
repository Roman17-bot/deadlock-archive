import { ArrowUpRight } from 'lucide-react';
import { formatDate } from '../../../lib/format';
import type { HeroSnapshot } from '../../../../shared/types';
import { useI18n } from '../../../i18n';

export function ArchiveNote({ data, onMethod }: { data: HeroSnapshot; onMethod: () => void }) {
  const { t } = useI18n();
  return (
    <section className="archive-note">
      <span className="note-mark">✦</span>
      <div>
        <h2>{t('Цифры меняются. Источники остаются.')}</h2>
        <p>
          {t(
            'Это снимок игры на {{date}}. У каждого значения есть версия клиента, а у расчётных показателей — своя формула.',
            { date: formatDate(data.meta.snapshotDate) },
          )}
        </p>
      </div>
      <button className="button button-outline" onClick={onMethod}>
        {t('Открыть методику')}
        <ArrowUpRight size={17} />
      </button>
    </section>
  );
}
