// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { AbilityCatalog } from '../shared/ability-types';
import type { HeroSnapshot } from '../shared/types';
import snapshot from './fixtures/6819/heroes.json';
import { abilityCatalogFixture } from './fixtures/hero-abilities';
import { bonus, buildHero, buildItem, buildRules } from './fixtures/hero-build';
import { HeroAbilities } from '../src/features/hero-calculator/HeroAbilities';
import { i18n, setLanguage } from '../src/i18n';
import { enHeroAbilities } from '../src/i18n/en-hero-abilities';
const state = vi.hoisted(() => ({
  catalog: undefined as AbilityCatalog | undefined,
  error: false,
  mismatch: false,
  retry: vi.fn(),
}));
vi.mock('../src/features/hero-calculator/useAbilities', () => ({ useAbilities: () => state }));
const hero = buildHero();
const other = { ...buildHero(), id: 2, name: 'Other' };
const data = { ...snapshot, heroes: [hero, other], calculatorRules: buildRules } as HeroSnapshot;
const props = { data, hero, level: 1, items: [], rules: buildRules, context: {} };
beforeEach(async () => {
  state.catalog = abilityCatalogFixture(data);
  state.error = false;
  state.mismatch = false;
  state.retry.mockClear();
  i18n.addResourceBundle('en', 'translation', enHeroAbilities, true, true);
  await setLanguage('ru');
});
afterEach(cleanup);
it('calculates cumulative ranks, resets to base, and restores the hero ranks', () => {
  const view = render(<HeroAbilities {...props} />);
  const first = () => screen.getAllByTestId('ability-card')[0];
  expect(within(first()).getByText('100')).toBeInTheDocument();
  fireEvent.click(within(first()).getByRole('button', { name: /2 AP/ }));
  expect(within(first()).getByText('120')).toBeInTheDocument();
  expect(within(first()).getByRole('button', { name: /1 AP/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  view.rerender(<HeroAbilities {...props} hero={other} />);
  expect(within(first()).getByText('100')).toBeInTheDocument();
  view.rerender(<HeroAbilities {...props} />);
  expect(within(first()).getByText('120')).toBeInTheDocument();
  fireEvent.click(within(first()).getByRole('button', { name: 'Базовая способность' }));
  expect(within(first()).getByText('100')).toBeInTheDocument();
});
it('targets each imbued item independently and recalculates on build changes', () => {
  const items = [
    buildItem(1, 'weapon', 0, [bonus('spirit', 20, 'imbuedAbility')]),
    buildItem(2, 'weapon', 0, [bonus('cooldownReduction', 50, 'imbuedAbility')]),
  ];
  const view = render(<HeroAbilities {...props} items={items} />);
  const targets = screen.getAllByRole('combobox');
  fireEvent.change(targets[0], { target: { value: '1' } });
  fireEvent.change(targets[1], { target: { value: '2' } });
  const cards = screen.getAllByTestId('ability-card');
  expect(within(cards[0]).getByText('120')).toBeInTheDocument();
  expect(within(cards[0]).getByText(/40/)).toBeInTheDocument();
  expect(within(cards[1]).getByText('100')).toBeInTheDocument();
  expect(within(cards[1]).getByText('20', { selector: 'dd' })).toBeInTheDocument();
  view.rerender(<HeroAbilities {...props} items={[]} />);
  expect(within(screen.getAllByTestId('ability-card')[0]).getByText('100')).toBeInTheDocument();
});
it('keeps section descriptions and linked variants, filters hidden and gated values', () => {
  const ability = state.catalog!.heroes[0].abilities[0];
  ability.sections = [
    {
      description: { ru: 'Рисунок притягивает врагов.', en: 'The drawing pulls enemies.' },
      properties: ['Damage'],
      blocks: [],
    },
  ];
  ability.parameters.push(
    { id: 'Hidden', label: { ru: 'Скрытый', en: 'Hidden' }, display: false, value: 99 },
    {
      id: 'Gate',
      label: { ru: 'Открывается позже', en: 'Unlocks later' },
      display: true,
      value: 12,
      metadata: { m_nRequiredUpgradeBits: 8 },
    },
  );
  ability.variants = [
    {
      ...ability,
      id: 99,
      name: { ru: 'Другой облик', en: 'Other form' },
      linkedAbilityId: 1,
      linkUpgrades: true,
      linkImbues: true,
    },
  ];
  render(<HeroAbilities {...props} />);
  expect(screen.getAllByText('Рисунок притягивает врагов.').length).toBeGreaterThan(0);
  expect(screen.getByText('Другой облик')).toBeInTheDocument();
  expect(screen.queryByText('Скрытый')).not.toBeInTheDocument();
  expect(screen.queryByText('Открывается позже')).not.toBeInTheDocument();
  fireEvent.click(
    within(screen.getAllByTestId('ability-card')[0]).getByRole('button', { name: /5 AP/ }),
  );
  expect(screen.getAllByText('Открывается позже').length).toBeGreaterThan(0);
});
it('offers loading, error, mismatch and retry without stale cards', () => {
  state.catalog = undefined;
  const view = render(<HeroAbilities {...props} />);
  expect(screen.getByText('Загружаем способности…')).toHaveAttribute('aria-busy', 'true');
  state.error = true;
  view.rerender(<HeroAbilities {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }));
  expect(state.retry).toHaveBeenCalledOnce();
  state.catalog = abilityCatalogFixture(data);
  state.error = false;
  state.mismatch = true;
  view.rerender(<HeroAbilities {...props} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Версии');
  expect(screen.queryByTestId('ability-card')).not.toBeInTheDocument();
});
it('uses English text and does not calculate an unavailable item build', async () => {
  await setLanguage('en');
  render(<HeroAbilities {...props} items={undefined} />);
  expect(screen.getByRole('heading', { name: 'Hero abilities' })).toBeInTheDocument();
  expect(screen.getAllByText('Ability description.')).toHaveLength(4);
  expect(screen.queryByText('100')).not.toBeInTheDocument();
  expect(
    screen.getByText('Load compatible items to calculate ability values.'),
  ).toBeInTheDocument();
});
it('keeps signed effects, suppresses default fields and respects hidden section gates', () => {
  const ability = state.catalog!.heroes[0].abilities[0];
  ability.parameters.push(
    {
      id: 'Slow',
      label: { ru: 'Снижение скорости', en: 'Speed reduction' },
      value: -20,
      unit: '%',
      display: true,
    },
    {
      id: 'Hidden',
      label: { ru: 'Секретный', en: 'Secret' },
      value: 99,
      display: true,
      metadata: { m_bIsHidden: true },
    },
    { id: 'Default', label: { ru: 'Нулевой эффект', en: 'Zero effect' }, value: 0, display: true },
    {
      id: 'Gate',
      label: { ru: '', en: '' },
      value: 1,
      display: false,
      metadata: { m_nRequiredUpgradeBits: 8 },
    },
  );
  ability.sections.push({
    description: { ru: 'Эффект последнего улучшения.', en: 'Final upgrade effect.' },
    properties: [],
    blocks: [],
    metadata: { property_upgrade_required: 'Gate' },
  });
  render(<HeroAbilities {...props} />);
  expect(screen.getByText('-20', { selector: 'dd' })).toBeInTheDocument();
  expect(screen.queryByText('Секретный')).not.toBeInTheDocument();
  expect(screen.queryByText('Нулевой эффект')).not.toBeInTheDocument();
  expect(screen.queryByText('Эффект последнего улучшения.')).not.toBeInTheDocument();
  fireEvent.click(
    within(screen.getAllByTestId('ability-card')[0]).getByRole('button', { name: /5 AP/ }),
  );
  expect(screen.getByText('Эффект последнего улучшения.')).toBeInTheDocument();
});
it('shows useful unsupported dependencies and derives missing upgrade text from localized labels', async () => {
  await setLanguage('en');
  const ability = state.catalog!.heroes[0].abilities[0];
  ability.parameters[0].scale = { className: 'scale_function_custom' };
  ability.upgrades[0].description = { ru: '', en: '' };
  render(<HeroAbilities {...props} />);
  const card = screen.getAllByTestId('ability-card')[0];
  expect(within(card).getByText('Special calculation')).toBeInTheDocument();
  expect(within(card).queryByText('100')).not.toBeInTheDocument();
  expect(
    within(card).getByRole('button', { name: '1 AP upgrade: Ability damage: +20' }),
  ).toBeInTheDocument();
});
