import { expect, it } from 'vitest';
import { withAbilityLabels } from './ability-display';
import { abilityFixture } from '../tests/fixtures/hero-abilities';

it('restores the known unlabeled Silver on-hit lifesteal without changing source numbers', () => {
  const a = abilityFixture();
  a.parameters = [
    { id: 'LifeStealPercentOnHit', value: 40, label: { ru: '', en: '' }, display: false },
  ];
  const visible = withAbilityLabels(a);
  expect(visible.parameters[0]).toMatchObject({
    label: { ru: 'Вампиризм при попадании', en: 'Lifesteal on hit' },
    display: true,
    value: 40,
    unit: '%',
  });
  expect(a.parameters[0].label.en).toBe('');
});
