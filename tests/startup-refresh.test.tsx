// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import fixture from './fixtures/6819/heroes.json';
import { useHeroSnapshot } from '../src/hooks/useHeroSnapshot';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('keeps the new saved version when an earlier initial request finishes late', async () => {
  const updated = structuredClone(fixture);
  updated.meta.clientVersion += 1;
  let finishInitial!: (response: Response) => void;
  const initial = new Promise<Response>((resolve) => {
    finishInitial = resolve;
  });
  let heroReads = 0;
  vi.stubGlobal('fetch', async (input: string) => {
    if (input === '/api/update/status')
      return Response.json({ phase: 'succeeded', localSaved: true, databaseSaved: true });
    if (++heroReads === 1) return initial;
    return Response.json(updated);
  });
  const { result } = renderHook(() => useHeroSnapshot());
  await waitFor(() =>
    expect(result.current.data?.meta.clientVersion).toBe(updated.meta.clientVersion),
  );
  await act(async () => {
    finishInitial(Response.json(fixture));
  });
  expect(result.current.data?.meta.clientVersion).toBe(updated.meta.clientVersion);
});

it('keeps loaded data visible when the automatic check is unavailable', async () => {
  vi.stubGlobal('fetch', async (input: string) => {
    if (input === '/api/update/status') throw new Error('offline');
    return Response.json(fixture);
  });
  const { result } = renderHook(() => useHeroSnapshot());
  await waitFor(() =>
    expect(result.current.data?.meta.clientVersion).toBe(fixture.meta.clientVersion),
  );
  expect(result.current.error).toBe(false);
});
