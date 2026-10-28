// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ItemCatalog, ItemStatistics, ShopItem } from '../shared/item-types';
import { ItemsPage } from '../src/pages/ItemsPage/ItemsPage';
import { ItemDetailPage } from '../src/pages/ItemDetailPage/ItemDetailPage';
import { i18n } from '../src/i18n';
import { ItemContent } from '../src/features/items/ItemContent';
const item = (id: number, name: string, category: ShopItem['category']): ShopItem => ({
  id,
  name,
  slug: name.toLowerCase(),
  localizedName: { ru: name, en: name },
  category,
  tier: 1,
  cost: 800,
  icon: `assets/items/${id}.webp`,
  activation: 'passive',
  description: { ru: 'Полезное свойство', en: 'Useful effect' },
  attributes: [],
  effects: [],
  tags: [],
  components: [],
  upgrades: [],
  advice: [],
});
const catalog: ItemCatalog = {
  meta: {
    schemaVersion: 1,
    clientVersion: 6821,
    sourceRevision: 1,
    updatedAt: '2026-10-28T00:00:00Z',
    itemCount: 2,
  },
  items: [item(1, 'Alpha', 'weapon'), item(2, 'Beta', 'spirit')],
};
beforeEach(async () => {
  window.history.replaceState(null, '', '#/items');
  await i18n.changeLanguage('ru');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('shows effect prose once and translates only Russian display units', async () => {
  const entry = {
    ...catalog.items[0],
    description: { ru: '  Даёт   ускорение. ', en: 'Grants speed.' },
    effects: [
      {
        kind: 'passive' as const,
        description: { ru: 'Даёт ускорение.', en: 'Grants speed.' },
        attributes: [],
      },
    ],
    attributes: [
      { key: 'duration', label: { ru: 'Длительность', en: 'Duration' }, value: '8 s' },
      { key: 'speed', label: { ru: 'Скорость', en: 'Speed' }, value: '+1.75m/s' },
      { key: 'regen', label: { ru: 'Регенерация', en: 'Regeneration' }, value: '2 HP/s' },
    ],
  };
  const { unmount } = render(<ItemContent item={entry} />);
  expect(screen.getAllByText('Даёт ускорение.')).toHaveLength(1);
  expect(screen.getByText('8 с')).toBeVisible();
  expect(screen.getByText('+1.75м/с')).toBeVisible();
  expect(screen.getByText('2 HP/с')).toBeVisible();
  unmount();
  await i18n.changeLanguage('en');
  render(<ItemContent item={entry} />);
  expect(screen.getAllByText('Grants speed.')).toHaveLength(1);
  expect(screen.getByText('8 s')).toBeVisible();
  expect(screen.getByText('+1.75m/s')).toBeVisible();
});
it('retains meaningful lead prose that differs from effects', () => {
  render(
    <ItemContent
      item={{
        ...catalog.items[0],
        effects: [
          {
            kind: 'passive',
            description: { ru: 'Отдельный эффект', en: 'Separate effect' },
            attributes: [],
          },
        ],
      }}
    />,
  );
  expect(screen.getByText('Полезное свойство')).toBeVisible();
  expect(screen.getByText('Отдельный эффект')).toBeVisible();
});
it('combines search and category, preserves URL and recovers empty results', async () => {
  const user = userEvent.setup();
  render(<ItemsPage initialCatalog={catalog} />);
  await user.type(screen.getByRole('searchbox'), 'Alpha');
  await user.click(screen.getByRole('button', { name: 'Спирит' }));
  expect(screen.getByText('Ничего не найдено')).toBeVisible();
  expect(window.location.hash).toContain('q=Alpha');
  await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
  expect(screen.getByRole('link', { name: /Alpha/ })).toBeVisible();
});
it('opens keyboard preview and dismisses it with Escape', () => {
  render(<ItemsPage initialCatalog={catalog} />);
  const link = screen.getByRole('link', { name: /Alpha/ });
  fireEvent.focus(link);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Полезное свойство');
  fireEvent.keyDown(link, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
it('dismisses a hover preview with Escape even without link focus', () => {
  render(<ItemsPage initialCatalog={catalog} />);
  fireEvent.mouseEnter(screen.getByRole('link', { name: /Alpha/ }).parentElement!);
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
it('combines situational conditions with explicit all and any modes', async () => {
  const user = userEvent.setup();
  const tagged = {
    ...catalog,
    items: [
      { ...catalog.items[0], tags: ['anti-heal'] },
      { ...catalog.items[1], tags: ['spirit-power'] },
    ],
  };
  render(<ItemsPage initialCatalog={tagged} />);
  await user.click(screen.getByText('Под задачу'));
  await user.click(screen.getByText('Противодействие'));
  await user.click(screen.getByRole('checkbox', { name: /Антихил/ }));
  await user.click(screen.getByText('Способности'));
  await user.click(screen.getByRole('checkbox', { name: /Спиритическая мощь/ }));
  expect(screen.getByText('Ничего не найдено')).toBeVisible();
  await user.click(screen.getByRole('radio', { name: 'Любое выбранное' }));
  expect(screen.getByRole('link', { name: /Alpha/ })).toBeVisible();
  expect(screen.getByRole('link', { name: /Beta/ })).toBeVisible();
  expect(window.location.hash).toContain('mode=any');
});
it('ignores unknown external filter identifiers instead of displaying them', () => {
  window.history.replaceState(null, '', '#/items?tags=internal_unknown');
  render(<ItemsPage initialCatalog={catalog} />);
  expect(screen.getByRole('link', { name: /Alpha/ })).toBeVisible();
  expect(screen.queryByText('internal_unknown')).not.toBeInTheDocument();
});
it('keeps catalog query when entering a detail and returning', () => {
  window.history.replaceState(null, '', '#/items?q=Alpha');
  render(<ItemsPage initialCatalog={catalog} />);
  const href = screen.getByRole('link', { name: /Alpha/ }).getAttribute('href')!;
  cleanup();
  window.history.replaceState(null, '', href);
  render(<ItemDetailPage slug="alpha" initialCatalog={catalog} />);
  expect(screen.getByRole('link', { name: /Назад/ })).toHaveAttribute('href', '#/items?q=Alpha');
});
it('shows unknown items without inventing statistics', () => {
  render(<ItemDetailPage slug="unknown" initialCatalog={catalog} />);
  expect(screen.getByText('Предмет не найден')).toBeVisible();
});
it('supports English detail and absent statistics', async () => {
  await i18n.changeLanguage('en');
  render(<ItemDetailPage slug="alpha" initialCatalog={catalog} />);
  expect(screen.getByText('Useful effect')).toBeVisible();
  expect(await screen.findByText('Purchase statistics are unavailable.')).toBeVisible();
});
it('keeps phone filters collapsed until requested', () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  render(<ItemsPage initialCatalog={catalog} />);
  expect(screen.getByText('Фильтры магазина').closest('details')).not.toHaveAttribute('open');
});
it('renders loading and recovers a failed catalog request', async () => {
  const { unmount } = render(<ItemsPage />);
  expect(screen.getByRole('status')).toHaveTextContent('Загрузка предметов');
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить предметы');
  unmount();
});
const statistics: ItemStatistics = {
  meta: {
    schemaVersion: 1,
    clientVersion: 6821,
    updatedAt: '2026-10-28T00:00:00Z',
    from: '2026-10-27T00:00:00Z',
    to: '2026-10-28T00:00:00Z',
    gameMode: 'normal',
    matchModes: ['ranked', 'unranked'],
    minAverageBadge: null,
    corruptedItems: 'exclude',
    source: 'deadlock-api',
  },
  items: [{ itemId: 1, matches: 40, wins: 23, losses: 17, averageBuyTimeSeconds: 905, heroes: [] }],
};
it('shows recorded wins, purchase count and rounded m:ss without causal claims', async () => {
  await i18n.changeLanguage('en');
  render(<ItemDetailPage slug="alpha" initialCatalog={catalog} initialStatistics={statistics} />);
  expect(screen.getByText('57.5%')).toBeVisible();
  expect(screen.getByText('40')).toBeVisible();
  expect(screen.getByText('15:05')).toBeVisible();
  expect(screen.getByText(/All ranks/)).toBeVisible();
});
it('treats zero purchases as absent observations instead of zero winrate', () => {
  render(
    <ItemDetailPage
      slug="alpha"
      initialCatalog={catalog}
      initialStatistics={{
        ...statistics,
        items: [
          { ...statistics.items[0], matches: 0, wins: 0, losses: 0, averageBuyTimeSeconds: null },
        ],
      }}
    />,
  );
  expect(screen.getByText('За этот период покупок нет.')).toBeVisible();
  expect(screen.queryByText('0%')).not.toBeInTheDocument();
});
