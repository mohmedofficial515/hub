import { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { UserRound } from 'lucide-react';
import { useLocale } from '@lab/i18n';
import { cn } from '@lab/utils';

import type { FrameLevel } from './mock';

export type PostmarkSize = 32 | 64 | 128;

/**
 * Size budgets (design/references.md §7.1): photo disc, then a moat in the surface colour, then the frame zone.
 * rIn / rOut bound the frame zone, in px of a viewBox as large as the avatar.
 */
const GEO = {
  32: { photo: 24, rIn: 13.5, rOut: 15.75, badge: 0, mono1: 12, mono2: 10 },
  64: { photo: 50, rIn: 27, rOut: 31.75, badge: 18, mono1: 22, mono2: 18 },
  128: { photo: 100, rIn: 54, rOut: 63.5, badge: 30, mono1: 42, mono2: 34 },
} as const;

interface Ring {
  r: number;
  w: number;
  ink: string;
}

const INK = {
  BLUE: 'var(--pm-blue)',
  SILVER: 'var(--pm-silver)',
  GOLD: 'var(--pm-gold)',
  KEY: 'var(--pm-gold-key)',
  OTHER: 'var(--pm-other)',
  NONE: 'var(--pm-none)',
};

/**
 * Structure per level, so the level reads in greyscale too:
 * BLUE one hairline · SILVER two concentric hairlines · GOLD a gold band between two navy keylines with a star
 * break at the top. Unknown codes get a graphite line, missing loyalty a hairline in the border colour.
 * At 32 px only the line structure survives (no star, text or badge).
 */
function ringsFor(level: FrameLevel, size: PostmarkSize): Ring[] {
  if (size === 32) {
    switch (level) {
      // BLUE one solid 2 px line; SILVER two 1 px lines with a full 1 px gap, so they separate at DPR 1.
      case 'BLUE':
        return [{ r: 14.6, w: 2, ink: INK.BLUE }];
      case 'SILVER':
        return [
          { r: 13.5, w: 1, ink: INK.SILVER },
          { r: 15.5, w: 1, ink: INK.SILVER },
        ];
      case 'GOLD':
        return [
          { r: 14.35, w: 1.9, ink: INK.GOLD },
          { r: 15.6, w: 0.7, ink: INK.KEY },
        ];
      case 'OTHER':
        return [{ r: 14.6, w: 1.5, ink: INK.OTHER }];
      default:
        return [{ r: 14.6, w: 1, ink: INK.NONE }];
    }
  }
  if (size === 64) {
    switch (level) {
      case 'BLUE':
        return [{ r: 29.5, w: 1.4, ink: INK.BLUE }];
      case 'SILVER':
        return [
          { r: 28, w: 1, ink: INK.SILVER },
          { r: 31, w: 1, ink: INK.SILVER },
        ];
      case 'GOLD':
        return [
          { r: 29.4, w: 3.4, ink: INK.GOLD },
          { r: 27.4, w: 0.8, ink: INK.KEY },
          { r: 31.5, w: 0.8, ink: INK.KEY },
        ];
      case 'OTHER':
        return [{ r: 29.5, w: 1.5, ink: INK.OTHER }];
      default:
        return [{ r: 29.5, w: 1, ink: INK.NONE }];
    }
  }
  switch (level) {
    case 'BLUE':
      return [{ r: 62.6, w: 1.4, ink: INK.BLUE }];
    case 'SILVER':
      return [
        { r: 55, w: 1.1, ink: INK.SILVER },
        { r: 62.6, w: 1.1, ink: INK.SILVER },
      ];
    case 'GOLD':
      return [
        { r: 58.7, w: 8, ink: INK.GOLD },
        { r: 54.5, w: 1, ink: INK.KEY },
        { r: 62.9, w: 1, ink: INK.KEY },
      ];
    case 'OTHER':
      return [{ r: 61, w: 1.5, ink: INK.OTHER }];
    default:
      return [{ r: 61, w: 1, ink: INK.NONE }];
  }
}

/** Five-point star centred on (cx, cy). */
function starPath(cx: number, cy: number, R: number) {
  const r = R * 0.45;
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? R : r;
    points.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return `M${points.join('L')}Z`;
}

/** A circle path that starts at the top and runs clockwise twice, so a text run may cross the top. */
function circlePath(c: number, r: number) {
  const turn = `a ${r} ${r} 0 1 1 0 ${2 * r} a ${r} ${r} 0 1 1 0 ${-2 * r}`;
  return `M ${c} ${c - r} ${turn} ${turn}`;
}

/**
 * Where the micro-text runs, in degrees clockwise from the top of the (tilted) ring: everything except a gap behind
 * the level badge (bottom-end corner) and, at GOLD, a gap for the star at the top.
 */
function textRuns(level: FrameLevel, tilt: number, rtl: boolean): [number, number][] {
  const badge = (rtl ? 225 : 135) - tilt;
  const half = 21;
  const from = badge + half;
  const to = badge - half + 360;
  if (level !== 'GOLD') return [[from, to]];
  return [
    [from, 352],
    [368, to],
  ];
}

/** The cancellation tail: three short ruled waves leaving the ring on the end side (GOLD, 128 px). */
function tailPaths(c: number) {
  const x0 = c + 66;
  const waves = 4;
  return [-9, 0, 9].map((dy) => {
    let d = `M ${x0} ${c + dy}`;
    for (let i = 0; i < waves; i++) d += ` q 1.75 ${i % 2 ? 2.2 : -2.2} 3.5 0`;
    return d;
  });
}

function BadgeGlyph({ level }: { level: FrameLevel }) {
  // dot · one chevron · two chevrons: the second cue besides colour.
  if (level === 'BLUE') return <circle cx="12" cy="12" r="3.2" fill="currentColor" />;
  if (level === 'SILVER')
    return <path d="M7 14.5 12 9.5l5 5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />;
  return (
    <path
      d="M7 12.5 12 7.5l5 5M7 17.5l5-5 5 5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export interface PostmarkProps {
  size: PostmarkSize;
  level: FrameLevel;
  /** Accessible name: the customer's name and level, e.g. "Sara Alqahtani, Gold member". */
  label: string;
  initial: string;
  photo?: { url: string; thumbUrl: string } | null;
  /** Year for the 128 px micro-text. */
  memberSince?: number;
  /** `surface` (white / ink card) or `brand` (the navy header). */
  tone?: 'surface' | 'brand';
  state?: 'ready' | 'loading' | 'signed-out';
  className?: string;
}

/**
 * The customer's avatar inside a Postmark (visa-stamp) frame. One SVG drawn per size, simplified downward:
 * 32 px line structure only; 64 px adds the star break and the level badge; 128 px adds the micro-text, a -6° stamp
 * tilt and, at GOLD, the cancellation tail. On a level change the frame draws itself once (600 ms); never loops.
 */
export function Postmark({
  size,
  level,
  label,
  initial,
  photo,
  memberSince,
  tone = 'surface',
  state = 'ready',
  className,
}: PostmarkProps) {
  const g = GEO[size];
  const c = size / 2;
  const rtl = useLocale() === 'ar';
  const reduce = useReducedMotion();
  const arcId = `pm-arc-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [failed, setFailed] = useState(false);
  const src = photo ? (size <= 64 ? photo.thumbUrl : photo.url) : undefined;

  // Draw only when the level changes after the first paint.
  const firstPaint = useRef(true);
  useEffect(() => {
    firstPaint.current = false;
  }, []);
  useEffect(() => setFailed(false), [src]);
  const draw = !firstPaint.current && !reduce;

  const box = { width: size, height: size };
  const inset = (size - g.photo) / 2;

  if (state === 'loading') {
    return (
      <span
        data-pm-tone={tone}
        aria-hidden
        className={cn('inline-block shrink-0 rounded-full bg-(--pm-skeleton) motion-safe:animate-pulse', className)}
        style={box}
      />
    );
  }

  if (state === 'signed-out') {
    return (
      <span
        data-pm-tone={tone}
        role="img"
        aria-label={label}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full border border-(--pm-none) text-(--pm-blue)',
          className,
        )}
        style={box}
      >
        <UserRound aria-hidden style={{ width: g.photo * 0.62, height: g.photo * 0.62 }} strokeWidth={1.75} />
      </span>
    );
  }

  const rings = ringsFor(level, size);
  const known = level === 'BLUE' || level === 'SILVER' || level === 'GOLD';
  const showStar = level === 'GOLD' && size >= 64;
  const showText = known && size === 128;
  const showTail = level === 'GOLD' && size === 128;
  const showBadge = known && size >= 64;
  const tilt = size === 128 ? (rtl ? 6 : -6) : 0;

  const textR = level === 'BLUE' ? 56.4 : level === 'SILVER' ? 56.9 : 56.75;
  const circ = 2 * Math.PI * textR;
  const phrase = `GOTEAV · ${level} MEMBER · SINCE ${memberSince ?? ''} · `.repeat(3);
  const runs = textRuns(level, tilt, rtl).map(([a, b]) => {
    const length = ((b - a) / 360) * circ;
    const text = phrase.slice(0, Math.floor(length / 3.75)).replace(/[\s·]+$/, '');
    return { offset: (a / 360) * circ, length, text };
  });
  const textInk = level === 'GOLD' ? 'var(--pm-on-gold)' : level === 'SILVER' ? INK.SILVER : INK.BLUE;
  const starAt = size === 128 ? 58.7 : 29.4;
  const starR = size === 128 ? 5.2 : 2.9;

  const pathAnim = draw
    ? { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } }
    : { initial: false as const };
  const fadeAnim = draw
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3, delay: 0.45 } }
    : { initial: false as const };

  const mono = initial.length > 1 ? g.mono2 : g.mono1;

  return (
    <span
      data-pm-tone={tone}
      role="img"
      aria-label={label}
      className={cn('relative inline-block shrink-0 align-middle', className)}
      style={box}
    >
      {/* Photo or monogram, inside the moat */}
      <span
        aria-hidden
        className="absolute overflow-hidden rounded-full bg-(--pm-mono-bg)"
        style={{ inset, width: g.photo, height: g.photo }}
      >
        {src && !failed ? (
          <img
            src={src}
            alt=""
            width={g.photo}
            height={g.photo}
            onError={() => setFailed(true)}
            className="block h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center leading-none font-bold text-(--pm-mono-fg)"
            style={{ fontSize: mono, letterSpacing: initial.length > 1 ? '0.02em' : undefined }}
          >
            {initial}
          </span>
        )}
      </span>

      {/* The frame */}
      <svg
        aria-hidden
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        overflow="visible"
        className="pointer-events-none absolute inset-0"
      >
        <g key={level} transform={tilt ? `rotate(${tilt} ${c} ${c})` : undefined}>
          {rings.map((ring, i) => (
            <motion.circle
              key={i}
              cx={c}
              cy={c}
              r={ring.r}
              fill="none"
              stroke={ring.ink}
              strokeWidth={ring.w}
              transform={`rotate(-90 ${c} ${c})`}
              {...pathAnim}
            />
          ))}

          {showText && (
            <motion.g {...fadeAnim}>
              <defs>
                <path id={arcId} d={circlePath(c, textR)} />
              </defs>
              {runs.map((run) => (
                <text
                  key={run.offset}
                  direction="ltr"
                  fill={textInk}
                  fontSize={level === 'GOLD' ? 5.4 : 5.6}
                  fontWeight={700}
                  style={{ fontFamily: 'Cairo, system-ui, sans-serif', unicodeBidi: 'plaintext' }}
                >
                  <textPath href={`#${arcId}`} startOffset={run.offset} textLength={run.length} lengthAdjust="spacing">
                    {run.text}
                  </textPath>
                </text>
              ))}
            </motion.g>
          )}

          {showStar && (
            <motion.g {...fadeAnim}>
              <circle cx={c} cy={c - starAt} r={starR + (size === 128 ? 1.6 : 0.9)} fill="var(--pm-surface)" />
              <path
                d={starPath(c, c - starAt, starR)}
                fill={INK.GOLD}
                stroke={INK.KEY}
                strokeWidth={size === 128 ? 0.8 : 0.6}
                strokeLinejoin="round"
              />
            </motion.g>
          )}

          {showTail && (
            <motion.g
              {...fadeAnim}
              transform={rtl ? `translate(${size} 0) scale(-1 1)` : undefined}
              stroke="var(--pm-tail)"
              strokeWidth={1.1}
              strokeLinecap="round"
              fill="none"
            >
              {tailPaths(c).map((d) => (
                <path key={d} d={d} />
              ))}
            </motion.g>
          )}
        </g>
      </svg>

      {showBadge && (
        <span
          aria-hidden
          className={cn(
            'absolute flex items-center justify-center rounded-full border-2 border-(--pm-surface)',
            level === 'GOLD'
              ? 'bg-(--pm-gold) text-(--pm-on-gold)'
              : level === 'SILVER'
                ? 'bg-(--pm-silver) text-(--pm-on-ink)'
                : 'bg-(--pm-blue) text-(--pm-on-ink)',
          )}
          style={{
            width: g.badge,
            height: g.badge,
            bottom: size === 128 ? 4 : -2,
            insetInlineEnd: size === 128 ? 4 : -2,
          }}
        >
          <svg viewBox="0 0 24 24" width={g.badge * 0.62} height={g.badge * 0.62}>
            <BadgeGlyph level={level} />
          </svg>
        </span>
      )}
    </span>
  );
}
