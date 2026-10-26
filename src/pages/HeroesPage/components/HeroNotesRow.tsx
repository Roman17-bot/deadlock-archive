import type { Hero, HeroStats } from '../../../../shared/types';
import { statsAtLevel } from '../../../../shared/heroes';
import { format } from '../../../lib/format';
import { useI18n } from '../../../i18n';
import { weaponNotes } from '../model/weaponNotes';
import { HeroNoteMetric } from './HeroNoteMetrics';
import { HeroGrowthNotes } from './HeroGrowthNotes';
import { HeroSourceNotes } from './HeroSourceNotes';

export function HeroNotesRow({
  hero,
  stats,
  level,
  columnCount,
}: {
  hero: Hero;
  stats: HeroStats;
  level: number;
  columnCount: number;
}) {
  const { t } = useI18n();
  const context = weaponNotes(hero);
  const pellets = hero.weapon.projectiles > 1 && !hero.weapon.hitOnce;
  const rateBonus = stats.spirit * hero.scaling.fireRatePercentPerSpirit;
  const fullSpinDps =
    hero.weapon.spinsUp && hero.weapon.fullSpinCycle !== null
      ? statsAtLevel(
          {
            ...hero,
            weapon: { ...hero.weapon, shotsPerSecond: 1 / hero.weapon.fullSpinCycle },
          },
          level,
        ).dps
      : null;
  const title = t('{{hero}} / параметры оружия', { hero: hero.name });
  return (
    <tr className="details-row">
      <td colSpan={columnCount}>
        <div className="hero-notes" role="region" aria-label={title}>
          <header className="hero-notes-heading">
            <h2>{title}</h2>
            <span>{t('Уровень {{level}}', { level: format(level) })}</span>
          </header>
          <section className="hero-notes-section">
            <h3>{t('Урон и магазин')}</h3>
            <dl className="hero-notes-metrics">
              <HeroNoteMetric label={t(context.tether ? 'Урон одного тика' : 'Урон выстрела')}>
                {format(stats.shotDamage, 4)} HP
              </HeroNoteMetric>
              {pellets && (
                <>
                  <HeroNoteMetric label={t('Дробин в выстреле')}>
                    {format(hero.weapon.projectiles)}
                  </HeroNoteMetric>
                  <HeroNoteMetric label={t('Урон одной дробины')}>
                    {format(stats.bulletDamage, 4)} HP
                  </HeroNoteMetric>
                </>
              )}
              {hero.weapon.burst > 1 && (
                <>
                  <HeroNoteMetric label={t('Выстрелов в очереди')}>
                    {format(hero.weapon.burst)}
                  </HeroNoteMetric>
                  <HeroNoteMetric label={t('Урон полной очереди')}>
                    {format(stats.shotDamage * hero.weapon.burst, 4)} HP
                  </HeroNoteMetric>
                </>
              )}
              <HeroNoteMetric label={t('Магазин')}>
                {format(hero.weapon.clipSize)} {t('ед.')}
              </HeroNoteMetric>
            </dl>
            {pellets && (
              <p>
                {t(
                  'Все {{count}} дробин должны попасть в одну цель: {{count}} × {{damage}} = {{total}} урона за выстрел.',
                  {
                    count: format(hero.weapon.projectiles),
                    damage: format(stats.bulletDamage, 4),
                    total: format(stats.shotDamage, 4),
                  },
                )}
              </p>
            )}
            {hero.weapon.hitOnce && (
              <>
                <p>
                  {t(
                    'В таблице один выстрел наносит цели {{damage}} урона. Несколько снарядов одного выстрела не складывают урон по этой же цели.',
                    { damage: format(stats.shotDamage, 4) },
                  )}
                </p>
              </>
            )}
            {hero.weapon.burst > 1 && (
              <p>
                {t(
                  'Один выстрел — часть очереди, а не урон всей очереди. Показаны обычные попадания всех выстрелов по одной цели.',
                )}
              </p>
            )}
            {context.tether && (
              <p>
                {t(
                  'Отдельная порция урона от связи с целью — тик; в таблице он считается выстрелом. Учтена одна цель, без отскоков и других целей.',
                )}
              </p>
            )}
            {context.explanations.map((text) => (
              <p key={text}>{t(text)}</p>
            ))}
          </section>
          <section className="hero-notes-section">
            <h3>{t('Скорость и DPS')}</h3>
            <dl className="hero-notes-metrics">
              <HeroNoteMetric label={t('Расчётный DPS')}>
                {format(stats.dps)} {t('HP/с')}
              </HeroNoteMetric>
              {stats.shotDamage > 0 && (
                <HeroNoteMetric
                  label={t(context.tether ? 'Тиков в секунду' : 'Выстрелов в секунду')}
                >
                  {format(stats.dps / stats.shotDamage, 4)}
                </HeroNoteMetric>
              )}
              {fullSpinDps !== null && (
                <HeroNoteMetric label={t('DPS при полной раскрутке')}>
                  {format(fullSpinDps)} {t('HP/с')}
                </HeroNoteMetric>
              )}
            </dl>
            <p>
              {t(
                'DPS — урон за секунду непрерывной стрельбы без перезарядки. Предметы, активные способности, особые режимы, попадания в голову, сопротивления и снижение урона от дистанции не учтены.',
              )}
            </p>
            {hero.weapon.burst > 1 && (
              <p>
                {t(
                  'Скорость учитывает паузы между выстрелами внутри очереди и между очередями; урон одного выстрела умножается на среднее число выстрелов в секунду.',
                )}
              </p>
            )}
            {context.beamWindup !== null && (
              <p>
                {t(
                  'Оружие наносит урон лучом: перед началом есть задержка {{delay}} с. Показанный DPS описывает стрельбу после неё.',
                  { delay: format(context.beamWindup) },
                )}
              </p>
            )}
            {hero.weapon.spinsUp && (
              <p>
                {t(
                  'Основной DPS и таблица показывают начало стрельбы. Полная раскрутка ускоряет огонь; время на раскрутку в её DPS не включено.',
                )}
              </p>
            )}
            {hero.scaling.fireRatePercentPerSpirit > 0 && (
              <p>
                {t(
                  'Каждая единица Spirit добавляет {{scale}}% к скорострельности. На выбранном уровне естественная мощь даёт +{{bonus}}%; этот бонус уже включён в DPS один раз.',
                  {
                    scale: format(hero.scaling.fireRatePercentPerSpirit, 5),
                    bonus: format(rateBonus, 5),
                  },
                )}
              </p>
            )}
          </section>
          <HeroGrowthNotes hero={hero} stats={stats} />
          <HeroSourceNotes hero={hero} />
        </div>
      </td>
    </tr>
  );
}
