// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Trend } from '../src/pages/HeroStatisticsPage/Trend';
import { dayTime, type HistoryPoint } from '../src/pages/HeroStatisticsPage/chart-model';
import { setLanguage } from '../src/i18n';

beforeEach(() => setLanguage('en'));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const start = dayTime('2026-01-01');
const history = (days: number): HistoryPoint[] =>
  Array.from({ length: days }, (_, i) => ({
    date: new Date(start + i * 86400000).toISOString().slice(0, 10),
    value: 40 + i / 10,
    matches: i + 10,
  }));
const props = (points: HistoryPoint[]) => ({
  points,
  start,
  end: dayTime(points.at(-1)!.date),
  label: 'Win rate',
  en: true,
});

describe('statistics trend interaction', () => {
  it('keeps the daily line identical while drawing fewer month and year markers', () => {
    const points = history(365);
    const { container, rerender } = render(<Trend {...props(points)} period={7} />);
    const dailyPath = container.querySelector('path')!.getAttribute('d');
    rerender(<Trend {...props(points)} period={365} />);
    expect(container.querySelector('path')).toHaveAttribute('d', dailyPath);
    expect(container.querySelectorAll('circle')).toHaveLength(12);
    const month = history(30);
    rerender(<Trend {...props(month)} period={7} />);
    const monthPath = container.querySelector('path')!.getAttribute('d');
    rerender(<Trend {...props(month)} period={30} />);
    expect(container.querySelector('path')).toHaveAttribute('d', monthPath);
    expect(container.querySelectorAll('circle')).toHaveLength(5);
    rerender(<Trend {...props(history(5))} period={7} />);
    expect(container.querySelectorAll('circle')).toHaveLength(5);
  });

  it('reaches daily values across gaps even when they have no sparse marker', () => {
    const points = history(30);
    points[1].value = null;
    const { container } = render(<Trend {...props(points)} period={30} />);
    const button = screen.getByRole('button');
    fireEvent.focus(button);
    fireEvent.keyDown(button, { key: 'Home' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('40%');
    expect(container.querySelectorAll('circle')).toHaveLength(6);
    expect(container.querySelector('circle[data-active]')).toHaveAttribute('cx', '8');
    fireEvent.keyDown(button, { key: 'ArrowRight' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('40.2%');
    expect(screen.getByRole('tooltip')).toHaveTextContent('matches: 12');
    expect(container.querySelector('path')!.getAttribute('d')!.match(/M/g)).toHaveLength(2);
    fireEvent.keyDown(button, { key: 'End' });
    expect(container.querySelectorAll('circle')).toHaveLength(5);
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('anchors the tooltip 10px above the selected circle edge after scaling or data changes', () => {
    let scale = 2;
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: SVGElement,
    ) {
      const x = Number(this.getAttribute('cx')) * scale;
      const y = Number(this.getAttribute('cy')) * scale + 200;
      return {
        left: x - 4,
        top: y - 4,
        width: 8,
        height: 8,
        right: x + 4,
        bottom: y + 4,
        x,
        y,
        toJSON: () => ({}),
      };
    });
    const points = history(30);
    const { container, rerender } = render(<Trend {...props(points)} period={30} />);
    const button = screen.getByRole('button');
    fireEvent.focus(button);
    fireEvent.keyDown(button, { key: 'Home' });
    const expectedTop = () =>
      `${Number(container.querySelector('circle[data-active]')!.getAttribute('cy')) * scale + 186}px`;
    expect(screen.getByRole('tooltip').style.top).toBe(expectedTop());
    const changed = points.map((point, index) => ({
      ...point,
      value: index === 0 ? 42 : point.value,
    }));
    rerender(<Trend {...props(changed)} period={30} />);
    expect(screen.getByRole('tooltip').style.top).toBe(expectedTop());
    expect(screen.getByRole('tooltip')).toHaveTextContent('42%');
    scale = 3;
    fireEvent(window, new Event('resize'));
    expect(screen.getByRole('tooltip').style.top).toBe(expectedTop());
  });

  it('flips below a circle near the viewport top and returns above when room is available', () => {
    let top = 5;
    vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      left: 100,
      top,
      width: 8,
      height: 8,
      right: 108,
      bottom: top + 8,
      x: 100,
      y: top,
      toJSON: () => ({}),
    }));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 260,
      height: 42,
      right: 260,
      bottom: 42,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    render(<Trend {...props(history(30))} period={30} />);
    fireEvent.focus(screen.getByRole('button'));
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.style.top).toBe('23px');
    expect(tooltip.style.transform).toBe('translateX(-50%)');
    expect(tooltip.style.left).toBe('138px');
    top = 300;
    fireEvent(window, new Event('scroll'));
    expect(tooltip.style.top).toBe('290px');
    expect(tooltip.style.transform).toBe('translate(-50%,-100%)');
  });

  it('finds the nearest daily point on the enlarged chart without cancelling native pointer behavior', () => {
    const points = history(30);
    const { container } = render(<Trend {...props(points)} period={30} />);
    const button = screen.getByRole('button');
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 200,
      width: 280,
      height: 90,
      right: 380,
      bottom: 290,
      x: 100,
      y: 200,
      toJSON: () => ({}),
    });
    const event = new MouseEvent('pointermove', {
      clientX: 100 + (8 / 180) * 280,
      bubbles: true,
      cancelable: true,
    });
    fireEvent(button, event);
    expect(event.defaultPrevented).toBe(false);
    expect(screen.getByRole('tooltip')).toHaveTextContent('40%');
    expect(container.querySelectorAll('circle')).toHaveLength(6);
  });

  it.each([
    [10, 15, '+5%', true, 'Change: from 10% to 15%'],
    [55, 56.6, '+1.6%', false, 'Изменение: с 55% до 56.6%'],
    [55, 54.5, '-0.5%', true, 'Change: from 55% to 54.5%'],
    [50, 50.02, '+0.02%', true, 'Change: from 50% to 50.02%'],
    [50, 49.9999996, '0%', true, 'Change: from 50% to 50%'],
  ])(
    'shows endpoint difference %s to %s as %s (English %s)',
    (first, last, delta, en, description) => {
      const points = history(2);
      points[0].value = first;
      points[1].value = last;
      const { container } = render(<Trend {...props(points)} en={en} />);
      expect(container.querySelector('.statistics-change-value')).toHaveTextContent(delta);
      expect(container.querySelector('.statistics-change-unit')).toBeNull();
      expect(container.querySelector('.statistics-change')).toHaveAttribute(
        'aria-label',
        description,
      );
      expect(container.querySelector('.statistics-change')).toHaveAttribute('title', description);
      expect(screen.getByRole('button').getAttribute('aria-label')).toContain(description);
    },
  );
});
