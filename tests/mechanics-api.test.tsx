// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MechanicsPage } from '../src/pages/MechanicsPage/MechanicsPage';
import heroes from '../data/heroes.json';
import ru from '../data/mechanics.json';
import en from '../data/mechanics.en.json';
import type { HeroSnapshot } from '../shared/types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('reads the local reference from the API rather than the bundled catalogue', async () => {
  const custom = structuredClone(ru);
  custom.formulas[0].title = 'Материал из PostgreSQL';
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (input) =>
      new Response(JSON.stringify(String(input).endsWith('language=en') ? en : custom)),
  );
  render(<MechanicsPage data={heroes as HeroSnapshot} localApi />);
  expect(await screen.findByRole('heading', { name: 'Материал из PostgreSQL' })).toBeVisible();
});

it('shows an explicit API failure instead of silently displaying bundled stale mechanics', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }));
  render(<MechanicsPage data={heroes as HeroSnapshot} localApi />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить механики');
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

it('rejects a bilingual API catalogue with mismatched formula identities', async () => {
  const invalid = structuredClone(en);
  invalid.formulas[0].id = 'unknown';
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (input) =>
      new Response(JSON.stringify(String(input).endsWith('language=en') ? invalid : ru)),
  );
  render(<MechanicsPage data={heroes as HeroSnapshot} localApi />);
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить механики'),
  );
});
