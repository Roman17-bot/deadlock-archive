// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { App } from '../src/app/App';
import { i18n, setLanguage, savedLanguage, translateError } from '../src/i18n';
import { format, formatDate } from '../src/lib/format';
import data from '../data/heroes.json';
import type { HeroSnapshot } from '../shared/types';

beforeEach(async () => {
  window.scrollTo = vi.fn();
  localStorage.clear();
  await i18n.changeLanguage('ru');
  window.location.hash = '#/';
});
afterEach(cleanup);

it('switches the whole page, accessible labels and locale, and remembers the choice', async () => {
  const user = userEvent.setup();
  render(<App initialSnapshot={data as HeroSnapshot} />);
  await user.click(screen.getByRole('button', { name: 'English' }));
  expect(await screen.findByRole('link', { name: 'Home' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Open the register' })).toBeVisible();
  expect(document.documentElement.lang).toBe('en');
  expect(document.title).toContain('reference');
  expect(savedLanguage()).toBe('en');
  expect(format(1234.5)).toBe('1,234.5');
  expect(formatDate('2026-10-25')).toContain('October');
  expect(document.body.textContent).not.toMatch(/[А-Яа-яЁё]/);
});

it('keeps register search, level and details while changing language', async () => {
  const user = userEvent.setup();
  window.location.hash = '#/heroes';
  render(<App initialSnapshot={data as HeroSnapshot} />);
  fireEvent.change(screen.getByRole('slider', { name: 'Уровень героя' }), {
    target: { value: '12' },
  });
  await user.type(screen.getByRole('searchbox', { name: 'Найти героя' }), 'Baba');
  await user.click(screen.getByRole('button', { name: 'Примечания: Baba' }));
  await user.click(screen.getByRole('button', { name: 'English' }));
  expect(screen.getByRole('slider', { name: 'Hero level' })).toHaveValue('12');
  expect(screen.getByRole('searchbox', { name: 'Find a hero' })).toHaveValue('Baba');
  expect(screen.getByRole('button', { name: 'Notes: Baba' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  expect(within(screen.getByRole('table')).getByText('Baba / weapon parameters')).toBeVisible();
  expect(document.body.textContent).not.toMatch(/[А-Яа-яЁё]/);
});

it('translates the updates page, its persisted history and server no-op status', async () => {
  await setLanguage('en');
  window.location.hash = '#/updates';
  render(<App initialSnapshot={data as HeroSnapshot} />);
  expect(screen.getByRole('heading', { name: 'Update center' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Version history' })).toBeVisible();
  expect(screen.getByText('6819', { selector: 'strong' })).toBeVisible();
  expect(document.body.textContent).not.toMatch(/[А-Яа-яЁё]/);
});

it('uses safe defaults and translates validation details without changing numbers', async () => {
  localStorage.setItem('deadlock-language', 'invalid');
  expect(savedLanguage()).toBe('ru');
  await setLanguage('en');
  expect(
    translateError('Здоровье героя, HP: введи число; десятичная запятая разрешена.'),
  ).toContain('enter a number');
  expect(translateError('Значение: допустимо от 0 до 100.')).toContain('0');
  expect(translateError('Доли Bullet, Spirit и Pure должны давать ровно 100%.')).not.toMatch(
    /[А-Яа-яЁё]/,
  );
});
