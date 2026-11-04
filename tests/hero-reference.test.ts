import { describe, expect, it } from 'vitest';
import { aggregateHeroStats, heroHistory, safeMedia, windowDays } from '../shared/hero-reference';
import type { HeroStatScope } from '../shared/hero-reference';

describe('observed hero cohorts', () => {
  const days = [
    {
      date: '2026-10-01',
      totalSelections: 20,
      rows: [
        { heroId: 1, wins: 9, losses: 1, matches: 10 },
        { heroId: 2, wins: 1, losses: 9, matches: 10 },
      ],
    },
    {
      date: '2026-10-03',
      totalSelections: 200,
      rows: [
        { heroId: 1, wins: 10, losses: 90, matches: 100 },
        { heroId: 2, wins: 90, losses: 10, matches: 100 },
      ],
    },
  ];
  it('weights matches instead of averaging percentages', () => {
    const hero = aggregateHeroStats(days)[0];
    expect(hero.winRate).toBeCloseTo((19 / 110) * 100);
    expect(hero.selectionShare).toBe(50);
  });
  it('leaves absent observations missing and never interpolates', () => {
    expect(heroHistory(days, 1, 'winRate').map((p) => p.date)).toEqual([
      '2026-10-01',
      '2026-10-03',
    ]);
    expect(heroHistory(days, 99, 'winRate').every((p) => p.value === null)).toBe(true);
  });
  it('uses a saved calendar window rather than the last N observed rows or current date', () => {
    expect(
      windowDays({ days, to: '2026-10-03T12:00:00Z' } as HeroStatScope, 2).map((d) => d.date),
    ).toEqual(['2026-10-03']);
    expect(windowDays({ days: [] } as unknown as HeroStatScope, 7)).toEqual([]);
  });
  it('does not shift backwards when a cohort has no recent observations', () => {
    expect(windowDays({ days, to: '2026-11-04T08:00:00Z' } as HeroStatScope, 7)).toEqual([]);
    expect(
      windowDays({ days, to: '2026-10-02T08:00:00Z' } as HeroStatScope, 7).map((d) => d.date),
    ).toEqual(['2026-10-01']);
  });
  it('allows vetted local/CDN media but rejects active and unrelated addresses', () => {
    expect(safeMedia('images/heroes/abrams.webp')).toBe(true);
    expect(safeMedia('images/../private/file')).toBe(false);
    expect(safeMedia('javascript:alert(1)')).toBe(false);
    expect(safeMedia('https://evil.example/movie.mp4')).toBe(false);
  });
});
