import { forwardRef, type SVGProps, type ReactNode } from 'react';
export type ArchiveIconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
  absoluteStrokeWidth?: boolean;
};
function createIcon(name: string, paths: ReactNode, rounded = false) {
  const Icon = forwardRef<SVGSVGElement, ArchiveIconProps>(
    ({ size = 24, strokeWidth = 1.75, absoluteStrokeWidth = false, children, ...props }, ref) => {
      const labelled = Boolean(
        props['aria-label'] || props['aria-labelledby'] || props.role === 'img',
      );
      return (
        <svg
          ref={ref}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={
            absoluteStrokeWidth && Number(size)
              ? (Number(strokeWidth) * 24) / Number(size)
              : strokeWidth
          }
          strokeLinecap={rounded ? 'round' : 'square'}
          strokeLinejoin={rounded ? 'round' : 'miter'}
          aria-hidden={labelled ? undefined : true}
          role={labelled ? 'img' : undefined}
          focusable="false"
          data-archive-icon={name}
          {...props}
        >
          {paths}
          {children}
        </svg>
      );
    },
  );
  Icon.displayName = name;
  return Icon;
}
export const ArrowRight = /* @__PURE__ */ createIcon(
  'ArrowRight',
  <>
    <path d="M3 12h17m-6-6 6 6-6 6" />
  </>,
);
export const ArrowLeft = /* @__PURE__ */ createIcon(
  'ArrowLeft',
  <>
    <path d="M21 12H4m6-6-6 6 6 6" />
  </>,
);
export const ArrowDown = /* @__PURE__ */ createIcon(
  'ArrowDown',
  <>
    <path d="M12 3v17m-6-6 6 6 6-6" />
  </>,
);
export const ArrowUp = /* @__PURE__ */ createIcon(
  'ArrowUp',
  <>
    <path d="M12 21V4m-6 6 6-6 6 6" />
  </>,
);
export const ArrowUpRight = /* @__PURE__ */ createIcon(
  'ArrowUpRight',
  <>
    <path d="M5 19 19 5M8 5h11v11" />
  </>,
);
export const ChevronRight = /* @__PURE__ */ createIcon(
  'ChevronRight',
  <>
    <path d="m8 5 7 7-7 7" />
  </>,
);
export const ChevronDown = /* @__PURE__ */ createIcon(
  'ChevronDown',
  <>
    <path d="m5 8 7 7 7-7" />
  </>,
);
export const ChevronsUp = /* @__PURE__ */ createIcon(
  'ChevronsUp',
  <>
    <path d="m5 13 7-7 7 7M5 19l7-7 7 7" />
  </>,
);
export const ArrowUpDown = /* @__PURE__ */ createIcon(
  'ArrowUpDown',
  <>
    <path d="M7 3v18m-4-4 4 4 4-4M17 21V3m-4 4 4-4 4 4" />
  </>,
);
export const MoveHorizontal = /* @__PURE__ */ createIcon(
  'MoveHorizontal',
  <>
    <path d="M3 12h18M7 7l-5 5 5 5m10-10 5 5-5 5" />
  </>,
);
export const Move = /* @__PURE__ */ createIcon(
  'Move',
  <>
    <path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4" />
  </>,
);
export const Check = /* @__PURE__ */ createIcon(
  'Check',
  <>
    <path d="m4 12 5 5L20 5" />
  </>,
);
export const X = /* @__PURE__ */ createIcon(
  'X',
  <>
    <path d="m5 5 14 14M19 5 5 19" />
  </>,
);
export const Plus = /* @__PURE__ */ createIcon(
  'Plus',
  <>
    <path d="M4 12h16M12 4v16" />
  </>,
);
export const Minus = /* @__PURE__ */ createIcon(
  'Minus',
  <>
    <path d="M4 12h16" />
  </>,
);
export const Search = /* @__PURE__ */ createIcon(
  'Search',
  <path d="M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0ZM14.5 14.5 21 21M7 10a3 3 0 0 1 3-3" />,
  true,
);
export const Info = /* @__PURE__ */ createIcon(
  'Info',
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 10v7M12 6v1" />
  </>,
);
export const CircleAlert = /* @__PURE__ */ createIcon(
  'CircleAlert',
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 6v8M12 17v1" />
  </>,
);
export const CirclePause = /* @__PURE__ */ createIcon(
  'CirclePause',
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 7v10M15 7v10" />
  </>,
);
export const Ban = /* @__PURE__ */ createIcon(
  'Ban',
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M6 6 18 18" />
  </>,
);
export const RotateCcw = /* @__PURE__ */ createIcon(
  'RotateCcw',
  <>
    <path d="M5 9a8 8 0 1 1-.5 6M5 3v6h6" />
  </>,
);
export const RotateCw = /* @__PURE__ */ createIcon(
  'RotateCw',
  <>
    <path d="M19 9a8 8 0 1 0 .5 6M19 3v6h-6" />
  </>,
);
export const RefreshCw = /* @__PURE__ */ createIcon(
  'RefreshCw',
  <path d="M5 8a8 8 0 0 1 13-2l2 2M20 3v5h-5M19 16A8 8 0 0 1 6 18l-2-2M4 21v-5h5" />,
  true,
);
export const Download = /* @__PURE__ */ createIcon(
  'Download',
  <>
    <path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6" />
  </>,
);
export const Upload = /* @__PURE__ */ createIcon(
  'Upload',
  <>
    <path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" />
  </>,
);
export const BookOpen = /* @__PURE__ */ createIcon(
  'BookOpen',
  <>
    <path d="M12 6C8 3 5 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-3-1-6-1-10 2Zm0 0v15" />
  </>,
);
export const Calculator = /* @__PURE__ */ createIcon(
  'Calculator',
  <path d="M5 3h14v18H5ZM8 7h8M8 11h1M8 15h1M8 18h1M12 11h1M12 15h1M12 18h1M16 11v7" />,
  true,
);
export const Database = /* @__PURE__ */ createIcon(
  'Database',
  <>
    <path d="M3 5c0-4 18-4 18 0v14c0 4-18 4-18 0ZM3 5c0 4 18 4 18 0M3 12c0 4 18 4 18 0" />
  </>,
);
export const Layers = /* @__PURE__ */ createIcon(
  'Layers',
  <path d="M4 5h16v6H4ZM6 8h2M10 8h7M4 14h16M4 18h16M7 21h10" />,
  true,
);
export const Layers3 = /* @__PURE__ */ createIcon(
  'Layers3',
  <>
    <path d="m3 6 9-4 9 4-9 4ZM3 12l9 4 9-4M3 18l9 4 9-4" />
  </>,
);
export const Package = /* @__PURE__ */ createIcon(
  'Package',
  <>
    <path d="m3 6 9-4 9 4v12l-9 4-9-4ZM3 6l9 4 9-4M12 10v12M7 4l9 4" />
  </>,
);
export const SlidersHorizontal = /* @__PURE__ */ createIcon(
  'SlidersHorizontal',
  <path d="M3 6h3M10 6h11M3 12h11M18 12h3M3 18h5M12 18h9M6 4h4v4H6ZM14 10h4v4h-4ZM8 16h4v4H8Z" />,
  true,
);
export const Shield = /* @__PURE__ */ createIcon(
  'Shield',
  <path d="M12 3 20 6V12C20 16 16 19 12 21 8 19 4 16 4 12V6ZM8 8l4-1 4 1M12 7v9" />,
  true,
);
export const Crosshair = /* @__PURE__ */ createIcon(
  'Crosshair',
  <>
    <circle cx="12" cy="12" r="6" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
  </>,
  true,
);
export const Target = /* @__PURE__ */ createIcon(
  'Target',
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
    <path d="m12 12 9-9" />
  </>,
);
export const Sparkles = /* @__PURE__ */ createIcon(
  'Sparkles',
  <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM19 3v3M17.5 4.5h3" />,
  true,
);
export const Zap = /* @__PURE__ */ createIcon(
  'Zap',
  <>
    <path d="M14 2 4 14h7l-1 8L20 9h-7Z" />
  </>,
);
export const Heart = /* @__PURE__ */ createIcon(
  'Heart',
  <>
    <path d="M12 21 3 12C-1 5 7 0 12 6c5-6 13-1 9 6Z" />
  </>,
);
export const Activity = /* @__PURE__ */ createIcon(
  'Activity',
  <>
    <path d="M2 12h5l3-8 4 16 3-8h5" />
  </>,
);
export const Eye = /* @__PURE__ */ createIcon(
  'Eye',
  <>
    <path d="M2 12C7 2 17 2 22 12 17 22 7 22 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
export const Timer = /* @__PURE__ */ createIcon(
  'Timer',
  <>
    <circle cx="12" cy="14" r="8" />
    <path d="M9 2h6M12 2v4M18 6l2-2M12 9v5l3 2" />
  </>,
);
export const Hourglass = /* @__PURE__ */ createIcon(
  'Hourglass',
  <>
    <path d="M5 2h14M5 22h14M7 2v5l5 5-5 5v5M17 2v5l-5 5 5 5v5" />
  </>,
);
export const Gauge = /* @__PURE__ */ createIcon(
  'Gauge',
  <>
    <path d="M3 18a10 10 0 1 1 18 0H3ZM12 15l5-8M5 10l2 1M12 4v2M19 10l-2 1" />
  </>,
);
export const TrendingDown = /* @__PURE__ */ createIcon(
  'TrendingDown',
  <>
    <path d="m2 5 7 7 4-4 8 10M14 18h7v-7" />
  </>,
);
export const Expand = /* @__PURE__ */ createIcon(
  'Expand',
  <>
    <path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6" />
  </>,
);
export const Ruler = /* @__PURE__ */ createIcon(
  'Ruler',
  <>
    <path d="m3 17 14-14 4 4L7 21Zm5-5 3 3m1-7 3 3m1-7 3 3" />
  </>,
);
export const Coins = /* @__PURE__ */ createIcon(
  'Coins',
  <>
    <circle cx="9" cy="9" r="6" />
    <path d="M13 4a7 7 0 1 1-9 9M7 9h4M9 6v6" />
  </>,
);
export const Anchor = /* @__PURE__ */ createIcon(
  'Anchor',
  <>
    <path d="M12 2v19M3 13v4c4 6 14 6 18 0v-4M3 13l4 3m14-3-4 3M8 7h8" />
    <circle cx="12" cy="4" r="2" />
  </>,
);
export const Droplets = /* @__PURE__ */ createIcon(
  'Droplets',
  <>
    <path d="M9 2C7 6 3 9 3 13a6 6 0 0 0 12 0C15 9 11 6 9 2ZM18 10c-1 3-3 4-3 7a4 4 0 0 0 8 0c0-3-3-4-5-7Z" />
  </>,
);
export const Flame = /* @__PURE__ */ createIcon(
  'Flame',
  <>
    <path d="M13 2c2 7 8 8 8 13a9 9 0 0 1-18 0c0-4 3-6 5-8v6c5-2 5-6 5-11ZM12 14c-5 5-1 9 2 6 2-2 0-4-2-6Z" />
  </>,
);
export const Footprints = /* @__PURE__ */ createIcon(
  'Footprints',
  <>
    <path d="M5 3c-4 0-4 8 0 8s4-8 0-8ZM3 15v4h4v-4ZM18 9c-4 0-4 8 0 8s4-8 0-8ZM16 20v2h4v-2" />
  </>,
);
export const Ghost = /* @__PURE__ */ createIcon(
  'Ghost',
  <>
    <path d="M4 22V10a8 8 0 0 1 16 0v12l-4-3-4 3-4-3ZM8 9v3M16 9v3" />
  </>,
);
export const Hand = /* @__PURE__ */ createIcon(
  'Hand',
  <>
    <path d="M8 11V5a2 2 0 0 1 4 0v6-7a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v10l-5 5H8l-6-9c-1-3 2-4 4-1l2 2" />
  </>,
);
export const Skull = /* @__PURE__ */ createIcon(
  'Skull',
  <>
    <path d="M6 17a9 9 0 1 1 12 0v5H6ZM9 18v4M15 18v4M11 15h2" />
    <circle cx="8" cy="10" r="2" />
    <circle cx="16" cy="10" r="2" />
  </>,
);
export const Users = /* @__PURE__ */ createIcon(
  'Users',
  <>
    <path d="M2 22v-4c0-6 12-6 12 0v4M16 14c6-1 7 3 7 8" />
    <circle cx="8" cy="6" r="4" />
    <path d="M16 2a4 4 0 0 1 0 8" />
  </>,
);
export const Wind = /* @__PURE__ */ createIcon(
  'Wind',
  <>
    <path d="M2 7h13c7 0 4-8 0-5M2 12h18M2 17h9c7 0 4 8 0 5" />
  </>,
);
export const VolumeX = /* @__PURE__ */ createIcon(
  'VolumeX',
  <>
    <path d="M3 9h4l6-6v18l-6-6H3Zm13 0 6 6m0-6-6 6" />
  </>,
);
export const Swords = /* @__PURE__ */ createIcon(
  'Swords',
  <>
    <path d="M3 2v5l14 14 4-4L7 3ZM14 19l5-5M21 2v5l-5 5M10 17l-7 4v-5l4-4" />
  </>,
);
export const Pickaxe = /* @__PURE__ */ createIcon(
  'Pickaxe',
  <>
    <path d="m3 21 14-14M6 3c8-2 14 4 15 12L6 3Z" />
  </>,
);
export const Eraser = /* @__PURE__ */ createIcon(
  'Eraser',
  <>
    <path d="m3 14 12-12 7 7-12 12H7ZM9 8l7 7M10 21h12" />
  </>,
);
export const Snail = /* @__PURE__ */ createIcon(
  'Snail',
  <>
    <path d="M2 17c0 6 18 6 20 0v-7M17 14v-5M20 5v5M15 5v4" />
    <circle cx="9" cy="13" r="6" />
    <path d="M9 10a3 3 0 1 0 3 3" />
  </>,
);
export const BatteryCharging = /* @__PURE__ */ createIcon(
  'BatteryCharging',
  <>
    <path d="M8 5H2v14h18v-4M22 9v6M15 2l-5 10h6l-3 10" />
  </>,
);
export const HeartOff = /* @__PURE__ */ createIcon(
  'HeartOff',
  <>
    <path d="M12 21 3 12C-1 5 7 0 12 6c5-6 13-1 9 6Z" />
    <path d="M2 2l20 20" />
  </>,
);
export const HeartPulse = /* @__PURE__ */ createIcon(
  'HeartPulse',
  <>
    <path d="M12 21 3 12C-1 5 7 0 12 6c5-6 13-1 9 6Z" />
    <path d="M4 12h4l2-4 3 9 2-5h5" />
  </>,
);
export const ShieldCheck = /* @__PURE__ */ createIcon(
  'ShieldCheck',
  <>
    <path d="m12 2 9 4v7c0 5-9 9-9 9S3 18 3 13V6Z" />
    <path d="m7 12 3 3 7-7" />
  </>,
);
export const ShieldPlus = /* @__PURE__ */ createIcon(
  'ShieldPlus',
  <>
    <path d="m12 2 9 4v7c0 5-9 9-9 9S3 18 3 13V6Z" />
    <path d="M8 11h8M12 7v8" />
  </>,
);
export const ShieldOff = /* @__PURE__ */ createIcon(
  'ShieldOff',
  <>
    <path d="m12 2 9 4v7c0 5-9 9-9 9S3 18 3 13V6Z" />
    <path d="M2 2l20 20" />
  </>,
);
export const WandSparkles = /* @__PURE__ */ createIcon(
  'WandSparkles',
  <>
    <path d="m3 20 12-12 3 3L6 23ZM12 12l3 3M17 2v5m-3-2h6M21 6v5m-2-2h4" />
  </>,
);
export type ArchiveIcon = typeof Search;
export type LucideIcon = ArchiveIcon;
