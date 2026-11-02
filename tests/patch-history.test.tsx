// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import history from './fixtures/6819/version-history.json';
import snapshot from './fixtures/6819/heroes.json';
import { validateVersionHistory, type OfficialPatch } from '../shared/version-history';
import { VersionHistory } from '../src/pages/UpdatesPage/components/VersionHistory';
import { setLanguage } from '../src/i18n';

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
  await setLanguage('ru');
});
afterEach(cleanup);

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
    <VersionHistory
      data={snapshot}
      mode="public"
      history={value}
      historyStatus="ready"
      historyVisible
      retryHistory={() => {}}
    />,
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
  expect(screen.getByText(/Лечение за выстрел снижено с 25 до 22/)).toBeVisible();
  const link = screen.getByRole('link', { name: 'Открыть в Steam' });
  expect(link).toHaveAttribute('href', officialPatch.url);
  expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  expect(screen.queryByText('6819')).not.toBeInTheDocument();
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
