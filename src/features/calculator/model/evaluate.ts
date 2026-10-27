import * as math from '../../../../shared/mechanics';
import { format } from '../../../lib/format';
import { tasks } from './tasks';

export type Result = {
  label: string;
  value: number;
  unit: string;
  rows: { label: string; value: number; unit?: string }[];
  equation: string;
};
export function evaluate(task: string, values: Record<string, string>): Result {
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
        label: 'Усиление общего вампиризма',
        value: r.actualA,
        unit: 'HP',
        rows: [
          row('Усиление каждого эффекта', r.actualB, 'HP'),
          row('Вампиризм до усиления', r.rate, '%'),
        ],
        equation:
          'Общий вампиризм × усиление. Второй вариант складывает уже усиленные эффекты. Лечение ограничено недостающим HP.',
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
        label: 'Итоговая перезарядка',
        value: r.seconds,
        unit: 'с',
        rows: [
          row('Общее сокращение перезарядки', r.reduction, '%'),
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
        label: 'Множитель попадания в голову',
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
          row('Общее замедление', r.slow, '%'),
          row('Slow resistance', r.resistance, '%'),
          row('Замедление с учётом сопротивления', r.effective, '%'),
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
          row('Общее замедление стрельбы', r.slow, '%'),
          row('Итоговое изменение скорострельности', r.net, '%'),
        ],
        equation: r.net >= 0 ? 'f₀ × (1+z)' : 'f₀ / (1−z)',
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
