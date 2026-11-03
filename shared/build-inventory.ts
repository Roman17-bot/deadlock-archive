import type { BuildRules } from './build-types';
import type { ShopItem } from './item-types';

interface Recipes {
  byId: Map<number, ShopItem>;
  ancestors: Map<number, Set<number>>;
}
const cache = new WeakMap<readonly ShopItem[], Recipes>();

function recipes(items: readonly ShopItem[]): Recipes {
  const cached = cache.get(items);
  if (cached) return cached;
  const byId = new Map(items.map((item) => [item.id, item]));
  if (byId.size !== items.length) throw new RangeError('Повторяющиеся предметы в каталоге.');
  const ancestors = new Map<number, Set<number>>();
  const visiting = new Set<number>();
  function collect(id: number): Set<number> {
    if (visiting.has(id)) throw new RangeError('Цикл улучшений предметов.');
    const known = ancestors.get(id);
    if (known) return known;
    const item = byId.get(id);
    if (!item) throw new RangeError('Неизвестный компонент предмета.');
    visiting.add(id);
    const result = new Set<number>();
    for (const component of item.components) {
      result.add(component);
      for (const ancestor of collect(component)) result.add(ancestor);
    }
    visiting.delete(id);
    ancestors.set(id, result);
    return result;
  }
  items.forEach((item) => collect(item.id));
  const result = { byId, ancestors };
  cache.set(items, result);
  return result;
}

function capacity(rules: BuildRules, unlockedExtraSlots: number) {
  if (
    !Number.isInteger(unlockedExtraSlots) ||
    unlockedExtraSlots < 0 ||
    unlockedExtraSlots > rules.maxSlots - rules.baseSlots
  )
    throw new RangeError('Некорректное число дополнительных слотов.');
  return rules.baseSlots + unlockedExtraSlots;
}

export function validateBuildInventory(
  slots: readonly (number | null)[],
  items: readonly ShopItem[],
  rules: BuildRules,
  unlockedExtraSlots = rules.maxSlots - rules.baseSlots,
): void {
  if (
    slots.length !== rules.maxSlots ||
    Array.from(slots).some((id) => id !== null && (!Number.isSafeInteger(id) || Number(id) <= 0))
  )
    throw new RangeError('Некорректный набор слотов.');
  const available = capacity(rules, unlockedExtraSlots);
  const { byId, ancestors } = recipes(items);
  const owned = new Set<number>();
  let active = 0;
  slots.forEach((id, index) => {
    if (id === null) return;
    if (index >= available) throw new RangeError('Для этого слота нужна дополнительная ячейка.');
    const item = byId.get(id);
    if (!item) throw new RangeError('Неизвестный предмет.');
    if (owned.has(id)) throw new RangeError('Этот предмет уже добавлен.');
    owned.add(id);
    if (item.activation === 'active') active++;
  });
  if (active > rules.maxActiveItems) throw new RangeError('Слишком много активных предметов.');
  for (const id of owned) {
    if ([...ancestors.get(id)!].some((ancestor) => owned.has(ancestor)))
      throw new RangeError('Базовый предмет и его улучшение нельзя добавить одновременно.');
  }
}

export function chooseBuildItem(
  slots: readonly (number | null)[],
  index: number,
  itemId: number,
  items: readonly ShopItem[],
  rules: BuildRules,
  unlockedExtraSlots = rules.maxSlots - rules.baseSlots,
): { slots: (number | null)[]; removed: number[] } {
  if (!Number.isInteger(index) || index < 0 || index >= rules.maxSlots)
    throw new RangeError('Некорректный номер слота.');
  if (index >= capacity(rules, unlockedExtraSlots))
    throw new RangeError('Для этого слота нужна дополнительная ячейка.');
  validateBuildInventory(slots, items, rules, unlockedExtraSlots);
  const { byId, ancestors } = recipes(items);
  if (!byId.has(itemId)) throw new RangeError('Неизвестный предмет.');
  if (slots.some((id, slot) => id === itemId && slot !== index))
    throw new RangeError('Этот предмет уже добавлен.');
  const removed: number[] = [];
  const next = slots.map((id, slot) => {
    if (id === null || id === itemId) return id;
    if (slot === index || ancestors.get(itemId)!.has(id) || ancestors.get(id)!.has(itemId)) {
      removed.push(id);
      return null;
    }
    return id;
  });
  next[index] = itemId;
  validateBuildInventory(next, items, rules, unlockedExtraSlots);
  return { slots: next, removed };
}
