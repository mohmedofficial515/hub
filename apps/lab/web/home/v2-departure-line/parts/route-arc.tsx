/**
 * The signature of this version: one 1px gold great-circle arc on the navy block that listens to the search form
 * (references.md 8.2, idea 3). Empty, it is a quiet dashed line with a hint; with an origin it plants the start code;
 * with both ends it draws once (700ms) and the trip summary appears under it. Multi-city draws one arc per leg.
 * No photograph, so no scrim and no gradient.
 *
 * Direction: the SVG is drawn LTR and mirrored in RTL (`rtl:-scale-x-100`); labels are placed with
 * `inset-inline-start`, so the origin is always at the reading start.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { Plane } from 'lucide-react';
import { cn } from '@lab/utils';
import type { Airport } from './mocks';

interface Stop {
  airport: Airport | null;
  date?: string | null;
}

interface RouteArcProps {
  stops: Stop[];
  summary: string | null;
  emptyHint: string;
  ariaLabel: string;
  routeText: string | null;
  /** Shown at the two ends until an airport is chosen. */
  ends: { from: string; to: string };
  compact?: boolean;
}

const W = 1000;
const H = 220;
const PAD = 70;
const BASE = 170;

function arcPath(x1: number, x2: number, lift: number) {
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${BASE} Q ${mid} ${BASE - lift * 2} ${x2} ${BASE}`;
}

export function RouteArc({ stops, summary, emptyHint, ariaLabel, routeText, ends, compact }: RouteArcProps) {
  const reduce = useReducedMotion();
  const n = Math.max(stops.length, 2);
  const xs = Array.from({ length: n }, (_, i) => PAD + ((W - PAD * 2) * i) / (n - 1));
  const legs = xs.slice(1).map((x2, i) => ({ x1: xs[i], x2, done: !!stops[i]?.airport && !!stops[i + 1]?.airport }));
  const lift = n > 2 ? 70 : 110;
  const complete = legs.every((l) => l.done);
  const key = stops.map((s) => s.airport?.code ?? '-').join('');

  return (
    <figure
      aria-label={ariaLabel}
      className={cn('relative w-full select-none', compact ? 'h-[150px]' : 'h-[188px] lg:h-[236px]')}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-0 h-[70%] w-full rtl:-scale-x-100"
        aria-hidden
      >
        {/* the ground line: a hairline the codes stand on */}
        <line x1={PAD} y1={BASE} x2={W - PAD} y2={BASE} stroke="var(--line-on-brand)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {legs.map((leg, i) =>
          leg.done ? (
            <motion.path
              key={`${key}-${i}`}
              d={arcPath(leg.x1, leg.x2, lift)}
              fill="none"
              stroke="var(--highlight)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, delay: i * 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            />
          ) : (
            <path
              key={`empty-${i}`}
              d={arcPath(leg.x1, leg.x2, lift)}
              fill="none"
              stroke="var(--on-brand-muted)"
              strokeOpacity={0.45}
              strokeWidth={1}
              strokeDasharray="3 7"
              vectorEffect="non-scaling-stroke"
            />
          ),
        )}
      </svg>

      {/* the plane rides at the apex of the first finished leg, after it is drawn */}
      {complete && legs.length === 1 && (
        <motion.span
          key={`plane-${key}`}
          aria-hidden
          className="absolute start-1/2 -translate-x-1/2 rtl:translate-x-1/2 text-(--highlight)"
          style={{ top: compact ? '12%' : '13%' }}
          initial={reduce ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, delay: reduce ? 0 : 0.6 }}
        >
          <Plane className="size-5 rotate-45 rtl:-scale-x-100 rtl:-rotate-45" strokeWidth={1.75} />
        </motion.span>
      )}

      {/* codes on the ground line */}
      {xs.map((x, i) => {
        const stop = stops[i];
        const pct = (x / W) * 100;
        const edge = i === 0 ? 'start' : i === xs.length - 1 ? 'end' : 'mid';
        return (
          <div
            key={i}
            className={cn(
              'absolute flex flex-col',
              edge === 'start' && 'items-start',
              edge === 'end' && 'items-end',
              edge === 'mid' && 'items-center',
            )}
            style={{
              top: compact ? '64%' : '66%',
              insetInlineStart: edge === 'end' ? undefined : `calc(${pct}% - ${edge === 'mid' ? '3rem' : '0.25rem'})`,
              insetInlineEnd: edge === 'end' ? `calc(${100 - pct}% - 0.25rem)` : undefined,
              width: edge === 'mid' ? '6rem' : undefined,
            }}
          >
            <span
              translate="no"
              className={cn(
                'tnum leading-none font-bold tracking-normal',
                !stop?.airport && edge !== 'mid'
                  ? cn('font-semibold', compact ? 'text-lg' : 'text-xl lg:text-2xl')
                  : compact
                    ? 'text-[1.75rem]'
                    : n > 2
                      ? 'text-3xl lg:text-4xl'
                      : 'text-4xl lg:text-5xl',
                stop?.airport ? 'text-(--on-brand)' : 'text-(--on-brand-muted)',
              )}
            >
              {stop?.airport?.code ?? (edge === 'start' ? ends.from : edge === 'end' ? ends.to : '···')}
            </span>
            <span className={cn('mt-1.5 max-w-[11rem] truncate text-sm text-(--on-brand-muted)', compact && 'max-w-[8rem] text-xs')}>
              {stop?.airport?.city ?? ' '}
            </span>
          </div>
        );
      })}

      <figcaption
        className={cn(
          'absolute text-center text-(--on-brand-muted)',
          // phone: between the two codes, under the arc; wider: inside the dome
          compact
            ? n > 2
              ? 'inset-x-0 top-0 text-xs leading-snug'
              : 'inset-x-[24%] top-[66%] text-xs leading-snug'
            : n > 2
              ? 'inset-x-0 top-[4%] text-sm'
              : 'inset-x-0 top-[27%] text-sm',
        )}
      >
        {routeText && <span className="sr-only">{routeText}. </span>}
        {summary ? (
          <motion.span
            key={summary}
            className="tnum inline-block"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {summary}
          </motion.span>
        ) : stops.some((s) => s.airport) ? null : (
          <span className="mx-auto block max-w-[16rem] text-balance">{emptyHint}</span>
        )}
      </figcaption>
    </figure>
  );
}
