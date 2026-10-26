import type { HeroSnapshot } from '../../../shared/types';
import { useI18n } from '../../i18n';
import { useHeroRegister } from './hooks/useHeroRegister';
import { RegisterHeading } from './components/RegisterHeading';
import { RegisterToolbar } from './components/RegisterToolbar';
import { LevelToolbar } from './components/LevelToolbar';
import { MobileTableTools } from './components/MobileTableTools';
import { HeroTable } from './components/HeroTable';
import { RegisterNotes } from './components/RegisterNotes';

export function HeroesPage({ data, onMethod }: { data: HeroSnapshot; onMethod: () => void }) {
  const { t } = useI18n();
  const register = useHeroRegister(data);
  return (
    <div className="register-page">
      <RegisterHeading data={data} />
      <section className="register-workspace" aria-label={t('Параметры сравнения')}>
        <RegisterToolbar
          query={register.query}
          setQuery={register.setQuery}
          exportCsv={register.exportCsv}
          selected={register.selected}
        />
        <LevelToolbar level={register.level} setLevel={register.setLevel} reset={register.reset} />
      </section>
      {register.isMobile && (
        <MobileTableTools statView={register.statView} changeStatView={register.changeStatView} />
      )}
      <HeroTable data={data} onMethod={onMethod} {...register} />
      <RegisterNotes data={data} onMethod={onMethod} />
    </div>
  );
}
