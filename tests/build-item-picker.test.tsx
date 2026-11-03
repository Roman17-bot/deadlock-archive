// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { BuildItemPicker } from '../src/features/hero-calculator/BuildItemPicker';
import { buildItem, buildRules } from './fixtures/hero-build';
import { setLanguage } from '../src/i18n';

const items = [
  buildItem(4, 'weapon', 6400),
  buildItem(3, 'spirit', 3200),
  buildItem(2, 'vitality', 1600),
  buildItem(1, 'weapon', 800),
];
const empty = () => Array<number | null>(12).fill(null);
beforeEach(async () => {
  await setLanguage('ru');
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
});
afterEach(cleanup);

it('organizes the shop by labelled categories and ascending tiers rather than source order', () => {
  render(
    <BuildItemPicker
      items={items}
      slots={empty()}
      slot={0}
      rules={buildRules}
      onChoose={() => {}}
      onClose={() => {}}
    />,
  );
  expect(screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'))).toEqual([
    'Оружие',
    'Выживаемость',
    'Спирит',
  ]);
  const weapon = within(screen.getByRole('region', { name: 'Оружие' }));
  expect(
    weapon.getAllByRole('heading', { level: 5 }).map((heading) => heading.textContent),
  ).toEqual(['Тир 1', 'Тир 4']);
  expect(weapon.getAllByRole('button').map((button) => button.textContent)).toEqual([
    expect.stringContaining('Предмет 1'),
    expect.stringContaining('Предмет 4'),
  ]);
  expect(weapon.getByRole('button', { name: /Предмет 4/ })).toHaveTextContent('6 400');
});

it('combines search with one category and one tier, and reset restores the complete shop', async () => {
  const user = userEvent.setup();
  render(
    <BuildItemPicker
      items={items}
      slots={empty()}
      slot={0}
      rules={buildRules}
      onChoose={() => {}}
      onClose={() => {}}
    />,
  );
  const categories = within(screen.getByRole('group', { name: 'Категория' }));
  await user.click(categories.getByRole('button', { name: 'Спирит' }));
  expect(screen.getAllByRole('region')).toHaveLength(1);
  await user.click(categories.getByRole('button', { name: 'Оружие' }));
  expect(categories.getByRole('button', { name: 'Спирит' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  expect(screen.queryByRole('region', { name: 'Спирит' })).not.toBeInTheDocument();
  await user.click(
    within(screen.getByRole('group', { name: 'Тир' })).getByRole('button', { name: 'Тир 4' }),
  );
  expect(screen.queryByRole('button', { name: /Предмет 1/ })).not.toBeInTheDocument();
  await user.type(screen.getByRole('searchbox', { name: 'Найти предмет' }), 'Item 3');
  expect(screen.getByText('Ничего не найдено')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
  expect(screen.getByRole('searchbox')).toHaveValue('');
  expect(screen.getAllByRole('region')).toHaveLength(3);
  await user.type(screen.getByRole('searchbox'), 'Item 3');
  expect(screen.getByRole('button', { name: /Предмет 3/ })).toBeVisible();
});

it('keeps duplicate and active-limit reasons readable and never chooses an unavailable item', async () => {
  const user = userEvent.setup();
  const onChoose = vi.fn();
  const actives = [10, 11, 12, 13, 14].map((id) => ({
    ...buildItem(id, 'spirit'),
    activation: 'active' as const,
  }));
  const slots = empty();
  [1, 10, 11, 12, 13].forEach((id, index) => (slots[index] = id));
  render(
    <BuildItemPicker
      items={[...items, ...actives]}
      slots={slots}
      slot={6}
      rules={buildRules}
      onChoose={onChoose}
      onClose={() => {}}
    />,
  );
  const duplicate = screen.getByRole('button', { name: /^Предмет 1\b.*Этот предмет уже добавлен/ });
  expect(duplicate).toBeDisabled();
  expect(within(duplicate).getByText('Этот предмет уже добавлен.')).toBeVisible();
  const fifth = screen.getByRole('button', { name: /Предмет 14/ });
  expect(fifth).toBeDisabled();
  expect(within(fifth).getByText('Слишком много активных предметов.')).toBeVisible();
  await user.click(fifth);
  expect(onChoose).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: /Предмет 2/ }));
  expect(onChoose).toHaveBeenCalledWith(2);
});

it('marks the current slot item selected and still allows its component upgrade', async () => {
  const user = userEvent.setup();
  const onChoose = vi.fn();
  const slots = empty();
  slots[0] = 1;
  const upgrade = { ...buildItem(5, 'weapon', 1600), components: [1] };
  render(
    <BuildItemPicker
      items={[...items, upgrade]}
      slots={slots}
      slot={0}
      rules={buildRules}
      onChoose={onChoose}
      onClose={() => {}}
    />,
  );
  expect(screen.getByRole('button', { name: /Предмет 1/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: /Предмет 1/ })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: /Предмет 5/ }));
  expect(onChoose).toHaveBeenCalledWith(5);
});

it('translates the shop groups, filters and empty state into English', async () => {
  await setLanguage('en');
  const user = userEvent.setup();
  render(
    <BuildItemPicker
      items={items}
      slots={empty()}
      slot={0}
      rules={buildRules}
      onChoose={() => {}}
      onClose={() => {}}
    />,
  );
  expect(screen.getByRole('region', { name: 'Weapon' })).toBeVisible();
  expect(screen.getByRole('region', { name: 'Vitality' })).toBeVisible();
  await user.type(screen.getByRole('searchbox', { name: 'Find an item' }), 'not-an-item');
  expect(screen.getByText('No items found')).toBeVisible();
  expect(screen.getByRole('dialog').textContent).not.toMatch(/[а-яё]/i);
});
