import { useCallback, useEffect, useRef, type MouseEvent } from 'react';

type MotionContext = {
  preference: MediaQueryList;
  active: Map<SVGSVGElement, Animation>;
};

/** Decorative feedback only: click handlers and their results remain synchronous. */
export function useActionMotion() {
  const context = useRef<MotionContext | null>(null);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const active = new Map<SVGSVGElement, Animation>();
    const cancelAll = () => {
      active.forEach((animation) => animation.cancel());
      active.clear();
    };
    const changed = () => {
      if (preference.matches) cancelAll();
    };
    context.current = { preference, active };
    preference.addEventListener('change', changed);
    return () => {
      preference.removeEventListener('change', changed);
      cancelAll();
      context.current = null;
    };
  }, []);

  return useCallback((event: MouseEvent<HTMLElement>) => {
    const current = context.current;
    if (!current || current.preference.matches || event.defaultPrevented) return;
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button || button.disabled) return;
    const icon = button.querySelector<SVGSVGElement>('svg[data-archive-icon]');
    if (!icon || typeof icon.animate !== 'function') return;
    const name = icon.dataset.archiveIcon;
    let frames: Keyframe[];
    let duration = 160;
    if (name === 'RotateCcw' || name === 'RefreshCw') {
      frames = [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-40deg)', offset: 0.4 },
        { transform: 'rotate(0deg)' },
      ];
      duration = 180;
    } else if (name === 'Download' || name === 'Upload') {
      frames = [
        { transform: 'translateY(0)' },
        { transform: `translateY(${name === 'Download' ? 3 : -3}px)` },
        { transform: 'translateY(0)' },
      ];
    } else if (
      ['Crosshair', 'Shield', 'Sparkles', 'Layers', 'Layers3', 'Plus', 'Minus'].includes(name ?? '')
    ) {
      frames = [
        { transform: 'scale(1)' },
        { transform: 'scale(.88)', offset: 0.4 },
        { transform: 'scale(1)' },
      ];
    } else return;
    current.active.get(icon)?.cancel();
    try {
      const animation = icon.animate(frames, { duration, easing: 'cubic-bezier(.2,.8,.3,1)' });
      current.active.set(icon, animation);
      const finish = () => {
        if (current.active.get(icon) === animation) current.active.delete(icon);
      };
      animation.onfinish = finish;
      animation.oncancel = finish;
    } catch {
      // A decorative browser API failure must never interfere with the action.
    }
  }, []);
}
