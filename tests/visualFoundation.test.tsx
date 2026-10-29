// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Search, RotateCcw } from '../src/components/ui/ArchiveIcon/ArchiveIcons';
import { useActionMotion } from '../src/hooks/useActionMotion';

let reduced: boolean;
let listeners: Set<() => void>;
let animations: Array<{ cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null }>;
const animate = vi.fn(() => {
  const animation = { cancel: vi.fn(), onfinish: null as (() => void) | null };
  animations.push(animation);
  return animation;
});
beforeEach(() => {
  reduced = false;
  listeners = new Set();
  animations = [];
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return reduced;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }));
  vi.stubGlobal('Animation', class {});
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate });
  animate.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Example() {
  const onClickCapture = useActionMotion();
  const [count, setCount] = useState(0);
  return (
    <main onClickCapture={onClickCapture}>
      <button onClick={() => setCount((n) => n + 1)}>
        <RotateCcw />
        <span>Reset</span>
      </button>
      <output aria-label="Actions">{count}</output>
    </main>
  );
}

it('keeps ordinary glyphs decorative while exposing an explicitly labelled icon', () => {
  const { container } = render(
    <>
      <Search />
      <Search aria-label="Search archive" />
    </>,
  );
  expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  expect(screen.getByRole('img', { name: 'Search archive' }).hasAttribute('aria-hidden')).toBe(
    false,
  );
});
it('retains SVG sizing, custom classes and a forwarded ref', () => {
  const ref = { current: null as SVGSVGElement | null };
  render(<Search ref={ref} size={18} className="example-icon" />);
  expect(ref.current?.getAttribute('width')).toBe('18');
  expect(ref.current?.classList.contains('example-icon')).toBe(true);
});
it('responds to a nested button target without postponing the underlying action', () => {
  render(<Example />);
  fireEvent.click(screen.getByText('Reset'));
  expect(screen.getByLabelText('Actions').textContent).toBe('1');
  expect(animate).toHaveBeenCalledTimes(1);
});
it('keeps the action working without movement for reduced motion', () => {
  reduced = true;
  render(<Example />);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByLabelText('Actions').textContent).toBe('1');
  expect(animate).not.toHaveBeenCalled();
});
it('cancels the previous response on repeated input', () => {
  render(<Example />);
  fireEvent.click(screen.getByRole('button'));
  fireEvent.click(screen.getByRole('button'));
  expect(animations[0].cancel).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Actions').textContent).toBe('2');
  expect(animate).toHaveBeenCalledTimes(2);
});
it('cancels owned movement when the OS preference changes and removes listeners on unmount', () => {
  const { unmount } = render(<Example />);
  fireEvent.click(screen.getByRole('button'));
  reduced = true;
  listeners.forEach((listener) => listener());
  expect(animations[0].cancel).toHaveBeenCalledTimes(1);
  unmount();
  expect(listeners.size).toBe(0);
});
it('cleans up an unfinished animation on unmount', () => {
  const { unmount } = render(<Example />);
  fireEvent.click(screen.getByRole('button'));
  unmount();
  expect(animations[0].cancel).toHaveBeenCalledTimes(1);
});
it('lets the action succeed when decorative animation is unsupported or fails', () => {
  animate.mockImplementationOnce(() => {
    throw new Error('Unsupported animation');
  });
  render(<Example />);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByLabelText('Actions').textContent).toBe('1');
});
