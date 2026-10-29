import type { LocalizedText } from '../../shared/item-types';
import weapon from './advice/weapon.json' with { type: 'json' };
import vitality from './advice/vitality.json' with { type: 'json' };
import spirit from './advice/spirit.json' with { type: 'json' };

const adviceByName: ReadonlyMap<string, readonly LocalizedText[]> = new Map(
  Object.entries({ ...weapon, ...vitality, ...spirit }),
);

/** Purchase advice is editorial copy, not a conclusion inferred from incidental item tags. */
export function itemAdvice(name: string): LocalizedText[] {
  return (adviceByName.get(name) ?? []).map((tip) => ({ ...tip }));
}
