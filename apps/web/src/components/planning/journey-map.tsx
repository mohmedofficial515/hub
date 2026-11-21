'use client';

/**
 * @file journey-map.tsx
 * @description The plan as a journey (v5-live-plan): a stop per phase on a path that winds row by row, then a finish line. A stop's ring fills with
 * its steps, a finished phase is a filled disc with a check, and the phase holding the next step pulses slowly (still under reduced motion). The
 * selection ring moves between stops (framer `layoutId`). Finished stretches draw themselves once, in the phase's tone; the rest is dotted. Each
 * stop is a button that picks the phase shown under the map: one Tab stop, arrows along the path (kit `useRoving`). Under 560 px the path is one
 * vertical line, a stop per row.
 */
import { motion } from 'framer-motion';
import { Check, Flag, Sparkles } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';

import { cn, fmt, focusRing, Ltr, num, useLocale, useRoving, useT } from '@/components/kit';
import { type PhaseGroup, phaseState, toneOf } from '@/features/planning/journey';

import type { PlanningMessages } from './messages';

/** Half the distance between two rows: the radius of the turn that joins them. */
const R = 68;
const ROW = R * 2;
const TOP = 30;
/** The vertical layout (phones): one stop per line. */
const V_STEP = 72;
const V_X = 28;
const VERTICAL_BELOW = 560;

interface Stop {
  x: number;
  y: number;
  row: number;
}

function columnsFor(width: number) {
  if (width >= 1000) return 6;
  if (width >= 760) return 5;
  return 4;
}

/** Where each stop sits. Rows run in reading order and turn back on the next row, so any number of phases fits without scrolling. */
function layout(width: number, count: number, rtl: boolean) {
  if (width < VERTICAL_BELOW) {
    const stops = Array.from({ length: count }, (_, i) => ({
      x: rtl ? width - V_X : V_X,
      y: TOP + i * V_STEP,
      row: i,
    }));
    return {
      vertical: true,
      stops,
      height: TOP + (count - 1) * V_STEP + 36,
      labelWidth: width - V_X * 2 - 16,
    };
  }
  const cols = Math.min(columnsFor(width), count);
  const rows = Math.ceil(count / cols);
  const margin = rows > 1 ? R + 12 : 56;
  const step = cols > 1 ? (width - margin * 2) / (cols - 1) : 0;
  const stops: Stop[] = Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols);
    const c = i % cols;
    const along = row % 2 === 0 ? c : cols - 1 - c;
    const logical = cols > 1 ? margin + along * step : width / 2;
    return { x: rtl ? width - logical : logical, y: TOP + row * ROW, row };
  });
  return {
    vertical: false,
    stops,
    height: TOP + (rows - 1) * ROW + 104,
    labelWidth: Math.max(96, Math.min(step - 14, 172, margin * 2 - 8)),
  };
}

/** The line from one stop to the next: straight along a row, a half circle bulging outwards where the row turns. */
function segmentPath(a: Stop, b: Stop, width: number) {
  if (a.row === b.row || a.x !== b.x) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const sweep = a.x > width / 2 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${R} ${R} 0 0 ${sweep} ${b.x} ${b.y}`;
}

const SPRING = { type: 'spring', stiffness: 420, damping: 24 } as const;

export function JourneyMap({
  groups,
  selected,
  hover,
  active = null,
  onSelect,
  onHover,
}: {
  groups: PhaseGroup[];
  selected: number;
  hover: number | null;
  /** The phase holding the step Claude works on, if any: its stop wears the halo (v5-live-plan, batch 2). */
  active?: number | null;
  onSelect: (index: number) => void;
  onHover: (index: number | null) => void;
}) {
  const j = useT<PlanningMessages>('planning').detail.journey;
  const locale = useLocale();
  const rtl = locale === 'ar';
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const { root, groupProps, itemProps } = useRoving(selected);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = groups.reduce((n, g) => n + g.total, 0);
  const done = groups.reduce((n, g) => n + g.done, 0);
  const finished = total > 0 && done === total;
  const count = groups.length + 1;
  // Before the first measure (and in a DOM that measures nothing) the map lays out as on a phone.
  const w = width || VERTICAL_BELOW - 1;
  const map = layout(w, count, rtl);
  const last = groups.length - 1;
  const at = (stop: Stop) =>
    map.vertical
      ? { insetInlineStart: V_X - 22, top: stop.y, width: w - 12 }
      : { left: stop.x, top: stop.y - 22, width: map.labelWidth };
  const finish = map.stops[count - 1]!;

  return (
    <div ref={box} className="min-w-0">
      <div
        ref={root}
        {...groupProps}
        role="group"
        aria-label={j.title}
        className="pj-map"
        style={{ height: map.height }}
      >
        <svg width={w} height={map.height} aria-hidden>
          {groups.map((g, i) => {
            const d = segmentPath(map.stops[i]!, map.stops[i + 1]!, w);
            const state = phaseState(g);
            const frac = g.total ? g.done / g.total : 0;
            return (
              <g key={g.phase?.id ?? 'loose'} data-pj-tone={toneOf(i)}>
                {state === 'done' ? (
                  <path
                    d={d}
                    pathLength={1}
                    className="pj-seg pj-seg-fill pj-seg-draw"
                    strokeDasharray="1 1"
                    style={{ animationDelay: `${i * 90}ms` }}
                  />
                ) : state === 'now' ? (
                  <>
                    <path d={d} className="pj-seg pj-seg-base" />
                    <path
                      d={d}
                      pathLength={1}
                      className="pj-seg pj-seg-fill"
                      strokeDasharray={`${frac} 1`}
                      style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.2, 0.7, 0.2, 1)' }}
                    />
                  </>
                ) : (
                  <path d={d} className="pj-seg pj-seg-todo" />
                )}
              </g>
            );
          })}
        </svg>

        {groups.map((g, i) => {
          const stop = map.stops[i]!;
          const state = phaseState(g);
          const title = g.phase?.title ?? j.noPhase;
          const frac = g.total ? g.done / g.total : 0;
          const reviewFrac = g.total ? g.review / g.total : 0;
          const roving = itemProps(i);
          const words = state === 'done' ? j.stateDone : state === 'now' ? j.stateNow : j.stateTodo;
          return (
            <div
              key={g.phase?.id ?? 'loose'}
              data-pj-tone={toneOf(i)}
              data-dim={hover !== null && hover !== i && selected !== i ? 'true' : 'false'}
              className={map.vertical ? 'pj-stop pj-stop-row' : 'pj-stop'}
              style={at(stop)}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
            >
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                transition={{ ...SPRING, delay: i * 0.05 }}
                {...roving}
                onFocus={() => {
                  roving.onFocus();
                  onHover(i);
                }}
                onBlur={() => onHover(null)}
                onClick={() => onSelect(i)}
                aria-pressed={selected === i}
                aria-current={state === 'now' ? 'step' : undefined}
                aria-label={`${fmt(j.phaseOfN, { n: num(g.index, locale), last: num(last, locale) })}: ${title}. ${fmt(
                  j.progressLabel,
                  { done: num(g.done, locale), total: num(g.total, locale) },
                )}${g.review > 0 ? `. ${fmt(j.inReview, { n: num(g.review, locale) })}` : ''}. ${words}${state === 'now' ? `. ${j.here}` : ''}${active === i ? `. ${j.claudeHere}` : ''}`}
                data-state={state}
                className={cn('pj-node shrink-0 text-body', focusRing)}
              >
                {selected === i && (
                  <motion.span
                    layoutId="pj-sel-ring"
                    className="pj-sel-ring"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                {active === i && (
                  <>
                    <span aria-hidden className="pj-halo" data-pj-halo />
                    <motion.span
                      aria-hidden
                      className="pj-halo-badge"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    >
                      <Sparkles className="size-3" strokeWidth={2.5} />
                    </motion.span>
                  </>
                )}
                {state === 'done' ? (
                  <motion.span
                    aria-hidden
                    initial={{ scale: 0.3, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                  >
                    <Check className="size-5" strokeWidth={3} />
                  </motion.span>
                ) : (
                  <>
                    <svg viewBox="0 0 44 44" aria-hidden className="pj-node-ring">
                      <circle
                        cx="22"
                        cy="22"
                        r="20"
                        fill="none"
                        strokeWidth="3"
                        style={{ stroke: 'var(--pj-tone-line)' }}
                      />
                      <circle
                        cx="22"
                        cy="22"
                        r="20"
                        fill="none"
                        strokeWidth="3"
                        strokeLinecap="round"
                        pathLength={1}
                        strokeDasharray={`${frac} 1`}
                        style={{
                          stroke: 'var(--pj-tone)',
                          opacity: frac > 0 ? 1 : 0,
                          transition: 'stroke-dasharray 700ms cubic-bezier(0.2, 0.7, 0.2, 1)',
                        }}
                      />
                      {/* In review: the arc after the done part, dashed, so it reads as a shape and not only a colour. */}
                      <circle
                        cx="22"
                        cy="22"
                        r="20"
                        fill="none"
                        strokeWidth="3"
                        pathLength={1}
                        strokeDasharray={`${reviewFrac} 1`}
                        strokeDashoffset={-frac}
                        className="pj-node-review"
                        style={{ opacity: reviewFrac > 0 ? 0.5 : 0 }}
                      />
                    </svg>
                    <span aria-hidden className="relative">
                      <Ltr className="tabular-nums">{num(g.index, locale)}</Ltr>
                    </span>
                  </>
                )}
              </motion.button>
              <motion.span
                aria-hidden
                className="pj-label min-w-0"
                style={map.vertical ? { flex: 1 } : { width: map.labelWidth }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
              >
                <span
                  dir="auto"
                  className={cn(
                    'pj-clamp-2 text-body-sm leading-snug',
                    selected === i || state === 'now'
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  {title}
                </span>
                <span className="flex items-center gap-1.5 text-caption tabular-nums">
                  <span className={state === 'todo' ? 'text-muted-foreground' : 'pj-tone-fg font-medium'}>
                    {state === 'done'
                      ? j.stateDone
                      : fmt(j.progress, { done: num(g.done, locale), total: num(g.total, locale) })}
                  </span>
                  {state === 'now' && <span className="pj-tone-fg font-semibold">· {j.here}</span>}
                </span>
                {state !== 'done' && g.review > 0 && (
                  <span className="flex items-center gap-1 text-caption text-foreground tabular-nums">
                    <span aria-hidden className="pj-swatch pj-swatch-review" />
                    {fmt(j.inReview, { n: num(g.review, locale) })}
                  </span>
                )}
              </motion.span>
            </div>
          );
        })}

        {/* The finish line: not a phase, so not a button. */}
        <div className={map.vertical ? 'pj-stop pj-stop-row' : 'pj-stop'} style={at(finish)}>
          <span
            aria-hidden
            data-state={finished ? 'done' : 'todo'}
            className="pj-node pj-node-finish shrink-0"
          >
            {finished ? (
              <Check className="size-5" strokeWidth={3} />
            ) : (
              <Flag className="size-4.5" strokeWidth={2} />
            )}
          </span>
          <span className="pj-label min-w-0" style={map.vertical ? { flex: 1 } : { width: map.labelWidth }}>
            <span className="text-body-sm font-semibold text-foreground">
              {finished ? j.finishDone : j.finishLine}
            </span>
            {!finished && (
              <span className="text-caption text-muted-foreground tabular-nums">
                {fmt(j.remaining, { n: num(total - done, locale) })}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
