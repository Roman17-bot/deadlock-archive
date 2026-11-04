import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readJson } from '../src/services/http';
import { loadHeroHistory } from '../src/services/heroReferenceApi';
vi.mock('../src/services/http', () => ({ readJson: vi.fn() }));
const payload = (id: string) => ({
  schemaVersion: 1,
  clientVersion: 6848,
  source: 'deadlock-api',
  metric: 'selection-share',
  id,
  mode: id === 'normal-all-all' ? 'all' : 'unranked',
  gameMode: 'normal',
  matchModes: id === 'normal-all-all' ? ['ranked', 'unranked'] : ['unranked'],
  rankMin: null,
  rankMax: null,
  from: '2026-10-01T00:00:00Z',
  to: '2026-11-04T08:00:00Z',
  updatedAt: '2026-11-04T08:01:00Z',
  requestedFrom: '2026-10-06T00:00:00Z',
  requestedTo: '2026-11-04T08:00:00Z',
  days: [{ date: '2026-10-01', rows: '1,5,5,10;2,7,3,10' }],
});
beforeEach(() => vi.mocked(readJson).mockReset());
describe('lazy history transport', () => {
  it('fetches and caches only the requested cohort, decodes exact counts and explicitly retries', async () => {
    vi.mocked(readJson).mockResolvedValue(payload('normal-all-all'));
    const signal = new AbortController().signal;
    const scope = await loadHeroHistory('normal-all-all', signal);
    expect(scope.days[0].totalSelections).toBe(20);
    expect(readJson).toHaveBeenCalledExactlyOnceWith('/api/hero-history/normal-all-all');
    await loadHeroHistory('normal-all-all', signal);
    expect(readJson).toHaveBeenCalledTimes(1);
    await loadHeroHistory('normal-all-all', signal, true);
    expect(readJson).toHaveBeenCalledTimes(2);
  });
  it('rejects escaping names and a response belonging to another cohort', async () => {
    const signal = new AbortController().signal;
    await expect(loadHeroHistory('../private', signal)).rejects.toThrow('Invalid statistics scope');
    expect(readJson).not.toHaveBeenCalled();
    vi.mocked(readJson).mockResolvedValue(payload('normal-all-all'));
    await expect(loadHeroHistory('normal-unranked-all', signal)).rejects.toThrow(
      'Invalid catalogue data',
    );
  });
});
