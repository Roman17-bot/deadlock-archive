// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StatisticsTable } from '../src/pages/HeroStatisticsPage/StatisticsTable';
let viewport = 360;
let content = 1080;
let resize: () => void;
beforeEach(() => {
  viewport = 360;
  content = 1080;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('expansion-table-scroll') ? viewport : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('expansion-table-scroll') ? content : 0;
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('shows only for actual overflow and tracks scroll edges and resized content', () => {
  render(
    <StatisticsTable en>
      <table>
        <tbody>
          <tr>
            <th>Hero</th>
            <td>Win rate</td>
          </tr>
        </tbody>
      </table>
    </StatisticsTable>,
  );
  const region = screen.getByRole('region');
  expect(screen.getByText('Columns')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Previous columns' })).toBeDisabled();
  const scroll = vi.fn(({ left }: ScrollToOptions) => {
    region.scrollLeft += left ?? 0;
    fireEvent.scroll(region);
  });
  Object.defineProperty(region, 'scrollBy', { configurable: true, value: scroll });
  fireEvent.click(screen.getByRole('button', { name: 'Next columns' }));
  expect(scroll).toHaveBeenCalledWith(
    expect.objectContaining({ behavior: 'auto', left: expect.any(Number) }),
  );
  expect(region.scrollLeft).toBeGreaterThan(100);
  expect(screen.getByRole('button', { name: 'Previous columns' })).toBeEnabled();
  region.scrollLeft = content - viewport;
  fireEvent.scroll(region);
  expect(screen.getByRole('button', { name: 'Next columns' })).toBeDisabled();
  content = viewport;
  act(() => resize());
  expect(screen.queryByText('Columns')).not.toBeInTheDocument();
});
it('does not add navigation for a table fitting its region', () => {
  viewport = 1440;
  render(
    <StatisticsTable en={false}>
      <table />
    </StatisticsTable>,
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
