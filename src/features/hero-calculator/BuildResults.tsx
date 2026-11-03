import { useId, useState } from 'react';
import type { BuildResult, BuildRules, BuildStats } from '../../../shared/build-types';
import { calculateCooldown, calculateDamage } from '../../../shared/mechanics';
import { useI18n } from '../../i18n';
import { format } from '../../lib/format';
import { ChevronDown } from '../../components/ui/ArchiveIcon/ArchiveIcons';
const groups: {
  title: string;
  primary: keyof BuildStats;
  unit: string;
  rows: [keyof BuildStats, string, string?][];
}[] = [
  {
    title: 'Живучесть',
    primary: 'health',
    unit: 'HP',
    rows: [
      ['health', 'Здоровье', 'HP'],
      ['regen', 'Регенерация', 'HP/с'],
      ['outOfCombatRegen', 'Регенерация вне боя', 'HP/с'],
      ['bulletResist', 'Сопротивление пулям', '%'],
      ['spiritResist', 'Сопротивление спириту', '%'],
      ['bulletEhp', 'Эффективное HP против пуль'],
      ['spiritEhp', 'Эффективное HP против спирита'],
    ],
  },
  {
    title: 'Оружие',
    primary: 'dps',
    unit: 'DPS',
    rows: [
      ['shotDamage', 'Урон выстрела'],
      ['bulletDamage', 'Урон снаряда'],
      ['dps', 'DPS без перезарядки'],
      ['sustainedDps', 'DPS с перезарядкой'],
      ['shotsPerSecond', 'Выстрелов в секунду'],
      ['clipSize', 'Магазин'],
      ['reloadSeconds', 'Перезарядка', 'с'],
    ],
  },
  {
    title: 'Спирит и способности',
    primary: 'spirit',
    unit: 'SP',
    rows: [
      ['spirit', 'Спирит'],
      ['cooldownReduction', 'Сокращение перезарядки', '%'],
      ['itemCooldownReduction', 'Сокращение перезарядки предметов', '%'],
      ['durationPercent', 'Длительность', '%'],
      ['rangePercent', 'Дальность', '%'],
      ['radiusPercent', 'Радиус', '%'],
    ],
  },
  {
    title: 'Передвижение и эффекты',
    primary: 'moveSpeed',
    unit: 'м/с',
    rows: [
      ['moveSpeed', 'Скорость движения', 'м/с'],
      ['sprintSpeed', 'Скорость бега', 'м/с'],
      ['stamina', 'Выносливость'],
      ['staminaRegen', 'Восстановление выносливости', 'зарядов/с'],
      ['debuffResist', 'Сопротивление эффектам', '%'],
      ['slowResist', 'Сопротивление замедлению', '%'],
      ['bulletLifesteal', 'Вампиризм пулями', '%'],
      ['spiritLifesteal', 'Спиритический вампиризм', '%'],
      ['healingAmp', 'Усиление лечения', '%'],
      ['regenAmp', 'Усиление регенерации', '%'],
    ],
  },
];
function validNumber(raw: string, min: number, max: number): number | undefined {
  const value = Number(raw);
  return raw.trim() && Number.isFinite(value) && value >= min && value <= max ? value : undefined;
}
function ExampleInput({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
}) {
  const { t } = useI18n();
  const id = useId();
  const invalid = validNumber(value, min, max) === undefined;
  return (
    <label>
      {t(label)}
      <input
        type="number"
        step="any"
        min={min}
        max={max}
        value={value}
        aria-invalid={invalid}
        aria-describedby={invalid ? id : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {invalid && (
        <small id={id} role="alert">
          {t('Введи число от {{min}} до {{max}}.', { min: format(min), max: format(max) })}
        </small>
      )}
    </label>
  );
}
const names = { weapon: 'Оружие', vitality: 'Выживаемость', spirit: 'Спирит' };
export function BuildResults({
  result,
  rules,
  onRule,
}: {
  result: BuildResult;
  rules: BuildRules;
  onRule: (id: string) => void;
}) {
  const { t } = useI18n();
  const [resist, setResist] = useState('30');
  const [base, setBase] = useState('100');
  const [scale, setScale] = useState('1');
  const [cooldown, setCooldown] = useState('30');
  const resistance = validNumber(resist, -1000, 100);
  const damageBase = validNumber(base, 0, 1000000);
  const coefficient = validNumber(scale, 0, 10000);
  const cooldownBase = validNumber(cooldown, 0.01, 86400);
  const spiritDamage =
    damageBase !== undefined && coefficient !== undefined
      ? (damageBase + coefficient * result.ability.spirit) *
        (1 + result.ability.damagePercent / 100)
      : undefined;
  const cooldownSeconds =
    cooldownBase !== undefined
      ? calculateCooldown(cooldownBase, [result.ability.cooldownReduction]).seconds
      : undefined;
  const shot =
    resistance === undefined
      ? undefined
      : calculateDamage({
          base: result.stats.shotDamage,
          weaponBonus: 0,
          additiveAmp: 0,
          flat: 0,
          multipliers: [],
          falloff: 100,
          crit: 1,
          resistance,
        });
  return (
    <>
      <dl className="build-key-stats" aria-label={t('Характеристики билда')}>
        {(
          [
            ['health', 'Здоровье', 'HP'],
            ['dps', 'DPS без перезарядки', 'DPS'],
            ['spirit', 'Спирит', 'SP'],
          ] as const
        ).map(([key, label, unit]) => (
          <div key={key}>
            <dt>{t(label)}</dt>
            <dd>
              <strong>{format(result.stats[key])}</strong> <span>{unit}</span>
            </dd>
            <small>
              {t('Без предметов')}: {format(result.baseline[key])}
            </small>
          </div>
        ))}
      </dl>
      <section className="build-investment">
        <div className="build-heading">
          <h3>{t('Вложения')}</h3>
          <strong>
            {format(result.totalCost)} {t('душ')}
          </strong>
        </div>
        {(Object.keys(names) as (keyof typeof names)[]).map((category) => {
          const state = result.investments[category];
          return (
            <div className={`investment-row ${category}`} key={category}>
              <div>
                <strong>{t(names[category])}</strong>
                <span>
                  {format(state.souls)} {t('душ')}
                </span>
              </div>
              <div>
                <b>
                  +{format(state.bonus)}
                  {category === 'spirit' ? '' : '%'}
                </b>
                <small>
                  {t(
                    category === 'weapon'
                      ? 'Урон оружия'
                      : category === 'vitality'
                        ? 'Базовое здоровье'
                        : 'Спирит',
                  )}
                </small>
              </div>
              <div>
                <progress
                  aria-label={t('Вложения: {{category}}', { category: t(names[category]) })}
                  max={state.next?.souls || Math.max(1, state.souls)}
                  value={state.souls}
                />
                <small>
                  {state.next
                    ? t('До {{bonus}}: ещё {{souls}} душ', {
                        bonus: `+${state.next.bonus}${category === 'spirit' ? '' : '%'}`,
                        souls: format(state.next.souls - state.souls),
                      })
                    : t('Максимальный бонус')}
                </small>
              </div>
            </div>
          );
        })}
        <details>
          <summary>{t('Все пороги вложений')}</summary>
          <p>
            {t(
              'В каждой категории складывается полная стоимость предметов, которые сейчас находятся в билде. Проданные или заменённые предметы отдельно не учитываются. Вложения дают урон оружия, базовое здоровье или спирит в зависимости от категории.',
            )}
          </p>
          <p>
            {t(
              'Бонус достигнутого порога применяется один раз. Стоимость компонентов повторно не прибавляется.',
            )}
          </p>
          <div className="investment-memo">
            {(Object.keys(names) as (keyof typeof names)[]).map((category) => (
              <div key={category}>
                <h4>{t(names[category])}</h4>
                <dl>
                  {rules.investment[category].map((row) => (
                    <div key={row.souls}>
                      <dt>
                        {format(row.souls)} {t('душ')}
                      </dt>
                      <dd>
                        +{format(row.bonus)}
                        {category === 'spirit' ? '' : '%'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </details>
      </section>
      <section className="build-ledger">
        <h3>{t('Характеристики билда')}</h3>
        <p>
          {t(
            'Без предметов → с предметами, на выбранном уровне. Общие бонусы способностей показаны отдельно от выбранной способности.',
          )}
        </p>
        <div className="build-stat-groups">
          {groups.map((group, index) => (
            <details className="build-stat-section" key={group.title} open={index === 0}>
              <summary>
                <ChevronDown size={18} aria-hidden="true" />
                <span>{t(group.title)}</span>
                <strong>
                  {format(result.baseline[group.primary])} → {format(result.stats[group.primary])}{' '}
                  <small>{t(group.unit)}</small>
                </strong>
              </summary>
              <table aria-label={t(group.title)}>
                <thead>
                  <tr>
                    <th scope="col">{t('Характеристика')}</th>
                    <th scope="col">{t('Без предметов')}</th>
                    <th scope="col">{t('Билд')}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map(([key, label, unit]) => (
                    <tr key={key}>
                      <th scope="row">
                        {t(label)}
                        {unit && <small> {t(unit)}</small>}
                      </th>
                      <td>{format(result.baseline[key])}</td>
                      <td>
                        <strong>{format(result.stats[key])}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </div>
        <details>
          <summary>{t('Бонусы выбранной способности')}</summary>
          <dl className="build-ability">
            {(
              [
                ['spirit', 'Спирит'],
                ['cooldownReduction', 'Сокращение перезарядки'],
                ['durationPercent', 'Длительность'],
                ['rangePercent', 'Дальность'],
                ['radiusPercent', 'Радиус'],
                ['charges', 'Дополнительные заряды'],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <dt>{t(label)}</dt>
                <dd>
                  {format(result.ability[key])}
                  {!['spirit', 'charges'].includes(key) && '%'}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </section>
      <section className="build-examples">
        <h3>{t('Проверь билд в формулах')}</h3>
        <details>
          <summary>{t('Эффективное здоровье')}</summary>
          <p>{t('Без лечения и барьеров, против одного типа урона.')}</p>
          <p>
            {format(result.stats.health)} / (1 − {format(result.stats.bulletResist)} / 100) ={' '}
            <strong>{format(result.stats.bulletEhp)} HP</strong> · {t('Пули')}
          </p>
          <p>
            {format(result.stats.health)} / (1 − {format(result.stats.spiritResist)} / 100) ={' '}
            <strong>{format(result.stats.spiritEhp)} HP</strong> · {t('Спирит')}
          </p>
          <button className="text-link" onClick={() => onRule('ehp')}>
            {t('Как это считается')}
          </button>
        </details>
        <details>
          <summary>{t('Выстрел против сопротивления')}</summary>
          <ExampleInput
            label="Сопротивление цели, %"
            value={resist}
            onChange={setResist}
            min={-1000}
            max={100}
          />
          <p>{t('Все снаряды попадают в тело; без падения урона с расстоянием.')}</p>
          {shot !== undefined && resistance !== undefined && (
            <p>
              {format(result.stats.shotDamage)} × (1 − {format(resistance)} / 100) ={' '}
              <strong>{format(shot)}</strong>
            </p>
          )}
          <button className="text-link" onClick={() => onRule('damage-amps')}>
            {t('Как это считается')}
          </button>
        </details>
        <details>
          <summary>{t('Спирит и перезарядка способности')}</summary>
          <p>{t('Введи параметры нужной способности. Коэффициент не выбирается автоматически.')}</p>
          <div className="build-example-inputs">
            <ExampleInput
              label="Базовый урон способности"
              value={base}
              onChange={setBase}
              min={0}
              max={1000000}
            />
            <ExampleInput
              label="Коэффициент спирита"
              value={scale}
              onChange={setScale}
              min={0}
              max={10000}
            />
            <ExampleInput
              label="Базовая перезарядка, с"
              value={cooldown}
              onChange={setCooldown}
              min={0.01}
              max={86400}
            />
          </div>
          {spiritDamage !== undefined &&
            Number.isFinite(spiritDamage) &&
            damageBase !== undefined &&
            coefficient !== undefined && (
              <p>
                {result.ability.damagePercent !== 0 && '('}
                {format(damageBase)} + {format(coefficient)} × {format(result.ability.spirit)}
                {result.ability.damagePercent !== 0 && (
                  <>
                    ){' × (1 '}
                    {result.ability.damagePercent < 0 ? '−' : '+'}{' '}
                    {format(Math.abs(result.ability.damagePercent))} / 100)
                  </>
                )}
                {' = '}
                <strong>{format(spiritDamage)}</strong> · {t('до сопротивлений')}
              </p>
            )}
          {cooldownSeconds !== undefined && cooldownBase !== undefined && (
            <p>
              {format(cooldownBase)} × (1 − {format(result.ability.cooldownReduction)} / 100) ={' '}
              <strong>
                {format(cooldownSeconds)} {t('с')}
              </strong>
            </p>
          )}
          <button className="text-link" onClick={() => onRule('spirit-scaling')}>
            {t('Как это считается')}
          </button>
        </details>
      </section>
    </>
  );
}
