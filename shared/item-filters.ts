import { ITEM_SLANG, searchWords, slangProperties, matchesSearchWords } from './item-search';
import type { ItemCategory, ItemTier, LocalizedText, ShopItem } from './item-types';

export interface ItemFilters {
  query: string;
  categories: ItemCategory[];
  tiers: ItemTier[];
  activation: 'all' | 'active' | 'passive';
  tags: string[];
  tagMode: 'all' | 'any';
}
export const EMPTY_ITEM_FILTERS: ItemFilters = {
  query: '',
  categories: [],
  tiers: [],
  activation: 'all',
  tags: [],
  tagMode: 'all',
};
export interface ItemFilterDefinition {
  id: string;
  label: LocalizedText;
  description: LocalizedText;
  aliases?: string[];
}
export interface ItemFilterGroup {
  id: string;
  label: LocalizedText;
  filters: ItemFilterDefinition[];
}
const tag = (
  id: string,
  ru: string,
  en: string,
  descriptionRu: string,
  descriptionEn: string,
  aliases: string[] = [],
): ItemFilterDefinition => ({
  id,
  label: { ru, en },
  description: { ru: descriptionRu, en: descriptionEn },
  aliases: [...aliases, ...(ITEM_SLANG[id] ?? [])],
});

export const ITEM_FILTER_GROUPS: ItemFilterGroup[] = [
  {
    id: 'defense',
    label: { ru: 'Защита', en: 'Defense' },
    filters: [
      tag(
        'bullet-resist',
        'Сопротивление пулям',
        'Bullet resistance',
        'Снижает получаемый урон от пуль, в том числе при срабатывании эффекта.',
        'Reduces incoming bullet damage, including conditional bonuses.',
        ['bullet resist', 'броня', 'против пуль'],
      ),
      tag(
        'spirit-resist',
        'Спиритическое сопротивление',
        'Spirit resistance',
        'Снижает получаемый спиритический урон.',
        'Reduces incoming spirit damage.',
        ['spirit resist', 'против спирит урона'],
      ),
      tag(
        'melee-resist',
        'Защита от ближнего боя',
        'Melee resistance',
        'Снижает урон от ударов ближнего боя.',
        'Reduces melee damage.',
      ),
      tag(
        'barrier',
        'Барьер',
        'Barrier',
        'Даёт дополнительный запас защиты, часто при определённом условии.',
        'Grants a protective barrier, often after a trigger.',
        ['щит', 'shield'],
      ),
      tag(
        'damage-reduction',
        'Снижение урона',
        'Damage reduction',
        'Уменьшает получаемый урон отдельным защитным эффектом.',
        'Reduces damage through a separate defensive effect.',
      ),
      tag(
        'bullet-immunity',
        'Неуязвимость к пулям',
        'Bullet immunity',
        'Временно защищает от пуль. Не означает защиту от спиритического урона.',
        'Temporarily protects against bullets; does not imply spirit immunity.',
      ),
      tag(
        'invulnerable',
        'Неуязвимость',
        'Invulnerability',
        'Временно делает героя неуязвимым.',
        'Temporarily makes the hero invulnerable.',
      ),
      tag(
        'death-prevention',
        'Защита от смерти',
        'Death prevention',
        'Не даёт погибнуть во время защитного эффекта. Не означает полную неуязвимость.',
        'Prevents death during its protective effect; does not imply full invulnerability.',
      ),
      tag(
        'debuff-resist',
        'Сопротивление дебаффам',
        'Debuff resistance',
        'Сокращает длительность отрицательных эффектов.',
        'Shortens the duration of negative effects.',
      ),
      tag(
        'slow-resist',
        'Сопротивление замедлениям',
        'Slow resistance',
        'Ослабляет замедление передвижения.',
        'Reduces movement slow effects.',
      ),
      tag(
        'cleanse',
        'Снятие дебаффов',
        'Debuff removal',
        'Снимает указанные в описании эффекты.',
        'Removes the effects specified in its description.',
        ['диспел', 'очищение', 'dispel', 'purge'],
      ),
      tag(
        'cc-immunity',
        'Защита от контроля',
        'Control immunity',
        'Подавляет или предотвращает указанные виды контроля.',
        'Suppresses or prevents specified control effects.',
        ['антиконтроль', 'unstoppable'],
      ),
    ],
  },
  {
    id: 'counter',
    label: { ru: 'Противодействие', en: 'Counters' },
    filters: [
      tag(
        'anti-heal',
        'Антихил',
        'Healing reduction',
        'Снижает лечение и восстановление здоровья противника.',
        'Reduces enemy healing and health regeneration.',
        ['снижение лечения', 'снижает реген', 'antiheal', 'anti heal', 'anti-heal'],
      ),
      tag(
        'bullet-shred',
        'Снижение защиты от пуль',
        'Bullet resistance reduction',
        'Уменьшает сопротивление противника пулям.',
        'Reduces enemy bullet resistance.',
        ['bullet shred'],
      ),
      tag(
        'spirit-shred',
        'Снижение спиритической защиты',
        'Spirit resistance reduction',
        'Уменьшает спиритическое сопротивление противника.',
        'Reduces enemy spirit resistance.',
        ['spirit shred'],
      ),
      tag(
        'damage-suppression',
        'Снижение урона врага',
        'Enemy damage reduction',
        'Снижает исходящий урон противника.',
        'Reduces an enemy’s outgoing damage.',
      ),
      tag(
        'fire-rate-slow',
        'Снижение скорострельности',
        'Fire-rate slow',
        'Замедляет стрельбу противника.',
        'Slows enemy fire rate.',
      ),
      tag(
        'silence',
        'Безмолвие',
        'Silence',
        'Мешает применять способности.',
        'Prevents ability use.',
        ['сайленс'],
      ),
      tag('disarm', 'Обезоруживание', 'Disarm', 'Мешает стрелять.', 'Prevents shooting.'),
      tag(
        'curse',
        'Проклятие',
        'Curse',
        'Отключает указанные в описании возможности противника.',
        'Disables the enemy actions described by the item.',
      ),
      tag(
        'health-damage',
        'Урон от здоровья врага',
        'Health-based damage',
        'Наносит урон, зависящий от здоровья цели.',
        'Deals damage based on the target’s health.',
      ),
      tag(
        'reveal',
        'Обнаружение противников',
        'Enemy reveal',
        'Помогает видеть отмеченного противника, в том числе за препятствиями.',
        'Helps reveal marked enemies, including through obstacles.',
      ),
    ],
  },
  {
    id: 'control',
    label: { ru: 'Контроль', en: 'Crowd control' },
    filters: [
      tag(
        'movement-slow',
        'Замедление движения',
        'Movement slow',
        'Замедляет передвижение противника.',
        'Slows enemy movement.',
        ['slow', 'слоу'],
      ),
      tag('stun', 'Оглушение', 'Stun', 'Позволяет оглушить противника.', 'Can stun an enemy.', [
        'стан',
      ]),
      tag(
        'root',
        'Обездвиживание',
        'Root',
        'Фиксирует противника на месте.',
        'Roots an enemy in place.',
        ['рут'],
      ),
      tag(
        'mobility-lock',
        'Блокировка мобильности',
        'Mobility lock',
        'Мешает применять способности и предметы для передвижения.',
        'Prevents movement abilities and items.',
        ['grounded', 'заземление'],
      ),
      tag(
        'dash-reduction',
        'Ослабление рывков',
        'Dash reduction',
        'Сокращает дистанцию рывков противника.',
        'Reduces enemy dash distance.',
      ),
      tag(
        'forced-movement',
        'Перемещение врага',
        'Forced movement',
        'Отталкивает, притягивает или подбрасывает противника.',
        'Pushes, pulls or launches an enemy.',
      ),
    ],
  },
  {
    id: 'sustain',
    label: { ru: 'Здоровье и лечение', en: 'Health & sustain' },
    filters: [
      tag(
        'bonus-health',
        'Запас здоровья',
        'Bonus health',
        'Увеличивает максимальное здоровье.',
        'Increases maximum health.',
        ['хп', 'hp'],
      ),
      tag(
        'regen',
        'Регенерация',
        'Regeneration',
        'Восстанавливает здоровье со временем.',
        'Restores health over time.',
        ['реген', 'regen'],
      ),
      tag(
        'healing',
        'Лечение',
        'Healing',
        'Восстанавливает здоровье при активации или срабатывании.',
        'Restores health on activation or a trigger.',
        ['heal'],
      ),
      tag(
        'ally-support',
        'Помощь союзникам',
        'Ally support',
        'Даёт союзникам лечение, защиту или усиления.',
        'Heals, protects or buffs allies.',
        ['саппорт', 'support'],
      ),
      tag(
        'bullet-lifesteal',
        'Вампиризм от пуль',
        'Bullet lifesteal',
        'Возвращает здоровье за урон пулями.',
        'Restores health from bullet damage.',
        ['bullet lifesteal'],
      ),
      tag(
        'spirit-lifesteal',
        'Спиритический вампиризм',
        'Spirit lifesteal',
        'Возвращает здоровье за спиритический урон.',
        'Restores health from spirit damage.',
        ['spirit lifesteal'],
      ),
      tag(
        'melee-heal',
        'Лечение в ближнем бою',
        'Melee healing',
        'Восстанавливает здоровье при ударах или парировании.',
        'Restores health on melee hits or parries.',
      ),
      tag(
        'healing-amp',
        'Усиление лечения',
        'Healing amplification',
        'Усиливает собственное или получаемое лечение.',
        'Amplifies outgoing or received healing.',
      ),
      tag(
        'antiheal-resist',
        'Защита от антихила',
        'Healing reduction resistance',
        'Ослабляет вражеское снижение лечения.',
        'Reduces the effect of enemy healing reduction.',
      ),
    ],
  },
  {
    id: 'mobility',
    label: { ru: 'Передвижение', en: 'Movement' },
    filters: [
      tag(
        'move-speed',
        'Скорость движения',
        'Movement speed',
        'Увеличивает скорость движения.',
        'Increases movement speed.',
      ),
      tag(
        'sprint',
        'Спринт',
        'Sprint speed',
        'Увеличивает скорость спринта.',
        'Increases sprint speed.',
      ),
      tag(
        'stamina',
        'Выносливость и рывки',
        'Stamina & dashes',
        'Даёт выносливость, ускоряет её восстановление или улучшает рывки.',
        'Adds stamina, improves recovery or enhances dashes.',
      ),
      tag(
        'teleport',
        'Телепортация',
        'Teleport',
        'Позволяет мгновенно переместиться.',
        'Allows instant repositioning.',
        ['блинк', 'blink'],
      ),
      tag(
        'flight',
        'Полёт и прыжки',
        'Flight & jumps',
        'Даёт полёт, подъём или улучшенный прыжок.',
        'Grants flight, elevation or improved jumps.',
      ),
      tag(
        'stealth',
        'Скрытность',
        'Stealth',
        'Скрывает героя от врага при выполнении условий эффекта.',
        'Hides the hero while the effect’s conditions are met.',
      ),
    ],
  },
  {
    id: 'weapon',
    label: { ru: 'Оружие', en: 'Weapon' },
    filters: [
      tag(
        'weapon-damage',
        'Урон оружия',
        'Weapon damage',
        'Усиливает обычные выстрелы.',
        'Increases weapon damage.',
      ),
      tag(
        'fire-rate',
        'Скорострельность',
        'Fire rate',
        'Увеличивает скорость стрельбы.',
        'Increases fire rate.',
      ),
      tag(
        'ammo',
        'Магазин и патроны',
        'Magazine & ammo',
        'Увеличивает или восполняет боезапас.',
        'Increases or replenishes ammunition.',
      ),
      tag(
        'reload',
        'Перезарядка оружия',
        'Weapon reload',
        'Ускоряет или заменяет перезарядку.',
        'Speeds up or replaces reloading.',
      ),
      tag(
        'headshot',
        'Выстрелы в голову',
        'Headshots',
        'Усиливает попадания в голову или даёт эффект за них.',
        'Improves headshots or triggers effects on them.',
      ),
      tag(
        'melee-damage',
        'Урон ближнего боя',
        'Melee damage',
        'Усиливает удары ближнего боя.',
        'Increases melee damage.',
      ),
      tag(
        'weapon-range',
        'Дальность оружия',
        'Weapon range',
        'Меняет дальность эффективной стрельбы или скорость пуль.',
        'Improves effective weapon range or bullet speed.',
      ),
      tag(
        'farming',
        'Фарм и объекты',
        'Farming & objectives',
        'Помогает против бойцов, нейтралов и других целей, не являющихся героями.',
        'Helps against troopers, neutrals and other non-hero targets.',
      ),
      tag(
        'economy',
        'Дополнительные души',
        'Extra souls',
        'Даёт дополнительный доход душ при выполнении условий.',
        'Provides extra soul income under its conditions.',
      ),
    ],
  },
  {
    id: 'abilities',
    label: { ru: 'Способности', en: 'Abilities' },
    filters: [
      tag(
        'spirit-power',
        'Спиритическая мощь',
        'Spirit power',
        'Добавляет спиритическую мощь.',
        'Adds spirit power.',
        ['спирит', 'spirit power'],
      ),
      tag(
        'spirit-damage',
        'Дополнительный спиритический урон',
        'Extra spirit damage',
        'Наносит дополнительный спиритический урон.',
        'Deals additional spirit damage.',
      ),
      tag(
        'cooldown',
        'Перезарядка способностей',
        'Ability cooldown',
        'Сокращает или сбрасывает перезарядку способностей.',
        'Reduces or resets ability cooldowns.',
        ['кд', 'cooldown', 'cdr'],
      ),
      tag(
        'ability-range',
        'Дальность и радиус',
        'Ability range & radius',
        'Увеличивает дальность или область способностей.',
        'Increases ability range or area.',
      ),
      tag(
        'duration',
        'Длительность эффектов',
        'Effect duration',
        'Увеличивает длительность способностей.',
        'Increases ability duration.',
      ),
      tag(
        'charges',
        'Заряды способностей',
        'Ability charges',
        'Добавляет заряды или ускоряет их восстановление.',
        'Adds ability charges or speeds up recharging.',
      ),
      tag(
        'imbue',
        'Усиление выбранной способности',
        'Ability imbue',
        'Накладывает усиление на выбранную способность.',
        'Enhances a selected ability.',
        ['imbue', 'имбью'],
      ),
    ],
  },
];

const definitions = new Map(ITEM_FILTER_GROUPS.flatMap((g) => g.filters).map((f) => [f.id, f]));
const itemTokens = new WeakMap<ShopItem, string[]>();

export function searchItemProperties(query: string): ItemFilterDefinition[] {
  const words = searchWords(query);
  const slang = slangProperties(query);
  return [...definitions.values()].filter((filter) =>
    slang.length
      ? slang.includes(filter.id)
      : matchesSearchWords(
          words,
          searchWords([filter.label.ru, filter.label.en, ...(filter.aliases ?? [])].join(' ')),
        ),
  );
}

export function filterItems(items: ShopItem[], filters: ItemFilters): ShopItem[] {
  const words = searchWords(filters.query);
  const slang = slangProperties(filters.query);
  return items.filter((item) => {
    if (filters.categories.length && !filters.categories.includes(item.category)) return false;
    if (filters.tiers.length && !filters.tiers.includes(item.tier)) return false;
    if (filters.activation !== 'all' && item.activation !== filters.activation) return false;
    if (
      filters.tags.length &&
      !(filters.tagMode === 'all'
        ? filters.tags.every((t) => item.tags.includes(t))
        : filters.tags.some((t) => item.tags.includes(t)))
    )
      return false;
    if (!words.length) return true;
    if (slang.length) return slang.some((id) => item.tags.includes(id));
    let tokens = itemTokens.get(item);
    if (!tokens) {
      const labels = item.tags.map((id) => definitions.get(id)).filter(Boolean);
      tokens = searchWords(
        [
          item.name,
          item.localizedName.ru,
          item.localizedName.en,
          item.description.ru,
          item.description.en,
          ...item.effects.flatMap((e) => [e.description.ru, e.description.en]),
          ...labels.flatMap((f) => [f!.label.ru, f!.label.en, ...(f!.aliases ?? [])]),
        ].join(' '),
      );
      itemTokens.set(item, tokens);
    }
    return matchesSearchWords(words, tokens);
  });
}
