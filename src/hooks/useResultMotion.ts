import { useEffect, useRef } from 'react';

/** A changed selection settles like a drawer; content and pointer access stay live. */
export function useResultMotion(selection: string) {
  const target = useRef<HTMLDivElement>(null);
  const previous = useRef(selection);
  useEffect(() => {
    if (previous.current === selection) return;
    previous.current = selection;
    const element = target.current;
    if (
      !element ||
      typeof element.animate !== 'function' ||
      typeof window.matchMedia !== 'function'
    )
      return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) return;
    let animation: Animation;
    try {
      animation = element.animate(
        [{ transform: 'translateY(10px)' }, { transform: 'translateY(0)' }],
        { duration: 300, easing: 'cubic-bezier(.16,1,.3,1)' },
      );
    } catch {
      return;
    }
    let active = true;
    const cancel = () => {
      if (!active) return;
      active = false;
      animation.cancel();
    };
    const changed = () => {
      if (preference.matches) cancel();
    };
    animation.onfinish = animation.oncancel = () => {
      active = false;
    };
    preference.addEventListener('change', changed);
    return () => {
      preference.removeEventListener('change', changed);
      cancel();
    };
  }, [selection]);
  return target;
}
