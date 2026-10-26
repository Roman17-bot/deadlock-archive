import { useI18n } from '../../../i18n';
import type { HeroRegisterState } from '../hooks/useHeroRegister';

type Props = Pick<HeroRegisterState, 'statView' | 'changeStatView'>;

export function MobileTableTools({ statView, changeStatView }: Props) {
  const { t } = useI18n();
  return (
    <div className="mobile-table-tools">
      <div className="stat-view-switch" role="group" aria-label={t('Показатели таблицы')}>
        <button aria-pressed={statView === 'stats'} onClick={() => changeStatView('stats')}>
          {t('Характеристики')}
        </button>
        <button aria-pressed={statView === 'growth'} onClick={() => changeStatView('growth')}>
          {t('Приросты за LVL')}
        </button>
      </div>
      <p>{t('Нажми на героя, чтобы открыть подробности.')}</p>
    </div>
  );
}
