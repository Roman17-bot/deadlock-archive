// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import snapshot from './fixtures/6819/heroes.json';
import type { HeroSnapshot } from '../shared/types';
import { HeroesPage } from '../src/pages/HeroesPage/HeroesPage';
import { i18n } from '../src/i18n';

const data = snapshot as HeroSnapshot;
let width: number;
let tableWidth: number;
let mobile: boolean;
let resizeCallbacks: (() => void)[];

beforeEach(async () => {
  window.location.hash = '#/heroes';
  await i18n.changeLanguage('ru');
  width = 360;
  tableWidth = 660;
  mobile = true;
  resizeCallbacks = [];
  vi.stubGlobal('matchMedia', () => ({
    matches: mobile,
    addEventListener() {},
    removeEventListener() {},
  }));
  // jsdom has no layout; only supply the browser's measured geometry boundary.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('table-scroll')
      ? width
      : this.classList.contains('hero-column')
        ? 112
        : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (!this.classList.contains('table-scroll')) return 0;
    return this.closest('.table-frame')?.getAttribute('data-stat-view') === 'growth'
      ? width
      : Math.max(width, tableWidth);
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const region = () => screen.getByRole('region', { name: 'Таблица характеристик героев' });
const position = () => screen.getByRole('slider', { name: 'Прокрутка характеристик' });

describe('mobile table discovery and navigation', () => {
  it('makes overflow discoverable and disables the arrow at the starting edge', () => {
    render(<HeroesPage data={data} onMethod={() => {}} />);
    expect(screen.getByText('Листай характеристики')).toBeVisible();
    expect(position()).toHaveValue('0');
    expect(screen.getByRole('button', { name: 'Предыдущие столбцы' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Следующие столбцы' })).toBeEnabled();
    expect(region()).toHaveAccessibleDescription(/Spirit.*Реген/);
  });

  it('moves the actual table with arrows and range and keeps sorting at the same offset', async () => {
    const user = userEvent.setup();
    render(<HeroesPage data={data} onMethod={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Следующие столбцы' }));
    expect(region().scrollLeft).toBe(248);
    await user.click(screen.getByRole('button', { name: 'Следующие столбцы' }));
    expect(region().scrollLeft).toBe(300);
    expect(position()).toHaveValue('100');
    expect(screen.getByRole('button', { name: 'Следующие столбцы' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Регенерация: сортировать' }));
    expect(region().scrollLeft).toBe(300);
    fireEvent.change(position(), { target: { value: '25' } });
    expect(region().scrollLeft).toBe(75);
    await user.click(screen.getByRole('button', { name: 'Предыдущие столбцы' }));
    expect(region().scrollLeft).toBe(0);
  });

  it('follows finger or keyboard scrolling without moving the page', () => {
    render(<HeroesPage data={data} onMethod={() => {}} />);
    region().scrollLeft = 150;
    fireEvent.scroll(region());
    expect(position()).toHaveValue('50');
    expect(screen.getByRole('button', { name: 'Предыдущие столбцы' })).toBeEnabled();
    region().scrollLeft = 300;
    fireEvent.scroll(region());
    expect(position()).toHaveValue('100');
    expect(screen.getByRole('button', { name: 'Следующие столбцы' })).toBeDisabled();
  });

  it('removes unnecessary controls when the table fits and restores them on resize', () => {
    width = 700;
    render(<HeroesPage data={data} onMethod={() => {}} />);
    expect(screen.queryByRole('slider', { name: 'Прокрутка характеристик' })).toBeNull();
    width = 360;
    act(() => resizeCallbacks.forEach((callback) => callback()));
    expect(position()).toHaveValue('0');
    width = 700;
    act(() => resizeCallbacks.forEach((callback) => callback()));
    expect(screen.queryByRole('slider', { name: 'Прокрутка характеристик' })).toBeNull();
  });

  it('resets only on view changes and preserves the selected hero, level and open notes', async () => {
    const user = userEvent.setup();
    render(<HeroesPage data={data} onMethod={() => {}} />);
    await user.type(screen.getByRole('searchbox'), 'Violet');
    fireEvent.change(screen.getByRole('slider', { name: 'Уровень героя' }), {
      target: { value: '11' },
    });
    fireEvent.change(position(), { target: { value: '100' } });
    await user.click(screen.getByRole('button', { name: 'Примечания: Violet' }));
    expect(region().scrollLeft).toBe(300);
    await user.click(screen.getByRole('button', { name: 'Приросты за LVL' }));
    expect(region().scrollLeft).toBe(0);
    expect(screen.queryByRole('slider', { name: 'Прокрутка характеристик' })).toBeNull();
    expect(screen.getByRole('searchbox')).toHaveValue('Violet');
    expect(screen.getByRole('slider', { name: 'Уровень героя' })).toHaveValue('11');
    expect(screen.getByRole('button', { name: 'Примечания: Violet' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await user.click(screen.getByRole('button', { name: /^Характеристики$/ }));
    expect(position()).toHaveValue('0');
  });

  it('translates navigation and the available column summary into English', async () => {
    await i18n.changeLanguage('en');
    render(<HeroesPage data={data} onMethod={() => {}} />);
    expect(screen.getByText('Swipe for more stats')).toBeVisible();
    expect(screen.getByRole('slider', { name: 'Scroll hero stats' })).toHaveValue('0');
    expect(screen.getByRole('button', { name: 'Next columns' })).toBeEnabled();
    expect(screen.getByRole('region', { name: 'Hero stats table' })).toHaveAccessibleDescription(
      /Spirit.*Regen/,
    );
  });

  it('keeps the desktop table free of mobile controls even if it is wider than its viewport', () => {
    mobile = false;
    render(<HeroesPage data={data} onMethod={() => {}} />);
    expect(screen.queryByRole('slider', { name: 'Прокрутка характеристик' })).toBeNull();
    expect(screen.getAllByRole('columnheader')).toHaveLength(10);
  });
});
