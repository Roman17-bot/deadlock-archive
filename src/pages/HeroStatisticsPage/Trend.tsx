import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { format, formatDate } from '../../lib/format';
import { chartGeometry, deltaValue, type HistoryPoint } from './chart-model';

export function Trend({
  points,
  start,
  end,
  label,
  en,
}: {
  points: HistoryPoint[];
  start: number;
  end: number;
  label: string;
  en: boolean;
}) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, below: false });
  const tooltip = useRef<HTMLSpanElement>(null);
  const circles = useRef<(SVGCircleElement | null)[]>([]);
  const chart = chartGeometry(points, start, end);
  const selected = active === null ? undefined : chart.points[active];
  useEffect(() => {
    if (active === null) return;
    const position = () => {
      const box = circles.current[active]?.getBoundingClientRect();
      if (box) {
        const tip = tooltip.current?.getBoundingClientRect();
        const half = (tip?.width ?? 260) / 2;
        const below = box.top < (tip?.height ?? 42) + 20;
        setAnchor({
          x: Math.max(half + 8, Math.min(window.innerWidth - half - 8, box.left + box.width / 2)),
          y: below ? box.bottom + 10 : box.top - 10,
          below,
        });
      }
    };
    position();
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    return () => {
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
    };
  }, [active]);
  if (!chart.points.length)
    return <span className="statistics-no-history">{en ? 'No history' : 'Нет истории'}</span>;
  const change = chart.points.at(-1)!.value! - chart.points[0].value!;
  const roundedChange = deltaValue(change);
  const delta = `${roundedChange.value > 0 ? '+' : ''}${format(roundedChange.value, roundedChange.precision)} ${en ? 'pp' : 'п.п.'}`;
  const low = Math.min(...chart.points.map((p) => p.value!));
  const high = Math.max(...chart.points.map((p) => p.value!));
  let rangePrecision = 1;
  while (
    low !== high &&
    low.toFixed(rangePrecision) === high.toFixed(rangePrecision) &&
    rangePrecision < 4
  )
    rangePrecision++;
  const selectNear = (target: HTMLButtonElement, clientX: number) => {
    const box = target.getBoundingClientRect();
    const x = ((clientX - box.left) / box.width) * 180;
    let nearest = 0;
    chart.points.forEach((p, i) => {
      if (Math.abs(p.x - x) < Math.abs(chart.points[nearest].x - x)) nearest = i;
    });
    setActive(nearest);
  };
  return (
    <span
      className="statistics-trend"
      data-change={roundedChange.value > 0 ? 'up' : roundedChange.value < 0 ? 'down' : 'flat'}
    >
      <button
        type="button"
        className="statistics-trend-button"
        aria-label={`${label}: ${formatDate(chart.points[0].date)} — ${formatDate(chart.points.at(-1)!.date)}, ${delta}`}
        aria-describedby={selected ? id : undefined}
        onFocus={() => setActive(chart.points.length - 1)}
        onBlur={() => setActive(null)}
        onPointerMove={(e) => selectNear(e.currentTarget, e.clientX)}
        onPointerDown={(e) => {
          e.currentTarget.focus();
          selectNear(e.currentTarget, e.clientX);
        }}
        onPointerCancel={() => setActive(null)}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'touch') setActive(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setActive(null);
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
            e.preventDefault();
            setActive((i) =>
              e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? chart.points.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        chart.points.length - 1,
                        (i ?? chart.points.length - 1) + (e.key === 'ArrowLeft' ? -1 : 1),
                      ),
                    ),
            );
          }
        }}
      >
        <svg viewBox="0 0 180 56" width="180" height="56" aria-hidden="true">
          <path d={chart.path} />
          {chart.points.map((p, i) => (
            <circle
              key={p.date}
              ref={(node) => {
                circles.current[i] = node;
              }}
              cx={p.x}
              cy={p.y}
              r={active === i ? 4 : 2.5}
              data-active={active === i || undefined}
            />
          ))}
        </svg>
        <span className="statistics-range">{format(high, rangePrecision)}%</span>
        <span className="statistics-range statistics-range-low">
          {format(low, rangePrecision)}%
        </span>
      </button>
      <span className="statistics-change">{chart.points.length > 1 ? delta : '—'}</span>
      {selected &&
        createPortal(
          <span
            ref={tooltip}
            className="statistics-trend-tooltip"
            role="tooltip"
            id={id}
            style={{
              left: anchor.x,
              top: anchor.y,
              transform: anchor.below ? 'translateX(-50%)' : 'translate(-50%,-100%)',
            }}
          >
            {formatDate(selected.date)} · {format(selected.value!, 1)}% ·{' '}
            {en ? 'matches' : 'матчей'}: {format(selected.matches, 0)}
          </span>,
          document.body,
        )}
    </span>
  );
}
