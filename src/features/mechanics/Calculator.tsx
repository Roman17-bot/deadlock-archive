import { useId, useState } from 'react';
import { Calculator as CalculatorIcon, RotateCcw, ArrowDown, CircleAlert } from 'lucide-react';
import * as math from '../../../shared/mechanics';
import { format } from '../../lib/format';

type Field = { key: string; label: string; value: string; list?: boolean; hint?: string };
type Task = { id: string; label: string; rule: string; note: string; fields: Field[] };
const f = (key: string, label: string, value: string, list = false, hint?: string): Field => ({
  key,
  label,
  value,
  list,
  hint,
});
const tasks: Task[] = [
  {
    id: 'defense',
    label: 'Сопротивления и эффективное HP',
    rule: 'ehp',
    note: 'Один выбранный тип урона, постоянная защита, без лечения и барьеров. Условный бонус одного эффекта сначала собери в один источник.',
    fields: [
      f('health', 'Здоровье героя, HP', '1000'),
      f('resists', 'Положительные резисты, %', '30;20', true),
      f(
        'shred',
        'Shred и отрицательные резисты, %',
        '',
        true,
        'Величины без минуса. Врождённые отрицательные резисты — сюда.',
      ),
      f('damage', 'Входящий урон до защиты', '1000'),
    ],
  },
  {
    id: 'mixed',
    label: 'Эффективное HP против смеси урона',
    rule: 'mixed-ehp',
    note: 'Задай постоянные доли исходного урона. Введи уже итоговые резисты, после shred. Pure в этой модели проходит без этих двух резистов.',
    fields: [
      f('health', 'Здоровье героя, HP', '2000'),
      f('bullet', 'Доля Bullet, %', '60'),
      f('spirit', 'Доля Spirit, %', '40'),
      f('pure', 'Доля Pure, %', '0'),
      f('rb', 'Итоговый Bullet Resist, %', '40'),
      f('rs', 'Итоговый Spirit Resist, %', '20'),
    ],
  },
  {
    id: 'damage',
    label: 'Урон с усилениями и сопротивлением',
    rule: 'damage-amps',
    note: 'Здесь пулы заданы явно: обычный Weapon Damage, подтверждённый additive amp, отдельные multipliers. Для Spirit-урона оставь Weapon Damage равным нулю.',
    fields: [
      f('base', 'Базовый урон на нужном уровне', '100'),
      f('weapon', 'Weapon Damage, %', '50'),
      f(
        'amp',
        'Итоговый аддитивный amp, %',
        '-10',
        false,
        'Например, усиление20% и штраф30% дают−10%.',
      ),
      f('flat', 'Плоский урон после этих слоёв', '10'),
      f('multi', 'Независимые усиления, %', '25', true),
      f('falloff', 'Оставшийся урон по дистанции, %', '100'),
      f('crit', 'Итоговый множитель крита', '1'),
      f('resist', 'Итоговое сопротивление цели, %', '20'),
    ],
  },
  {
    id: 'healing',
    label: 'Лечение и снижение лечения',
    rule: 'direct-heal',
    note: 'Исходящее усиление принадлежит источнику heal. Отдельный receive amp у получателя вводи только при наличии такого эффекта. Booster у получателя не означает универсальный receive amp.',
    fields: [
      f('base', 'Исходное лечение, HP', '200'),
      f('amp', 'Исходящее усиление, %', '20'),
      f('receive', 'Отдельное усиление получателя, %', '0'),
      f(
        'anti',
        'Разные источники anti-heal, %',
        '35;35',
        true,
        'Одинаковые копии одного debuff не вводи повторно.',
      ),
      f('missing', 'Недостающее здоровье, HP', '1000'),
    ],
  },
  {
    id: 'lifesteal',
    label: 'Вампиризм и усиление лечения',
    rule: 'lifesteal-amp',
    note: 'Порядок усиления не разрешён доступными проверками: показаны обе модели. Если LS уже включает heal amp из tooltip, оставь усиление0%. Один канал — Bullet либо Spirit.',
    fields: [
      f('damage', 'Подходящий нанесённый урон', '200'),
      f('ls', 'Источники вампиризма, %', '13;28', true),
      f('amp', 'Исходящее усиление лечения, %', '20'),
      f('anti', 'Разные источники anti-heal, %', '', true),
      f(
        'target',
        'Коэффициент цели',
        '1',
        false,
        'Обычно герой1; Bullet nonhero0,6; Spirit nonhero0,4.',
      ),
      f('hero', 'Эффективность вампиризма героя', '1', false, 'У Rat King в raw0,75; обычно1.'),
      f('missing', 'Недостающее здоровье, HP', '1000'),
    ],
  },
  {
    id: 'duration',
    label: 'Длительность дебаффа и сопротивление',
    rule: 'debuff-duration',
    note: 'Только для свойства, которое разрешает увеличение длительности и сокращение debuff resistance. Аура, continuously refreshed slow и fuse могут работать иначе.',
    fields: [
      f('base', 'Исходная длительность, с', '4'),
      f('extend', 'Бонусы длительности, %', '20', true),
      f('resist', 'Источники debuff resist, %', '25', true),
    ],
  },
  {
    id: 'cooldown',
    label: 'Перезарядка способности или предмета',
    rule: 'cooldown',
    note: 'Выбери один timer type: ability либо item. Вводи только действующие на него источники. Частота — идеальная оценка без cast time, channel и ограничений ресурсов.',
    fields: [
      f('base', 'Cooldown после плоских апгрейдов, с', '60'),
      f('cdr', 'Применимые источники CDR, %', '20;5', true),
    ],
  },
  {
    id: 'range',
    label: 'Радиус или дальность способности',
    rule: 'range',
    note: 'Выбери одно конкретное свойство. Процент дальности не обязан менять dash, ширину эффекта или оружейный falloff.',
    fields: [
      f('base', 'Базовый радиус или дальность, м', '20'),
      f('bonus', 'Бонусы выбранного свойства, %', '30;5', true),
    ],
  },
  {
    id: 'health',
    label: 'Максимальное здоровье с бонусами',
    rule: 'max-health',
    note: 'Обычный base-health bonus плюс плоское HP. Total health penalty, HP steal, override и no-scale эффекты сюда не включены.',
    fields: [
      f('base', 'Базовое HP на LVL1', '800'),
      f('boons', 'Число Boons, LVL минус1', '10'),
      f('growth', 'Прирост HP за Boon', '49'),
      f('bonus', 'Итоговый бонус базового HP, %', '20'),
      f('flat', 'Плоское здоровье предметов, HP', '210'),
    ],
  },
  {
    id: 'scaling',
    label: 'Линейное масштабирование от Spirit',
    rule: 'spirit-scaling',
    note: 'Для обычной линейной функции конкретного свойства. Пример — улучшенная граната Kelvin. Другие scale functions требуют отдельного разбора.',
    fields: [
      f('base', 'База свойства', '60'),
      f('flat', 'Плоские апгрейды', '30'),
      f('scale', 'Исходный Spirit-коэффициент', '0,6'),
      f('upgrade', 'Прибавка к коэффициенту', '0,8'),
      f('spirit', 'Spirit Power', '100'),
    ],
  },
  {
    id: 'headshot',
    label: 'Множитель попадания в голову',
    rule: 'headshots',
    note: 'Коэффициенты меняют бонусную часть крита. Подходит для обычного критующего оружия; NPC и специальные handlers отдельно.',
    fields: [
      f('crit', 'Множитель оружия', '1,65'),
      f('out', 'Исходящий bonus scale', '0,7'),
      f('incoming', 'Входящий bonus scale цели', '1'),
      f('body', 'Урон обычного попадания', '100'),
    ],
  },
  {
    id: 'slow',
    label: 'Скорость после замедлений',
    rule: 'movement-slow',
    note: 'Рабочая модель с пониженной уверенностью: slow resist складывается суммой, замедляется часть скорости выше2м/с. Только обычное наземное движение.',
    fields: [
      f('speed', 'Скорость до замедлений, м/с', '10'),
      f('slows', 'Источники movement slow, %', '30;25', true),
      f('resist', 'Источники slow resistance, %', '25;35', true),
    ],
  },
  {
    id: 'falloff',
    label: 'Урон по дистанции, bias0,5',
    rule: 'falloff',
    note: 'Линейная модель только для bias0,5. Дистанция и обе границы должны быть в одинаковых единицах: метрах либо исходных units.',
    fields: [
      f('distance', 'Дистанция до цели', '945'),
      f('start', 'Начало falloff', '590'),
      f('end', 'Конец falloff', '1300'),
      f('a', 'Начальный масштаб урона, %', '100'),
      f('b', 'Конечный масштаб урона, %', '10'),
    ],
  },
  {
    id: 'rate',
    label: 'Скорострельность с баффами и slows',
    rule: 'fire-rate',
    note: 'Отрицательная conversion-ветка — рабочая оценка по wiki. Burst, spin-up и charged оружие имеют особые паузы.',
    fields: [
      f('base', 'Базовая частота, выстр./с', '10'),
      f('bonuses', 'Бонусы fire rate, %', '38', true),
      f('slows', 'Источники fire-rate slow, %', '25;28', true),
    ],
  },
  {
    id: 'dps',
    label: 'DPS, точность и перезарядка',
    rule: 'dps',
    note: 'Введи частоту залпов выбранной модели или замера. Оценка с reload использует непрерывную модель магазина и не является точным TTK.',
    fields: [
      f('damage', 'Урон одного залпа по цели', '10'),
      f('rate', 'Частота залпов, в секунду', '5'),
      f('mag', 'Залпов в магазине', '10'),
      f('reload', 'Перезарядка, с', '2'),
      f('accuracy', 'Доля попаданий, %', '100'),
      f('head', 'Доля headshots среди попаданий, %', '0'),
      f('crit', 'Множитель headshot', '1,65'),
    ],
  },
];

type Result = {
  label: string;
  value: number;
  unit: string;
  rows: { label: string; value: number; unit?: string }[];
  equation: string;
};
function evaluate(task: string, values: Record<string, string>): Result {
  const n = (key: string, min = 0, max = 1e12) =>
    math.parseNumber(
      values[key],
      tasks.find((t) => t.id === task)?.fields.find((field) => field.key === key)?.label,
      min,
      max,
    );
  const p = (key: string) => math.parsePercentList(values[key]);
  const row = (label: string, value: number, unit?: string) => ({ label, value, unit });
  switch (task) {
    case 'defense': {
      const r = math.calculateDefense({
        health: n('health'),
        damage: n('damage'),
        resists: p('resists'),
        shred: p('shred'),
      });
      return {
        label: 'Эффективное HP',
        value: r.ehp,
        unit: 'HP экв.',
        rows: [
          row('Настоящее HP', r.health, 'HP'),
          row('Эквивалентная прибавка', r.extraEhp, 'HP'),
          row('Итоговое сопротивление', r.resistance, '%'),
          row('Пройдёт входящего урона', r.damageTaken, 'HP'),
        ],
        equation: `${format(r.health)} / (1 − ${format(r.resistance, 4)} / 100)`,
      };
    }
    case 'mixed':
      return {
        label: 'EHP против этой смеси',
        value: math.mixedEffectiveHealth(
          n('health'),
          [n('bullet'), n('spirit'), n('pure')],
          [n('rb', -1000, 100), n('rs', -1000, 100)],
        ),
        unit: 'HP экв.',
        rows: [row('Настоящее HP', n('health'), 'HP')],
        equation: 'HP / взвешенный множитель входящего урона',
      };
    case 'damage':
      return {
        label: 'Урон после выбранных слоёв',
        value: math.calculateDamage({
          base: n('base'),
          weaponBonus: n('weapon', -100, 10000),
          additiveAmp: n('amp', -100, 10000),
          flat: n('flat'),
          multipliers: p('multi'),
          falloff: n('falloff'),
          crit: n('crit'),
          resistance: n('resist', -1000, 100),
        }),
        unit: 'HP',
        rows: [],
        equation: '[base × (1+W) × (1+A) + flat] × multipliers × falloff × crit × (1−R)',
      };
    case 'healing': {
      const r = math.calculateHealing({
        base: n('base'),
        outgoing: n('amp'),
        receiving: n('receive'),
        reductions: p('anti'),
        missing: n('missing'),
      });
      return {
        label: 'Реально восстановится',
        value: r.actual,
        unit: 'HP',
        rows: [
          row('Потенциальное лечение', r.potential, 'HP'),
          row('Общее снижение лечения', r.reduction, '%'),
          row('Overheal', r.potential - r.actual, 'HP'),
        ],
        equation: 'min(недостающее HP, base × cast × receive × anti-heal)',
      };
    }
    case 'lifesteal': {
      const r = math.calculateLifesteal({
        damage: n('damage'),
        sources: p('ls'),
        amp: n('amp'),
        reductions: p('anti'),
        targetFactor: n('target'),
        heroFactor: n('hero'),
        missing: n('missing'),
      });
      return {
        label: 'Модель A · усиление после объединения',
        value: r.actualA,
        unit: 'HP',
        rows: [
          row('Модель B · усиление до объединения', r.actualB, 'HP'),
          row('LS до усиления', r.rate, '%'),
        ],
        equation:
          'A: damage × P(LS) × amp; B: damage × P(LS × amp). Оба результата ограничены недостающим HP.',
      };
    }
    case 'duration': {
      const r = math.calculateDuration(n('base'), p('extend'), p('resist'));
      return {
        label: 'Длительность на цели',
        value: r.seconds,
        unit: 'с',
        rows: [
          row('Бонус длительности', r.extension, '%'),
          row('Debuff resistance', r.resistance, '%'),
        ],
        equation: 'base × (1 + duration bonus) × (1 − debuff resist)',
      };
    }
    case 'cooldown': {
      const r = math.calculateCooldown(n('base'), p('cdr'));
      return {
        label: 'Итоговый cooldown',
        value: r.seconds,
        unit: 'с',
        rows: [
          row('Суммарный CDR', r.reduction, '%'),
          row('Идеальных применений в минуту', r.castsPerMinute),
        ],
        equation: 'base × произведение (1 − каждый CDR)',
      };
    }
    case 'range': {
      const r = math.calculateDuration(n('base'), p('bonus'), []);
      return {
        label: 'Итоговая дальность или радиус',
        value: r.seconds,
        unit: 'м',
        rows: [row('Суммарный бонус', r.extension, '%')],
        equation: 'base × [1 + P(бонусы)]',
      };
    }
    case 'health':
      return {
        label: 'Максимальное здоровье',
        value: math.calculateMaxHealth({
          base: n('base'),
          boons: n('boons'),
          growth: n('growth'),
          baseBonus: n('bonus'),
          flat: n('flat'),
        }),
        unit: 'HP',
        rows: [],
        equation: 'ceil[(base + Boons × growth) × (1 + base bonus) + flat]',
      };
    case 'scaling': {
      const value = n('base') + n('flat') + (n('scale') + n('upgrade')) * n('spirit');
      if (!Number.isFinite(value) || value > 1e12)
        throw new RangeError('Результат вне поддерживаемого диапазона.');
      return {
        label: 'Итоговое свойство до других слоёв',
        value,
        unit: 'ед.',
        rows: [row('Итоговый коэффициент', n('scale') + n('upgrade'))],
        equation: 'base + flat + (scale + upgrade) × Spirit',
      };
    }
    case 'headshot': {
      const value = math.headshotMultiplier(n('crit'), n('out'), n('incoming'));
      return {
        label: 'Множитель headshot',
        value,
        unit: '×',
        rows: [row('Урон попадания в голову', n('body') * value, 'HP')],
        equation: '1 + (weapon crit − 1) × outgoing scale × incoming scale',
      };
    }
    case 'slow': {
      const r = math.calculateSlow(n('speed'), p('slows'), p('resist'));
      return {
        label: 'Оценка скорости',
        value: r.speed,
        unit: 'м/с',
        rows: [
          row('Суммарный slow', r.slow, '%'),
          row('Slow resistance', r.resistance, '%'),
          row('Эффективный slow', r.effective, '%'),
        ],
        equation: '2 + (скорость − 2) × (1 − effective slow)',
      };
    }
    case 'falloff':
      return {
        label: 'Остаётся исходного урона',
        value: math.calculateFalloff(n('distance'), n('start'), n('end'), n('a'), n('b')),
        unit: '%',
        rows: [],
        equation: 'start scale + (end scale − start scale) × clamp(t,0,1)',
      };
    case 'rate': {
      const r = math.calculateFireRate(n('base'), p('bonuses'), p('slows'));
      return {
        label: 'Оценка частоты',
        value: r.rate,
        unit: 'выстр./с',
        rows: [
          row('Сумма бонусов', r.bonus, '%'),
          row('Пул slows', r.slow, '%'),
          row('Итоговый стат с ограничением', r.net, '%'),
        ],
        equation: r.net >= 0 ? 'f₀ × (1+z)' : 'f₀ / (1−z), отрицательная ветка модели',
      };
    }
    case 'dps': {
      const rate = n('rate', 0.000001),
        mag = n('mag', 1),
        damage = n('damage'),
        reload = n('reload');
      if (!Number.isInteger(mag))
        throw new RangeError('Число залпов в магазине должно быть целым.');
      const accuracy = n('accuracy', 0, 100) / 100,
        head = n('head', 0, 100) / 100,
        crit = n('crit', 1, 100);
      const expected = damage * accuracy * (1 + head * (crit - 1));
      return {
        label: 'Ожидаемый DPS во время стрельбы',
        value: expected * rate,
        unit: 'HP/с',
        rows: [row('Оценка с перезарядкой', (mag * expected) / (mag / rate + reload), 'HP/с')],
        equation: 'D × rate × p_hit × [1 + headshare × (crit−1)]',
      };
    }
    default:
      throw new Error('Выбери задачу расчёта.');
  }
}

export function Calculator({ onRule }: { onRule: (id: string) => void }) {
  const id = useId();
  const [mode, setMode] = useState('defense');
  const [values, setValues] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(
      tasks.map((t) => [
        t.id,
        Object.fromEntries(t.fields.map((field) => [field.key, field.value])),
      ]),
    ),
  );
  const task = tasks.find((entry) => entry.id === mode)!;
  let result: Result | undefined, error: string | undefined;
  try {
    result = evaluate(mode, values[mode]);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Не удалось рассчитать.';
  }
  return (
    <section className="mechanics-calculator" aria-labelledby={`${id}-heading`}>
      <div className="calculator-title">
        <div>
          <span className="section-kicker">ПОЛЕВАЯ ЛАБОРАТОРИЯ</span>
          <h2 id={`${id}-heading`}>Проверь идею цифрами.</h2>
        </div>
        <CalculatorIcon size={34} aria-hidden="true" />
      </div>
      <div className="calculator-layout">
        <div className="calculator-form">
          <label className="calc-task-label" htmlFor={`${id}-mode`}>
            Задача расчёта
          </label>
          <select id={`${id}-mode`} value={mode} onChange={(e) => setMode(e.target.value)}>
            {tasks.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
          <p className="calc-entry-hint">
            Числа можно вводить с запятой. Отдельные проценты разделяй точкой с запятой:{' '}
            <b>30;20</b>. Пустой список — нет эффектов.
          </p>
          <div className="calculator-fields">
            {task.fields.map((field) => (
              <label key={field.key} htmlFor={`${id}-${mode}-${field.key}`}>
                <span>{field.label}</span>
                <input
                  id={`${id}-${mode}-${field.key}`}
                  type="text"
                  inputMode={field.list ? 'text' : 'decimal'}
                  value={values[mode][field.key]}
                  placeholder={field.list ? 'Нет источников' : undefined}
                  autoComplete="off"
                  onChange={(e) =>
                    setValues((current) => ({
                      ...current,
                      [mode]: { ...current[mode], [field.key]: e.target.value },
                    }))
                  }
                />
                {field.hint && <small>{field.hint}</small>}
              </label>
            ))}
          </div>
          <button
            className="calc-reset"
            onClick={() =>
              setValues((current) => ({
                ...current,
                [mode]: Object.fromEntries(task.fields.map((field) => [field.key, field.value])),
              }))
            }
          >
            <RotateCcw size={16} />
            Вернуть пример
          </button>
        </div>
        <div className="calculator-result" aria-live="polite" aria-atomic="true">
          <span className="result-kicker">
            РАСЧЁТНОЕ ДЕЛО / {String(tasks.indexOf(task) + 1).padStart(2, '0')}
          </span>
          {error ? (
            <div className="calc-error" role="alert">
              <CircleAlert size={30} />
              <h3>Проверь значения</h3>
              <p>{error}</p>
            </div>
          ) : (
            result && (
              <>
                <h3>{result.label}</h3>
                <div className="calc-primary">
                  <strong data-testid="calc-primary">{format(result.value, 3)}</strong>
                  <span>{result.unit}</span>
                </div>
                <dl>
                  {result.rows.map((row) => (
                    <div key={row.label}>
                      <dt>{row.label}</dt>
                      <dd>
                        <b>{format(row.value, 3)}</b>
                        {row.unit && <span>{row.unit}</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="result-equation">{result.equation}</p>
              </>
            )
          )}
          <p className="calculator-assumption">{task.note}</p>
          <button className="text-link" onClick={() => onRule(task.rule)}>
            Разбор и границы формулы
            <ArrowDown size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}
