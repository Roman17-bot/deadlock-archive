import type { AbilityCatalog } from '../../shared/ability-types';
import { validateAbilityCatalog } from '../../shared/abilities';
import { asset } from '../lib/format';
import { jsonResource } from './jsonResource';

const abilities = jsonResource<AbilityCatalog>(
  import.meta.env.DEV ? '/api/abilities' : asset('data/abilities.json'),
  validateAbilityCatalog,
);
export function loadAbilities(signal: AbortSignal, force = false) {
  if (force) abilities.clear();
  return abilities.read(signal);
}
