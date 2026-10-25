/** Percent arguments use ordinary percentages (30 means 30%), not fractions. */
export function parseNumber(raw: string, label = 'Значение', min = -1e12, max = 1e12): number {
  const normalized = raw.trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized))
    throw new RangeError(`${label}: введи число; десятичная запятая разрешена.`);
  return bounded(Number(normalized), label, min, max);
}

function bounded(value: number, label: string, min = 0, max = 1e12): number {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new RangeError(`${label}: допустимо от ${min} до ${max}.`);
  return value;
}

export function parsePercentList(raw: string): number[] {
  if (!raw.trim()) return [];
  const entries = raw.split(/[;\n]/);
  if (entries.length > 64) throw new RangeError('Введи не больше 64 отдельных источников.');
  return entries.map((entry) => parseNumber(entry, 'Процент источника', 0, 100));
}

export function diminishing(values: number[]): number {
  return (
    100 *
    (1 -
      values.reduce(
        (remaining, value) => remaining * (1 - bounded(value, 'Процент', 0, 100) / 100),
        1,
      ))
  );
}

export function calculateDefense(input: {
  health: number;
  damage: number;
  resists: number[];
  shred: number[];
}) {
  const health = bounded(input.health, 'Здоровье', Number.MIN_VALUE);
  const damage = bounded(input.damage, 'Урон');
  const positive = diminishing(input.resists);
  const negative = diminishing(input.shred);
  const resistance = positive - negative;
  if (resistance >= 100)
    throw new RangeError('При итоговом сопротивлении 100% конечное EHP этой модели не определено.');
  const multiplier = 1 - resistance / 100;
  const ehp = health / multiplier;
  if (!Number.isFinite(ehp) || ehp > 1e15)
    throw new RangeError('Сопротивление слишком близко к 100% для устойчивого расчёта.');
  return {
    health,
    positive,
    negative,
    resistance,
    multiplier,
    damageTaken: damage * multiplier,
    ehp,
    extraEhp: ehp - health,
  };
}

export function mixedEffectiveHealth(
  health: number,
  shares: [number, number, number],
  resists: [number, number],
): number {
  bounded(health, 'Здоровье', Number.MIN_VALUE);
  shares.forEach((value) => bounded(value, 'Доля урона', 0, 100));
  resists.forEach((value) => bounded(value, 'Итоговое сопротивление', -1000, 100));
  if (Math.abs(shares.reduce((a, b) => a + b, 0) - 100) > 1e-8)
    throw new RangeError('Доли Bullet, Spirit и Pure должны давать ровно 100%.');
  const factor =
    (shares[0] * (1 - resists[0] / 100) + shares[1] * (1 - resists[1] / 100) + shares[2]) / 100;
  if (factor <= 1e-12) throw new RangeError('Для этой смеси конечное EHP не определено.');
  return health / factor;
}

export function headshotMultiplier(
  weaponCrit: number,
  outgoingScale: number,
  incomingScale: number,
): number {
  return (
    1 +
    (bounded(weaponCrit, 'Базовый crit', 1, 100) - 1) *
      bounded(outgoingScale, 'Исходящий crit scale', 0, 100) *
      bounded(incomingScale, 'Входящий crit scale', 0, 100)
  );
}

export function calculateDamage(input: {
  base: number;
  weaponBonus: number;
  additiveAmp: number;
  flat: number;
  multipliers: number[];
  falloff: number;
  crit: number;
  resistance: number;
}): number {
  const base = bounded(input.base, 'Базовый урон');
  const weapon = 1 + bounded(input.weaponBonus, 'Weapon Damage', -100, 10000) / 100;
  const amp = 1 + bounded(input.additiveAmp, 'Аддитивный пул', -100, 10000) / 100;
  const flat = bounded(input.flat, 'Плоский урон');
  const independent = input.multipliers.reduce(
    (total, value) => total * (1 + bounded(value, 'Независимое усиление', -100, 10000) / 100),
    1,
  );
  const result =
    (((base * weapon * amp + flat) *
      independent *
      bounded(input.falloff, 'Остаток урона после дистанции', 0, 100)) /
      100) *
    bounded(input.crit, 'Crit multiplier', 1, 100) *
    (1 - bounded(input.resistance, 'Итоговый резист', -1000, 100) / 100);
  return bounded(result, 'Результат');
}

export function calculateHealing(input: {
  base: number;
  outgoing: number;
  receiving: number;
  reductions: number[];
  missing: number;
}) {
  const reduction = diminishing(input.reductions);
  const potential =
    bounded(input.base, 'Исходное лечение') *
    (1 + bounded(input.outgoing, 'Исходящее усиление', -100, 10000) / 100) *
    (1 + bounded(input.receiving, 'Усиление получателя', -100, 10000) / 100) *
    (1 - reduction / 100);
  return {
    reduction,
    potential: bounded(potential, 'Результат'),
    actual: Math.min(bounded(input.missing, 'Недостающее HP'), potential),
  };
}

export function calculateLifesteal(input: {
  damage: number;
  sources: number[];
  amp: number;
  reductions: number[];
  targetFactor: number;
  heroFactor: number;
  missing: number;
}) {
  const damage = bounded(input.damage, 'Подходящий нанесённый урон');
  const ampMultiplier = 1 + bounded(input.amp, 'Исходящее усиление', 0, 1000) / 100;
  const rate = diminishing(input.sources);
  const scaledSources = input.sources.map((value) => value * ampMultiplier);
  if (scaledSources.some((value) => value > 100))
    throw new RangeError(
      'В модели B отдельный усиленный LS превышает 100%; такой край не подтверждён.',
    );
  const factor =
    bounded(input.targetFactor, 'Коэффициент цели', 0, 1) *
    bounded(input.heroFactor, 'Эффективность героя', 0, 1) *
    (1 - diminishing(input.reductions) / 100);
  const missing = bounded(input.missing, 'Недостающее HP');
  const afterPooling = ((damage * rate) / 100) * ampMultiplier * factor;
  const beforePooling = ((damage * diminishing(scaledSources)) / 100) * factor;
  return {
    rate,
    afterPooling,
    beforePooling,
    actualA: Math.min(missing, afterPooling),
    actualB: Math.min(missing, beforePooling),
  };
}

export function calculateDuration(base: number, extensions: number[], resists: number[]) {
  const extension = diminishing(extensions);
  const resistance = diminishing(resists);
  return {
    extension,
    resistance,
    seconds: bounded(base, 'Базовое время') * (1 + extension / 100) * (1 - resistance / 100),
  };
}

export function calculateCooldown(base: number, reductions: number[]) {
  bounded(base, 'Базовая перезарядка', Number.MIN_VALUE);
  const reduction = diminishing(reductions);
  if (reduction >= 100) throw new RangeError('Модель не определяет реальную частоту при 100% CDR.');
  const seconds = base * (1 - reduction / 100);
  if (seconds < 1e-9) throw new RangeError('Перезарядка слишком близка к нулю.');
  return { reduction, seconds, castsPerMinute: 60 / seconds };
}

export function calculateMaxHealth(input: {
  base: number;
  boons: number;
  growth: number;
  baseBonus: number;
  flat: number;
}): number {
  const boons = bounded(input.boons, 'Boons', 0, 35);
  if (!Number.isInteger(boons)) throw new RangeError('Число Boons должно быть целым.');
  const result =
    (bounded(input.base, 'Базовое HP', Number.MIN_VALUE) +
      boons * bounded(input.growth, 'Прирост HP')) *
      (1 + bounded(input.baseBonus, 'Бонус базового HP', 0, 1000) / 100) +
    bounded(input.flat, 'Плоское HP');
  return Math.ceil(result);
}

export function calculateSlow(speed: number, slows: number[], resistance: number[]) {
  bounded(speed, 'Скорость до замедления', 2, 1000);
  const slow = diminishing(slows);
  const resist = resistance.reduce(
    (sum, value) => sum + bounded(value, 'Slow resistance', 0, 100),
    0,
  );
  if (resist > 100)
    throw new RangeError('Суммарный slow resist выше 100% вне области этой модели.');
  const effective = slow * (1 - resist / 100);
  return { slow, resistance: resist, effective, speed: 2 + (speed - 2) * (1 - effective / 100) };
}

export function calculateFalloff(
  distance: number,
  start: number,
  end: number,
  startScale: number,
  endScale: number,
): number {
  bounded(distance, 'Дистанция');
  bounded(start, 'Начало falloff');
  bounded(end, 'Конец falloff');
  bounded(startScale, 'Начальный масштаб', 0, 100);
  bounded(endScale, 'Конечный масштаб', 0, 100);
  if (end < start || (end === start && startScale !== endScale))
    throw new RangeError(
      'Конец должен быть больше начала; совпадающие границы требуют одинакового масштаба.',
    );
  const t = end === start ? 0 : Math.min(1, Math.max(0, (distance - start) / (end - start)));
  return startScale + (endScale - startScale) * t;
}

export function calculateFireRate(base: number, bonuses: number[], slows: number[]) {
  bounded(base, 'Начальная частота', Number.MIN_VALUE, 10000);
  const bonus = bonuses.reduce((sum, value) => sum + bounded(value, 'Бонус частоты', 0, 1000), 0);
  const slow = diminishing(slows);
  const net = Math.max(-50, bonus - slow);
  return { bonus, slow, net, rate: net >= 0 ? base * (1 + net / 100) : base / (1 - net / 100) };
}
