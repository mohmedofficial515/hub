import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { AlertTriangle, Loader2, Plane, RotateCw, XCircle } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { Amount } from './amount';
import { formatMonth, useMedia } from './hooks';
import { formatUsd, isolate, MASK, toCents, type Cents } from './money';
import { FILTERS, matchesFilter, type Entry, type Filter, type MonthGroup } from './ledger';
import { NodeDot, nodeKindOf, SingleWaypoint, StoryWaypoint, type NodeKind } from './waypoint';
import { RETURN_TOPUP } from './use-wallet-lab';

interface Point {
  x: number;
  y: number;
  hold: boolean;
  balance: string;
  dip: number | null; // x of the lowest balance inside a booking story (capture before refund)
}

const RAIL_MD = 112;
const RAIL_SM = 40;
const PAD = 16;

/** Smooth vertical spline through the waypoints. */
function splinePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return '';
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const my = (a.y + b.y) / 2;
    d += ` C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
  }
  return d;
}

export function FilterChips({
  filter,
  onChange,
  vertical,
}: {
  filter: Filter;
  onChange: (f: Filter) => void;
  vertical?: boolean;
}) {
  const t = useT(messages);
  return (
    <div
      role="group"
      aria-label={t.filterLabel}
      className={cn(vertical ? 'flex flex-col gap-1.5' : 'no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1')}
    >
      {FILTERS.map((f) => {
        const active = f === filter;
        return (
          <button
            key={f}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(f)}
            className={cn(
              'min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-secondary/60 focus-visible:outline-none',
              vertical && 'rounded-xl text-start',
              active
                ? 'bg-primary text-primary-foreground dark:bg-ocean-light dark:text-ocean-deep'
                : 'border border-border bg-card text-foreground hover:bg-muted',
            )}
          >
            {t.filters[f]}
          </button>
        );
      })}
    </div>
  );
}

export function Legend() {
  const t = useT(messages);
  const items: [NodeKind, string][] = [
    ['in', t.legendIn],
    ['out', t.legendOut],
    ['hold', t.legendHold],
    ['points', t.legendPoints],
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
      <h3 className="text-sm font-bold">{t.legendTitle}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t.legendLine}</p>
      <ul className="mt-3 grid gap-2 text-xs">
        {items.map(([kind, label]) => (
          <li key={kind} className="flex items-center gap-2.5">
            <NodeDot kind={kind} className="ring-card" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface FlightPathProps {
  months: MonthGroup[];
  allEntries: Entry[];
  filter: Filter;
  shown: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  historyError: boolean;
  onRetry: () => void;
  loading: boolean;
  topUpResult: 'pending' | 'done' | 'failed' | null;
  lastCreditId: string | null;
}

function Row({ node, children, className }: { node: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <li className={cn('grid grid-cols-[2.5rem_minmax(0,1fr)] md:grid-cols-[7rem_minmax(0,1fr)]', className)}>
      <div className="relative">{node}</div>
      <div className="min-w-0 pb-3">{children}</div>
    </li>
  );
}

export function FlightPath(props: FlightPathProps) {
  const t = useT(messages);
  const locale = useLocale();
  const reduce = useReducedMotion();
  const md = useMedia('(min-width: 768px)');
  const rail = md ? RAIL_MD : RAIL_SM;
  const { months, shown } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const svgWrapRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<{ points: Point[]; height: number }>({ points: [], height: 0 });
  const [planeIdx, setPlaneIdx] = useState(0);

  // Altitude: distance from the outer edge follows the ledger balance (sqrt scale, clamped to the rail).
  const maxBalance = useMemo(
    () => props.allEntries.reduce<Cents>((m, e) => (e.balanceAfter > m ? e.balanceAfter : m), 1n),
    [props.allEntries],
  );
  const offsetFor = (b: Cents) => {
    if (!md) return rail / 2;
    const ratio = Number((b * 10000n) / maxBalance) / 10000;
    return PAD + ratio * (rail - PAD * 2);
  };

  const visible = months.flatMap((m) => m.entries);
  const headKind: NodeKind | null =
    props.topUpResult === 'pending' ? 'pending' : props.topUpResult === 'failed' ? 'failed' : null;

  useLayoutEffect(() => {
    const container = containerRef.current;
    const wrap = svgWrapRef.current;
    if (!container || !wrap) return;
    const rtl = getComputedStyle(container).direction === 'rtl';
    const measure = () => {
      const base = wrap.getBoundingClientRect();
      const nodes = Array.from(container.querySelectorAll<HTMLElement>('[data-node]'));
      const points = nodes.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.left + r.width / 2 - base.left,
          y: r.top + r.height / 2 - base.top,
          hold: el.dataset.hold === '1',
          balance: el.dataset.balance ?? '',
          dip: el.dataset.dip ? r.left + r.width / 2 - base.left + Number(el.dataset.dip) * (rtl ? -1 : 1) : null,
        };
      });
      setGeo({ points, height: base.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [months, md, headKind, props.loading]);

  const { points, height } = geo;
  const settled = points.filter((p) => p.balance !== '');
  const linePoints =
    settled.length > 0
      ? [
          { x: settled[0].x, y: 0 },
          ...settled.flatMap((p) => (p.dip === null ? [p] : [p, { x: p.dip, y: p.y + 72 }])),
          ...(props.hasMore ? [{ x: settled[settled.length - 1].x, y: height }] : []),
        ]
      : [];
  const d = splinePath(linePoints);
  const inward = locale === 'ar' ? -12 : 12;

  // Scroll-linked plane: one transform-only element riding the path.
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start 60%', 'end 60%'] });
  const showPlane = md && !reduce && settled.length > 1;
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const el = planeRef.current;
    if (!el || !showPlane) return;
    const y = p * (settled[settled.length - 1].y - settled[0].y) + settled[0].y;
    let i = 0;
    while (i < settled.length - 2 && settled[i + 1].y < y) i++;
    const a = settled[i];
    const b = settled[i + 1];
    const k = b.y === a.y ? 0 : Math.min(1, Math.max(0, (y - a.y) / (b.y - a.y)));
    const ease = k * k * (3 - 2 * k); // follows the spline closely enough for a marker
    const x = a.x + (b.x - a.x) * ease;
    const slope = (b.x - a.x) * 6 * k * (1 - k);
    const angle = (Math.atan2(b.y - a.y, slope) * 180) / Math.PI;
    el.style.transform = `translate(${x}px, ${y}px)`;
    const icon = el.firstElementChild as HTMLElement | null;
    if (icon) icon.style.transform = `translate(-50%, -50%) rotate(${angle + 45}deg)`;
    const label = labelRef.current;
    if (label) label.style.transform = `translate(${Math.min(Math.max(x, 36), rail - 36)}px, ${y + 22}px) translateX(-50%)`;
    const nearest = k < 0.5 ? i : i + 1;
    if (nearest !== planeIdx) setPlaneIdx(nearest);
  });
  const planeBalance = settled[planeIdx]?.balance;

  const nodeAt = (entry: Entry | null, kind: NodeKind, offset: number) => {
    // A refunded story dipped below its closing balance; draw that dip below the node (delta from node x).
    let dip: number | undefined;
    if (entry?.kind === 'story' && md) {
      const low = entry.steps.reduce<Cents>((m, s) => (toCents(s.tx.balanceAfter) < m ? toCents(s.tx.balanceAfter) : m), entry.balanceAfter);
      if (low < entry.balanceAfter) dip = offsetFor(low) - offset;
    }
    return (
    <span
      data-node
      data-dip={dip}
      data-hold={kind === 'hold' ? '1' : undefined}
      data-balance={entry ? String(entry.balanceAfter) : undefined}
      className="absolute top-[1.55rem] -translate-y-1/2"
      style={{ insetInlineStart: offset - 7 }}
    >
      <NodeDot kind={kind} />
    </span>
    );
  };

  if (props.loading) {
    return (
      <div aria-busy="true" aria-label={t.loading} className="relative">
        <div className="absolute inset-y-0 start-5 w-px bg-border md:start-14" aria-hidden />
        <ul className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="grid grid-cols-[2.5rem_minmax(0,1fr)] md:grid-cols-[7rem_minmax(0,1fr)]">
              <span />
              <div className="h-24 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (props.historyError) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
        <AlertTriangle className="size-5 text-destructive" aria-hidden />
        <p className="flex-1 text-sm font-semibold">{t.historyError}</p>
        <button
          type="button"
          onClick={props.onRetry}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-secondary/60 focus-visible:outline-none"
        >
          <RotateCw className="size-4" aria-hidden />
          {t.retry}
        </button>
      </div>
    );
  }

  const noHistory = props.allEntries.length === 0 && !props.hasMore;

  return (
    <div ref={containerRef} className="relative">
      {/* Path layer — decorative; the structure below is the accessible ledger. */}
      <div
        ref={svgWrapRef}
        aria-hidden
        className="pointer-events-none absolute inset-y-0 start-0"
        style={{ width: rail }}
      >
        {noHistory ? (
          <div className="absolute inset-y-0 start-1/2 w-0 border-s-2 border-dashed border-muted-foreground/30" />
        ) : (
          <svg className="absolute inset-0 overflow-visible" width={rail} height={height}>
            {points
              .filter((p) => p.hold)
              .map((p, i) => (
                <line
                  key={i}
                  x1={p.x + inward}
                  x2={p.x + inward}
                  y1={0}
                  y2={p.y}
                  className="stroke-amber-500"
                  strokeWidth="2"
                  strokeDasharray="4 5"
                  strokeLinecap="round"
                />
              ))}
            {d && (
              <>
                <path d={d} fill="none" className="stroke-secondary/15" strokeWidth="10" strokeLinecap="round" />
                <motion.path
                  key={md ? 'md' : 'sm'}
                  d={d}
                  fill="none"
                  className="stroke-primary dark:stroke-ocean-light"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
              </>
            )}
            {!props.hasMore && settled.length > 0 && (
              <circle
                cx={settled[settled.length - 1].x}
                cy={settled[settled.length - 1].y + 28}
                r="4"
                className="fill-none stroke-muted-foreground/50"
                strokeWidth="2"
              />
            )}
          </svg>
        )}
      </div>

      {noHistory ? (
        <ol>
          <Row node={nodeAt(null, 'ghost', rail / 2)}>
            <div className="rounded-2xl border-2 border-dashed border-border p-5 text-center sm:p-8">
              <Plane className="mx-auto size-8 text-secondary rtl:-scale-x-100" aria-hidden />
              <p className="mt-3 text-base font-bold">{t.runwayTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.runwaySub}</p>
            </div>
          </Row>
        </ol>
      ) : (
        <>
          {headKind && (
            <ol>
              <Row node={nodeAt(null, headKind, offsetFor(props.allEntries[0]?.balanceAfter ?? 0n))}>
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border border-dashed p-4',
                    headKind === 'pending' ? 'border-secondary/60 bg-secondary/5' : 'border-rose-400/70 bg-rose-50 dark:bg-rose-500/10',
                  )}
                >
                  {headKind === 'pending' ? (
                    <Loader2 className="size-5 shrink-0 animate-spin text-teal-700 motion-reduce:animate-none dark:text-secondary" aria-hidden />
                  ) : (
                    <XCircle className="size-5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
                  )}
                  <p className="text-sm font-semibold">
                    {headKind === 'pending' ? t.pending(isolate(shown ? formatUsd(toCents(RETURN_TOPUP)) : MASK)) : t.failed}
                  </p>
                </div>
              </Row>
            </ol>
          )}

          {months.length === 0 && (
            <p className="ms-10 rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground md:ms-28">
              {t.emptyFilter}
            </p>
          )}

          {months.map((month) => (
            <section key={month.key} aria-labelledby={`fp-m-${month.key}`}>
              <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] md:grid-cols-[7rem_minmax(0,1fr)]">
                <span />
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-2 pt-2">
                  <h3 id={`fp-m-${month.key}`} className="text-base font-extrabold">
                    {formatMonth(month.key, locale)}
                  </h3>
                  <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {month.complete || month.current ? (
                      <>
                        <span>
                          {t.monthIn}{' '}
                          <Amount cents={month.inflow} shown={shown} sign className="font-bold text-emerald-700 dark:text-emerald-400" />
                        </span>
                        <span>
                          {t.monthOut}{' '}
                          <Amount cents={-month.outflow} shown={shown} className="font-bold text-foreground" />
                        </span>
                        {month.current && <span>({t.soFar})</span>}
                      </>
                    ) : (
                      <span>{t.partialMonth}</span>
                    )}
                  </p>
                </div>
              </div>
              <ol>
                {month.entries.map((entry) => {
                  const kind = nodeKindOf(entry);
                  return (
                    <Row key={entry.key} node={nodeAt(entry, kind, offsetFor(entry.balanceAfter))}>
                      {entry.kind === 'story' ? (
                        <StoryWaypoint entry={entry} shown={shown} />
                      ) : (
                        <SingleWaypoint entry={entry} shown={shown} isNew={entry.tx.id === props.lastCreditId} />
                      )}
                    </Row>
                  );
                })}
              </ol>
            </section>
          ))}

          <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] md:grid-cols-[7rem_minmax(0,1fr)]">
            <span />
            <div className="pt-4">
              {props.hasMore ? (
                <button
                  type="button"
                  onClick={props.onLoadMore}
                  disabled={props.loadingMore}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-bold hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-secondary/60 focus-visible:outline-none disabled:opacity-70 sm:w-auto"
                >
                  {props.loadingMore && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
                  {props.loadingMore ? t.loadingMore : t.loadMore}
                </button>
              ) : (
                <p className="text-sm text-muted-foreground">{t.pathStart}</p>
              )}
            </div>
          </div>
        </>
      )}
      {showPlane && (
        // Plane layer sits above the nodes; same box as the path layer.
        <div aria-hidden className="pointer-events-none absolute inset-y-0 start-0 z-10" style={{ width: rail }}>
        {showPlane && (
          // Physical `left-0`: the plane lives in the SVG's own coordinate space (measured from its left edge).
          <div ref={planeRef} className="absolute top-0 left-0 will-change-transform" style={{ transform: `translate(${settled[0].x}px, ${settled[0].y}px)` }}>
            <span className="absolute top-0 left-0 grid size-7 place-items-center rounded-full bg-secondary text-ocean-deep shadow-md" style={{ transform: 'translate(-50%, -50%) rotate(135deg)' }}>
              <Plane className="size-4" />
            </span>
          </div>
        )}
        {showPlane && planeBalance && (
          <div
            ref={labelRef}
            className="absolute top-0 left-0 will-change-transform"
            style={{ transform: `translate(${Math.min(Math.max(settled[0].x, 36), rail - 36)}px, ${settled[0].y + 22}px) translateX(-50%)` }}
          >
            <div className="rounded-lg bg-ocean-deep px-2 py-1 text-center whitespace-nowrap text-white shadow-lg">
              <div className="text-[10px] leading-none text-white/70">{t.planeAt}</div>
              <bdi dir="ltr" className="text-xs font-bold tabular-nums">
                {shown ? formatUsd(BigInt(planeBalance)) : MASK}
              </bdi>
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
}

