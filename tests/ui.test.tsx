// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import snapshot from '../data/heroes.json';
import type { HeroSnapshot } from '../shared/types';
import { selectHeroes } from '../shared/heroes';
import { App } from '../src/app/App';

const data = snapshot as HeroSnapshot;

it('opens the mechanics route through the main navigation and uses live metadata', () => {
  window.location.hash = '#/mechanics';
  const updated = structuredClone(data);
  updated.meta.clientVersion = 6820;
  updated.meta.snapshotDate = '2026-10-25';
  render(<App initialSnapshot={updated} />);
  expect(screen.getByRole('heading', { name: 'Механики и формулы.' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Механики' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Обновления' })).toHaveAttribute('href', '#/updates');
  expect(screen.getByText('КЛИЕНТ 6820')).toBeVisible();
});
beforeEach(() => {
  window.location.hash = '#/heroes';
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function useMobileViewport() {
  let matches = true;
  const media = new EventTarget();
  Object.defineProperty(media, 'matches', { get: () => matches });
  vi.stubGlobal('matchMedia', () => media);
  return (next: boolean) => {
    matches = next;
    act(() => {
      media.dispatchEvent(Object.assign(new Event('change'), { matches }));
    });
  };
}

describe('mobile register views', () => {
  it('shows five core stats for every hero instead of nine numeric columns', () => {
    useMobileViewport();
    render(<App initialSnapshot={data} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader')).toHaveLength(6);
    expect(within(table).getAllByRole('row')).toHaveLength(45);
    expect(screen.getByTestId('stat-nurse-harrow-health')).toHaveTextContent('730');
    expect(screen.queryByTestId('stat-nurse-harrow-healthGrowth')).not.toBeInTheDocument();
  });

  it('switches growth views while preserving the selected hero and level', async () => {
    useMobileViewport();
    const user = userEvent.setup();
    render(<App initialSnapshot={data} />);
    await user.type(screen.getByRole('searchbox'), 'харроу');
    fireEvent.change(screen.getByRole('slider'), { target: { value: '11' } });
    await user.click(screen.getByRole('button', { name: 'Приросты за LVL' }));
    expect(within(screen.getByRole('table')).getAllByRole('columnheader')).toHaveLength(5);
    expect(screen.getByTestId('stat-nurse-harrow-healthGrowth')).toHaveTextContent('+32');
    expect(screen.queryByTestId('stat-nurse-harrow-health')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Характеристики' }));
    expect(screen.getByTestId('stat-nurse-harrow-health').textContent?.replace(/\s/g, '')).toBe(
      '1050',
    );
    expect(screen.getByRole('slider')).toHaveValue('11');
  });

  it('clears a hidden numeric sort when changing the visible stat group', async () => {
    useMobileViewport();
    const user = userEvent.setup();
    render(<App initialSnapshot={data} />);
    await user.click(screen.getByRole('button', { name: 'Здоровье: сортировать' }));
    expect(screen.getByRole('table').querySelector('tbody tr')).toHaveAttribute(
      'data-hero',
      'mo-krill',
    );
    await user.click(screen.getByRole('button', { name: 'Приросты за LVL' }));
    expect(screen.getByRole('table').querySelector('tbody tr')).toHaveAttribute(
      'data-hero',
      'abrams',
    );
    await user.click(screen.getByRole('button', { name: '+ HP: сортировать' }));
    expect(screen.getByRole('table').querySelector('tbody tr')).toHaveAttribute(
      'data-hero',
      'mo-krill',
    );
  });

  it('restores all columns when a mobile viewport becomes wide', async () => {
    const changeViewport = useMobileViewport();
    const user = userEvent.setup();
    render(<App initialSnapshot={data} />);
    await user.click(screen.getByRole('button', { name: 'Приросты за LVL' }));
    changeViewport(false);
    expect(within(screen.getByRole('table')).getAllByRole('columnheader')).toHaveLength(10);
    expect(screen.getByTestId('stat-nurse-harrow-health')).toHaveTextContent('730');
    expect(screen.getByTestId('stat-nurse-harrow-healthGrowth')).toHaveTextContent('+32');
    expect(screen.queryByRole('button', { name: 'Приросты за LVL' })).not.toBeInTheDocument();
  });
});

it('keeps the home usable when a spotlight hero is absent from a valid snapshot', () => {
  window.location.hash = '#/';
  const partial = structuredClone(data);
  partial.heroes = partial.heroes.filter((hero) => hero.name !== 'Nurse Harrow');
  partial.meta.heroCount = partial.heroes.length;
  render(<App initialSnapshot={partial} />);
  expect(screen.getByRole('link', { name: /^Открыть реестр$/ })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Violet' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Nurse Harrow' })).not.toBeInTheDocument();
});

describe('hero register', () => {
  it('keyboard skip link keeps the current page and focuses its content', async () => {
    const user = userEvent.setup();
    render(<App initialSnapshot={data} />);
    await user.click(screen.getByRole('link', { name: 'К содержимому' }));
    expect(window.location.hash).toBe('#/heroes');
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.getByRole('table')).toBeVisible();
  });
  it('updates a hero deep link when navigating between filters on the same page', () => {
    window.location.hash = '#/heroes?hero=nurse-harrow';
    render(<App initialSnapshot={data} />);
    expect(screen.getByRole('searchbox')).toHaveValue('Nurse Harrow');
    window.location.hash = '#/heroes?hero=violet';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(screen.getByRole('searchbox')).toHaveValue('Violet');
  });
  it('renders all heroes with real stat values and sortable column buttons', () => {
    render(<App initialSnapshot={data} />);
    const table = screen.getByRole('table', { name: 'Характеристики героев' });
    expect(within(table).getAllByRole('row')).toHaveLength(45);
    expect(screen.getByTestId('stat-nurse-harrow-regen')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-nurse-harrow-health')).toHaveTextContent('730');
    expect(screen.getAllByRole('button', { name: /сортировать/i })).toHaveLength(10);
  });
  it('searches Russian aliases and recovers from an empty result', async () => {
    const user = userEvent.setup();
    render(<App initialSnapshot={data} />);
    const input = screen.getByRole('searchbox', { name: 'Найти героя' });
    await user.type(input, 'харроу');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    await user.clear(input);
    await user.type(input, 'невозможный герой');
    expect(screen.getByText('Таких героев в досье нет')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Очистить поиск' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(45);
  });
  it('changes numeric sort in both directions', async () => {
    const user = userEvent.setup();
    render(<App initialSnapshot={data} />);
    const button = screen.getByRole('button', { name: 'Здоровье: сортировать' });
    await user.click(button);
    const expected = selectHeroes(data.heroes, '', 'health', 'desc', 1)[0];
    expect(screen.getByRole('table').querySelector('tbody tr')).toHaveAttribute(
      'data-hero',
      expected.slug,
    );
    await user.click(button);
    const lowest = selectHeroes(data.heroes, '', 'health', 'asc', 1)[0];
    expect(screen.getByRole('table').querySelector('tbody tr')).toHaveAttribute(
      'data-hero',
      lowest.slug,
    );
  });
  it('recalculates a selected level and resets the controls', async () => {
    const user = userEvent.setup();
    render(<App initialSnapshot={data} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Уровень героя' }), {
      target: { value: '11' },
    });
    expect(screen.getByTestId('stat-nurse-harrow-health').textContent?.replace(/\s/g, '')).toBe(
      '1050',
    );
    await user.click(screen.getByRole('button', { name: 'Сбросить настройки' }));
    expect(screen.getByRole('slider')).toHaveValue('1');
    expect(screen.getByTestId('stat-nurse-harrow-health')).toHaveTextContent('730');
  });
  it('opens source methodology in a closeable dialog', async () => {
    const user = userEvent.setup();
    render(<App initialSnapshot={data} />);
    await user.click(screen.getByRole('button', { name: 'Как считаем характеристики' }));
    expect(screen.getByRole('dialog', { name: 'Как устроены цифры' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Параметры героев/ })).toHaveAttribute(
      'href',
      expect.stringContaining('client_version=6819'),
    );
    await user.click(screen.getByRole('button', { name: 'Закрыть методику' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

it('home links to the real register and spotlights both new releases', () => {
  window.location.hash = '#/';
  render(<App initialSnapshot={data} />);
  expect(screen.getByRole('link', { name: 'Открыть реестр' })).toHaveAttribute('href', '#/heroes');
  expect(screen.getByRole('heading', { name: 'Nurse Harrow' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Violet' })).toBeVisible();
});

it('shows a data error and can retry successfully', async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, 'fetch')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(new Response(JSON.stringify(data), { status: 200 }));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить досье');
  await user.click(screen.getByRole('button', { name: 'Повторить загрузку' }));
  expect(await screen.findByRole('table', { name: 'Характеристики героев' })).toBeVisible();
});
