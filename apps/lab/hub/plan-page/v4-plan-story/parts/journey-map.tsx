import { useLayoutEffect, useRef, useState } from 'react';
import { Check, Flag } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { focusRing, fmt, Ltr, num, useRoving } from '../../../today/v5-peacock-app/kit';
import { messages } from '../i18n';
import type { PhaseGroup } from './model';
import { phaseState, toneOf } from './tone';

/** Half the distance between two rows: the radius of the turn that joins them. */
const R = 68;
const ROW = R * 2;
const TOP = 30;
/** Vertical layout (phones): one stop per line. */
const V_STEP = 72;
const V_X = 28;

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
  if (width < 560) {
    const stops = Array.from({ length: count }, (_, i) => ({ x: rtl ? width - V_X : V_X, y: TOP + i * V_STEP, row: i }));
    return { vertical: true, stops, height: TOP + (count - 1) * V_STEP + 36, labelWidth: width - V_X * 2 - 16, cols: 1 };
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
  return { vertical: false, stops, height: TOP + (rows - 1) * ROW + 104, labelWidth: Math.max(96, Math.min(step - 14, 172, margin * 2 - 8)), cols };
}

/** The line from one stop to the next: straight along a row, a half circle bulging outwards where the row turns. */
function segmentPath(a: Stop, b: Stop, width: number) {
  if (a.row === b.row || a.x !== b.x) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const sweep = a.x > width / 2 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${R} ${R} 0 0 ${sweep} ${b.x} ${b.y}`;
}

/**
 * The plan as a journey: a stop per phase on a path that winds row by row, then a finish line. A stop's ring fills with its steps,
 * a finished phase is a filled disc with a check, and the phase holding the next step is ringed with a slow pulse (none under
 * reduced motion). Finished stretches of the path draw themselves once, in the phase's tone; the rest is dotted.
 * Each stop is a button that picks the phase shown under the map. One Tab stop, arrows along the path (kit `useRoving`).
 */
export function JourneyMap({
  groups,
  selected,
  hover,
  onSelect,
  onHover,
}: {
  groups: PhaseGroup[];
  selected: number;
  hover: number | null;
  onSelect: (index: number) => void;
  onHover: (index: number | null) => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const rtl = locale === 'ar';
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const { root, groupProps, itemProps } = useRoving(selected);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry!.contentRect.width)));
    ro.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  const total = groups.reduce((n, g) => n + g.total, 0);
  const done = groups.reduce((n, g) => n + g.done, 0);
  const finished = total > 0 && done === total;
  const count = groups.length + 1;
  const map = width ? layout(width, count, rtl) : null;
  const last = groups.length - 1;

  return (
    <div ref={box} className="min-w-0" style={{ minHeight: map ? undefined : 240 }}>
      {map && (
        <div ref={root} {...groupProps} role="group" aria-label={t.journey} className="ps-map" style={{ height: map.height }}>
          <svg width={width} height={map.height} aria-hidden>
            {groups.map((g, i) => {
              const a = map.stops[i]!;
              const b = map.stops[i + 1]!;
              const d = segmentPath(a, b, width);
              const state = phaseState(g);
              const frac = g.total ? g.done / g.total : 0;
              return (
                <g key={i} data-tone={toneOf(i)}>
                  {state === 'done' ? (
                    <path d={d} pathLength={1} className="ps-seg ps-seg-fill ps-seg-draw" strokeDasharray="1 1" style={{ animationDelay: `${i * 90}ms` }} />
                  ) : state === 'now' ? (
                    <>
                      <path d={d} className="ps-seg ps-seg-base" />
                      <path d={d} pathLength={1} className="ps-seg ps-seg-fill" strokeDasharray={`${frac} 1`} />
                    </>
                  ) : (
                    <path d={d} className="ps-seg ps-seg-todo" />
                  )}
                </g>
              );
            })}
          </svg>

          {groups.map((g, i) => {
            const stop = map.stops[i]!;
            const state = phaseState(g);
            const title = g.phase?.title ?? t.unphased;
            const frac = g.total ? g.done / g.total : 0;
            const roving = itemProps(i);
            const words = state === 'done' ? t.stateDone : state === 'now' ? t.stateNow : t.stateTodo;
            return (
              <div
                key={g.phase?.id ?? 'loose'}
                data-tone={toneOf(i)}
                data-dim={hover !== null && hover !== i && selected !== i ? 'true' : 'false'}
                className={map.vertical ? 'ps-stop ps-stop-row' : 'ps-stop'}
                style={map.vertical ? { insetInlineStart: V_X - 22, top: stop.y, width: width - 12 } : { left: stop.x, top: stop.y - 22, width: map.labelWidth }}
                onMouseEnter={() => onHover(i)}
                onMouseLeave={() => onHover(null)}
              >
                <button
                  type="button"
                  {...roving}
                  onFocus={() => {
                    roving.onFocus();
                    onHover(i);
                  }}
                  onBlur={() => onHover(null)}
                  onClick={() => onSelect(i)}
                  aria-pressed={selected === i}
                  aria-current={state === 'now' ? 'step' : undefined}
                  aria-label={`${fmt(t.phaseOfN, { n: num(g.index, locale), last: num(last, locale) })}: ${title}. ${fmt(t.progressLabel, { done: num(g.done, locale), total: num(g.total, locale) })}. ${words}${state === 'now' ? `. ${t.here}` : ''}`}
                  data-state={state}
                  className={`ps-node shrink-0 text-body ${focusRing}`}
                >
                  {state === 'done' ? (
                    <Check aria-hidden className="size-5" strokeWidth={3} />
                  ) : (
                    <>
                      <svg viewBox="0 0 44 44" aria-hidden className="ps-node-ring">
                        <circle cx="22" cy="22" r="20" fill="none" strokeWidth="3" style={{ stroke: 'var(--tone-line)' }} />
                        {frac > 0 && <circle cx="22" cy="22" r="20" fill="none" strokeWidth="3" strokeLinecap="round" pathLength={1} strokeDasharray={`${frac} 1`} style={{ stroke: 'var(--tone)' }} />}
                      </svg>
                      <Ltr className="relative tabular-nums">{num(g.index, locale)}</Ltr>
                    </>
                  )}
                </button>
                <span aria-hidden className="ps-label min-w-0" style={map.vertical ? { flex: 1 } : { width: map.labelWidth }}>
                  <span dir="auto" className={`ps-clamp-2 text-body-sm leading-snug ${selected === i || state === 'now' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                    {title}
                  </span>
                  <span className="flex items-center gap-1.5 text-caption tabular-nums">
                    <span className={state === 'todo' ? 'text-muted-foreground' : 'ps-tone-fg font-medium'}>
                      {state === 'done' ? t.stateDone : fmt(t.progress, { done: num(g.done, locale), total: num(g.total, locale) })}
                    </span>
                    {state === 'now' && <span className="ps-tone-fg font-semibold">· {t.here}</span>}
                  </span>
                </span>
              </div>
            );
          })}

          {/* The finish line: not a phase, so not a button. */}
          {(() => {
            const stop = map.stops[count - 1]!;
            return (
              <div
                className={map.vertical ? 'ps-stop ps-stop-row' : 'ps-stop'}
                style={map.vertical ? { insetInlineStart: V_X - 22, top: stop.y, width: width - 12 } : { left: stop.x, top: stop.y - 22, width: map.labelWidth }}
              >
                <span aria-hidden data-state={finished ? 'done' : 'todo'} className="ps-node ps-node-finish shrink-0">
                  {finished ? <Check className="size-5" strokeWidth={3} /> : <Flag className="size-4.5" strokeWidth={2} />}
                </span>
                <span className="ps-label min-w-0" style={map.vertical ? { flex: 1 } : { width: map.labelWidth }}>
                  <span className="text-body-sm font-semibold text-foreground">{finished ? t.finishDone : t.finishLine}</span>
                  {!finished && <span className="text-caption text-muted-foreground tabular-nums">{fmt(t.remaining, { n: num(total - done, locale) })}</span>}
                </span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
