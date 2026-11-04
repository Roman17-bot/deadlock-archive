/** World coordinates are game units. Normalized x/y are points, not HUD icon corners. */
export interface WorldMapObject {
  id: string;
  category: string;
  kind?: string;
  name?: string;
  world?: [number, number, number];
  x: number;
  y: number;
  layer: string | null;
  team?: number | null;
  target?: [number, number, number];
  firstSpawnSeconds: number | null;
  respawnSeconds: number | null;
  timingNote?: string;
  unitCount?: number | null;
  perUnit?: WorldMapUnitReward;
}

export interface WorldMapUnitReward {
  max_health: number;
  gold_reward: number;
  gold_reward_bonus_percent_per_minute: number;
}

interface BreakableRewardRule {
  dropProbability: number;
  soulsBase: number;
  soulsPerMinute: number;
}

export interface WorldMapCatalogue {
  meta: {
    schemaVersion: number;
    clientVersion: number;
    checkedAt?: string;
    [key: string]: unknown;
  };
  radius: number;
  images: {
    mid: string;
    mid_tunnels?: string;
    rat_tunnels?: string;
    [key: string]: string | undefined;
  };
  objects: WorldMapObject[];
  rules: {
    campRules: Record<
      string,
      { perUnit: WorldMapUnitReward; firstSpawnSeconds: number; respawnSeconds: number }
    >;
    crates: BreakableRewardRule;
    toughCrates: BreakableRewardRule;
    goldenStatues: { dropProbability: number; [key: string]: unknown };
    [key: string]: unknown;
  };
  routeExamples?: Array<{
    id: string;
    nameRu: string;
    side: string;
    startId: string;
    endId: string;
    stopIds: string[];
    earliestAllFirstSpawnsSeconds: number;
    [key: string]: unknown;
  }>;
  unknowns?: string[];
  [key: string]: unknown;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown, label: string, minimum = 0, maximum = 1e12): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum)
    throw new RangeError(`${label}: допустимо от ${minimum} до ${maximum}.`);
  return value;
}

function integer(value: unknown, label: string, minimum = 1, maximum = 10000): number {
  const result = finite(value, label, minimum, maximum);
  if (!Number.isInteger(result)) throw new RangeError(`${label}: требуется целое число.`);
  return result;
}

function unitReward(value: unknown): void {
  if (!record(value)) throw new TypeError('Отсутствуют параметры одного нейтрала.');
  finite(value.max_health, 'HP нейтрала', Number.MIN_VALUE);
  finite(value.gold_reward, 'Награда нейтрала');
  finite(value.gold_reward_bonus_percent_per_minute, 'Прирост награды');
}

/** Validates consumed geometry and reward fields before a downloaded catalogue is used. */
export function assertWorldMapCatalogue(value: unknown): asserts value is WorldMapCatalogue {
  if (!record(value) || !record(value.meta) || !record(value.images) || !record(value.rules))
    throw new TypeError('Неполные данные карты.');
  integer(value.meta.schemaVersion, 'Версия схемы');
  integer(value.meta.clientVersion, 'Версия клиента', 1, 1e9);
  finite(value.radius, 'Радиус карты', Number.MIN_VALUE);
  if (typeof value.images.mid !== 'string' || !value.images.mid)
    throw new TypeError('Отсутствует изображение карты.');
  if (!Array.isArray(value.objects) || !value.objects.length || value.objects.length > 10000)
    throw new TypeError('Недопустимый список объектов карты.');
  const ids = new Set<string>();
  for (const object of value.objects) {
    if (
      !record(object) ||
      typeof object.id !== 'string' ||
      !object.id ||
      ids.has(object.id) ||
      typeof object.category !== 'string' ||
      !object.category
    )
      throw new TypeError('Повторяющийся или неполный объект карты.');
    ids.add(object.id);
    finite(object.x, 'Координата X', 0, 1);
    finite(object.y, 'Координата Y', 0, 1);
    if (object.layer !== null && typeof object.layer !== 'string')
      throw new TypeError('Неизвестен этаж объекта.');
    for (const key of ['firstSpawnSeconds', 'respawnSeconds'])
      if (object[key] !== null) finite(object[key], 'Таймер объекта');
    for (const key of ['world', 'target']) {
      if (
        object[key] !== undefined &&
        (!Array.isArray(object[key]) ||
          object[key].length !== 3 ||
          object[key].some((part: unknown) => typeof part !== 'number' || !Number.isFinite(part)))
      )
        throw new TypeError('Недопустимые мировые координаты.');
    }
    if (object.perUnit !== undefined) unitReward(object.perUnit);
    if (object.unitCount !== undefined && object.unitCount !== null)
      integer(object.unitCount, 'Число нейтралов');
  }
  if (!record(value.rules.campRules)) throw new TypeError('Отсутствуют правила лагерей.');
  for (const rule of Object.values(value.rules.campRules)) {
    if (!record(rule)) throw new TypeError('Недопустимое правило лагеря.');
    unitReward(rule.perUnit);
    finite(rule.firstSpawnSeconds, 'Первое появление лагеря');
    finite(rule.respawnSeconds, 'Возрождение лагеря');
  }
  for (const name of ['crates', 'toughCrates']) {
    const rule = value.rules[name];
    if (!record(rule)) throw new TypeError('Отсутствует правило ящиков.');
    finite(rule.dropProbability, 'Вероятность награды', 0, 1);
    finite(rule.soulsBase, 'Базовые души');
    finite(rule.soulsPerMinute, 'Прирост душ');
  }
  const statues = value.rules.goldenStatues;
  if (!record(statues)) throw new TypeError('Отсутствует правило статуй.');
  finite(statues.dropProbability, 'Вероятность усиления', 0, 1);
}

export interface WorldMapRewardInput {
  matchSeconds: number;
  availableConfirmed: boolean;
  /** Explicit user count, never inferred from a camp tier or number of markers. */
  unitCount?: number;
}

export interface WorldMapReward {
  expectedSouls: number | null;
  expectedPermanentBuffs: number | null;
  reason:
    | 'known'
    | 'before-spawn'
    | 'availability-unknown'
    | 'unit-count-unknown'
    | 'reward-unknown'
    | 'buff';
}

function mapObject(map: WorldMapCatalogue, objectId: string): WorldMapObject {
  const object = map.objects.find((entry) => entry.id === objectId);
  if (!object) throw new RangeError('Объект отсутствует на этой версии карты.');
  return object;
}

/** Expected values, with linear configured per-minute growth and no invented rounding. */
export function calculateWorldMapReward(
  map: WorldMapCatalogue,
  objectId: string,
  input: WorldMapRewardInput,
): WorldMapReward {
  const time = finite(input.matchSeconds, 'Время матча');
  if (typeof input.availableConfirmed !== 'boolean')
    throw new TypeError('Подтверди наличие объекта.');
  if (input.unitCount !== undefined) integer(input.unitCount, 'Число нейтралов');
  const object = mapObject(map, objectId);
  const unknown = (reason: WorldMapReward['reason']): WorldMapReward => ({
    expectedSouls: null,
    expectedPermanentBuffs: null,
    reason,
  });
  if (
    ['crates', 'tough_crates', 'golden_statues'].includes(object.category) &&
    typeof map.meta.rulesClientVersion === 'number' &&
    map.meta.rulesClientVersion !== map.meta.clientVersion
  )
    return unknown('reward-unknown');
  if (object.firstSpawnSeconds !== null && time < object.firstSpawnSeconds)
    return unknown('before-spawn');
  if (!input.availableConfirmed) return unknown('availability-unknown');
  if (object.category === 'camps') {
    // A Sacrifice also pays on melee hits. Its generic death reward is not the full payout.
    if (object.kind === 'vault') return unknown('reward-unknown');
    if (input.unitCount === undefined) return unknown('unit-count-unknown');
    const unit = object.perUnit ?? map.rules.campRules[object.kind ?? '']?.perUnit;
    if (!unit) return unknown('reward-unknown');
    const value =
      input.unitCount *
      unit.gold_reward *
      (1 + (unit.gold_reward_bonus_percent_per_minute * time) / 6000);
    return {
      expectedSouls: finite(value, 'Награда лагеря'),
      expectedPermanentBuffs: null,
      reason: 'known',
    };
  }
  if (object.category === 'crates' || object.category === 'tough_crates') {
    const rule = object.category === 'crates' ? map.rules.crates : map.rules.toughCrates;
    return {
      expectedSouls: finite(
        rule.dropProbability * (rule.soulsBase + (rule.soulsPerMinute * time) / 60),
        'Средние души',
      ),
      expectedPermanentBuffs: null,
      reason: 'known',
    };
  }
  if (object.category === 'golden_statues')
    return {
      expectedSouls: null,
      expectedPermanentBuffs: map.rules.goldenStatues.dropProbability,
      reason: 'buff',
    };
  return unknown('reward-unknown');
}

export interface WorldMapRouteStopInput {
  objectId: string;
  /** Player-supplied travel time; straight lines on the map do not establish this value. */
  travelSeconds: number;
  clearSeconds: number;
  availableConfirmed: boolean;
  unitCount?: number;
  lastClearedSeconds?: number;
}

export interface WorldMapRouteInput {
  startSeconds: number;
  stops: WorldMapRouteStopInput[];
}

export interface WorldMapRouteStopResult {
  objectId: string;
  arrivalSeconds: number;
  readySeconds: number;
  waitSeconds: number;
  finishSeconds: number;
  reward: WorldMapReward;
}

export interface WorldMapRouteResult {
  stops: WorldMapRouteStopResult[];
  finishSeconds: number;
  elapsedSeconds: number;
  knownExpectedSouls: number;
  totalExpectedSouls: number | null;
  expectedPermanentBuffs: number;
  unknownRewardObjectIds: string[];
}

/** A chosen scenario, not a shortest-path solver or prediction of enemy farm activity. */
export function calculateWorldMapRoute(
  map: WorldMapCatalogue,
  input: WorldMapRouteInput,
): WorldMapRouteResult {
  const start = finite(input.startSeconds, 'Начало маршрута');
  if (!Array.isArray(input.stops) || input.stops.length > 64)
    throw new RangeError('Выбери не больше 64 остановок.');
  let current = start;
  const cleared = new Map<string, number>();
  const stops: WorldMapRouteStopResult[] = [];
  let knownExpectedSouls = 0;
  let expectedPermanentBuffs = 0;
  const unknownRewardObjectIds: string[] = [];
  for (const stop of input.stops) {
    const object = mapObject(map, stop.objectId);
    const arrivalSeconds = current + finite(stop.travelSeconds, 'Время пути');
    const clearSeconds = finite(stop.clearSeconds, 'Время зачистки');
    let readySeconds = Math.max(arrivalSeconds, object.firstSpawnSeconds ?? 0);
    const previous = cleared.get(object.id);
    const reportedClear =
      stop.lastClearedSeconds === undefined
        ? undefined
        : finite(stop.lastClearedSeconds, 'Последняя зачистка');
    const lastClear =
      previous === undefined ? reportedClear : Math.max(previous, reportedClear ?? previous);
    if (lastClear !== undefined) {
      if (lastClear > arrivalSeconds) throw new RangeError('Последняя зачистка позже прибытия.');
      if (object.respawnSeconds === null)
        throw new RangeError('Для повторной остановки неизвестно время возрождения.');
      readySeconds = Math.max(readySeconds, lastClear + object.respawnSeconds);
    }
    const finishSeconds = finite(readySeconds + clearSeconds, 'Время завершения');
    const reward = calculateWorldMapReward(map, stop.objectId, {
      matchSeconds: finishSeconds,
      availableConfirmed: stop.availableConfirmed,
      unitCount: stop.unitCount,
    });
    if (reward.expectedSouls !== null) knownExpectedSouls += reward.expectedSouls;
    else if (reward.reason !== 'buff') unknownRewardObjectIds.push(stop.objectId);
    if (reward.expectedPermanentBuffs !== null)
      expectedPermanentBuffs += reward.expectedPermanentBuffs;
    stops.push({
      objectId: stop.objectId,
      arrivalSeconds,
      readySeconds,
      waitSeconds: readySeconds - arrivalSeconds,
      finishSeconds,
      reward,
    });
    if (stop.availableConfirmed) cleared.set(object.id, finishSeconds);
    current = finishSeconds;
  }
  return {
    stops,
    finishSeconds: current,
    elapsedSeconds: current - start,
    knownExpectedSouls,
    totalExpectedSouls: unknownRewardObjectIds.length ? null : knownExpectedSouls,
    expectedPermanentBuffs,
    unknownRewardObjectIds,
  };
}
