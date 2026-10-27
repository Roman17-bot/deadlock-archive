// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncPanel } from '../src/features/synchronization/SyncPanel';
import { UpdatesPage as UpdatePage } from '../src/pages/UpdatesPage/UpdatesPage';
import { i18n } from '../src/i18n';
import type { SyncState } from '../shared/sync-types';
import type { HeroSnapshot } from '../shared/types';
import snapshot from './fixtures/6819/heroes.json';
import history from './fixtures/6819/version-history.json';

const hash = 'a'.repeat(64);
const other = 'b'.repeat(64);
const state: SyncState = {
  available: true,
  source: 'postgresql',
  phase: 'idle',
  clientVersion: 6819,
  snapshotHash: hash,
  repositoryHash: other,
  pagesHash: other,
  localSaved: false,
  repositoryMatches: false,
  pagesMatches: false,
  updatedAt: '2026-10-26T12:00:00Z',
  message: 'На сайте опубликована другая версия данных.',
};
const completed: SyncState = {
  ...state,
  phase: 'succeeded',
  localSaved: true,
  repositoryMatches: true,
  pagesMatches: true,
  repositoryHash: hash,
  pagesHash: hash,
  upToDate: true,
  message: 'Данные PostgreSQL и GitHub Pages синхронизированы.',
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
beforeEach(async () => {
  await i18n.changeLanguage('ru');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('exact sync panel', () => {
  it('checks content explicitly even when the client version is unchanged', async () => {
    const requests: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      requests.push(String(url));
      return json(state);
    });
    render(
      <SyncPanel
        token="nonce"
        updateBusy={false}
        onBusyChange={vi.fn()}
        onLocalSnapshot={vi.fn()}
      />,
    );
    expect(await screen.findByText('На сайте опубликована другая версия данных.')).toBeVisible();
    expect(screen.queryByText(/aaaaaaaaaaaa/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Проверить синхронизацию' }));
    await waitFor(() => expect(requests).toContain('/api/sync/status?refresh=1'));
    expect(screen.getByRole('button', { name: 'Синхронизировать с Pages' })).toBeEnabled();
  });

  it('keeps queued publication pending, sends only the nonce and reloads a snapshot once', async () => {
    vi.useFakeTimers();
    const posts: RequestInit[] = [];
    const onLocalSnapshot = vi.fn();
    let started = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (String(url) === '/api/sync') {
        started = true;
        posts.push(init!);
        return json(
          {
            ...state,
            phase: 'queued',
            localSaved: true,
            message: 'Снимок отправлен. Ожидаем развёртывание Pages.',
          },
          202,
        );
      }
      return json(started ? completed : state);
    });
    const view = render(
      <StrictMode>
        <SyncPanel
          token="nonce"
          updateBusy={false}
          onBusyChange={vi.fn()}
          onLocalSnapshot={onLocalSnapshot}
        />
      </StrictMode>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const button = screen.getByRole('button', { name: 'Синхронизировать с Pages' });
    fireEvent.click(button);
    fireEvent.click(button);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText('Ожидаем обновление сайта.')).toBeVisible();
    expect(button).toBeDisabled();
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json', 'X-Archive-Token': 'nonce' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByText('Сайт обновлён')).toBeVisible();
    expect(onLocalSnapshot).toHaveBeenCalledExactlyOnceWith(hash);
    view.unmount();
    const count = vi.mocked(fetch).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(vi.mocked(fetch).mock.calls).toHaveLength(count);
  });

  it('shows a verified no-op and permits retry after a failed deployment', async () => {
    let result: SyncState = {
      ...state,
      phase: 'failed',
      localSaved: true,
      message: 'Синхронизация не удалась. Локальные данные сохранены; повторите попытку.',
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(result));
    render(
      <SyncPanel
        token="nonce"
        updateBusy={false}
        onBusyChange={vi.fn()}
        onLocalSnapshot={vi.fn()}
      />,
    );
    const retry = await screen.findByRole('button', { name: 'Повторить синхронизацию' });
    expect(retry).toBeEnabled();
    result = completed;
    fireEvent.click(retry);
    expect(await screen.findByText('Сайт обновлён')).toBeVisible();
    expect(
      screen.getByText('На сайте уже те же данные. Повторная публикация не нужна.'),
    ).toBeVisible();
  });

  it('translates local-only states and does not render unsafe publication links or messages', async () => {
    await i18n.changeLanguage('en');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ ...state, url: 'https://evil.example/token', message: 'secret raw backend error' }),
    );
    render(
      <SyncPanel
        token="nonce"
        updateBusy={false}
        onBusyChange={vi.fn()}
        onLocalSnapshot={vi.fn()}
      />,
    );
    expect(await screen.findByText('The site has a different version of the data.')).toBeVisible();
    expect(document.body.textContent).not.toMatch(/[А-Яа-яЁё]|secret raw backend error/);
    expect(document.querySelector('a[href*="evil"]')).toBeNull();
  });

  it('rejects invalid hashes and never reports an unverified success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ ...completed, pagesHash: other, snapshotHash: '../secret' }),
    );
    render(
      <SyncPanel
        token="nonce"
        updateBusy={false}
        onBusyChange={vi.fn()}
        onLocalSnapshot={vi.fn()}
      />,
    );
    expect(
      await screen.findByText('Не удалось проверить синхронизацию. Повторите попытку.'),
    ).toBeVisible();
    expect(screen.queryByText('Сайт обновлён')).not.toBeInTheDocument();
  });

  it('does not label a successful request as deployed when Pages serves different data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ...completed, pagesHash: other }));
    render(
      <SyncPanel
        token="nonce"
        updateBusy={false}
        onBusyChange={vi.fn()}
        onLocalSnapshot={vi.fn()}
      />,
    );
    expect(
      await screen.findByText(
        'Не удалось дождаться обновления сайта. Проверьте синхронизацию ещё раз.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('Сайт обновлён')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить синхронизацию' })).toBeEnabled();
  });

  it('keeps a failed operation actionable even if its prior hashes match', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ...completed, phase: 'failed' }));
    render(
      <SyncPanel
        token="nonce"
        updateBusy={false}
        onBusyChange={vi.fn()}
        onLocalSnapshot={vi.fn()}
      />,
    );
    expect(await screen.findByText('Нужна повторная попытка')).toBeVisible();
    expect(screen.queryByText('Сайт обновлён')).not.toBeInTheDocument();
  });

  it('bounds an unfinished deployment and lets the owner check again', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      json({ ...state, phase: 'queued' }),
    );
    render(
      <SyncPanel
        token="nonce"
        updateBusy={false}
        onBusyChange={vi.fn()}
        onLocalSnapshot={vi.fn()}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    for (let i = 0; i < 120; i++)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
    expect(
      screen.getByText(
        'Ожидание Pages заняло слишком много времени. Проверьте синхронизацию снова.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Проверить синхронизацию' })).toBeEnabled();
    expect(vi.mocked(fetch).mock.calls).toHaveLength(121);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(vi.mocked(fetch).mock.calls).toHaveLength(121);
  });

  it('cancels an active deployment poll on unmount', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      json({ ...state, phase: 'in_progress' }),
    );
    const view = render(
      <SyncPanel
        token="nonce"
        updateBusy={false}
        onBusyChange={vi.fn()}
        onLocalSnapshot={vi.fn()}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
  });

  it('refreshes publication status after game-data work finishes', async () => {
    let next = state;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(next));
    const props = { token: 'nonce', onBusyChange: vi.fn(), onLocalSnapshot: vi.fn() };
    const view = render(<SyncPanel {...props} updateBusy={true} />);
    await screen.findByText('На сайте опубликована другая версия данных.');
    next = { ...state, phase: 'queued' };
    view.rerender(<SyncPanel {...props} updateBusy={false} />);
    expect(await screen.findByText('Ожидаем обновление сайта.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Синхронизировать с Pages' })).toBeDisabled();
  });

  it.each([
    ['https://github.com/Roman17-bot/deadlock-archive/actions/workflows/pages.yml', {}],
    ['https://github.com/Roman17-bot/deadlock-archive/actions/runs/42', { runId: 42 }],
    [
      `https://github.com/Roman17-bot/deadlock-archive/commit/${'d'.repeat(40)}`,
      { commitSha: 'd'.repeat(40) },
    ],
  ])('links only the matching known GitHub publication %s', async (url, extra) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ ...state, ...extra, url }));
    render(
      <SyncPanel
        token="nonce"
        updateBusy={false}
        onBusyChange={vi.fn()}
        onLocalSnapshot={vi.fn()}
      />,
    );
    expect(await screen.findByRole('link', { name: 'Открыть публикацию GitHub' })).toHaveAttribute(
      'href',
      url,
    );
  });

  it('reloads same-client saved data and blocks game refresh while a sync runs', async () => {
    const candidate = structuredClone(snapshot) as HeroSnapshot;
    candidate.heroes[0].base.health += 10;
    const onSnapshot = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/update/session')
        return json({
          token: 'nonce',
          state: {
            phase: 'idle',
            clientVersion: snapshot.meta.clientVersion,
            localSaved: false,
            changed: false,
            message: 'Можно обновить данные.',
            updatedAt: state.updatedAt,
          },
        });
      if (url === '/api/version-history') return json(history);
      if (url === '/api/heroes') return json(candidate);
      if (url === '/api/sync') return json({ ...state, phase: 'queued', localSaved: true }, 202);
      return json(state);
    });
    render(<UpdatePage mode="local" data={snapshot as HeroSnapshot} onSnapshot={onSnapshot} />);
    const sync = within(screen.getByRole('region', { name: 'Синхронизация с Pages' }));
    const start = sync.getByRole('button', { name: 'Синхронизировать с Pages' });
    await waitFor(() => expect(start).toBeEnabled());
    fireEvent.click(start);
    await waitFor(() => expect(onSnapshot).toHaveBeenCalledWith(candidate));
    expect(screen.getByRole('button', { name: 'Обновить данные' })).toBeDisabled();
  });
});
