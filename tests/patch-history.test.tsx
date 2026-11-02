// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import history from './fixtures/6819/version-history.json';
import snapshot from './fixtures/6819/heroes.json';
import { validateVersionHistory, type OfficialPatch } from '../shared/version-history';
import { VersionHistory } from '../src/pages/UpdatesPage/components/VersionHistory';
import { i18n, setLanguage } from '../src/i18n';
import { I18nextProvider } from 'react-i18next';

export const officialPatch: OfficialPatch = {
  id: '1847920302240420',
  source: 'steam',
  url: 'https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1847920302240420',
  publishedAt: '2026-10-30T20:51:49.000Z',
  title: { en: 'Halloween 2026 + Gameplay Update', ru: 'Хэллоуин 2026 и обновление игры' },
  body: {
    en: '## Heroes\n- Nurse Harrow: Healing Needles reduced from 25 to 22.\n- Abrams: Gun damage increased by 5%.',
    ru: '## Герои\n- Nurse Harrow: Лечение за выстрел снижено с 25 до 22.\n- Abrams: Урон оружия увеличен на 5%.',
  },
};
const withPatches = (patches: unknown[] = [officialPatch]) => ({ ...history, patches });

beforeEach(async () => {
  vi.resetModules();
  await setLanguage('ru');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('accepts legacy audit history and rejects unsafe or empty official descriptions', () => {
  expect(validateVersionHistory(history)).toBe(true);
  expect(validateVersionHistory(withPatches())).toBe(true);
  for (const patch of [
    null,
    { ...officialPatch, id: 'news' },
    { ...officialPatch, source: 'guessed' },
    { ...officialPatch, url: 'javascript:alert(1)' },
    { ...officialPatch, url: officialPatch.url.replace('akamaihd.net', 'akamaihd.net.evil.test') },
    { ...officialPatch, publishedAt: 'yesterday' },
    { ...officialPatch, clientVersion: -1 },
    { ...officialPatch, title: { en: 'x'.repeat(241) } },
    { ...officialPatch, body: { en: ' ' } },
    { ...officialPatch, body: { en: 'x'.repeat(200_001) } },
  ])
    expect(validateVersionHistory(withPatches([patch]))).toBe(false);
  expect(validateVersionHistory(withPatches([officialPatch, officialPatch]))).toBe(false);
});

function show(value: unknown = withPatches()) {
  if (!validateVersionHistory(value)) throw new Error('Invalid test history');
  return render(
    <I18nextProvider i18n={i18n}>
      <VersionHistory
        data={snapshot}
        mode="public"
        history={value}
        historyStatus="ready"
        historyVisible
        retryHistory={() => {}}
      />
    </I18nextProvider>,
  );
}
async function expand() {
  const details = document.querySelector('details')!;
  details.open = true;
  fireEvent(details, new Event('toggle'));
  await waitFor(() => expect(screen.getByText('Свернуть изменения')).toBeVisible());
}

it('hides bare build audit entries and shows an honest empty state', () => {
  show(history);
  expect(document.querySelector('.version-history-list')).toBeNull();
  expect(screen.queryByText('6819')).not.toBeInTheDocument();
  expect(
    screen.getByText('Описания обновлений появятся здесь после следующей проверки.'),
  ).toBeVisible();
});

it('expands actual readable notes and opens the exact official news URL', async () => {
  show();
  expect(screen.getByText(officialPatch.title.ru!)).toBeVisible();
  expect(screen.queryByText(/Лечение за выстрел/)).not.toBeInTheDocument();
  await expand();
  expect(screen.getByRole('heading', { name: 'Герои' })).toBeVisible();
  expect(screen.getByText('Nurse Harrow').closest('li')).toHaveTextContent(
    'Nurse Harrow: Лечение за выстрел снижено с 25 до 22.',
  );
  const link = screen.getByRole('link', { name: 'Открыть в Steam' });
  expect(link).toHaveAttribute('href', officialPatch.url);
  expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  expect(screen.queryByText('6819')).not.toBeInTheDocument();
});

it('adds the matching portrait to official Nurse shorthand and highlights values, not tier labels', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No request expected'));
  show(
    withPatches([
      {
        ...officialPatch,
        body: {
          en: '## Heroes\n- Nurse: Healing Needles - T3 changed from 25 to 22; scaling 0.24.',
        },
      },
    ]),
  );
  await expand();
  const line = screen.getByText('Nurse').closest('li')!;
  expect(line.querySelector('img')).toHaveAttribute('src', '/assets/heroes/nurse-harrow.webp');
  expect(line.querySelector('img')).toHaveAttribute('alt', '');
  expect(line).toHaveTextContent(
    'Nurse: Healing Needles - T3 changed from 25 to 22; scaling 0.24.',
  );
  expect([...line.querySelectorAll('.patch-note-number')].map((n) => n.textContent)).toEqual([
    '25',
    '22',
    '0.24',
  ]);
  expect(fetcher).not.toHaveBeenCalled();
});

it('keeps text readable while item icons load and reuses one catalogue for multiple notes', async () => {
  const catalog = (await import('../data/items.json')).default;
  let finish!: (value: Response) => void;
  const request = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const fetcher = vi.spyOn(globalThis, 'fetch').mockReturnValue(request);
  show(
    withPatches([
      {
        ...officialPatch,
        body: { en: '## Items\n- Divine Barrier: Cooldown increased from 45s to 55s.' },
      },
      {
        ...officialPatch,
        id: '124',
        url: officialPatch.url.replace(officialPatch.id, '124'),
        body: { en: '## Items\n- Radiant Regeneration: Healing reduced from 65 to 40.' },
      },
    ]),
  );
  expect(fetcher).not.toHaveBeenCalled();
  await expand();
  const line = screen.getByText('Divine Barrier').closest('li')!;
  expect(line).toHaveTextContent('Divine Barrier: Cooldown increased from 45s to 55s.');
  expect(line.querySelector('img')).toBeNull();
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  finish(Response.json(catalog));
  await waitFor(() =>
    expect(line.querySelector('img')).toHaveAttribute('src', '/assets/items/divine-barrier.webp'),
  );
  expect(line.querySelector('img')).toHaveAttribute('loading', 'lazy');
  expect(line).toHaveAttribute('data-category', 'vitality');
  const second = document.querySelectorAll('details')[1];
  second.open = true;
  fireEvent(second, new Event('toggle'));
  await waitFor(() =>
    expect(
      screen.getByText('Radiant Regeneration').closest('li')?.querySelector('img'),
    ).toBeInTheDocument(),
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('retries missing icon metadata when a note is reopened after a network failure', async () => {
  const catalog = (await import('../data/items.json')).default;
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(Response.json(catalog));
  show(
    withPatches([
      { ...officialPatch, body: { en: '- Divine Barrier: Cooldown increased from 45s to 55s.' } },
    ]),
  );
  await expand();
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  const details = document.querySelector('details')!;
  details.open = false;
  fireEvent(details, new Event('toggle'));
  await expand();
  await waitFor(() =>
    expect(
      screen.getByText('Divine Barrier').closest('li')?.querySelector('img'),
    ).toBeInTheDocument(),
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('renders source markup as text, with explicit English fallback and translated controls', async () => {
  show(
    withPatches([
      {
        ...officialPatch,
        title: { en: '<b>Update</b>' },
        body: { en: '<img src=x onerror=alert(1)>\nHero changes.' },
      },
    ]),
  );
  await expand();
  expect(screen.getByText('<b>Update</b>')).toBeVisible();
  expect(document.querySelector('.history-patch b, .history-patch img')).toBeNull();
  expect(screen.getByText('Оригинал на английском')).toBeVisible();
  expect(document.querySelector('.history-patch-copy')).toHaveAttribute('lang', 'en');
  await setLanguage('en');
  await waitFor(() => expect(screen.getByText('Collapse changes')).toBeVisible());
  expect(screen.getByRole('link', { name: 'Open on Steam' })).toHaveAttribute(
    'href',
    officialPatch.url,
  );
});
