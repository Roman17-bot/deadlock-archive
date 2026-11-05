// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { PageLoadBoundary } from '../src/app/page-loading/PageLoadBoundary';
import { usePageDataPending } from '../src/hooks/usePageDataPending';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function ImageSection({ pending, name }: { pending: boolean; name: string }) {
  usePageDataPending(pending);
  const [fallback, setFallback] = useState(false);
  return pending ? null : (
    <>
      <h1>{name}</h1>
      <img
        alt="Portrait"
        loading="lazy"
        src={fallback ? '/fallback.webp' : '/portrait.webp'}
        onError={() => setFallback(true)}
      />
    </>
  );
}

it('waits for committed data, the eager portrait, and its decode before revealing the route', async () => {
  const onLoadingChange = vi.fn();
  const complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false);
  let decoded!: () => void;
  const decode = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        decoded = resolve;
      }),
  );
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value: decode,
  });
  const page = (pending: boolean) => (
    <StrictMode>
      <PageLoadBoundary kind="hero-detail" onLoadingChange={onLoadingChange}>
        <ImageSection pending={pending} name="Dossier" />
      </PageLoadBoundary>
    </StrictMode>
  );
  try {
    const { container, rerender } = render(page(true));
    expect(screen.getByRole('status')).toHaveTextContent('Загружаем данные');
    expect(onLoadingChange).not.toHaveBeenCalledWith(false);
    rerender(page(false));
    const img = container.querySelector('img')!;
    await waitFor(() => expect(img).toHaveAttribute('loading', 'eager'));
    expect(screen.queryByRole('heading', { name: 'Dossier' })).not.toBeInTheDocument();
    complete.mockReturnValue(true);
    fireEvent.load(img);
    await waitFor(() => expect(decode).toHaveBeenCalled());
    expect(screen.getByRole('status')).toBeInTheDocument();
    await act(async () => decoded());
    expect(await screen.findByRole('heading', { name: 'Dossier' })).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(onLoadingChange).toHaveBeenLastCalledWith(false);
  } finally {
    Reflect.deleteProperty(HTMLImageElement.prototype, 'decode');
  }
});

it('waits for an image fallback and does not let an old route dismiss a new skeleton', async () => {
  const onLoadingChange = vi.fn();
  const complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false);
  const page = (route: string, pending: boolean) => (
    <PageLoadBoundary key={route} kind="hero-detail" onLoadingChange={onLoadingChange}>
      <ImageSection pending={pending} name={route} />
    </PageLoadBoundary>
  );
  const { container, rerender } = render(page('First', false));
  const old = container.querySelector('img')!;
  await waitFor(() => expect(old).toHaveAttribute('loading', 'eager'));
  rerender(page('Second', true));
  fireEvent.load(old);
  expect(onLoadingChange).not.toHaveBeenCalledWith(false);
  expect(screen.getByRole('status')).toBeInTheDocument();

  rerender(page('Second', false));
  const img = container.querySelector('img')!;
  fireEvent.error(img);
  expect(img).toHaveAttribute('src', '/fallback.webp');
  await waitFor(() => expect(img).toHaveAttribute('loading', 'eager'));
  expect(screen.getByRole('status')).toBeInTheDocument();
  complete.mockReturnValue(true);
  fireEvent.error(img);
  expect(await screen.findByRole('heading', { name: 'Second' })).toBeVisible();
});
