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
import { AppRoutes } from '../src/app/routes';
import {
  loadHeroProfiles,
  loadHeroStatistics,
  loadHeroHistory,
} from '../src/services/heroReferenceApi';
import { setLanguage } from '../src/i18n';
import { loadAbilities } from '../src/services/abilitiesApi';
import { abilityFixture } from './fixtures/hero-abilities';
vi.mock('../src/services/abilitiesApi', () => ({ loadAbilities: vi.fn() }));
vi.mock('../src/services/heroReferenceApi', () => ({
  loadHeroProfiles: vi.fn(),
  loadHeroStatistics: vi.fn(),
  loadHeroHistory: vi.fn(),
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
  vi.mocked(loadAbilities).mockResolvedValue({
    meta: { ...data.meta, schemaVersion: 1, updatedAt: data.meta.checkedAt },
    heroes: data.heroes.map((hero) => ({
      heroId: hero.id,
      abilities: ([1, 2, 3, 4] as const).map((slot) => abilityFixture(hero.id * 10 + slot, slot)),
    })),
  });
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
    const first = screen.getByRole('link', { name: `Open dossier for ${a.name}` });
    expect(await within(first).findByText('60%')).toHaveClass('is-positive');
    const second = screen.getByRole('link', { name: `Open dossier for ${b.name}` });
    expect(within(second).getByText('40%')).toHaveClass('is-negative');
    fireEvent.focus(second);
    expect(screen.getByRole('heading', { name: b.name })).toBeVisible();
    expect(second).toHaveAttribute('href', `#/heroes/${b.slug}`);
    expect(screen.queryByText(/Green: ≥50%/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: `Details ${b.name}` })).not.toBeInTheDocument();
    fireEvent.mouseEnter(first);
    expect(screen.getByRole('heading', { name: a.name })).toBeVisible();
    expect(await screen.findByText('Ability 4')).toBeVisible();
  });
  it('recovers from an empty search without losing the selected preview', async () => {
    const user = userEvent.setup();
    render(<HeroRosterPage data={data} />);
    await user.type(screen.getByRole('searchbox'), 'impossiblehero');
    expect(screen.getByText('No heroes found.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reset search' }));
    expect(screen.getByRole('link', { name: `Open dossier for ${a.name}` })).toBeVisible();
  });
  it('falls back from unavailable artwork and loads a fresh image when the preview changes', () => {
    render(<HeroRosterPage data={data} />);
    const preview = screen.getByRole('complementary', { name: 'Hero preview' });
    const image = preview.querySelector('.roster-showcase-art')!;
    expect(image).toHaveAttribute('src', expect.stringContaining(`/roster/heroes/${a.slug}.webp`));
    fireEvent.error(image);
    expect(image).toHaveAttribute('src', expect.stringContaining(a.portrait));
    fireEvent.focus(screen.getByRole('link', { name: `Open dossier for ${b.name}` }));
    expect(preview.querySelector('.roster-showcase-art')).toHaveAttribute(
      'src',
      expect.stringContaining(`/roster/heroes/${b.slug}.webp`),
    );
  });
});

describe('match statistics', () => {
  it('separates mode and rank, orders metrics and offers real calendar periods', async () => {
    const user = userEvent.setup();
    render(
      <AppRoutes
        route="heroes"
        routeHash="#/heroes/statistics"
        data={data}
        onMethod={() => {}}
        onSnapshot={() => {}}
      />,
    );
    const table = await screen.findByRole('table');
    expect(screen.getByRole('link', { name: 'Heroes' })).toBeVisible();
    expect(
      within(screen.getByRole('navigation', { name: 'Hero pages' })).getByRole('link', {
        name: 'Match statistics',
      }),
    ).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('combobox', { name: 'Rank' })).not.toBeInTheDocument();
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Hero', 'Matches', 'Win rate', 'Pick share']);
    expect(table.querySelector('tbody tr')).toHaveTextContent(a.name);
    await user.click(screen.getByRole('button', { name: /^Win rate/ }));
    expect(table.querySelector('tbody tr')).toHaveTextContent(b.name);
    await user.click(screen.getByRole('button', { name: 'Month' }));
    expect(within(table).getAllByText('130', { exact: true })).toHaveLength(2);
    expect(screen.queryByText(/exact client version are unavailable/)).not.toBeInTheDocument();
    expect(screen.queryByText(/current day is partial/)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /How matches/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Mode' }));
    await user.click(screen.getByRole('option', { name: 'Ranked' }));
    expect(screen.getByRole('combobox', { name: 'Rank' })).toBeVisible();
    expect(within(table).getAllByText('No history')).toHaveLength(4);
    expect(loadHeroHistory).not.toHaveBeenCalled();
  });
  it('loads only the selected saved history on Year, retries failure and keeps old catalogues working', async () => {
    const stats = statistics();
    stats.historyScopes = ['normal-all'];
    vi.mocked(loadHeroStatistics).mockResolvedValue(stats);
    vi.mocked(loadHeroHistory)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(stats.scopes[0]);
    const user = userEvent.setup();
    render(<HeroStatisticsPage data={data} />);
    await screen.findByRole('table');
    expect(loadHeroHistory).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Year' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load history.');
    expect(loadHeroHistory).toHaveBeenCalledTimes(1);
    expect(vi.mocked(loadHeroHistory).mock.calls[0][0]).toBe('normal-all');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('table')).toBeVisible();
    expect(screen.queryByText(/Hero selections/)).not.toBeInTheDocument();
    expect(vi.mocked(loadHeroHistory).mock.calls[1][2]).toBe(true);
    await user.click(screen.getByRole('combobox', { name: 'Mode' }));
    await user.click(screen.getByRole('option', { name: 'Ranked' }));
    expect(loadHeroHistory).toHaveBeenCalledTimes(2);
  });
  it('keeps missing date gaps and exposes real daily counts with keyboard and numeric pp changes', async () => {
    render(<HeroStatisticsPage data={data} />);
    await screen.findByRole('table');
    const trend = screen.getByRole('button', { name: new RegExp(`${a.name} Win rate:`) });
    expect(trend.querySelector('path')?.getAttribute('d')?.match(/M/g)).toHaveLength(2);
    expect(trend.querySelector('path')?.getAttribute('d')?.match(/L/g)).toHaveLength(1);
    fireEvent.focus(trend);
    expect(document.body.querySelector(':scope > [role=tooltip]')).toBe(
      screen.getByRole('tooltip'),
    );
    expect(screen.getByRole('tooltip')).toHaveTextContent('October 4, 2026 · 50% · matches: 10');
    fireEvent.keyDown(trend, { key: 'ArrowLeft' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('October 3, 2026 · 40% · matches: 10');
    expect(trend.closest('.statistics-trend')).toHaveTextContent('-40%');
    fireEvent.keyDown(trend, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('anchors its portal tooltip above the actual selected point and updates after scroll', async () => {
    const geometry = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: Element) {
        const top = this.tagName.toLowerCase() === 'circle' ? 300 : 0;
        return {
          x: 400,
          y: top,
          left: 400,
          top,
          right: 408,
          bottom: top + 8,
          width: 8,
          height: 8,
          toJSON() {},
        };
      });
    render(<HeroStatisticsPage data={data} />);
    await screen.findByRole('table');
    fireEvent.focus(screen.getByRole('button', { name: new RegExp(`${a.name} Win rate:`) }));
    expect(screen.getByRole('tooltip')).toHaveStyle({ top: '290px', left: '404px' });
    fireEvent.scroll(window);
    expect(screen.getByRole('tooltip')).toHaveStyle({ top: '290px' });
    geometry.mockRestore();
  });
  it('retries failed loading and presents Russian controls', async () => {
    await setLanguage('ru');
    vi.mocked(loadHeroStatistics).mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    render(<HeroStatisticsPage data={data} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить статистику');
    await user.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByRole('table')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Режим' })).toBeVisible();
    expect(vi.mocked(loadHeroStatistics).mock.calls[1][1]).toBe(true);
  });
});
