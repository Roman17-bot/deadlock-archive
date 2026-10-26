import { ArrowUpRight, Crosshair } from 'lucide-react';
import type { HeroSnapshot } from '../../../../shared/types';
import { useI18n } from '../../../i18n';

export function ArchiveStrip({ data, onMethod }: { data: HeroSnapshot; onMethod: () => void }) {
  const { t } = useI18n();
  return (
    <section className="archive-strip" aria-label={t('О справочнике')}>
      <div>
        <strong>{data.heroes.length}</strong>
        <span>{t('ДОСТУПНЫХ ГЕРОЯ')}</span>
      </div>
      <div>
        <strong>1—36</strong>
        <span>{t('УРОВНИ ДЛЯ СРАВНЕНИЯ')}</span>
      </div>
      <div>
        <Crosshair size={26} />
        <span>{t('БЕЗ ПРЕДМЕТОВ И БАФФОВ')}</span>
      </div>
      <button onClick={onMethod}>
        <span>{t('КАК УСТРОЕНЫ ДАННЫЕ')}</span>
        <ArrowUpRight size={23} />
      </button>
    </section>
  );
}
