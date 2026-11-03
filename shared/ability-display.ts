import type { AbilityDetails } from './ability-types';

/** Presentation labels for named source facts lacking a localized tooltip label. */
export function withAbilityLabels<T extends AbilityDetails>(ability: T): T {
  if (
    !ability.parameters.some(
      (parameter) => parameter.id === 'LifeStealPercentOnHit' && !parameter.label.en,
    )
  )
    return ability;
  return {
    ...ability,
    parameters: ability.parameters.map((parameter) =>
      parameter.id === 'LifeStealPercentOnHit' && !parameter.label.en
        ? {
            ...parameter,
            label: { ru: 'Вампиризм при попадании', en: 'Lifesteal on hit' },
            unit: '%',
            display: parameter.metadata?.m_bIsHidden !== true,
          }
        : parameter,
    ),
  };
}
