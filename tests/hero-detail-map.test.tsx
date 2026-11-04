// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { StrictMode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import snapshot from './fixtures/6819/heroes.json';
import { buildHero, buildRules } from './fixtures/hero-build';
import { abilityCatalogFixture } from './fixtures/hero-abilities';
import type { HeroSnapshot } from '../shared/types';
import type { HeroProfiles, HeroStatistics, HeroVideo } from '../shared/hero-reference';
import type { WorldMapCatalogue } from '../shared/world-map';
import { HeroDetailPage } from '../src/pages/HeroDetailPage/HeroDetailPage';
import { MapPage } from '../src/pages/MapPage/MapPage';
import { FarmRoute, routeEntry } from '../src/pages/MapPage/FarmRoute';
import { DemoPlayer } from '../src/features/heroes/DemoPlayer';
import { loadHeroProfiles, loadHeroStatistics } from '../src/services/heroReferenceApi';
import { loadWorldMap } from '../src/services/worldMapApi';
import { loadAbilities } from '../src/services/abilitiesApi';
import { setLanguage } from '../src/i18n';
vi.mock('../src/services/heroReferenceApi', () => ({
  loadHeroProfiles: vi.fn(),
  loadHeroStatistics: vi.fn(),
  referenceMedia: (s: string) => s,
}));
vi.mock('../src/services/worldMapApi', () => ({ loadWorldMap: vi.fn() }));
vi.mock('../src/services/abilitiesApi', () => ({ loadAbilities: vi.fn() }));
vi.mock('../src/features/items/useItems', () => ({
  useItems: () => ({
    catalog: undefined,
    statistics: undefined,
    error: false,
    statisticsState: 'ready',
    retry: vi.fn(),
  }),
}));
const hero = buildHero();
const friend = { ...buildHero(), id: 2, slug: 'friend', name: 'Friend' };
const data = { ...snapshot, heroes: [hero, friend], calculatorRules: buildRules } as HeroSnapshot;
const text = (en: string, ru = en) => ({ en, ru });
function profiles(): HeroProfiles {
  return {
    schemaVersion: 1,
    clientVersion: data.meta.clientVersion,
    updatedAt: '2026-11-04',
    heroes: [
      {
        heroId: hero.id,
        slug: hero.slug,
        art: { background: 'images/hero.webp', card: 'images/card.webp' },
        summary: text('A helpful summary.'),
        lore: text('A story about the hero.'),
        tips: [text('Protect your escape route.')],
        relationships: [{ heroId: friend.id, description: text('An old ally.') }],
        videos: [],
      },
    ],
  };
}
const cohort = {
  from: '2026-10-01',
  to: '2026-11-01',
  updatedAt: '2026-11-04',
  minMatches: 100,
  sameLane: false as const,
};
const statistics: HeroStatistics = {
  schemaVersion: 1,
  clientVersion: data.meta.clientVersion,
  sourceClientVersion: null,
  updatedAt: '2026-11-04',
  from: cohort.from,
  to: cohort.to,
  source: 'deadlock-api',
  timeResolutionSeconds: 3600,
  metric: 'selection-share',
  periods: [7, 30],
  scopes: [],
  matchups: { ...cohort, rows: [] },
  synergies: { ...cohort, rows: [] },
};
// Compact consumed fields from the 6848 candidate, with just two placements for isolated UI tests.
const unit = { max_health: 500, gold_reward: 155, gold_reward_bonus_percent_per_minute: 1.08 };
const map: WorldMapCatalogue = {
  meta: { schemaVersion: 1, clientVersion: data.meta.clientVersion },
  radius: 10000,
  images: { mid: 'images/map.webp', mid_tunnels: 'images/tunnels.webp' },
  objects: [
    {
      id: 'camp:chinatown_bell_1',
      category: 'camps',
      kind: 'vault',
      x: 0.6510416667,
      y: 0.587797619,
      layer: null,
      firstSpawnSeconds: 480,
      respawnSeconds: 300,
      unitCount: null,
      perUnit: unit,
    },
    {
      id: 'crate-test',
      category: 'crates',
      x: 0.2,
      y: 0.2,
      layer: null,
      firstSpawnSeconds: null,
      respawnSeconds: null,
    },
  ],
  rules: {
    campRules: { vault: { perUnit: unit, firstSpawnSeconds: 480, respawnSeconds: 300 } },
    crates: { dropProbability: 0.6, soulsBase: 23, soulsPerMinute: 1.8 },
    toughCrates: { dropProbability: 1, soulsBase: 46, soulsPerMinute: 3.6 },
    goldenStatues: { dropProbability: 0.5 },
  },
};
beforeEach(async () => {
  await setLanguage('en');
  vi.mocked(loadHeroProfiles).mockResolvedValue(profiles());
  vi.mocked(loadHeroStatistics).mockResolvedValue(statistics);
  vi.mocked(loadAbilities).mockResolvedValue(abilityCatalogFixture(data));
  vi.mocked(loadWorldMap).mockResolvedValue(map);
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
  await setLanguage('ru');
});

describe('hero dossier', () => {
  it('returns modal focus to the original trigger after StrictMode replays effects', async () => {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
      this.querySelector('button')?.focus();
    };
    function ModalHost() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open demo</button>
          {open && <DemoPlayer title="Demo" onClose={() => setOpen(false)} />}
        </>
      );
    }
    const user = userEvent.setup();
    render(
      <StrictMode>
        <ModalHost />
      </StrictMode>,
    );
    const trigger = screen.getByRole('button', { name: 'Open demo' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Close video' }));
    expect(trigger).toHaveFocus();
  });
  it('reuses real ability cards and recalculates base health and Spirit scaling at the selected level', async () => {
    render(<HeroDetailPage data={data} slug={hero.slug} />);
    const cards = await screen.findAllByTestId('ability-card');
    expect(cards).toHaveLength(4);
    expect(screen.getByText('Health').nextElementSibling).toHaveTextContent('800');
    expect(within(cards[0]).getByText('100', { selector: 'dd' })).toBeVisible();
    fireEvent.change(screen.getByRole('slider', { name: /Level/ }), { target: { value: '6' } });
    expect(screen.getByText('Health').nextElementSibling?.textContent?.replace(/\s|,/g, '')).toBe(
      '1045',
    );
    expect(within(cards[0]).getByText('105', { selector: 'dd' })).toBeVisible();
    fireEvent.click(within(cards[0]).getByRole('button', { name: /1 AP/ }));
    expect(within(cards[0]).getByText('125', { selector: 'dd' })).toBeVisible();
  });
  it('switches to lore and opens real relationship links without showing gameplay blocks', async () => {
    const user = userEvent.setup();
    render(<HeroDetailPage data={data} slug={hero.slug} />);
    await screen.findByText('A helpful summary.');
    await user.click(screen.getByRole('button', { name: 'Story & connections' }));
    expect(screen.getByText('A story about the hero.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Friend' })).toHaveAttribute('href', '#/heroes/friend');
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Gameplay' }));
    expect(screen.getByRole('slider')).toHaveValue('1');
  });
  it('recovers from profile failure and closes missing video with focus returned to the trigger', async () => {
    vi.mocked(loadHeroProfiles).mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    render(<HeroDetailPage data={data} slug={hero.slug} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Hero story could not be loaded');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('A helpful summary.');
    const trigger = screen.getByRole('button', { name: /Watch primary attack/ });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Primary attack' })).toHaveTextContent(
      'No video yet',
    );
    expect(screen.queryByText('Original video')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close video' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(vi.mocked(loadHeroProfiles).mock.calls[1][1]).toBe(true);
  });
  it('does not show a stale version story and handles unknown heroes', async () => {
    const stale = profiles();
    stale.clientVersion++;
    vi.mocked(loadHeroProfiles).mockResolvedValue(stale);
    const view = render(<HeroDetailPage data={data} slug={hero.slug} />);
    expect(
      await screen.findByText('The hero story is being updated for this version.'),
    ).toBeVisible();
    expect(screen.queryByText('A helpful summary.')).not.toBeInTheDocument();
    view.rerender(<HeroDetailPage data={data} slug="absent" />);
    expect(screen.getByRole('heading', { name: 'Hero not found' })).toBeVisible();
  });
});

it('constrains a real video to its segment and handles native dialog cancellation', () => {
  const close = vi.fn();
  const video: HeroVideo = {
    abilityId: 'weapon',
    url: 'media/example.mp4',
    poster: 'images/poster.webp',
    title: text('Demo'),
    sourceUrl: 'https://example.test/original',
    checkedAt: '2026-11-04',
    clientVersion: data.meta.clientVersion,
    startSeconds: 10,
    endSeconds: 14,
  };
  const { container } = render(<DemoPlayer title="Demo" video={video} onClose={close} />);
  const player = container.querySelector('video')!;
  expect(player).toHaveAttribute('src', 'media/example.mp4#t=10,14');
  fireEvent.loadedMetadata(player);
  expect(player.currentTime).toBe(10);
  const pause = vi.spyOn(player, 'pause').mockImplementation(() => {});
  player.currentTime = 14;
  fireEvent.timeUpdate(player);
  expect(pause).toHaveBeenCalledOnce();
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true }));
  expect(close).toHaveBeenCalledOnce();
});

describe('city map and route planning', () => {
  it('retries a failed map request and blocks another client version', async () => {
    vi.mocked(loadWorldMap).mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    const view = render(<MapPage data={data} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The map could not be loaded');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Every stop counts' })).toBeVisible();
    expect(vi.mocked(loadWorldMap).mock.calls[1][1]).toBe(true);
    view.rerender(
      <MapPage
        data={{ ...data, meta: { ...data.meta, clientVersion: data.meta.clientVersion + 1 } }}
      />,
    );
    expect(screen.getByText('The map is being updated for this version.')).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Background' })).not.toBeInTheDocument();
  });
  it('filters layers, selects an object through keyboard controls, swaps backgrounds and adds a route stop', async () => {
    const user = userEvent.setup();
    const { container } = render(<MapPage data={data} />);
    await screen.findByRole('heading', { name: 'Every stop counts' });
    const picker = () => screen.getByRole('combobox', { name: /Objects shown/ });
    expect(within(picker()).getAllByRole('option')).toHaveLength(2);
    await user.click(screen.getByRole('checkbox', { name: /Normal crates/ }));
    expect(within(picker()).getAllByRole('option')).toHaveLength(3);
    await user.selectOptions(picker(), 'camp:chinatown_bell_1');
    expect(screen.getByRole('heading', { name: "Sinner's Sacrifice · F5" })).toBeVisible();
    expect(screen.getByText('Total souls / machine')).toBeVisible();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Background' }), 'mid_tunnels');
    expect(container.querySelector('.map-base')).toHaveAttribute('src', 'images/tunnels.webp');
    await user.click(screen.getByRole('button', { name: 'Add to route' }));
    expect(screen.getByRole('button', { name: "1. Sinner's Sacrifice · F5" })).toBeVisible();
    expect(screen.getByRole('spinbutton', { name: 'Travel / s' })).toHaveValue(null);
    await user.type(screen.getByRole('searchbox'), 'B2');
    expect(within(picker()).getAllByRole('option')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'None' }));
    expect(within(picker()).getAllByRole('option')).toHaveLength(1);
  });
  it('requires explicit travel/clear/count/availability, computes waits and rejects invalid route input', async () => {
    function Planner() {
      const [entries, setEntries] = useState([routeEntry(map.objects[0].id)]);
      const strongCampMap = {
        ...map,
        objects: [
          {
            ...map.objects[0],
            kind: 'strong',
            perUnit: {
              max_health: 1246,
              gold_reward: 199,
              gold_reward_bonus_percent_per_minute: 1.08,
            },
          },
        ],
      };
      return (
        <FarmRoute
          map={strongCampMap}
          entries={entries}
          setEntries={setEntries}
          onSelect={vi.fn()}
        />
      );
    }
    const user = userEvent.setup();
    render(<Planner />);
    expect(screen.getByText('Enter all travel and clearing times to calculate.')).toBeVisible();
    await user.type(screen.getByRole('spinbutton', { name: 'Travel / s' }), '10');
    await user.type(screen.getByRole('spinbutton', { name: 'Clear / s' }), '20');
    expect(screen.getByText('Total reward is not yet known')).toBeVisible();
    await user.click(screen.getByRole('checkbox', { name: 'Object available' }));
    expect(screen.getByText('Total reward is not yet known')).toBeVisible();
    await user.type(screen.getByRole('spinbutton', { name: 'Creatures' }), '2');
    expect(screen.getByText('433.8 expected souls', { selector: 'strong' })).toBeVisible();
    expect(screen.getByText(/Arrival 5:10 · Wait 2:50 · Finish 8:20/)).toBeVisible();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Creatures' }), {
      target: { value: '0' },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Check times and creature counts');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Creatures' }), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Last clear / min (optional)' }), {
      target: { value: '99' },
    });
    expect(screen.getByRole('alert')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Remove stop 1' }));
    expect(
      screen.getByText('Select a map object and add it here, or choose a starting plan.'),
    ).toBeVisible();
  });
});
