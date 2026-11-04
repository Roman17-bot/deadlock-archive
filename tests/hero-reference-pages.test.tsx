// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import snapshot from './fixtures/6819/heroes.json';
import type { HeroSnapshot } from '../shared/types';
import type { HeroProfiles, HeroStatistics, HeroStatScope } from '../shared/hero-reference';
import { HeroRosterPage } from '../src/pages/HeroRosterPage/HeroRosterPage';
import { HeroStatisticsPage } from '../src/pages/HeroStatisticsPage/HeroStatisticsPage';
import { loadHeroProfiles, loadHeroStatistics } from '../src/services/heroReferenceApi';
import { setLanguage } from '../src/i18n';
vi.mock('../src/services/heroReferenceApi', () => ({
  loadHeroProfiles: vi.fn(),
  loadHeroStatistics: vi.fn(),
  referenceMedia: (s: string) => s,
}));
const data = { ...snapshot, heroes: snapshot.heroes.slice(0, 2) } as HeroSnapshot;
const [a, b] = data.heroes;
const pair = {
  from: '2026-09-01',
  to: '2026-10-04',
  updatedAt: '2026-10-04',
  sameLane: false as const,
  minMatches: 10,
  rows: [],
};
function statistics(): HeroStatistics {
  const scope: HeroStatScope = {
    id: 'normal-all',
    mode: 'all',
    gameMode: 'normal',
    matchModes: [],
    rankMin: null,
    rankMax: null,
    updatedAt: '2026-10-04',
    from: '2026-09-10',
    to: '2026-10-04',
    requestedFrom: '2026-09-01',
    requestedTo: '2026-10-04',
    days: [
      {
        date: '2026-09-10',
        totalSelections: 200,
        rows: [
          { heroId: a.id, matches: 100, wins: 0, losses: 100 },
          { heroId: b.id, matches: 100, wins: 100, losses: 0 },
        ],
      },
      ...[9, 4, 5].map((wins, i) => ({
        date: `2026-10-0${[1, 3, 4][i]}`,
        totalSelections: 20,
        rows: [
          { heroId: a.id, matches: 10, wins, losses: 10 - wins },
          { heroId: b.id, matches: 10, wins: 10 - wins, losses: wins },
        ],
      })),
    ],
  };
  return {
    schemaVersion: 1,
    clientVersion: 6848,
    sourceClientVersion: null,
    updatedAt: '2026-10-04',
    from: '2026-09-01',
    to: '2026-10-04',
    source: 'deadlock-api',
    timeResolutionSeconds: 3600,
    metric: 'selection-share',
    periods: [7, 30],
    scopes: [
      scope,
      ...Array.from({ length: 14 }, (_, i) => ({
        ...scope,
        id: `ranked-${i}`,
        mode: 'ranked' as const,
        rankMin: 11,
        rankMax: 16,
        days: [],
      })),
    ],
    matchups: pair,
    synergies: pair,
  };
}
beforeEach(async () => {
  await setLanguage('en');
  vi.mocked(loadHeroStatistics).mockResolvedValue(statistics());
  vi.mocked(loadHeroProfiles).mockResolvedValue({
    schemaVersion: 1,
    clientVersion: 6848,
    updatedAt: '2026-10-04',
    heroes: [],
  } satisfies HeroProfiles);
});
afterEach(async () => {
  cleanup();
  vi.resetAllMocks();
  await setLanguage('ru');
});

describe('hero roster', () => {
  it('uses the same 7 day normal-all cohort, previews by keyboard and keeps direct detail links', async () => {
    render(<HeroRosterPage data={data} />);
    const first = screen.getByRole('button', { name: `Preview ${a.name}` });
    expect(await within(first).findByText('60%')).toHaveClass('is-positive');
    const second = screen.getByRole('button', { name: `Preview ${b.name}` });
    expect(within(second).getByText('40%')).toHaveClass('is-negative');
    fireEvent.focus(second);
    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: b.name })).toBeVisible();
    expect(screen.getByRole('link', { name: `Details ${b.name}` })).toHaveAttribute(
      'href',
      `#/heroes/${b.slug}`,
    );
    expect(screen.getByText(/Green: ≥50%/)).toBeVisible();
  });
  it('recovers from an empty search without losing the selected preview', async () => {
    const user = userEvent.setup();
    render(<HeroRosterPage data={data} />);
    await user.type(screen.getByRole('searchbox'), 'impossiblehero');
    expect(screen.getByText('No heroes found.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reset search' }));
    expect(screen.getByRole('button', { name: `Preview ${a.name}` })).toBeVisible();
  });
});

describe('match statistics', () => {
  it('offers supported scopes and periods, sorts values and recomputes calendar windows', async () => {
    const user = userEvent.setup();
    render(<HeroStatisticsPage data={data} />);
    const table = await screen.findByRole('table');
    expect(
      within(screen.getByRole('combobox', { name: 'Matches and rank' })).getAllByRole('option'),
    ).toHaveLength(15);
    expect(table.querySelector('tbody tr')).toHaveTextContent(a.name);
    await user.click(screen.getByRole('button', { name: /^Win rate/ }));
    expect(table.querySelector('tbody tr')).toHaveTextContent(b.name);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Period' }), '30');
    expect(within(table).getAllByText('130', { exact: true })).toHaveLength(2);
    expect(screen.getByText(/exact client version are unavailable/)).toBeVisible();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Matches and rank' }),
      'ranked-0',
    );
    expect(within(table).getAllByText('No history')).toHaveLength(4);
  });
  it('keeps missing date gaps and exposes real daily counts with keyboard and numeric pp changes', async () => {
    render(<HeroStatisticsPage data={data} />);
    await screen.findByRole('table');
    const trend = screen.getByRole('button', { name: new RegExp(`${a.name} Win rate:`) });
    expect(trend.querySelector('path')?.getAttribute('d')?.match(/M/g)).toHaveLength(2);
    expect(trend.querySelector('path')?.getAttribute('d')?.match(/L/g)).toHaveLength(1);
    fireEvent.focus(trend);
    expect(screen.getByRole('tooltip')).toHaveTextContent('October 4, 2026 · 50% · matches: 10');
    fireEvent.keyDown(trend, { key: 'ArrowLeft' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('October 3, 2026 · 40% · matches: 10');
    expect(screen.getAllByText('-40 pp')).toHaveLength(1);
    fireEvent.keyDown(trend, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('retries failed loading and presents Russian controls', async () => {
    await setLanguage('ru');
    vi.mocked(loadHeroStatistics).mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    render(<HeroStatisticsPage data={data} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить статистику');
    await user.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByRole('table')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Матчи и ранг' })).toBeVisible();
    expect(vi.mocked(loadHeroStatistics).mock.calls[1][1]).toBe(true);
  });
});
