// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import snapshot from '../data/heroes.json';
import type { HeroSnapshot } from '../shared/types';
import type { UpdateState } from '../shared/update-types';
import { UpdatePage } from '../src/features/updates/UpdatePage';
import { StrictMode } from 'react';
import { i18n, setLanguage } from '../src/i18n';
import initialHistory from '../data/version-history.json';

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
function fetchRoutes(handle: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => handle(String(input), init));
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
    expect(screen.getByText(/Публикация в очереди/)).toBeVisible();
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
    expect(await screen.findByText('Публикация не отправлена')).toBeVisible();
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
    await screen.findByText(/Публикация в очереди/);
    expect(document.querySelector('a[href*="evil.example"]')).toBeNull();
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
    expect(screen.getAllByText('Сборка клиента')).toHaveLength(2);
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
    expect(screen.getByRole('status')).toHaveTextContent(/Опубликованный снимок загружен/);
    expect(calls.find((call) => call.url.endsWith('data/heroes.json'))?.init?.cache).toBe(
      'no-store',
    );
    expect(
      calls.some((call) => call.url.startsWith('/api/') || call.url.includes('127.0.0.1')),
    ).toBe(false);
    expect(screen.getByRole('link', { name: /локальный центр/ })).toHaveAttribute(
      'target',
      '_blank',
    );
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
    expect(await screen.findByRole('alert')).toHaveTextContent(/Текущий снимок сохранён/);
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
    expect(await screen.findByText(/Клиент 6821 уже доступен/)).toHaveTextContent(
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
