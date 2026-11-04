import { describe, expect, it } from 'vitest';
import { decodeHeroHistory, validateHeroHistory } from '../shared/hero-statistics-history';
import type { HeroStatisticsHistory } from '../shared/hero-statistics-history';

const history = (): HeroStatisticsHistory => ({
  schemaVersion: 1,
  clientVersion: 6848,
  source: 'deadlock-api',
  metric: 'selection-share',
  id: 'normal-ranked-tier-11',
  mode: 'ranked',
  gameMode: 'normal',
  matchModes: ['ranked'],
  rankMin: 111,
  rankMax: 116,
  from: '2026-10-01T00:00:00Z',
  to: '2026-11-04T08:00:00Z',
  updatedAt: '2026-11-04T08:01:00Z',
  requestedFrom: '2026-10-06T00:00:00Z',
  requestedTo: '2026-11-04T08:00:00Z',
  days: [
    { date: '2026-10-01', rows: '1,5,5,10;2,7,3,10' },
    { date: '2026-11-04', rows: '1,8,4,12' },
  ],
});
describe('compact hero statistics history', () => {
  it('decodes exact daily counts and denominators without filling missing dates', () => {
    const input = history();
    expect(validateHeroHistory(input)).toBe(true);
    const decoded = decodeHeroHistory(input);
    expect(decoded.days).toHaveLength(2);
    expect(decoded.days[0]).toEqual({
      date: '2026-10-01',
      totalSelections: 20,
      rows: [
        { heroId: 1, wins: 5, losses: 5, matches: 10 },
        { heroId: 2, wins: 7, losses: 3, matches: 10 },
      ],
    });
    expect(decoded.rankMin).toBe(111);
    expect(decoded.to).toBe(input.to);
  });
  it.each([
    '1,8,4,13',
    '1,8,4,12;1,1,1,2',
    '1,-2,4,2',
    '1,NaN,4,4',
    '1,1,1,2;',
    '1,9007199254740992,0,9007199254740992',
  ])('rejects corrupt counts: %s', (rows) => {
    const input = history();
    input.days[0].rows = rows;
    expect(validateHeroHistory(input)).toBe(false);
  });
  it('rejects unknown and mismatched cohorts, impossible dates, unordered days and history older than a year', () => {
    for (const change of [
      (h: ReturnType<typeof history>) => {
        h.id = '../private';
      },
      (h: ReturnType<typeof history>) => {
        h.rankMin = 101;
      },
      (h: ReturnType<typeof history>) => {
        h.days[0].date = '2026-02-31';
      },
      (h: ReturnType<typeof history>) => {
        h.days.reverse();
      },
      (h: ReturnType<typeof history>) => {
        h.days[0].date = '2025-10-01';
      },
    ]) {
      const input = history();
      change(input);
      expect(validateHeroHistory(input)).toBe(false);
    }
  });
});
