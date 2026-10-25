// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MechanicsPage } from '../src/features/mechanics/MechanicsPage';
import data from '../data/heroes.json';
import type { HeroSnapshot } from '../shared/types';

beforeEach(() => {
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
  await user.selectOptions(screen.getByRole('combobox', { name: 'Задача расчёта' }), 'lifesteal');
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
