// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import snapshot from './fixtures/6819/heroes.json';
import type { HeroSnapshot } from '../shared/types';
import type { UpdateState } from '../shared/update-types';
import { UpdatesPage as UpdatePage } from '../src/pages/UpdatesPage/UpdatesPage';
import { StrictMode } from 'react';
import { i18n, setLanguage } from '../src/i18n';
import initialHistory from './fixtures/6819/version-history.json';
import { startUpdateRequest } from '../src/services/updatesApi';
import { fetchSyncState } from '../src/services/synchronizationApi';
import { readJson } from '../src/services/http';

const data = snapshot as HeroSnapshot;
const workflow =
  'https://github.com/Roman17-bot/deadlock-archive/actions/workflows/refresh-data.yml';
const idle: UpdateState = {
  phase: 'idle',
  clientVersion: 6819,
  localSaved: false,
  changed: false,
  message: 'Можно обновить данные.',
  updatedAt: '2026-10-25T09:00:00Z',
};
const saved: UpdateState = {
  ...idle,
  phase: 'succeeded',
  clientVersion: 6820,
  localSaved: true,
  changed: true,
  message: 'Локальные данные сохранены.',
  jobId: 'job-1',
};
const newer = (): HeroSnapshot => ({ ...data, meta: { ...data.meta, clientVersion: 6820 } });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const syncResult = {
  available: true,
  source: 'postgresql',
  phase: 'idle',
  localSaved: false,
  message: 'Ready',
  updatedAt: '2026-10-27T12:00:00Z',
};

describe('local mutation session recovery', () => {
  const operations = [
    {
      name: 'update',
      url: '/api/update',
      result: idle,
      send: () => startUpdateRequest('stale', false),
    },
    {
      name: 'sync',
      url: '/api/sync',
      result: syncResult,
      send: () =>
        fetchSyncState('/api/sync', {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            'X-Archive-Token': 'stale',
            'X-Extra': 'kept',
          },
          body: '{}',
        }),
    },
  ];

  it('exposes the HTTP status without consuming an error body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not JSON', { status: 403 }));
    await expect(readJson('/api/update')).rejects.toMatchObject({ status: 403 });
  });

  describe.each(operations)('$name', ({ url, result, send }) => {
    it('recovers a stale nonce once and preserves the original request', async () => {
      const calls: { url: string; init?: RequestInit }[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        calls.push({ url: String(input), init });
        if (input === '/api/update/session')
          return json({
            token: 'fresh',
            state: idle,
            url: 'https://evil.example',
            request: '/api/other',
          });
        if (input === url) return calls.length === 1 ? json({}, 403) : json(result);
        throw Error('Unexpected URL');
      });
      await expect(send()).resolves.toEqual(result);
      expect(calls.map((call) => call.url)).toEqual([url, '/api/update/session', url]);
      const original = calls[0].init!;
      const retry = calls[2].init!;
      expect(retry).toMatchObject({ method: 'POST', body: original.body });
      expect(retry.cache).toBe(original.cache);
      expect(retry.signal).toBe(original.signal);
      const headers = new Headers(original.headers);
      headers.set('X-Archive-Token', 'fresh');
      expect([...new Headers(retry.headers)]).toEqual([...headers]);
      expect(calls[1].init?.cache).toBe('no-store');
    });

    it.each([403, 500])('does not recover again after retry returns %s', async (status) => {
      const calls: string[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        calls.push(String(input));
        if (input === '/api/update/session') return json({ token: 'fresh', state: idle });
        return json({}, calls.length === 1 ? 403 : status);
      });
      await expect(send()).rejects.toMatchObject({ status });
      expect(calls).toEqual([url, '/api/update/session', url]);
    });

    it('does not resend or refresh after an initial server failure', async () => {
      const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({}, 500));
      await expect(send()).rejects.toMatchObject({ status: 500 });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it.each([
      { token: 'stale', state: idle },
      { token: '', state: idle },
      { token: '   ', state: idle },
      { token: 123, state: idle },
      { token: 'fresh' },
      { token: 'fresh', state: {} },
    ])('does not resend with an unchanged or invalid session %#', async (session) => {
      const calls: string[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        calls.push(String(input));
        return input === '/api/update/session' ? json(session) : json({}, 403);
      });
      await expect(send()).rejects.toThrow();
      expect(calls).toEqual([url, '/api/update/session']);
    });

    it('does not resend when the session refresh fails', async () => {
      const calls: string[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        calls.push(String(input));
        return json({}, input === '/api/update/session' ? 500 : 403);
      });
      await expect(send()).rejects.toThrow();
      expect(calls).toEqual([url, '/api/update/session']);
    });

    it('does not repeat a request after a transport failure', async () => {
      const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
      await expect(send()).rejects.toThrow('offline');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('does not resend after malformed session JSON', async () => {
      const calls: string[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        calls.push(String(input));
        return input === '/api/update/session' ? new Response('not JSON') : json({}, 403);
      });
      await expect(send()).rejects.toThrow();
      expect(calls).toEqual([url, '/api/update/session']);
    });
  });

  it('keeps sync cancellation and all caller options through recovery', async () => {
    const controller = new AbortController();
    const request: RequestInit = {
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal,
      credentials: 'same-origin',
      body: '{"publish":false}',
      headers: new Headers({ 'Content-Type': 'application/json', 'X-Archive-Token': 'stale' }),
    };
    const calls: RequestInit[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      calls.push(init!);
      if (input === '/api/update/session') return json({ token: 'fresh', state: idle });
      return calls.length === 1 ? json({}, 403) : json(syncResult);
    });
    await expect(fetchSyncState('/api/sync', request)).resolves.toEqual(syncResult);
    expect(calls[1].signal).toBe(controller.signal);
    expect(calls[2]).toMatchObject({
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal,
      credentials: 'same-origin',
      body: '{"publish":false}',
    });
    expect(new Headers(request.headers).get('X-Archive-Token')).toBe('stale');
  });

  it('does not resend sync after cancellation during session recovery', async () => {
    const controller = new AbortController();
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      calls.push(String(input));
      if (input === '/api/update/session') {
        controller.abort();
        return json({ token: 'fresh', state: idle });
      }
      return json({}, 403);
    });
    await expect(
      fetchSyncState('/api/sync', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'X-Archive-Token': 'stale' },
        body: '{}',
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toEqual(['/api/sync', '/api/update/session']);
  });
});
function fetchRoutes(
  handle: (url: string, init?: RequestInit) => Response | Promise<Response>,
  defaultHistory = true,
) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) =>
    String(input) === '/api/sync/status'
      ? json({
          available: false,
          source: 'json',
          phase: 'idle',
          localSaved: false,
          updatedAt: '2026-10-26T12:00:00Z',
          message: 'Для синхронизации настройте локальную PostgreSQL.',
        })
      : defaultHistory && String(input) === '/api/version-history'
        ? json(initialHistory)
        : handle(String(input), init),
  );
}
beforeEach(async () => {
  await i18n.changeLanguage('ru');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('owner updates', () => {
  it('does not show bundled history when the local database read fails and can retry', async () => {
    let available = false;
    fetchRoutes((url) => {
      if (url === '/api/update/session') return json({ token: 'nonce', state: idle });
      if (url === '/api/version-history') return available ? json(initialHistory) : json({}, 503);
      throw Error('Unexpected URL');
    }, false);
    render(<UpdatePage mode="local" data={data} onSnapshot={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить историю');
    expect(document.querySelector('.version-history-list')).toBeNull();
    available = true;
    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку истории' }));
    expect(
      await screen.findByText('6819', { selector: '.version-history-list strong' }),
    ).toBeVisible();
  });
  it('shows a translated up-to-date result without reloading a snapshot or a publication link', async () => {
    await setLanguage('en');
    const onSnapshot = vi.fn();
    const calls: string[] = [];
    fetchRoutes((url) => {
      calls.push(url);
      if (url === '/api/version-history') return json(initialHistory);
      if (url === '/api/update/session') return json({ token: 'nonce', state: idle });
      if (url === '/api/update')
        return json({
          ...idle,
          phase: 'succeeded',
          upToDate: true,
          message: 'Текущая версия актуальна.',
        });
      throw Error('Unexpected URL');
    });
    render(<UpdatePage mode="local" data={data} onSnapshot={onSnapshot} />);
    const button = screen.getByRole('button', { name: 'Update data' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByText('The current version is up to date.')).toBeVisible();
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(calls).not.toContain('/api/heroes');
    expect(screen.queryByRole('link', { name: 'Open the GitHub job' })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[А-Яа-яЁё]/);
  });
  it('connects under the real application StrictMode lifecycle', async () => {
    fetchRoutes((url) => {
      if (url === '/api/update/session') return json({ token: 'nonce', state: idle });
      throw Error('Unexpected URL');
    });
    render(
      <StrictMode>
        <UpdatePage mode="local" data={data} onSnapshot={vi.fn()} />
      </StrictMode>,
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Обновить данные' })).toBeEnabled(),
    );
  });
  it('sends the in-memory session nonce and publishes by default, then loads a saved snapshot', async () => {
    const onSnapshot = vi.fn();
    const calls: { url: string; init?: RequestInit }[] = [];
    fetchRoutes((url, init) => {
      calls.push({ url, init });
      if (url === '/api/update/session') return json({ token: 'session-nonce', state: idle });
      if (url === '/api/update')
        return json({ ...saved, publication: { status: 'queued', url: workflow } }, 202);
      if (url === '/api/heroes') return json(newer());
      throw Error('Unexpected URL');
    });
    render(<UpdatePage mode="local" data={data} onSnapshot={onSnapshot} />);
    const button = await screen.findByRole('button', { name: 'Обновить данные' });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.getByRole('checkbox', { name: /Опубликовать/ })).toBeChecked();
    fireEvent.click(button);
    await waitFor(() =>
      expect(onSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({ meta: expect.objectContaining({ clientVersion: 6820 }) }),
      ),
    );
    expect(screen.getByText('Сохранено локально')).toBeVisible();
    expect(screen.getByText(/Изменения отправлены/)).toBeVisible();
    const post = calls.find((call) => call.url === '/api/update')!;
    expect(post.init?.method).toBe('POST');
    expect(post.init?.body).toBe('{"publish":true}');
    expect(post.init?.headers).toEqual(
      expect.objectContaining({ 'X-Archive-Token': 'session-nonce' }),
    );
    expect(calls.every((call) => call.url.startsWith('/'))).toBe(true);
    expect(screen.queryByText(/Данные опубликованы/)).not.toBeInTheDocument();
  });

  it('keeps the local save visible after publication fails and allows a retry without publication', async () => {
    const onSnapshot = vi.fn();
    let publish: unknown;
    fetchRoutes((url, init) => {
      if (url === '/api/update/session') return json({ token: 'nonce', state: idle });
      if (url === '/api/update') {
        publish = JSON.parse(String(init?.body)).publish;
        return json(
          {
            ...saved,
            phase: 'failed',
            message: 'Отправка публикации не удалась.',
            error: 'Отправка публикации не удалась.',
          },
          202,
        );
      }
      if (url === '/api/heroes') return json(newer());
      throw Error('Unexpected URL');
    });
    render(<UpdatePage mode="local" data={data} onSnapshot={onSnapshot} />);
    const button = screen.getByRole('button', { name: 'Обновить данные' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(screen.getByRole('checkbox', { name: /Опубликовать/ }));
    fireEvent.click(button);
    expect(await screen.findByText('Сохранено локально')).toBeVisible();
    expect(await screen.findByText('Сайт пока не обновлён')).toBeVisible();
    await waitFor(() => expect(onSnapshot).toHaveBeenCalledTimes(1));
    expect(publish).toBe(false);
    expect(button).toBeEnabled();
  });

  it('shows actionable fallback when the local API is unavailable and reconnects on retry', async () => {
    let unavailable = true;
    fetchRoutes(() => {
      if (unavailable) throw Error('offline');
      return json({ token: 'nonce', state: idle });
    });
    render(<UpdatePage mode="local" data={data} onSnapshot={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Локальный сервер недоступен/);
    expect(screen.getByRole('button', { name: 'Обновить данные' })).toBeDisabled();
    expect(screen.getByRole('link', { name: /GitHub Actions/ })).toHaveAttribute('href', workflow);
    unavailable = false;
    fireEvent.click(screen.getByRole('button', { name: 'Повторить подключение' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Обновить данные' })).toBeEnabled(),
    );
  });

  it('polls active work at a bounded cadence, blocks double submission, and stops after unmount', async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    fetchRoutes((url) => {
      calls.push(url);
      return json(
        url === '/api/update/session'
          ? { token: 'nonce', state: idle }
          : { ...idle, phase: 'checking' },
      );
    });
    const view = render(<UpdatePage mode="local" data={data} onSnapshot={vi.fn()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const button = screen.getByRole('button', { name: 'Обновить данные' });
    fireEvent.click(button);
    fireEvent.click(button);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(button).toBeDisabled();
    expect(calls.filter((url) => url === '/api/update')).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(calls.filter((url) => url === '/api/update/status')).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1101);
    });
    expect(calls.filter((url) => url === '/api/update/status')).toHaveLength(1);
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(calls.filter((url) => url === '/api/update/status')).toHaveLength(1);
  });

  it('never renders an arbitrary publication URL', async () => {
    fetchRoutes((url) =>
      json(
        url === '/api/update/session'
          ? {
              token: 'nonce',
              state: {
                ...saved,
                publication: { status: 'queued', url: 'https://evil.example/collect' },
              },
            }
          : newer(),
      ),
    );
    render(<UpdatePage mode="local" data={data} onSnapshot={vi.fn()} />);
    await screen.findByText(/Изменения отправлены/);
    expect(document.querySelector('a[href*="evil.example"]')).toBeNull();
  });

  it('opens the exact stored-data commit returned by the publisher', async () => {
    const commitSha = 'c'.repeat(40);
    const url = `https://github.com/Roman17-bot/deadlock-archive/commit/${commitSha}`;
    fetchRoutes((input) =>
      json(
        input === '/api/update/session'
          ? {
              token: 'nonce',
              state: { ...saved, publication: { status: 'queued', url, commitSha } },
            }
          : newer(),
      ),
    );
    render(<UpdatePage mode="local" data={data} onSnapshot={vi.fn()} />);
    expect(await screen.findByRole('link', { name: 'Открыть задачу GitHub' })).toHaveAttribute(
      'href',
      url,
    );
  });
});

describe('public updates', () => {
  it('loads persisted history and distinguishes the client build date from the archive date', async () => {
    const history = {
      schemaVersion: 1,
      versions: [
        ...initialHistory.versions,
        {
          clientVersion: 6818,
          buildDate: '2026-10-21',
          firstPublishedAt: '2026-10-23T12:00:00Z',
          provenance: { kind: 'snapshot-save', reference: '2026-10-23T12:00:00Z' },
        },
      ],
    };
    fetchRoutes((url) => (url.endsWith('data/version-history.json') ? json(history) : json(data)));
    render(<UpdatePage mode="public" data={data} onSnapshot={vi.fn()} />);
    expect(
      await screen.findByText('6818', { selector: '.version-history-list strong' }),
    ).toBeVisible();
    expect(document.querySelectorAll('.version-history-list li')).toHaveLength(2);
    expect(screen.getAllByText('Дата выхода')).toHaveLength(2);
    expect(document.querySelector('time[datetime="2026-10-23T12:00:00Z"]')).toBeVisible();
  });
  it('applies a verified same-version snapshot when its commit or content changes', async () => {
    const updated = structuredClone(data);
    updated.meta.gameCommit = 'a'.repeat(40);
    updated.heroes[0].base.health += 10;
    const onSnapshot = vi.fn();
    fetchRoutes((url) => json(url.includes('steam-info') ? { client_version: 6819 } : updated));
    render(<UpdatePage mode="public" data={data} onSnapshot={onSnapshot} />);
    fireEvent.click(screen.getByRole('button', { name: 'Проверить обновления' }));
    await waitFor(() => expect(onSnapshot).toHaveBeenCalledWith(updated));
  });
  it('loads an already published snapshot without contacting the owner server', async () => {
    const onSnapshot = vi.fn();
    const calls: { url: string; init?: RequestInit }[] = [];
    fetchRoutes((url, init) => {
      calls.push({ url, init });
      return json(url.includes('steam-info') ? { client_version: 6820 } : newer());
    });
    render(<UpdatePage mode="public" data={data} onSnapshot={onSnapshot} />);
    fireEvent.click(screen.getByRole('button', { name: 'Проверить обновления' }));
    await waitFor(() => expect(onSnapshot).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status')).toHaveTextContent(/Данные сайта обновлены/);
    expect(calls.find((call) => call.url.endsWith('data/heroes.json'))?.init?.cache).toBe(
      'no-store',
    );
    expect(
      calls.some((call) => call.url.startsWith('/api/') || call.url.includes('127.0.0.1')),
    ).toBe(false);
    expect(
      screen.queryByRole('link', { name: /локальный центр|GitHub Actions/ }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['invalid', { meta: { clientVersion: 6820 }, heroes: [] }],
    ['older version', { ...data, meta: { ...data.meta, clientVersion: 6818 } }],
    ['older revision', { ...data, meta: { ...data.meta, sourceRevision: 1 } }],
  ])('preserves valid current data when the published response is %s', async (_, candidate) => {
    const onSnapshot = vi.fn();
    fetchRoutes((url) => json(url.includes('steam-info') ? { client_version: 6819 } : candidate));
    render(<UpdatePage mode="public" data={data} onSnapshot={onSnapshot} />);
    fireEvent.click(screen.getByRole('button', { name: 'Проверить обновления' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Текущая версия сохранена/);
    expect(onSnapshot).not.toHaveBeenCalled();
    expect(screen.getByText('6819', { selector: '.updates-version' })).toBeVisible();
  });

  it('explains a newer upstream version while retaining the published snapshot', async () => {
    fetchRoutes((url) => {
      if (url === 'https://api.deadlock-api.com/v1/assets/steam-info')
        return json({ client_version: 6821 });
      if (url.includes('data/heroes.json')) return json(data);
      throw Error('Unknown upstream endpoint');
    });
    render(<UpdatePage mode="public" data={data} onSnapshot={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Проверить обновления' }));
    expect(await screen.findByText(/Вышла версия игры 6821/)).toHaveTextContent(
      /ещё не опубликован/,
    );
    expect(screen.getByText('6819', { selector: '.updates-version' })).toBeVisible();
  });

  it('still loads a valid published snapshot when the version API is unavailable', async () => {
    const onSnapshot = vi.fn();
    fetchRoutes((url) => {
      if (url.includes('steam-info')) throw Error('offline');
      return json(newer());
    });
    render(<UpdatePage mode="public" data={data} onSnapshot={onSnapshot} />);
    fireEvent.click(screen.getByRole('button', { name: 'Проверить обновления' }));
    await waitFor(() => expect(onSnapshot).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status')).toHaveTextContent(/Версию игры проверить не удалось/);
    expect(screen.getByRole('button', { name: 'Проверить обновления' })).toBeEnabled();
  });
});
