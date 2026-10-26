// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MechanicsPage } from '../src/pages/MechanicsPage/MechanicsPage';
import data from '../data/heroes.json';
import type { HeroSnapshot } from '../shared/types';
import { setLanguage } from '../src/i18n';

beforeEach(async () => {
  await setLanguage('ru');
  window.scrollTo = vi.fn();
});
afterEach(cleanup);

it('recalculates effective HP without changing actual HP, including a decimal comma', () => {
  render(<MechanicsPage data={data as HeroSnapshot} />);
  expect(screen.getByTestId('calc-primary').textContent?.replace(/\s/g, '')).toContain('1785,714');
  fireEvent.change(screen.getByRole('textbox', { name: 'Здоровье героя, HP' }), {
    target: { value: '2000,5' },
  });
  expect(screen.getByTestId('calc-primary').textContent?.replace(/\s/g, '')).toContain('3572,321');
  expect(screen.getByText('Настоящее HP')).toBeVisible();
});

it('keeps invalid input visible and explains it instead of displaying a zero result', () => {
  render(<MechanicsPage data={data as HeroSnapshot} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Здоровье героя, HP' }), {
    target: { value: '' },
  });
  expect(screen.getByRole('alert')).toHaveTextContent('введи число');
  expect(screen.queryByTestId('calc-primary')).not.toBeInTheDocument();
});

it('shows both lifesteal amp estimates and their explicit model labels', async () => {
  const user = userEvent.setup();
  render(<MechanicsPage data={data as HeroSnapshot} />);
  await user.click(screen.getByRole('combobox', { name: 'Задача расчёта' }));
  await user.click(screen.getByRole('option', { name: 'Вампиризм и усиление лечения' }));
  expect(screen.getByTestId('calc-primary')).toHaveTextContent('89,664');
  expect(screen.getByText('87,917')).toBeVisible();
  expect(screen.getByText(/Порядок усиления не разрешён/)).toBeVisible();
});

it('filters the actual reference and keeps source links in the corresponding article', async () => {
  const user = userEvent.setup();
  render(<MechanicsPage data={data as HeroSnapshot} />);
  const search = screen.getByRole('searchbox', { name: 'Найти формулу' });
  await user.type(search, 'hit-once');
  expect(
    screen.getByRole('heading', { name: 'Несколько траекторий и правило hit-once' }),
  ).toBeVisible();
  expect(
    screen.queryByRole('heading', { name: 'Увеличение радиуса и дальности' }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByText('Разбор, пример и источники'));
  expect(screen.getByRole('link', { name: 'Описание полей оружия' })).toHaveAttribute(
    'href',
    expect.stringContaining('17462b250a0ca80e7f80102f2c83cc3eecff5f12'),
  );
});

it('opens the promised formula details and moves keyboard focus to its heading', async () => {
  const user = userEvent.setup();
  render(<MechanicsPage data={data as HeroSnapshot} />);
  await user.click(screen.getByRole('button', { name: 'Разбор и границы формулы' }));
  const article = document.getElementById('formula-ehp')!;
  expect(article.querySelector('details')).toHaveAttribute('open');
  expect(
    screen.getByRole('heading', {
      name: 'Эффективное здоровье: сколько исходного урона выдержит герой',
    }),
  ).toHaveFocus();
});

it('warns when refreshed hero data is newer than the reviewed mechanics', () => {
  const updated = structuredClone(data) as HeroSnapshot;
  updated.meta.clientVersion = 6820;
  render(<MechanicsPage data={updated} />);
  expect(screen.getByRole('status')).toHaveTextContent('Механики проверены для клиента 6819');
  expect(screen.getByRole('status')).toHaveTextContent('6820');
});

it('opens a keyboard operated menu, cancels a pending selection and retains values per task', async () => {
  const user = userEvent.setup();
  render(<MechanicsPage data={data as HeroSnapshot} />);
  const picker = screen.getByRole('combobox', { name: 'Задача расчёта' });
  await user.click(picker);
  expect(screen.getByRole('listbox')).toBeVisible();
  expect(screen.getByRole('option', { name: 'Сопротивления и эффективное HP' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await user.keyboard('{End}{Escape}');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(picker).toHaveFocus();
  expect(picker).toHaveTextContent('Сопротивления и эффективное HP');
  fireEvent.change(screen.getByRole('textbox', { name: 'Здоровье героя, HP' }), {
    target: { value: '2345' },
  });
  await user.keyboard('{Home}{ArrowDown}{Enter}');
  expect(picker).toHaveTextContent('Эффективное HP против смеси урона');
  await user.click(picker);
  await user.click(screen.getByRole('option', { name: 'Сопротивления и эффективное HP' }));
  expect(screen.getByRole('textbox', { name: 'Здоровье героя, HP' })).toHaveValue('2345');
});

it('dismisses the task menu when focus leaves and allows tabbing to the next field', async () => {
  const user = userEvent.setup();
  render(<MechanicsPage data={data as HeroSnapshot} />);
  await user.click(screen.getByRole('combobox', { name: 'Задача расчёта' }));
  expect(screen.getByRole('listbox')).toBeVisible();
  await user.tab();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Здоровье героя, HP' })).toHaveFocus();
});

it('retains calculator values, category and bilingual search when switching language', async () => {
  const user = userEvent.setup();
  render(<MechanicsPage data={data as HeroSnapshot} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Здоровье героя, HP' }), {
    target: { value: '2345,5' },
  });
  await user.click(screen.getByRole('button', { name: 'Защита' }));
  await user.type(screen.getByRole('searchbox', { name: 'Найти формулу' }), 'Эффективное здоровье');
  await act(async () => {
    await setLanguage('en');
  });
  expect(screen.getByRole('link', { name: 'Download the analysis' })).toHaveAttribute(
    'href',
    '/data/mechanics-reference.en.md',
  );
  expect(screen.getByRole('textbox', { name: 'Hero health, HP' })).toHaveValue('2345,5');
  expect(screen.getByRole('button', { name: 'Defense' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('searchbox', { name: 'Find a formula' })).toHaveValue(
    'Эффективное здоровье',
  );
  expect(document.getElementById('formula-ehp')).toBeVisible();
  expect(screen.getByTestId('calc-primary')).toHaveTextContent('4,188.393');
  await user.click(screen.getByRole('button', { name: 'Clear formula search' }));
  await user.type(screen.getByRole('searchbox', { name: 'Find a formula' }), 'effective health');
  await act(async () => {
    await setLanguage('ru');
  });
  expect(document.getElementById('formula-ehp')).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'Здоровье героя, HP' })).toHaveValue('2345,5');
});

it('translates every calculator task, its results and validation into English', async () => {
  const user = userEvent.setup();
  await setLanguage('en');
  render(<MechanicsPage data={data as HeroSnapshot} />);
  const calculator = screen.getByRole('region', { name: 'Put your idea to the test.' });
  const picker = within(calculator).getByRole('combobox', { name: 'Calculation task' });
  const labels = [
    'Resistance and effective HP',
    'Effective HP against mixed damage',
    'Damage with amplification and resistance',
    'Healing and healing reduction',
    'Lifesteal and healing amplification',
    'Debuff duration and resistance',
    'Ability or item cooldown',
    'Ability radius or range',
    'Maximum health with bonuses',
    'Linear Spirit scaling',
    'Headshot multiplier',
    'Speed after slows',
    'Damage falloff, bias 0.5',
    'Fire rate with buffs and slows',
    'DPS, accuracy, and reload',
  ];
  for (const name of labels) {
    await user.click(picker);
    await user.click(screen.getByRole('option', { name }));
    expect(within(calculator).getByTestId('calc-primary')).toBeVisible();
    expect(calculator.textContent).not.toMatch(/[А-Яа-яЁё]/);
  }
  fireEvent.change(screen.getByRole('textbox', { name: 'Volleys per magazine' }), {
    target: { value: '1.5' },
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Volleys per magazine must be a whole number.',
  );
  expect(screen.queryByTestId('calc-primary')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Volleys per magazine' }), {
    target: { value: '' },
  });
  expect(screen.getByRole('alert')).toHaveTextContent('Volleys per magazine: enter a number');
});

it('keeps domain validation explanations readable in English', async () => {
  const user = userEvent.setup();
  await setLanguage('en');
  render(<MechanicsPage data={data as HeroSnapshot} />);
  const picker = screen.getByRole('combobox', { name: 'Calculation task' });
  await user.click(picker);
  await user.click(screen.getByRole('option', { name: 'Lifesteal and healing amplification' }));
  fireEvent.change(screen.getByRole('textbox', { name: /^Hero lifesteal efficiency/ }), {
    target: { value: '2' },
  });
  expect(screen.getByRole('alert')).toHaveTextContent('Hero efficiency: use a value from 0 to 1.');
  fireEvent.change(screen.getByRole('textbox', { name: /^Hero lifesteal efficiency/ }), {
    target: { value: '1' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Lifesteal sources, %' }), {
    target: { value: '100' },
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'In model B, an amplified lifesteal source exceeds 100%',
  );
  await user.click(picker);
  await user.click(screen.getByRole('option', { name: 'Damage falloff, bias 0.5' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Falloff end' }), {
    target: { value: '100' },
  });
  expect(screen.getByRole('alert')).toHaveTextContent('The end must be greater than the start');
});
