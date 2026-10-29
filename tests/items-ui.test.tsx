// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ItemCatalog, ItemStatistics, ShopItem } from '../shared/item-types';
import { ItemsPage } from '../src/pages/ItemsPage/ItemsPage';
import { ItemDetailPage } from '../src/pages/ItemDetailPage/ItemDetailPage';
import { i18n } from '../src/i18n';
import { ITEM_FILTER_GROUPS } from '../shared/item-filters';
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
  await user.type(screen.getByRole('searchbox', { name: 'Поиск предметов' }), 'Alpha');
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
it('switches categories exclusively, keeps the selected category, and explicitly restores all', async () => {
  const user = userEvent.setup();
  render(<ItemsPage initialCatalog={catalog} />);
  const all = screen.getByRole('button', { name: 'Все категории' });
  expect(all).toHaveAttribute('aria-pressed', 'true');
  await user.click(screen.getByRole('button', { name: 'Оружие' }));
  await user.click(screen.getByRole('button', { name: 'Спирит' }));
  expect(screen.getByRole('button', { name: 'Оружие' })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.queryByRole('link', { name: /Alpha/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Beta/ })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Спирит' }));
  expect(window.location.hash).toBe('#/items?category=spirit');
  await user.click(all);
  expect(screen.getByRole('link', { name: /Alpha/ })).toBeVisible();
  expect(window.location.hash).toBe('#/items');
});
it('switches one property globally with replacement counts and an explicit all option', async () => {
  const user = userEvent.setup();
  render(
    <ItemsPage
      initialCatalog={{
        ...catalog,
        items: [
          { ...catalog.items[0], tags: ['anti-heal'] },
          { ...catalog.items[1], tags: ['bullet-resist'] },
          { ...item(3, 'Gamma', 'weapon'), tags: ['bullet-resist'] },
          { ...item(4, 'Delta', 'weapon'), tags: ['bullet-resist'] },
        ],
      }}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Оружие' }));
  const panel = within(screen.getByRole('complementary'));
  await user.click(panel.getByText('Противодействие', { selector: 'summary span' }));
  await user.click(panel.getByRole('button', { name: 'Антихил' }));
  expect(screen.getByRole('link', { name: /Alpha/ })).toBeVisible();
  const bullet = panel.getByRole('button', { name: 'Сопротивление пулям' });
  expect(within(bullet).getByText('2')).toBeVisible();
  await user.click(bullet);
  expect(panel.getByRole('button', { name: 'Антихил' })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.queryByRole('link', { name: /Alpha/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Beta/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Gamma/ })).toBeVisible();
  await user.click(bullet);
  expect(window.location.hash).toBe('#/items?category=weapon&tags=bullet-resist');
  const all = panel.getByRole('button', { name: 'Все свойства' });
  expect(within(all).getByText('3')).toBeVisible();
  await user.click(all);
  expect(screen.getByRole('link', { name: /Alpha/ })).toBeVisible();
  expect(window.location.hash).toBe('#/items?category=weapon');
});
it('exposes all 59 properties once as grouped buttons without checkbox or matching-mode controls', async () => {
  const user = userEvent.setup();
  render(<ItemsPage initialCatalog={catalog} />);
  const panel = within(screen.getByRole('complementary'));
  for (const group of ITEM_FILTER_GROUPS) {
    const summary = panel.getByText(group.label.ru, { selector: 'summary span' });
    if (!summary.closest('details')!.open) await user.click(summary);
    for (const property of group.filters) {
      expect(panel.getAllByRole('button', { name: property.label.ru })).toHaveLength(1);
    }
  }
  expect(panel.getAllByRole('button')).toHaveLength(60);
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
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
it('keeps phone categories available while secondary filters are collapsed', async () => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width'),
    addEventListener() {},
    removeEventListener() {},
  }));
  render(<ItemsPage initialCatalog={catalog} />);
  expect(screen.getByRole('button', { name: 'Все свойства' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Сопротивление пулям' })).toBeVisible();
  expect(
    screen.getByText('Передвижение', { selector: 'summary span' }).closest('details'),
  ).not.toHaveAttribute('open');
  const spirit = screen.getByRole('button', { name: 'Спирит' });
  expect(spirit.closest('details')).toBeNull();
  await userEvent.click(spirit);
  expect(spirit).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('link', { name: /Alpha/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Beta/ })).toBeVisible();
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
  expect(screen.queryByText(/All ranks/)).not.toBeInTheDocument();
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

it('searches properties independently, opens matching controls, and resets every criterion', async () => {
  const user = userEvent.setup();
  window.history.replaceState(
    null,
    '',
    '#/items?q=Alpha&category=weapon&tier=1&activation=passive&tags=anti-heal&mode=any',
  );
  render(
    <ItemsPage
      initialCatalog={{
        ...catalog,
        items: [{ ...catalog.items[0], tags: ['anti-heal'] }, catalog.items[1]],
      }}
    />,
  );
  const propertySearch = screen.getByRole('searchbox', { name: 'Поиск свойств' });
  const originalHash = window.location.hash;
  await user.type(propertySearch, 'диспел');
  expect(screen.getByRole('button', { name: 'Снятие дебаффов' })).toBeVisible();
  expect(screen.getByRole('searchbox', { name: 'Поиск предметов' })).toHaveValue('Alpha');
  expect(window.location.hash).toBe(originalHash);
  expect(screen.getByRole('link', { name: /Alpha/ })).toBeVisible();
  await user.clear(propertySearch);
  await user.type(propertySearch, 'zzzz');
  expect(screen.getByText('Свойства не найдены')).toBeVisible();
  expect(screen.getByRole('link', { name: /Alpha/ })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
  expect(propertySearch).toHaveValue('');
  expect(window.location.hash).toBe('#/items');
  expect(screen.getByRole('searchbox', { name: 'Поиск предметов' })).toHaveValue('');
  expect(screen.getByRole('link', { name: /Beta/ })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Сбросить фильтры' })).toBeVisible();
});
it('derives tier costs from the catalog and keeps activation independent', async () => {
  const user = userEvent.setup();
  render(
    <ItemsPage
      initialCatalog={{
        ...catalog,
        items: [
          catalog.items[0],
          { ...catalog.items[1], tier: 2, cost: 1750, activation: 'active' },
        ],
      }}
    />,
  );
  const tiers = screen.getByRole('group', { name: 'Тиры' });
  const secondTier = within(tiers).getByRole('button', { name: 'Тир 2' });
  expect(secondTier).toHaveTextContent(/II.*1.750/);
  await user.click(secondTier);
  expect(screen.queryByRole('link', { name: /Alpha/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Beta/ })).toBeVisible();
  await user.click(
    within(screen.getByRole('group', { name: 'Активация' })).getByRole('button', {
      name: 'Пассивные',
    }),
  );
  expect(screen.getByText('Ничего не найдено')).toBeVisible();
  expect(window.location.hash).toContain('tier=2');
  expect(window.location.hash).toContain('activation=passive');
});

it('resets a property-only search and exposes translated controls in English', async () => {
  await i18n.changeLanguage('en');
  const user = userEvent.setup();
  render(<ItemsPage initialCatalog={catalog} />);
  expect(screen.getByRole('heading', { name: 'Items for the situation' })).toBeVisible();
  const effectSearch = screen.getByRole('searchbox', { name: 'Search effects' });
  await user.type(effectSearch, 'zzzz');
  expect(screen.getByText('No effects found')).toBeVisible();
  const reset = screen.getByRole('button', { name: 'Reset filters' });
  expect(reset).toBeEnabled();
  await user.click(reset);
  expect(effectSearch).toHaveValue('');
  expect(screen.queryByText('No effects found')).not.toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Activation' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Tier 1' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Control immunity' })).toBeVisible();
  expect(window.location.hash).toBe('#/items');
});

it('puts property discovery first in the situational panel keyboard order', async () => {
  const user = userEvent.setup();
  render(<ItemsPage initialCatalog={catalog} />);
  await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
  await user.tab();
  expect(screen.getByRole('searchbox', { name: 'Поиск свойств' })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('button', { name: 'Все свойства' })).toHaveFocus();
});

it('lets players use the visible shortcut label as its accessible name', async () => {
  const user = userEvent.setup();
  render(
    <ItemsPage
      initialCatalog={{
        ...catalog,
        items: [{ ...catalog.items[0], tags: ['bullet-resist'] }, catalog.items[1]],
      }}
    />,
  );
  const bulletResistance = screen.getByRole('button', { name: 'Сопротивление пулям' });
  await user.click(bulletResistance);
  expect(bulletResistance).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('link', { name: /Alpha/ })).toBeVisible();
  expect(screen.queryByRole('link', { name: /Beta/ })).not.toBeInTheDocument();
  expect(window.location.hash).toContain('tags=bullet-resist');
});

it('keeps search, category, tier and activation context in replacement and all-property counts', () => {
  window.history.replaceState(
    null,
    '',
    '#/items?q=pick&category=weapon&tier=1&activation=passive&tags=anti-heal',
  );
  render(
    <ItemsPage
      initialCatalog={{
        ...catalog,
        items: [
          { ...catalog.items[0], description: { ru: 'выбор', en: 'pick' }, tags: ['anti-heal'] },
          {
            ...catalog.items[1],
            description: { ru: 'выбор', en: 'pick' },
            tags: ['bullet-resist'],
          },
          {
            ...item(3, 'Gamma', 'weapon'),
            description: { ru: 'выбор', en: 'pick' },
            tags: ['bullet-resist'],
          },
          { ...item(4, 'Echo', 'weapon'), tags: ['bullet-resist'] },
          {
            ...item(5, 'Delta', 'weapon'),
            description: { ru: 'выбор', en: 'pick' },
            tier: 2,
            tags: ['bullet-resist'],
          },
          {
            ...item(6, 'Theta', 'weapon'),
            description: { ru: 'выбор', en: 'pick' },
            activation: 'active',
            tags: ['bullet-resist'],
          },
        ],
      }}
    />,
  );
  const panel = within(screen.getByRole('complementary'));
  expect(
    within(panel.getByRole('button', { name: 'Сопротивление пулям' })).getByText('1'),
  ).toBeVisible();
  expect(within(panel.getByRole('button', { name: 'Все свойства' })).getByText('2')).toBeVisible();
});
it('canonicalizes a legacy URL in the rendered page and reveals its sole selected property', () => {
  window.history.replaceState(
    null,
    '',
    '#/items?category=invalid,spirit,weapon&tags=invalid,anti-heal,bullet-resist&mode=any',
  );
  render(
    <ItemsPage
      initialCatalog={{
        ...catalog,
        items: [
          { ...catalog.items[0], tags: ['bullet-resist'] },
          { ...catalog.items[1], tags: ['anti-heal'] },
        ],
      }}
    />,
  );
  expect(window.location.hash).toBe('#/items?category=spirit&tags=anti-heal');
  const panel = within(screen.getByRole('complementary'));
  expect(panel.getByRole('button', { name: 'Антихил' })).toHaveAttribute('aria-pressed', 'true');
  expect(panel.getByRole('button', { name: 'Сопротивление пулям' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  expect(screen.getByRole('button', { name: 'Спирит' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('link', { name: /Beta/ })).toBeVisible();
  expect(screen.queryByRole('link', { name: /Alpha/ })).not.toBeInTheDocument();
});

it('leaves detail and other routes intact during the catalog hashchange handoff', () => {
  render(<ItemsPage initialCatalog={catalog} />);
  const detail = screen.getByRole('link', { name: /Alpha/ }).getAttribute('href')!;
  window.history.replaceState(null, '', detail);
  fireEvent(window, new HashChangeEvent('hashchange'));
  expect(window.location.hash).toBe(detail);
  window.history.replaceState(null, '', '#/heroes');
  fireEvent(window, new HashChangeEvent('hashchange'));
  expect(window.location.hash).toBe('#/heroes');
});
