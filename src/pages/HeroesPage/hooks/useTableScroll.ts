import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export function useTableScroll(view: string) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, maximum: 0 });

  const measure = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const maximum = Math.max(0, element.scrollWidth - element.clientWidth);
    const left = Math.max(0, Math.min(maximum, element.scrollLeft));
    setPosition((previous) =>
      previous.left === left && previous.maximum === maximum ? previous : { left, maximum },
    );
  }, []);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollLeft = 0;
    measure();
    element.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : undefined;
    observer?.observe(element);
    const table = element.querySelector('table');
    if (table) observer?.observe(table);
    return () => {
      element.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [view, measure]);

  const moveTo = (left: number) => {
    const element = scrollRef.current;
    if (!element) return;
    const maximum = Math.max(0, element.scrollWidth - element.clientWidth);
    element.scrollLeft = Math.max(0, Math.min(maximum, left));
    measure();
  };

  const move = (direction: -1 | 1) => {
    const element = scrollRef.current;
    if (!element) return;
    const pinnedWidth = element.querySelector<HTMLElement>('thead .hero-column')?.clientWidth ?? 0;
    moveTo(element.scrollLeft + direction * Math.max(1, element.clientWidth - pinnedWidth));
  };

  return {
    scrollRef,
    overflowing: position.maximum > 1,
    canScrollLeft: position.left > 1,
    canScrollRight: position.left < position.maximum - 1,
    progress: position.maximum > 1 ? Math.round((position.left / position.maximum) * 100) : 0,
    move,
    setProgress: (percent: number) => moveTo((position.maximum * percent) / 100),
  };
}

export type TableScrollState = ReturnType<typeof useTableScroll>;
