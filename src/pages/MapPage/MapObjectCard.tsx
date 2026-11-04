import type { WorldMapCatalogue, WorldMapObject } from '../../../shared/world-map';
import { calculateWorldMapReward } from '../../../shared/world-map';
import { useI18n } from '../../i18n';
import { format } from '../../lib/format';
import { categories, clockTime, objectName } from './mapLabels';

export function MapObjectCard({
  map,
  object,
  minute,
  onAdd,
}: {
  map: WorldMapCatalogue;
  object: WorldMapObject;
  minute: number;
  onAdd: () => void;
}) {
  const { language } = useI18n();
  const en = language === 'en';
  const machine = object.category === 'camps' && object.kind === 'vault';
  const reward = calculateWorldMapReward(map, object.id, {
    matchSeconds: minute * 60,
    availableConfirmed: true,
    unitCount: object.category === 'camps' ? 1 : undefined,
  });
  const description: Record<string, [string, string]> = {
    crates: [
      'Разбей ящик, чтобы получить шанс на души.',
      'Break the crate for a chance to receive souls.',
    ],
    tough_crates: [
      'Крепкий ящик разбивается тяжёлой атакой ближнего боя.',
      'A tough crate requires a heavy melee attack.',
    ],
    golden_statues: [
      'Разбей статую ради шанса на постоянное усиление.',
      'Break the statue for a chance to gain a permanent stat increase.',
    ],
    camps: [
      'Нейтральные существа дают души. Состав и число существ нужно учитывать отдельно.',
      'Neutral creatures reward souls. Account for each creature and the camp composition.',
    ],
    bridge_buffs: [
      'Временное усиление оружия, выживаемости, способностей или движения.',
      'A temporary weapon, survival, ability or movement buff.',
    ],
    healing_snacks: [
      'Лечит на 14% максимального здоровья за 4 секунды.',
      'Restores 14% of maximum health over 4 seconds.',
    ],
    soul_urn_spawns: [
      'Возможная точка урны. Глобальное появление: 10:00, затем каждые 5 минут; активная точка меняется.',
      'A possible urn location. Global schedule: 10:00, then every 5 minutes; the active point varies.',
    ],
    soul_urn_pads: ['Точка доставки урны.', 'Urn delivery point.'],
    objectives: ['Постройка команды на линии или базе.', 'A team objective in a lane or base.'],
    shops: ['Здесь можно купить предметы.', 'Buy items here.'],
    teleporters: [
      'Точка быстрого перехода между частями карты.',
      'A fast connection between areas of the map.',
    ],
    bounce_pads: ['Используй трамплин для перемещения.', 'Use the pad for movement.'],
    steam_vents: [
      'Вертикальное перемещение с помощью потока пара.',
      'Use the steam flow for vertical movement.',
    ],
    climb_ropes: ['Верёвка для вертикального перемещения.', 'A rope for vertical movement.'],
    cosmic_veils: [
      'Завеса ограничивает видимость через проход.',
      'A veil obstructs vision through the passage.',
    ],
    unstable_rifts: ['Точка разлома на карте.', 'A rift location on the map.'],
    base_sentries: ['Защита в области базы.', 'A defensive unit near the base.'],
    bells: ['Колокол на карте.', 'A bell location on the map.'],
  };
  const breakable = ['crates', 'tough_crates', 'golden_statues'].includes(object.category);
  const reviewedRules =
    typeof map.meta.rulesClientVersion !== 'number' ||
    map.meta.rulesClientVersion === map.meta.clientVersion;
  return (
    <aside className="map-object-card" aria-labelledby="map-object-title" key={object.id}>
      <div
        className="map-card-symbol"
        aria-hidden="true"
        style={{ color: categories[object.category]?.color }}
      >
        {categories[object.category]?.glyph}
      </div>
      <h2 id="map-object-title" tabIndex={-1}>
        {objectName(object, language)}
      </h2>
      <p>
        {machine
          ? en
            ? 'A machine that pays souls when hit and destroyed. The complete reward and bonuses are not calculated yet.'
            : 'Автомат выдаёт души за удары и разрушение. Полная награда и дополнительные усиления пока не рассчитываются.'
          : !reviewedRules &&
              ['healing_snacks', 'bridge_buffs', 'soul_urn_spawns', 'golden_statues'].includes(
                object.category,
              )
            ? en
              ? 'Effect details are being updated for this version.'
              : 'Параметры эффекта обновляются для этой версии.'
            : description[object.category]?.[en ? 1 : 0]}
      </p>
      <dl>
        <div>
          <dt>{en ? 'First appearance' : 'Первое появление'}</dt>
          <dd>{clockTime(object.firstSpawnSeconds)}</dd>
        </div>
        <div>
          <dt>{en ? 'Respawn interval' : 'Интервал возрождения'}</dt>
          <dd>{clockTime(object.respawnSeconds)}</dd>
        </div>
        {object.perUnit && (
          <div>
            <dt>
              {machine
                ? en
                  ? 'Base health / machine'
                  : 'Базовое здоровье / автомат'
                : en
                  ? 'Base health / creature'
                  : 'Базовое здоровье / существо'}
            </dt>
            <dd>{format(object.perUnit.max_health)}</dd>
          </div>
        )}
        {(reward.expectedSouls !== null || object.category === 'camps') && (
          <div>
            <dt>
              {object.category === 'camps'
                ? machine
                  ? en
                    ? 'Total souls / machine'
                    : 'Все души / автомат'
                  : en
                    ? 'Souls / creature'
                    : 'Души / существо'
                : en
                  ? 'Expected souls'
                  : 'Ожидаемые души'}
            </dt>
            <dd>{reward.expectedSouls === null ? '—' : format(reward.expectedSouls, 1)}</dd>
          </div>
        )}
        {breakable && reviewedRules && (
          <div>
            <dt>{en ? 'Drop chance' : 'Шанс награды'}</dt>
            <dd>
              {format(
                (object.category === 'crates'
                  ? map.rules.crates.dropProbability
                  : object.category === 'tough_crates'
                    ? map.rules.toughCrates.dropProbability
                    : map.rules.goldenStatues.dropProbability) * 100,
              )}
              %
            </dd>
          </div>
        )}
        {object.category === 'bridge_buffs' && reviewedRules && (
          <div>
            <dt>{en ? 'Duration' : 'Длительность'}</dt>
            <dd>2:40</dd>
          </div>
        )}
      </dl>
      {(breakable || (object.category === 'camps' && !machine)) && (
        <p className="hero-caption">
          {en
            ? `Reward at ${minute}:00, assuming the object is present. Camp values are per creature.`
            : `Награда на ${minute}:00, если объект доступен. У кемпов — за одно существо.`}
        </p>
      )}
      {breakable && !reviewedRules && (
        <p className="hero-caption">
          {en
            ? 'Rewards are being updated for this version.'
            : 'Награды обновляются для этой версии.'}
        </p>
      )}
      {breakable && (
        <p className="hero-caption">
          {en
            ? 'This placement’s spawn group is unknown. Check that the object is present.'
            : 'Группа появления этой точки неизвестна. Проверь наличие объекта.'}
        </p>
      )}
      {object.category === 'golden_statues' && reviewedRules && (
        <p>
          {en
            ? 'Buff strength increases at 10 and 30 minutes. Possible bonuses include health, spirit, weapon damage, fire rate, ammo, cooldown, resistance, range and speed.'
            : 'Сила усиления растёт на 10-й и 30-й минутах. Возможны бонусы здоровья, спирита, урона оружия, темпа стрельбы, магазина, перезарядки, сопротивлений, дальности и скорости.'}
        </p>
      )}
      <button className="button" onClick={onAdd}>
        {en ? 'Add to route' : 'Добавить в маршрут'}
      </button>
    </aside>
  );
}
