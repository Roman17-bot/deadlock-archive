/** Player vocabulary is shared by the property panel and the catalogue search. */
export const ITEM_SLANG: Record<string, string[]> = {
  stun: ['стан', 'станы', 'станить', 'stun'],
  healing: ['хил', 'хилл', 'хилить', 'хилка', 'heal'],
  regen: ['реген', 'регенка', 'регенерация', 'regen', 'hp regen'],
  'anti-heal': ['антихил', 'антихилл', 'анти хил', 'анти хилл', 'antiheal', 'anti heal'],
  'bullet-shred': ['шред', 'shred', 'буллет шред', 'шред брони', 'armor shred', 'bullet shred'],
  'spirit-shred': ['шред', 'shred', 'спирит шред', 'spirit shred'],
  cleanse: ['диспел', 'диспелл', 'очищение', 'dispel', 'cleanse'],
  silence: ['сайленс', 'сайленсить', 'silence'],
  disarm: ['дизарм', 'разоружение', 'disarm'],
  root: ['рут', 'root'],
  'movement-slow': ['слоу', 'slow'],
  'bullet-lifesteal': ['вампиризм', 'лайфстил', 'лифстил', 'lifesteal', 'вамп', 'буллет лайфстил'],
  'spirit-lifesteal': ['вампиризм', 'лайфстил', 'лифстил', 'lifesteal', 'вамп', 'спирит лайфстил'],
  cooldown: ['кд', 'кдр', 'cdr', 'кулдаун', 'cooldown'],
  'cc-immunity': ['бкб', 'антиконтроль', 'cc immunity'],
  'debuff-resist': ['статус резист', 'дебафф резист', 'status resistance'],
  'bullet-resist': ['буллет резист', 'физ резист', 'bullet resist'],
  'spirit-resist': ['спирит резист', 'маг резист', 'spirit resist'],
  barrier: ['щит', 'шилд', 'shield'],
  'fire-rate': ['атак спид', 'attack speed', 'скорость атаки'],
  'fire-rate-slow': ['снижение атак спида', 'attack speed slow'],
  'move-speed': ['мувспид', 'мув спид', 'move speed', 'ms'],
  stamina: ['стамина', 'стамка', 'stamina', 'дэш', 'даш', 'dash', 'додж', 'dodge'],
  teleport: ['блинк', 'blink', 'телепорт', 'тп'],
  'dash-reduction': ['дэш', 'даш', 'dash', 'антидэш', 'антидаш', 'сокращение дэша'],
  'forced-movement': ['нокбэк', 'knockback', 'притягивание', 'отталкивание'],
  farming: ['фарм', 'фармить', 'farm', 'farming'],
  'bonus-health': ['хп', 'hp', 'health'],
  'healing-amp': ['хил амп', 'heal amp'],
  'antiheal-resist': ['резист антихила', 'antiheal resist'],
  stealth: ['инвиз', 'invis'],
  'ability-range': ['рендж', 'радиус', 'аое', 'aoe'],
  duration: ['дюрация', 'duration'],
  charges: ['чарджи', 'charges'],
  headshot: ['хедшот', 'headshot'],
  'melee-damage': ['мили урон', 'melee damage'],
  ammo: ['магазин', 'патроны', 'ammo'],
  reload: ['релоад', 'reload'],
};

export function searchWords(value: string): string[] {
  return (
    value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}
const slangIndex = new Map<string, string[]>();
for (const [id, aliases] of Object.entries(ITEM_SLANG)) {
  for (const alias of aliases) {
    const key = searchWords(alias).join(' ');
    const ids = slangIndex.get(key) ?? [];
    if (!ids.includes(id)) ids.push(id);
    slangIndex.set(key, ids);
  }
}
export function slangProperties(query: string): string[] {
  return slangIndex.get(searchWords(query).join(' ')) ?? [];
}
export function matchesSearchWords(words: string[], tokens: string[]): boolean {
  return words.every((word) =>
    tokens.some((token) => token === word || (word.length >= 3 && token.startsWith(word))),
  );
}
