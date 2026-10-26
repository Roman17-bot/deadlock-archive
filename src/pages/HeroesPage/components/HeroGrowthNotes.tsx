import type { Hero, HeroStats } from '../../../../shared/types';
import { useI18n } from '../../../i18n';
import { format } from '../../../lib/format';
import { HeroNoteMetric } from './HeroNoteMetrics';

export function HeroGrowthNotes({ hero, stats }: { hero: Hero; stats: HeroStats }) {
  const { t } = useI18n();
  const pellets = !hero.weapon.hitOnce && hero.weapon.projectiles > 1;
  const spiritDamageGrowth = hero.growth.spirit * hero.scaling.bulletDamagePerSpirit;
  const hitGrowth = hero.growth.bulletDamage + spiritDamageGrowth;
  return (
    <section className="hero-notes-section">
      <h3>{t('Рост за уровень')}</h3>
      <p>
        {t(
          'Каждый уровень после первого увеличивает характеристики на указанные значения. Spirit — спиритическая мощь; у некоторых героев она дополнительно усиливает оружие или восстановление здоровья.',
        )}
      </p>
      <dl className="hero-notes-metrics">
        <HeroNoteMetric label={t('Урон за уровень')}>
          +{format(stats.damageGrowth, 5)} HP
        </HeroNoteMetric>
        <HeroNoteMetric label={t('Здоровье за уровень')}>
          +{format(stats.healthGrowth)} HP
        </HeroNoteMetric>
        <HeroNoteMetric label={t('Spirit за уровень')}>
          +{format(stats.spiritGrowth, 5)}
        </HeroNoteMetric>
        <HeroNoteMetric label={t('Восстановление за уровень')}>
          +{format(stats.regenGrowth, 5)} {t('HP/с')}
        </HeroNoteMetric>
      </dl>
      {hero.scaling.bulletDamagePerSpirit > 0 && (
        <>
          <p>
            {t(
              'Естественный прирост +{{spirit}} Spirit за уровень добавляет по {{scale}} урона за единицу мощи: ещё +{{extra}} к одному попаданию.',
              {
                spirit: format(hero.growth.spirit, 5),
                scale: format(hero.scaling.bulletDamagePerSpirit, 5),
                extra: format(spiritDamageGrowth, 5),
              },
            )}
          </p>
          <p>
            {t(
              'Прямой прирост +{{direct}} и прибавка от Spirit +{{extra}} дают +{{total}} к урону одного попадания за уровень.',
              {
                direct: format(hero.growth.bulletDamage, 5),
                extra: format(spiritDamageGrowth, 5),
                total: format(hitGrowth, 5),
              },
            )}
          </p>
        </>
      )}
      {pellets && (
        <p>
          {t(
            'Одна дробина получает +{{growth}} урона за уровень. При попадании всех {{count}} дробин прирост выстрела — +{{total}}.',
            {
              growth: format(hitGrowth, 5),
              count: format(hero.weapon.projectiles),
              total: format(stats.damageGrowth, 5),
            },
          )}
        </p>
      )}
      {hero.scaling.regenPerSpirit > 0 && (
        <p>
          {t(
            'Каждая единица Spirit добавляет {{scale}} HP/с к восстановлению. Естественный прирост +{{spirit}} мощи даёт ещё +{{extra}} HP/с за уровень; итоговый прирост — +{{total}} HP/с за уровень.',
            {
              scale: format(hero.scaling.regenPerSpirit, 5),
              spirit: format(hero.growth.spirit, 5),
              extra: format(hero.growth.spirit * hero.scaling.regenPerSpirit, 5),
              total: format(stats.regenGrowth, 5),
            },
          )}
        </p>
      )}
    </section>
  );
}
