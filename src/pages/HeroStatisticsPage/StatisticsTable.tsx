import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  MoveHorizontal,
} from '../../components/ui/ArchiveIcon/ArchiveIcons';

/** Native table scrolling with a small discoverable control only when columns overflow. */
export function StatisticsTable({ children, en }: { children: ReactNode; en: boolean }) {
  const id = useId();
  const region = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, maximum: 0 });
  useLayoutEffect(() => {
    const element = region.current;
    if (!element) return;
    const measure = () => {
      const maximum = Math.max(0, element.scrollWidth - element.clientWidth);
      const left = Math.max(0, Math.min(maximum, element.scrollLeft));
      setPosition((previous) =>
        previous.left === left && previous.maximum === maximum ? previous : { left, maximum },
      );
    };
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
  }, []);
  const move = (direction: number) => {
    const element = region.current;
    if (!element) return;
    const pinned = element.querySelector('thead th')?.getBoundingClientRect().width ?? 0;
    const amount = Math.max(160, element.clientWidth - pinned);
    const left = Math.max(
      -position.left,
      Math.min(position.maximum - position.left, amount * direction),
    );
    element.scrollBy({
      left,
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };
  return (
    <>
      {position.maximum > 1 && (
        <div
          className="statistics-column-navigation"
          role="group"
          aria-label={en ? 'Column navigation' : 'Навигация по столбцам'}
        >
          <span>
            <MoveHorizontal size={20} />
            {en ? 'Columns' : 'Столбцы'}
          </span>
          <div>
            <button
              type="button"
              aria-controls={id}
              aria-label={en ? 'Previous columns' : 'Предыдущие столбцы'}
              disabled={position.left <= 1}
              onClick={() => move(-1)}
            >
              <ArrowLeft size={20} />
            </button>
            <button
              type="button"
              aria-controls={id}
              aria-label={en ? 'Next columns' : 'Следующие столбцы'}
              disabled={position.left >= position.maximum - 1}
              onClick={() => move(1)}
            >
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      )}
      <div
        id={id}
        ref={region}
        className="expansion-table-scroll"
        role="region"
        aria-label={en ? 'Hero match statistics table' : 'Таблица статистики матчей'}
        tabIndex={0}
      >
        {children}
      </div>
    </>
  );
}
