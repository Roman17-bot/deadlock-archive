// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { StrictMode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import catalog from '../data/items.json';
import statistics from '../data/item-statistics.json';
import { ItemsPage } from '../src/pages/ItemsPage/ItemsPage';
import { ItemDetailPage } from '../src/pages/ItemDetailPage/ItemDetailPage';
import { i18n } from '../src/i18n';
import { ItemSkeleton } from '../src/features/items/ItemSkeleton';

beforeEach(async () => {
  vi.resetModules();
  await i18n.changeLanguage('ru');
  window.history.replaceState(null, '', '#/items');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const response = (value: unknown) => ({ ok: true, json: async () => value });

it('coalesces requests, preserves other subscribers when one cancels, and expires same-version data', async () => {
  const { loadItems } = await import('../src/services/itemsApi');
  let resolve!: (value: ReturnType<typeof response>) => void;
  const fetcher = vi.fn().mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  vi.stubGlobal('fetch', fetcher);
  const first = new AbortController();
  const cancelled = loadItems(first.signal);
  const second = loadItems(new AbortController().signal);
  expect(fetcher).toHaveBeenCalledTimes(1);
  first.abort();
  resolve(response(catalog));
  await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
  await expect(second).resolves.toEqual(catalog);
  await loadItems(new AbortController().signal);
  expect(fetcher).toHaveBeenCalledTimes(1);
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
  fetcher.mockResolvedValueOnce(response(catalog));
  await loadItems(new AbortController().signal);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('does not cache invalid responses or failures', async () => {
  const { loadItems } = await import('../src/services/itemsApi');
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response({}))
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(response(catalog));
  vi.stubGlobal('fetch', fetcher);
  await expect(loadItems(new AbortController().signal)).rejects.toThrow();
  await expect(loadItems(new AbortController().signal)).rejects.toThrow('offline');
  await expect(loadItems(new AbortController().signal)).resolves.toEqual(catalog);
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('invalidates both caches when statistics and catalog versions disagree', async () => {
  const { loadItems, loadItemStatistics } = await import('../src/services/itemsApi');
  const nextCatalog = {
    ...catalog,
    meta: { ...catalog.meta, clientVersion: catalog.meta.clientVersion + 1 },
  };
  const nextStatistics = {
    ...statistics,
    meta: { ...statistics.meta, clientVersion: nextCatalog.meta.clientVersion },
  };
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response(catalog))
    .mockResolvedValueOnce(response(nextStatistics))
    .mockResolvedValueOnce(response(nextCatalog))
    .mockResolvedValueOnce(response(nextStatistics));
  vi.stubGlobal('fetch', fetcher);
  const signal = new AbortController().signal;
  const previous = await loadItems(signal);
  await expect(loadItemStatistics(signal, previous)).rejects.toThrow('Invalid item statistics');
  const refreshed = await loadItems(signal);
  expect(refreshed.meta.clientVersion).toBe(nextCatalog.meta.clientVersion);
  await expect(loadItemStatistics(signal, refreshed)).resolves.toEqual(nextStatistics);
  expect(fetcher).toHaveBeenCalledTimes(4);
});

it('renders an accessible catalog skeleton without requesting statistics, then offers retry on error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  render(<ItemsPage />);
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  expect(document.querySelector('.item-skeleton-catalog')).toBeInTheDocument();
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(document.querySelector('.item-skeleton')).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(vi.mocked(fetch).mock.calls[0][0])).not.toContain('statistics');
});

it('starts detail statistics alongside catalog in StrictMode and replaces both skeletons', async () => {
  const pending = new Map<string, (value: ReturnType<typeof response>) => void>();
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => new Promise((resolve) => pending.set(url, resolve))),
  );
  render(
    <StrictMode>
      <ItemDetailPage slug={catalog.items[0].slug} />
    </StrictMode>,
  );
  expect(fetch).toHaveBeenCalledTimes(2);
  expect([...pending.keys()].some((url) => url.includes('statistics'))).toBe(true);
  expect(document.querySelector('.item-skeleton-detail')).toBeInTheDocument();
  await act(async () => {
    for (const [url, resolve] of pending)
      if (!url.includes('statistics')) resolve(response(catalog));
  });
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(catalog.items[0].name),
  );
  expect(document.querySelector('.item-skeleton-statistics')).toBeInTheDocument();
  await act(async () => {
    for (const [url, resolve] of pending) if (url.includes('statistics')) resolve(response({}));
  });
  expect(await screen.findByText('Статистика покупок недоступна.')).toBeVisible();
  expect(document.querySelector('.item-skeleton')).not.toBeInTheDocument();
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
  const updatedCatalog = structuredClone(catalog);
  updatedCatalog.items[0].name = 'Updated item';
  fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }));
  expect(document.querySelector('.item-skeleton-statistics')).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(4);
  await act(async () => {
    for (const [url, resolve] of pending)
      resolve(response(url.includes('statistics') ? statistics : updatedCatalog));
  });
  expect(document.querySelector('.item-skeleton')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Updated item');
  expect(screen.queryByText('Статистика покупок недоступна.')).not.toBeInTheDocument();
  cleanup();
  render(<ItemsPage />);
  expect(await screen.findByRole('link', { name: /Updated item/ })).toBeVisible();
  expect(fetch).toHaveBeenCalledTimes(4);
});

it('localizes skeleton status in English', async () => {
  await i18n.changeLanguage('en');
  const { rerender } = render(
    <I18nextProvider i18n={i18n}>
      <ItemSkeleton variant="detail" />
    </I18nextProvider>,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Loading items…');
  rerender(
    <I18nextProvider i18n={i18n}>
      <ItemSkeleton variant="statistics" />
    </I18nextProvider>,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Loading statistics…');
});
