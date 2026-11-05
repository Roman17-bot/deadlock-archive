import type { Hero, HeroSnapshot } from '../../../shared/types';
import { statsAtLevel } from '../../../shared/heroes';
import { calculateBuild } from '../../../shared/build-stats';
import { meleeDamageAtLevel } from '../../../shared/ability-build';
import { weaponNotes } from '../../features/heroes/weaponNotes';
import { useI18n } from '../../i18n';
import { format } from '../../lib/format';
import { DossierStatPlate } from './HeroDossierArt';

type StatRow = readonly [label: string, value: string | number];

function Rows({ rows }: { rows: readonly StatRow[] }) {
  return rows.map(([label, value]) => (
    <div key={label}>
      <dt>{label}</dt>
      <dd>{typeof value === 'number' ? format(value, 3) : value}</dd>
    </div>
  ));
}

export function DossierStats({
  hero,
  data,
  level,
  onLevel,
  en,
  onDemo,
}: {
  hero: Hero;
  data: HeroSnapshot;
  level: number;
  onLevel: (level: number) => void;
  en: boolean;
  onDemo: () => void;
}) {
  const { t } = useI18n();
  const natural = statsAtLevel(hero, level);
  const build =
    data.calculatorRules && hero.calculation
      ? calculateBuild(hero, level, [], data.calculatorRules).stats
      : undefined;
  const melee = meleeDamageAtLevel(hero, level, natural.spirit);
  const weapon = weaponNotes(hero);
  const pellets = hero.weapon.projectiles > 1 && !hero.weapon.hitOnce;
  const shotLabel = weapon.tether
    ? en
      ? 'Damage per tick'
      : 'Урон за тик'
    : en
      ? 'Damage per shot'
      : 'Урон выстрела';
  const rateLabel = weapon.tether
    ? en
      ? 'Ticks per second'
      : 'Тиков в секунду'
    : en
      ? 'Shots per second'
      : 'Выстрелов в секунду';
  const reloadLabel = weapon.singleRoundReload
    ? en
      ? 'Reload per round'
      : 'Зарядка одного патрона'
    : en
      ? 'Reload'
      : 'Перезарядка';
  const percent = (value: number) => `${format(value, 2)}%`;
  const bonus = (value: number) => `${value > 0 ? '+' : ''}${format(value, 4)}`;
  const seconds = en ? 's' : 'с';
  const speed = en ? 'm/s' : 'м/с';
  return (
    <section className="dossier-section" aria-labelledby="dossier-stats-title">
      <h2 id="dossier-stats-title">{en ? 'Characteristics' : 'Характеристики'}</h2>
      <div className="dossier-stat-toolbar">
        <label className="dossier-level-rail">
          <span>{en ? 'Level' : 'Уровень'}</span>
          <input
            type="range"
            min={data.meta.levelRange[0]}
            max={data.meta.levelRange[1]}
            value={level}
            onChange={(event) => onLevel(Number(event.target.value))}
          />
          <output>{level}</output>
        </label>
        <button
          className="hero-demo-button"
          type="button"
          onClick={(event) => {
            event.currentTarget.focus();
            onDemo();
          }}
        >
          <span aria-hidden="true">▷</span>{' '}
          {en ? 'Watch primary attack' : 'Посмотреть обычную атаку'}
        </button>
      </div>
      <div className="dossier-stat-grid">
        <DossierStatPlate
          kind="weapon"
          title={en ? 'Weapon' : 'Оружие'}
          notes={weapon.explanations.map((note) => t(note))}
        >
          <Rows
            rows={[
              [shotLabel, natural.shotDamage],
              [en ? 'Damage per second' : 'Урон в секунду', natural.dps],
              [rateLabel, natural.shotDamage > 0 ? natural.dps / natural.shotDamage : 0],
              [en ? 'Magazine' : 'Магазин', build?.clipSize ?? hero.weapon.clipSize],
              [reloadLabel, `${format(hero.weapon.reloadSeconds, 3)} ${seconds}`],
            ]}
          />
          {pellets && (
            <Rows
              rows={[
                [
                  en ? 'Pellets × damage' : 'Дробины × урон',
                  `${hero.weapon.projectiles} × ${format(natural.bulletDamage, 3)}`,
                ],
              ]}
            />
          )}
          {hero.weapon.burst > 1 && (
            <Rows rows={[[en ? 'Shots per burst' : 'Выстрелов в очереди', hero.weapon.burst]]} />
          )}
          {weapon.beamWindup !== null && (
            <Rows
              rows={[
                [
                  en ? 'Beam wind-up' : 'Задержка луча',
                  `${format(weapon.beamWindup, 3)} ${seconds}`,
                ],
              ]}
            />
          )}
          {melee && (
            <Rows
              rows={[
                [en ? 'Light melee' : 'Лёгкий удар', melee.lightMeleeDamage],
                [en ? 'Heavy melee' : 'Тяжёлый удар', melee.heavyMeleeDamage],
              ]}
            />
          )}
        </DossierStatPlate>
        <DossierStatPlate kind="vitality" title={en ? 'Vitality' : 'Выживаемость'}>
          <Rows
            rows={[
              [en ? 'Health' : 'Здоровье', natural.health],
              [en ? 'Health regeneration / s' : 'Регенерация / с', natural.regen],
              [
                en ? 'Move speed' : 'Скорость бега',
                `${format(build?.moveSpeed ?? hero.base.moveSpeed)} ${speed}`,
              ],
              [en ? 'Stamina' : 'Выносливость', hero.base.stamina],
            ]}
          />
          {build && (
            <Rows
              rows={[
                [en ? 'Bullet resistance' : 'Защита от пуль', percent(build.bulletResist)],
                [en ? 'Spirit resistance' : 'Защита от спирита', percent(build.spiritResist)],
                [en ? 'Debuff resistance' : 'Сопротивление дебаффам', percent(build.debuffResist)],
                [en ? 'Sprint speed' : 'Скорость спринта', `${format(build.sprintSpeed)} ${speed}`],
                [
                  en ? 'Stamina recovery' : 'Восстановление выносливости',
                  build.staminaRegen > 0 ? `${format(1 / build.staminaRegen)} ${seconds}` : '—',
                ],
              ]}
            />
          )}
        </DossierStatPlate>
        <DossierStatPlate kind="spirit" title={en ? 'Spirit' : 'Спирит'}>
          <Rows rows={[[en ? 'Spirit power' : 'Сила спирита', natural.spirit]]} />
          {build && (
            <Rows
              rows={[
                [
                  en ? 'Cooldown reduction' : 'Сокращение перезарядки',
                  percent(build.cooldownReduction),
                ],
                [
                  en ? 'Ability duration bonus' : 'Бонус длительности',
                  percent(build.durationPercent),
                ],
                [en ? 'Ability range bonus' : 'Бонус дальности', percent(build.rangePercent)],
                [
                  en ? 'Spirit lifesteal' : 'Спиритический вампиризм',
                  percent(build.spiritLifesteal),
                ],
              ]}
            />
          )}
          {hero.scaling.bulletDamagePerSpirit !== 0 && (
            <Rows
              rows={[
                [
                  en ? 'Bullet damage per Spirit' : 'Урон пули за спирит',
                  bonus(hero.scaling.bulletDamagePerSpirit),
                ],
              ]}
            />
          )}
        </DossierStatPlate>
        <DossierStatPlate kind="growth" title={en ? 'Per level' : 'Прирост за уровень'}>
          <Rows
            rows={[
              [en ? 'Health' : 'Здоровье', bonus(natural.healthGrowth)],
              [en ? 'Shot damage' : 'Урон выстрела', bonus(natural.damageGrowth)],
              [en ? 'Spirit power' : 'Сила спирита', bonus(natural.spiritGrowth)],
              [en ? 'Regeneration / s' : 'Регенерация / с', bonus(natural.regenGrowth)],
            ]}
          />
          {hero.calculation?.meleeGrowth !== undefined && (
            <Rows
              rows={[[en ? 'Light melee' : 'Лёгкий удар', bonus(hero.calculation.meleeGrowth)]]}
            />
          )}
        </DossierStatPlate>
      </div>
      <p className="hero-caption">
        {en
          ? 'Without items. DPS is shown before reloads, range falloff and target resistance.'
          : 'Без предметов. Урон в секунду указан без перезарядки, падения урона на дистанции и сопротивлений цели.'}
      </p>
    </section>
  );
}
