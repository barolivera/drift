/**
 * Drift line icons — one thin stroke weight, no fills, dotted guide lines
 * (the ElevenLabs "Safety, built in" register). Inline SVG on `currentColor`.
 * Used in feature cards, the deep-work block and the footer. Never on the
 * checkout page.
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.25, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const dots = { ...line, strokeDasharray: '1 4' } as const;

function Svg({ title, children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={title} {...props}>
      {children}
    </svg>
  );
}

/** Wave — a lip curling over a dotted horizon. */
export function WaveMark({ title = 'Wave', ...p }: IconProps) {
  return (
    <Svg title={title} {...p}>
      <path {...dots} d="M8 84h104" />
      <path {...line} d="M14 78c14-2 22-14 24-30 3-22 22-34 42-30 22 5 30 26 24 44" />
      <path {...line} d="M100 60c-6-16-26-20-38-9-8 7-9 19-2 26 6 6 15 5 20-1" />
      <path {...line} d="M64 76c-8 4-20 6-30 4" />
      <path {...dots} d="M60 10v100" />
    </Svg>
  );
}

/** Palm — trunk, five fronds, dotted ground. */
export function PalmMark({ title = 'Palm', ...p }: IconProps) {
  return (
    <Svg title={title} {...p}>
      <path {...dots} d="M8 104h104" />
      <path {...line} d="M62 104c-4-26-2-46 8-62" />
      <path {...line} d="M70 42c-14-12-32-10-44 2 14-4 28-1 38 8" />
      <path {...line} d="M70 42c-3-18 5-30 18-36-5 10-5 22 0 33" />
      <path {...line} d="M70 42c12-12 30-12 42-2-12-1-24 3-32 12" />
      <path {...line} d="M70 42c5 14 16 22 30 24-11 3-22 0-30-7" />
      <path {...dots} d="M62 104v10" />
    </Svg>
  );
}

/** Sun — half disc on a dotted horizon, short rays. */
export function SunMark({ title = 'Sun', ...p }: IconProps) {
  return (
    <Svg title={title} {...p}>
      <path {...dots} d="M8 74h104" />
      <path {...line} d="M32 74a28 28 0 0 1 56 0" />
      <path {...line} d="M60 30V18M38 38l-8-8M82 38l8-8M24 62H12M108 62H96" />
      <path {...dots} d="M30 90h60M42 102h36" />
    </Svg>
  );
}

/** Laptop with a small wave on screen — remote work by the sea. */
export function LaptopMark({ title = 'Laptop', ...p }: IconProps) {
  return (
    <Svg title={title} {...p}>
      <path {...dots} d="M8 96h104" />
      <rect {...line} x="26" y="30" width="68" height="46" rx="4" />
      <path {...line} d="M14 86h92l-6-10H20z" />
      <path {...line} d="M38 60c6-10 12-10 18 0s12 10 18 0 12-10 18 0" strokeWidth="1.25" />
      <path {...dots} d="M60 8v18" />
    </Svg>
  );
}

/** Wireframe blocks — things being built. */
export function BlocksMark({ title = 'Blocks', ...p }: IconProps) {
  return (
    <Svg title={title} {...p}>
      <path {...dots} d="M8 100h104" />
      <path {...line} d="M36 44l24-12 24 12-24 12z" />
      <path {...line} d="M36 44v32l24 12 24-12V44" />
      <path {...line} d="M60 56v32" />
      <path {...line} d="M36 76l24-12 24 12" />
      <path {...dots} d="M60 8v24M12 34l24 10M108 34l-24 10" />
    </Svg>
  );
}

/** Phone with an outgoing arrow — a bank transfer from your phone. */
export function TransferMark({ title = 'Transfer', ...p }: IconProps) {
  return (
    <Svg title={title} {...p}>
      <path {...dots} d="M8 104h104" />
      <rect {...line} x="34" y="14" width="40" height="76" rx="8" />
      <path {...line} d="M50 22h16" />
      <path {...line} d="M46 54h28M66 46l8 8-8 8" />
      <path {...dots} d="M74 54h34" />
    </Svg>
  );
}

/** Two arcs with arrowheads — a merchant converts one currency to another. */
export function SwapMark({ title = 'Swap', ...p }: IconProps) {
  return (
    <Svg title={title} {...p}>
      <path {...dots} d="M60 10v100M10 60h100" />
      <path {...line} d="M28 52a34 34 0 0 1 60-16" />
      <path {...line} d="M88 22v14H74" />
      <path {...line} d="M92 68a34 34 0 0 1-60 16" />
      <path {...line} d="M32 98V84h14" />
      <circle {...dots} cx="60" cy="60" r="48" />
    </Svg>
  );
}

/** Three linked squares — settlement on-chain. */
export function ChainMark({ title = 'Chain', ...p }: IconProps) {
  return (
    <Svg title={title} {...p}>
      <path {...dots} d="M8 60h104" />
      <rect {...line} x="14" y="44" width="26" height="32" rx="6" />
      <rect {...line} x="47" y="44" width="26" height="32" rx="6" />
      <rect {...line} x="80" y="44" width="26" height="32" rx="6" />
      <path {...line} d="M40 60h7M73 60h7" />
      <path {...dots} d="M27 20v24M60 20v24M93 20v24M27 76v24M60 76v24M93 76v24" />
    </Svg>
  );
}

/** Lotus — yoga and mobility. */
export function YogaMark({ title = 'Yoga', ...p }: IconProps) {
  return (
    <Svg title={title} {...p}>
      <path {...dots} d="M8 92h104" />
      <path {...line} d="M60 78c-12-10-16-26-10-42 6 8 10 20 10 42z" />
      <path {...line} d="M60 78c12-10 16-26 10-42-6 8-10 20-10 42z" />
      <path {...line} d="M60 78C44 78 30 68 24 54c14 0 28 8 36 24" />
      <path {...line} d="M60 78c16 0 30-10 36-24-14 0-28 8-36 24" />
      <path {...line} d="M36 84c8 4 40 4 48 0" />
    </Svg>
  );
}

/** Bowl with steam — meals at the long table. */
export function BowlMark({ title = 'Meals', ...p }: IconProps) {
  return (
    <Svg title={title} {...p}>
      <path {...dots} d="M8 94h104" />
      <path {...line} d="M22 58h76c0 18-12 30-28 34H50C34 88 22 76 22 58z" />
      <path {...line} d="M22 58c20-6 56-6 76 0" />
      <path {...line} d="M48 42c-4-6 4-10 0-16M62 42c-4-6 4-10 0-16M76 42c-4-6 4-10 0-16" />
    </Svg>
  );
}

/** House — fourteen nights, room of your choice. */
export function HouseMark({ title = 'House', ...p }: IconProps) {
  return (
    <Svg title={title} {...p}>
      <path {...dots} d="M8 96h104" />
      <path {...line} d="M24 58v38h72V58" />
      <path {...line} d="M14 62l46-34 46 34" />
      <path {...line} d="M52 96V72h16v24" />
      <path {...dots} d="M60 24V10" />
    </Svg>
  );
}

/** Road with an arrow — transfers. */
export function RoadMark({ title = 'Transfers', ...p }: IconProps) {
  return (
    <Svg title={title} {...p}>
      <path {...line} d="M28 96L48 24h24l20 72" />
      <path {...dots} d="M60 30v60" />
      <path {...line} d="M14 96h92" />
      <path {...line} d="M84 56l14-14M98 42v14M98 42H84" strokeWidth="1.25" />
    </Svg>
  );
}

/** Surfboard with a leash — boards and wetsuits. */
export function BoardMark({ title = 'Boards', ...p }: IconProps) {
  return (
    <Svg title={title} {...p}>
      <path {...dots} d="M8 100h104" />
      <path {...line} d="M60 12c14 18 20 44 12 72-4 12-20 12-24 0-8-28-2-54 12-72z" />
      <path {...line} d="M60 28v52" />
      <path {...dots} d="M66 90c10 4 18 2 28-6" />
    </Svg>
  );
}

/** Small calendar glyph for metadata rows (boarding-pass stub). */
export function CalendarMark({ title = 'Dates', ...p }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 10h18M8 3v4M16 3v4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Small people glyph for seat counts. */
export function SeatMark({ title = 'Seats', ...p }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...p}>
      <circle cx="9" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 20c.5-4 3.5-6 6.5-6s6 2 6.5 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 14.5c3 0 5 2 5.5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Patch — a shield-shaped frame around a line icon, so marks read as a
 * program patch rather than a freestanding icon. Size it with a height class.
 */
export function Patch({
  Icon,
  title,
  className = '',
}: {
  Icon: (p: IconProps) => JSX.Element;
  title: string;
  className?: string;
}) {
  return (
    <span className={`relative inline-flex aspect-[100/112] items-center justify-center ${className}`}>
      <svg viewBox="0 0 100 112" aria-hidden className="absolute inset-0 h-full w-full">
        <path
          d="M50 4 L92 17 V56 C92 82 73 101 50 108 C27 101 8 82 8 56 V17 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
        <path d="M50 11 L86 22 V56 C86 78 70 95 50 101" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="1 4" strokeLinecap="round" />
      </svg>
      <Icon className="h-[56%] w-[56%]" title={title} />
    </span>
  );
}
