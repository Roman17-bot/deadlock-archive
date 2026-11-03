// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import data from './fixtures/6819/heroes.json';
import type { HeroSnapshot } from '../shared/types';
import type { BuildRules } from '../shared/build-types';
import type { ShopItem } from '../shared/item-types';
import { Calculator } from '../src/features/calculator/Calculator';
import { setLanguage } from '../src/i18n';
const rules: BuildRules = {
  schemaVersion: 1,
  baseSlots: 9,
  maxSlots: 12,
  maxActiveItems: 4,
  investment: {
    weapon: [
      { souls: 0, bonus: 0 },
      { souls: 800, bonus: 5 },
    ],
    vitality: [
      { souls: 0, bonus: 0 },
      { souls: 800, bonus: 5 },
    ],
    spirit: [
      { souls: 0, bonus: 0 },
      { souls: 800, bonus: 5 },
    ],
  },
};
const item = (id: number, name: string, components: number[] = []): ShopItem => ({
  id,
  name,
  slug: name,
  localizedName: { ru: name, en: name },
  category: 'weapon',
  tier: 1,
  cost: 800,
  icon: '',
  activation: 'passive',
  description: { ru: '', en: '' },
  attributes: [],
  effects: [],
  tags: [],
  components,
  upgrades: [],
  advice: [],
  calculation: { modifiers: [{ key: 'hp', stat: 'health', value: 100, scope: 'self' }] },
});
const items: ShopItem[] = [
  item(1, 'Basic'),
  item(2, 'Upgrade', [1]),
  {
    ...item(3, 'Damage penalty'),
    calculation: {
      modifiers: [{ key: 'all_damage', stat: 'damagePercent', value: -12, scope: 'self' }],
    },
  },
];
const hookState = vi.hoisted(() => ({
  calls: 0,
  version: 6819,
  error: false,
  missingBasic: false,
}));
vi.mock('../src/features/items/useItems', () => ({
  useItems: () => {
    hookState.calls++;
    return {
      catalog: {
        meta: { clientVersion: hookState.version },
        items: hookState.missingBasic ? items.filter((item) => item.id !== 1) : items,
      },
      error: hookState.error,
      retry: vi.fn(),
    };
  },
}));
const calculation = {
  debuffResist: 0,
  bulletLifesteal: 0,
  bulletResist: 0,
  spiritResist: 0,
  bulletResistGrowth: 0,
  spiritResistGrowth: 0,
  bulletResistPerSpirit: 0,
  spiritResistPerSpirit: 0,
  sprintSpeed: 2,
  sprintSpeedPerSpirit: 0,
  moveSpeedPerSpirit: 0,
  clipSizePerSpirit: 0,
  staminaRegen: 1,
};
const snapshot = {
  ...data,
  heroes: data.heroes.map((hero) => ({ ...hero, calculation })),
  calculatorRules: rules,
} as HeroSnapshot;
beforeEach(async () => {
  hookState.calls = 0;
  hookState.version = 6819;
  hookState.error = false;
  hookState.missingBasic = false;
  await setLanguage('ru');
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(cleanup);
it('lets the level be cleared and retyped while keeping the last valid calculation', async () => {
  const user = userEvent.setup();
  render(<Calculator data={snapshot} onRule={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Билд героя' }));
  const level = await screen.findByRole('spinbutton', { name: 'Уровень героя' });
  await user.clear(level);
  await user.type(level, '15');
  expect(level).toHaveValue(15);
  const health = screen.getByRole('rowheader', { name: /^Здоровье/ }).closest('tr')!;
  const previous = health.textContent;
  await user.clear(level);
  expect(level).toHaveValue(null);
  expect(health.textContent).toBe(previous);
  await user.type(level, '20');
  expect(level).toHaveValue(20);
  expect(health.textContent).not.toBe(previous);
  const valid = health.textContent;
  fireEvent.change(level, { target: { value: '55' } });
  expect(level).toHaveValue(55);
  expect(level).toHaveAttribute('aria-invalid', 'true');
  expect(health.textContent).toBe(valid);
  await user.tab();
  expect(level).toHaveValue(36);
  expect(level).toHaveAttribute('aria-invalid', 'false');
  await user.click(level);
  await user.clear(level);
  await user.keyboard('{Enter}');
  expect(level).toHaveValue(36);
  fireEvent.change(level, { target: { value: '21' } });
  expect(level).toHaveValue(21);
  expect(level).toHaveAttribute('aria-invalid', 'false');
});

it.each(['ru', 'en'] as const)(
  'announces current selections in button names (%s)',
  async (language) => {
    await setLanguage(language);
    const user = userEvent.setup();
    render(<Calculator data={snapshot} onRule={() => {}} />);
    await user.click(
      screen.getByRole('button', { name: language === 'ru' ? 'Билд героя' : 'Hero build' }),
    );
    expect(
      await screen.findByRole('button', {
        name: new RegExp(
          `${language === 'ru' ? 'Выбрать героя' : 'Choose a hero'}: ${snapshot.heroes[0].name}`,
        ),
      }),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', {
        name: language === 'ru' ? 'Предмет для слота 1' : 'Item for slot 1',
      }),
    );
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Basic/ }));
    expect(
      screen.getByRole('button', {
        name: language === 'ru' ? 'Слот 1: Basic. Заменить предмет' : 'Slot 1: Basic. Replace item',
      }),
    ).toBeVisible();
  },
);
it('retains both drafts across modes and changes hero/level without clearing items', async () => {
  const user = userEvent.setup();
  render(<Calculator data={snapshot} onRule={() => {}} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Здоровье героя, HP' }), {
    target: { value: '2345' },
  });
  await user.click(screen.getByRole('button', { name: 'Билд героя' }));
  fireEvent.change(await screen.findByRole('spinbutton', { name: 'Уровень героя' }), {
    target: { value: '12' },
  });
  await user.click(screen.getByRole('button', { name: 'Предмет для слота 1' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Basic/ }));
  await user.click(screen.getByRole('button', { name: 'Формулы' }));
  expect(screen.getByRole('textbox', { name: 'Здоровье героя, HP' })).toHaveValue('2345');
  await user.click(screen.getByRole('button', { name: 'Билд героя' }));
  expect(screen.getByRole('spinbutton', { name: 'Уровень героя' })).toHaveValue(12);
  expect(screen.getByRole('button', { name: 'Слот 1: Basic. Заменить предмет' })).toHaveTextContent(
    'Basic',
  );
  await user.click(screen.getByRole('button', { name: /^Выбрать героя:/ }));
  await user.type(screen.getByRole('searchbox', { name: 'Найти героя' }), snapshot.heroes[1].name);
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: snapshot.heroes[1].name }),
  );
  expect(screen.getByRole('button', { name: /^Выбрать героя:/ })).toHaveTextContent(
    snapshot.heroes[1].name,
  );
  expect(screen.getByRole('button', { name: 'Слот 1: Basic. Заменить предмет' })).toHaveTextContent(
    'Basic',
  );
});
it('cancels a picker, replaces components, removes and clears inventory', async () => {
  const user = userEvent.setup();
  render(<Calculator data={snapshot} onRule={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Билд героя' }));
  const slot = await screen.findByRole('button', { name: 'Предмет для слота 1' });
  await user.click(slot);
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Basic/ }));
  await user.click(screen.getByRole('button', { name: 'Предмет для слота 2' }));
  await user.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(slot).toHaveTextContent('Basic');
  await user.click(screen.getByRole('button', { name: 'Предмет для слота 2' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Upgrade/ }));
  expect(slot).not.toHaveTextContent('Basic');
  expect(screen.getByRole('status')).toHaveTextContent('Basic');
  await user.click(screen.getByRole('button', { name: 'Убрать Upgrade' }));
  expect(screen.queryByRole('button', { name: 'Убрать Upgrade' })).not.toBeInTheDocument();
  await user.click(slot);
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Basic/ }));
  await user.click(screen.getByRole('button', { name: 'Очистить предметы' }));
  expect(slot).not.toHaveTextContent('Basic');
});
it('translates the build controls and picker', async () => {
  await setLanguage('en');
  const user = userEvent.setup();
  render(<Calculator data={snapshot} onRule={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Hero build' }));
  await user.click(await screen.findByRole('button', { name: 'Item for slot 1' }));
  expect(screen.getByRole('searchbox', { name: 'Find an item' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
});

it('does not load the catalogue in Formulas and cancels with Escape restoring focus', async () => {
  const user = userEvent.setup();
  render(<Calculator data={snapshot} onRule={() => {}} />);
  expect(hookState.calls).toBe(0);
  await user.click(screen.getByRole('button', { name: 'Билд героя' }));
  const slot = await screen.findByRole('button', { name: 'Предмет для слота 1' });
  expect(hookState.calls).toBeGreaterThan(0);
  await user.click(slot);
  expect(screen.getByRole('searchbox', { name: 'Найти предмет' })).toHaveFocus();
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(slot).toHaveFocus();
});
it('filters item choices and never commits a pending search', async () => {
  const user = userEvent.setup();
  render(<Calculator data={snapshot} onRule={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Билд героя' }));
  await user.click(await screen.findByRole('button', { name: 'Предмет для слота 1' }));
  await user.type(screen.getByRole('searchbox', { name: 'Найти предмет' }), 'Upgrade');
  expect(
    within(screen.getByRole('dialog')).queryByRole('button', { name: /Basic/ }),
  ).not.toBeInTheDocument();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Категория' }), 'spirit');
  expect(
    within(screen.getByRole('dialog')).queryByRole('button', { name: /Upgrade/ }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: /Basic/ })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(screen.queryByRole('button', { name: 'Убрать Basic' })).not.toBeInTheDocument();
});

it('closes a populated search with one Escape and restores the slot focus', async () => {
  const user = userEvent.setup();
  render(<Calculator data={snapshot} onRule={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Билд героя' }));
  const slot = await screen.findByRole('button', { name: 'Предмет для слота 1' });
  await user.click(slot);
  await user.type(screen.getByRole('searchbox', { name: 'Найти предмет' }), 'Upgrade');
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(slot).toHaveFocus();
});

it('keeps secondary stats discoverable in expandable groups instead of a long initial ledger', async () => {
  const user = userEvent.setup();
  render(<Calculator data={snapshot} onRule={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Билд героя' }));
  const title = await screen.findByText('Спирит и способности');
  const group = title.closest('details');
  expect(group).not.toBeNull();
  expect(group).not.toHaveAttribute('open');
  await user.click(title);
  expect(group).toHaveAttribute('open');
});

it('removes an item absent from an updated catalogue while keeping the remaining draft', async () => {
  const user = userEvent.setup();
  const view = render(<Calculator data={snapshot} onRule={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Билд героя' }));
  const slot = await screen.findByRole('button', { name: 'Предмет для слота 1' });
  await user.click(slot);
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Basic/ }));
  hookState.missingBasic = true;
  view.rerender(<Calculator data={snapshot} onRule={() => {}} />);
  await waitFor(() => expect(slot).not.toHaveTextContent('Basic'));
  expect(screen.getByRole('status')).toHaveTextContent(
    'Сборка обновлена по новому списку предметов.',
  );
});
it('blocks mismatched versions and missing metadata instead of showing invented stats', async () => {
  hookState.version = 6820;
  const user = userEvent.setup();
  const view = render(<Calculator data={snapshot} onRule={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Билд героя' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Версии героев и предметов различаются',
  );
  expect(screen.queryByRole('heading', { name: 'Характеристики билда' })).not.toBeInTheDocument();
  hookState.version = 6819;
  view.rerender(
    <Calculator
      data={{
        ...snapshot,
        heroes: snapshot.heroes.map((hero) => ({ ...hero, calculation: undefined })),
      }}
      onRule={() => {}}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Параметры героя или предметов ещё не готовы',
  );
  expect(screen.queryByRole('heading', { name: 'Характеристики билда' })).not.toBeInTheDocument();
});
it('shows the reached investment once, final HP and a body-shot example using the build', async () => {
  const user = userEvent.setup();
  const onRule = vi.fn();
  render(<Calculator data={snapshot} onRule={onRule} />);
  await user.click(screen.getByRole('button', { name: 'Билд героя' }));
  await user.click(await screen.findByRole('button', { name: 'Предмет для слота 1' }));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Basic/ }));
  const healthRow = screen.getByRole('rowheader', { name: /^Здоровье/ }).closest('tr')!;
  expect(
    within(healthRow)
      .getAllByRole('cell')
      .map((cell) => cell.textContent),
  ).toEqual(['800', '900']);
  expect(screen.getByRole('progressbar', { name: 'Вложения: Оружие' })).toHaveAttribute(
    'value',
    '800',
  );
  await user.click(screen.getByText('Выстрел против сопротивления'));
  expect(screen.getByText('23,81')).toBeVisible();
  await user.click(
    within(screen.getByText('Выстрел против сопротивления').closest('details')!).getByRole(
      'button',
      { name: 'Как это считается' },
    ),
  );
  expect(onRule).toHaveBeenCalledWith('damage-amps');
});
it('keeps invalid example input editable without crashing or showing nonfinite results', async () => {
  const user = userEvent.setup();
  render(<Calculator data={snapshot} onRule={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Билд героя' }));
  await user.click(await screen.findByText('Спирит и перезарядка способности'));
  const cooldown = screen.getByRole('spinbutton', { name: 'Базовая перезарядка, с' });
  await user.clear(cooldown);
  expect(cooldown).toHaveValue(null);
  expect(cooldown).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('alert')).toHaveTextContent('Введи число от');
  await user.type(cooldown, '0');
  expect(cooldown).toHaveValue(0);
  expect(cooldown).toHaveAttribute('aria-invalid', 'true');
  await user.clear(cooldown);
  await user.type(cooldown, '45');
  expect(cooldown).toHaveAttribute('aria-invalid', 'false');
  const base = screen.getByRole('spinbutton', { name: 'Базовый урон способности' });
  fireEvent.change(base, { target: { value: '10000000' } });
  expect(base).toHaveValue(10000000);
  expect(base).toHaveAttribute('aria-invalid', 'true');
  const scale = screen.getByRole('spinbutton', { name: 'Коэффициент спирита' });
  fireEvent.change(scale, { target: { value: '1e999' } });
  expect(scale).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('heading', { name: 'Характеристики билда' })).toBeVisible();
  expect(screen.getByText('Проверь билд в формулах').closest('section')).not.toHaveTextContent(
    /NaN|Infinity|∞/,
  );
  fireEvent.change(base, { target: { value: '100' } });
  fireEvent.change(scale, { target: { value: '2' } });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await user.click(screen.getByText('Передвижение и эффекты'));
  await user.click(screen.getByText('Спирит и способности'));
  expect(
    screen.getByRole('rowheader', { name: /Восстановление выносливости.*заряд/ }),
  ).toBeVisible();
  expect(screen.getByRole('rowheader', { name: /Сокращение перезарядки предметов/ })).toBeVisible();
});

it('applies an all-damage penalty to the ability example and preserves input validation', async () => {
  const user = userEvent.setup();
  render(<Calculator data={snapshot} onRule={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Билд героя' }));
  await user.click(await screen.findByRole('button', { name: 'Предмет для слота 1' }));
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: /Damage penalty/ }),
  );
  await user.click(screen.getByText('Спирит и перезарядка способности'));
  const example = screen.getByText('Спирит и перезарядка способности').closest('details')!;
  expect(within(example).getByText('88')).toBeVisible();
  expect(example).toHaveTextContent('× (1 − 12 / 100)');
  const base = screen.getByRole('spinbutton', { name: 'Базовый урон способности' });
  fireEvent.change(base, { target: { value: '10000000' } });
  expect(base).toHaveAttribute('aria-invalid', 'true');
  expect(within(example).queryByText('88')).not.toBeInTheDocument();
  fireEvent.change(base, { target: { value: '200' } });
  expect(within(example).getByText('176')).toBeVisible();
});
