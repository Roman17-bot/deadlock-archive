import { useEffect, useRef } from 'react';
import { createArchiveRiffle } from './archiveRiffle';

const brandEvents = ['pointerenter', 'pointerleave', 'focus', 'blur'] as const;

export function useArchiveRiffle() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const book = ref.current;
    const turns = book?.querySelector<HTMLElement>('.archive-book__turns');
    if (
      !book ||
      !turns ||
      typeof turns.animate !== 'function' ||
      typeof window.matchMedia !== 'function'
    )
      return;

    const brand = book.closest('.brand');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
    let riffle: ReturnType<typeof createArchiveRiffle> | undefined;

    const sync = () => {
      if (reduced.matches || document.hidden) {
        riffle?.dispose();
        riffle = undefined;
        return;
      }

      // The cover and the pages share the same hover, focus and loading state.
      if (getComputedStyle(book).getPropertyValue('--book-open').trim() === '1') {
        riffle ??= createArchiveRiffle(turns);
        riffle.start();
      } else {
        riffle?.settle();
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(book, { attributes: true, attributeFilter: ['data-loading'] });
    for (const event of brandEvents) brand?.addEventListener(event, sync);
    reduced.addEventListener('change', sync);
    hover.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    sync();

    return () => {
      observer.disconnect();
      for (const event of brandEvents) brand?.removeEventListener(event, sync);
      reduced.removeEventListener('change', sync);
      hover.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
      riffle?.dispose();
    };
  }, []);

  return ref;
}
