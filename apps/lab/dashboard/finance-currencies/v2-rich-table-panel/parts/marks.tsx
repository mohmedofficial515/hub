import { useId, type ReactNode } from 'react';

/**
 * Original glyph badges, one per currency. Latin-symbol currencies are drawn as strokes, Arabic-abbreviation
 * currencies carry their abbreviation on a geometric ground. No flags, no copied marks. Marks never mirror.
 */

interface Def {
  bg: string;
  fg: string;
  shape: ReactNode;
  motif?: ReactNode;
  glyph: ReactNode;
}

const stroke = { fill: 'none', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const circle = <circle cx="20" cy="20" r="18" />;
const squircle = <rect x="2" y="2" width="36" height="36" rx="11" />;
const hex = <path d="M20 2l15.6 9v18L20 38 4.4 29V11z" strokeLinejoin="round" />;
const shield = <path d="M20 2l15 5.2v11.3c0 9.2-6.2 15.6-15 19.5C11.2 34.100 5 27.700 5 18.500V7.200z" />;
const octagon = <path d="M13 2h14l11 11v14L27 38H13L2 27V13z" />;
const rounded = <rect x="2" y="2" width="36" height="36" rx="18" />;

const text = (value: string, fg: string, size = 13) => (
  <text
    x="20"
    y="25"
    textAnchor="middle"
    fontSize={size}
    fontWeight={800}
    fill={fg}
    style={{ fontFamily: 'inherit', direction: 'rtl' }}
  >
    {value}
  </text>
);

const DEFS: Record<string, Def> = {
  USD: {
    bg: '#16365c',
    fg: '#ffffff',
    shape: circle,
    motif: <path d="M4 30c8-5 24-5 32 0" stroke="#fff" strokeOpacity=".16" strokeWidth="2" fill="none" />,
    glyph: (
      <g stroke="#fff" {...stroke}>
        <path d="M25.500 15c0-2.300-2.400-3.700-5.500-3.700s-5.500 1.500-5.500 3.800c0 5.200 11.300 2.600 11.300 8 0 2.400-2.600 3.900-5.800 3.900s-5.900-1.400-5.900-3.800" />
        <path d="M20 9v22" strokeWidth="2" />
      </g>
    ),
  },
  EUR: {
    bg: '#2a52a8',
    fg: '#ffffff',
    shape: circle,
    motif: <circle cx="20" cy="20" r="13" stroke="#fff" strokeOpacity=".18" strokeWidth="1.500" fill="none" strokeDasharray="1.500 3" />,
    glyph: (
      <g stroke="#fff" {...stroke}>
        <path d="M27 13.500a8.500 8.500 0 1 0 0 13" />
        <path d="M10.500 18.500h11M10.500 22h11" strokeWidth="2.200" />
      </g>
    ),
  },
  GBP: {
    bg: '#5b3a94',
    fg: '#ffffff',
    shape: hex,
    motif: <path d="M6 14l14-8 14 8" stroke="#fff" strokeOpacity=".18" strokeWidth="2" fill="none" />,
    glyph: (
      <g stroke="#fff" {...stroke}>
        <path d="M25 13.800c-1-2-2.800-3-5-3-3 0-5 2-5 5v4.400c0 3-1 5.200-3 6.800h17" />
        <path d="M12.500 20h9" strokeWidth="2.200" />
      </g>
    ),
  },
  TRY: {
    bg: '#b3261e',
    fg: '#ffffff',
    shape: squircle,
    motif: <path d="M28 7a9 9 0 1 0 0 13 7 7 0 1 1 0-13z" fill="#fff" fillOpacity=".14" transform="translate(-2 14)" />,
    glyph: (
      <g stroke="#fff" {...stroke}>
        <path d="M16 9v18.500" />
        <path d="M16 15.500h3.200a6.800 6.800 0 0 1 0 13.600H16" transform="translate(0 -3.500)" />
        <path d="M11.500 18.500l11-5M11.500 22.500l11-5" strokeWidth="2.200" />
      </g>
    ),
  },
  SAR: {
    bg: '#1d7348',
    fg: '#ffffff',
    shape: shield,
    motif: (
      <g stroke="#fff" strokeOpacity=".2" strokeWidth="1.600" fill="none">
        <path d="M6 31c5-5 9 2 14-2s9 3 14-1" />
        <path d="M8 35c4-3 8 1 12-1s8 2 12 0" />
      </g>
    ),
    glyph: text('ر.س', '#fff', 13),
  },
  AED: {
    bg: '#8c2a44',
    fg: '#ffffff',
    shape: octagon,
    motif: (
      <path
        d="M20 5l3.500 8.500L33 12l-6 7.500L35 25l-9.500 1.500L24 36l-4-7-4 7-1.500-9.500L5 25l8-5.500-6-7.500 9.500 1.500z"
        stroke="#fff"
        strokeOpacity=".2"
        strokeWidth="1.200"
        fill="none"
      />
    ),
    glyph: text('د.إ', '#fff', 14),
  },
  EGP: {
    bg: '#c7961f',
    fg: '#2a1c00',
    shape: hex,
    motif: <path d="M6 33l9-14 5 7 5-9 9 16z" fill="#2a1c00" fillOpacity=".12" />,
    glyph: text('ج.م', '#2a1c00', 14),
  },
  KWD: {
    bg: '#0b5f8a',
    fg: '#ffffff',
    shape: circle,
    motif: (
      <g stroke="#fff" strokeOpacity=".2" strokeWidth="1.600" fill="none">
        <path d="M3 28c4-4 7 3 11 0s7 3 11 0 7 3 12-1" />
        <path d="M3 33c4-3 7 2 11 0s7 2 11 0 7 2 12 0" />
      </g>
    ),
    glyph: text('د.ك', '#fff', 14),
  },
  QAR: {
    bg: '#74224f',
    fg: '#ffffff',
    shape: rounded,
    motif: <path d="M4 5l6 3.500L4 12l6 3.500L4 19l6 3.500L4 26l6 3.500L4 33" stroke="#fff" strokeOpacity=".22" strokeWidth="1.600" fill="none" />,
    glyph: text('ر.ق', '#fff', 14),
  },
  JOD: {
    bg: '#4a5a1c',
    fg: '#ffffff',
    shape: squircle,
    motif: (
      <g fill="#fff" fillOpacity=".16">
        <path d="M6 31l4-4 4 4-4 4zM14 31l4-4 4 4-4 4zM22 31l4-4 4 4-4 4zM30 31l4-4 4 4-4 4z" transform="translate(-2 -1)" />
      </g>
    ),
    glyph: text('د.أ', '#fff', 14),
  },
};

const FALLBACK: Def = { bg: '#475569', fg: '#fff', shape: circle, glyph: null };

export type RingTone = 'fresh' | 'aging' | 'stale';

export interface MarkRing {
  /** 0..1 portion of the stale-after window that is still left. */
  remaining: number;
  tone: RingTone;
}

const RING_COLOR: Record<RingTone, string> = {
  fresh: 'var(--success)',
  aging: 'var(--warning)',
  stale: 'var(--destructive)',
};

interface MarkProps {
  code: string;
  size?: number;
  ring?: MarkRing | null;
  /** Dim the mark (hidden currency). */
  dim?: boolean;
  className?: string;
  title?: string;
}

/** The mark plus an optional freshness ring (fills with the time left before the rate is stale). */
export function CurrencyMark({ code, size = 40, ring = null, dim = false, className, title }: MarkProps) {
  const def = DEFS[code] ?? FALLBACK;
  const uid = useId();
  const r = 22.5;
  const c = 2 * Math.PI * r;
  const frac = ring ? Math.max(0.04, Math.min(1, ring.remaining)) : 0;

  return (
    <svg
      viewBox="-5 -5 50 50"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      style={{ opacity: dim ? 0.55 : 1, flexShrink: 0, overflow: 'visible' }}
      direction="ltr"
    >
      {ring && (
        <g transform="rotate(-90 20 20)">
          <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeOpacity=".14" strokeWidth="2" />
          <circle
            cx="20"
            cy="20"
            r={r}
            fill="none"
            stroke={RING_COLOR[ring.tone]}
            strokeWidth="2.400"
            strokeLinecap="round"
            strokeDasharray={ring.tone === 'stale' ? '3 3.200' : `${c * frac} ${c}`}
          />
        </g>
      )}
      <defs>
        <clipPath id={`${uid}-clip`}>{def.shape}</clipPath>
      </defs>
      <g fill={def.bg}>{def.shape}</g>
      <g clipPath={`url(#${uid}-clip)`}>{def.motif}</g>
      {def.glyph}
    </svg>
  );
}
