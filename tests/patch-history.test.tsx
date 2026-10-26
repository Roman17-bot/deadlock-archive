// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import history from '../data/version-history.json';
import snapshot from '../data/heroes.json';
import { validateVersionHistory } from '../shared/version-history';
import { VersionHistory } from '../src/pages/UpdatesPage/components/VersionHistory';
import { setLanguage } from '../src/i18n';

const patch = {
  source: 'steamdb',
  steamBuildId: 26147187,
  gameCommit: snapshot.meta.gameCommit,
  url: 'https://steamdb.info/patchnotes/26147187/',
  notes: 'unpublished',
  checkedAt: '2026-10-26T09:00:00.000Z',
};
const withPatch = (value: unknown = patch) => ({
  ...history,
  versions: [{ ...history.versions[0], patch: value }],
});
const legacyHistory = {
  ...history,
  versions: history.versions.map((entry) =>
    Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'patch')),
  ),
};

beforeEach(async () => {
  await setLanguage('ru');
});
afterEach(cleanup);

it('accepts old history and rejects unsafe, mismatched or oversized patch metadata', () => {
  expect(validateVersionHistory(legacyHistory)).toBe(true);
  expect(validateVersionHistory(withPatch())).toBe(true);
  for (const value of [
    null,
    { ...patch, url: 'javascript:alert(1)' },
    { ...patch, url: 'https://steamdb.info.evil.test/patchnotes/26147187/' },
    { ...patch, url: 'https://steamdb.info/patchnotes/6819/' },
    { ...patch, gameCommit: 'not-a-commit' },
    { ...patch, checkedAt: 'yesterday' },
    { ...patch, notes: 'guessed' },
    { ...patch, summary: { ru: 'Описание', en: '' } },
    { ...patch, title: 'x'.repeat(241) },
  ])
    expect(validateVersionHistory(withPatch(value))).toBe(false);
});

function show(value: unknown) {
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

it('opens the exact Steam build from the client version and explains absent notes', () => {
  show(withPatch());
  const link = screen.getByRole('link', { name: /6819/ });
  expect(link).toHaveAttribute('href', patch.url);
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  expect(screen.getByText(/Официальный патчноут.*не опубликован/)).toBeVisible();
  expect(screen.getByText(/26147187/)).toBeVisible();
});

it('renders a published patch title and bilingual summary as text with an honest legacy fallback', async () => {
  await setLanguage('en');
  show(
    withPatch({
      ...patch,
      notes: 'published',
      title: '<b>Update</b>',
      summary: { ru: 'Изменения героев.', en: 'Hero changes.' },
    }),
  );
  expect(screen.getByText('<b>Update</b>')).toBeVisible();
  expect(document.querySelector('.history-patch b')).toBeNull();
  expect(screen.getByText('Hero changes.')).toBeVisible();
  cleanup();
  show(legacyHistory);
  expect(screen.queryByRole('link', { name: /6819/ })).not.toBeInTheDocument();
  expect(screen.getByText(/Patch details have not been linked/)).toBeVisible();
});
