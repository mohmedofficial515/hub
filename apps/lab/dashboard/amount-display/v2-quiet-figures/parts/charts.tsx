/**
 * Section 6: hand-drawn SVG charts (the lab has no Recharts). Rules of plan 5.5:
 *  - axis ticks are compact TEXT without the sign; the currency is named once in the chart header
 *  - the tooltip is exact, with the sign, and says when a day was converted / estimated
 *  - the donut centre and the top-N list use `<Amount>` (compact from 1,000, exact on demand)
 *  - the time axis direction in Arabic follows the decisions panel (question b)
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@lab/utils';
import { Card } from '@dash/components/ui/card';
import { Amount, AmountView } from './amount';
import { aggregate, sharesBySource, topTransactions, type SeriesPoint } from './convert';
import { dayLabel, DAY_COUNT, infoOf } from './data';
import { fill, useLab } from './env';
import { amountParts, decToString, mulDec, parseDec, partsNumber } from './money-core';

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(240, Math.round(el.clientWidth))));
    ro.observe(el);
    setWidth(Math.max(240, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A "nice" step (1, 2, 2.5, 5 x 10^n) for about four intervals. */
function niceScale(max: number): { step: number; top: number } {
  const raw = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  return { step, top: Math.ceil(max / step) * step };
}

/** Compact tick text without sign: "250K", "1.5M". */
export function amountTick(value: number, currency: string): string {
  const p = amountParts(String(Math.round(value)), currency, { context: 'chart', compact: 'always' });
  return p ? partsNumber(p) : '';
}

export function RevenueChart({ points, currency, estimatedDays }: { points: SeriesPoint[]; currency: string; estimatedDays: number }) {
  const lab = useLab();
  const { t, locale, decisions } = lab;
  const reduce = useReducedMotion();
  const [ref, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const mirrored = locale === 'ar' && decisions.axis === 'rtl';

  const H = 260;
  const m = { top: 14, bottom: 30, start: 46, end: 14 };
  const plotW = Math.max(100, width - m.start - m.end);
  const plotH = H - m.top - m.bottom;
  const nums = points.map((p) => Number(p.value));
  const { step, top } = niceScale(Math.max(...nums, 1));
  const x = (i: number) => m.start + (mirrored ? plotW - (i / (DAY_COUNT - 1)) * plotW : (i / (DAY_COUNT - 1)) * plotW);
  const y = (v: number) => m.top + plotH - (v / top) * plotH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  const line = useMemo(() => nums.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' '), [nums, width, mirrored, top]); // eslint-disable-line react-hooks/exhaustive-deps
  const area = `${line} L${x(DAY_COUNT - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;

  const pick = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    const frac = mirrored ? 1 - rel : rel;
    setActive(Math.min(DAY_COUNT - 1, Math.max(0, Math.round(frac * (DAY_COUNT - 1)))));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') return setActive(null);
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const visualRight = e.key === 'ArrowRight';
    const forward = mirrored ? !visualRight : visualRight;
    setActive((a) => Math.min(DAY_COUNT - 1, Math.max(0, (a ?? (forward ? -1 : DAY_COUNT)) + (forward ? 1 : -1))));
  };

  const ap = active === null ? null : points[active];
  const name = infoOf(currency);
  const tipLeft = ap === null ? 0 : Math.min(Math.max(x(active!), 96), width - 96);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-14 font-extrabold">{t.charts.revenue}</h3>
        <p className="text-12 font-medium text-muted-foreground">
          {fill(t.charts.axisCurrency, { cur: locale === 'ar' ? (name?.nameAr ?? currency) : (name?.nameEn ?? currency) })} · <bdi dir="ltr">{currency}</bdi>
        </p>
      </div>
      <div
        ref={ref}
        className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabIndex={0}
        role="group"
        aria-label={t.charts.aria}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <svg width={width} height={H} role="presentation" className="block max-w-full select-none">
          <defs>
            <linearGradient id="qf-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={m.start} x2={m.start + plotW} y1={y(tick)} y2={y(tick)} className="stroke-border" strokeDasharray={tick === 0 ? undefined : '3 4'} />
              <text x={mirrored ? m.start + plotW + 8 : m.start - 8} y={y(tick)} dy="0.32em" textAnchor={mirrored ? 'start' : 'end'} className="fill-muted-foreground text-[11px] tabular-nums">
                {amountTick(tick, currency)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % 5 === 0 || i === DAY_COUNT - 1 ? (
              <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? (mirrored ? 'end' : 'start') : i === DAY_COUNT - 1 ? (mirrored ? 'start' : 'end') : 'middle'} className="fill-muted-foreground text-[11px]">
                {dayLabel(i, locale)}
              </text>
            ) : null,
          )}
          <motion.path d={area} fill="url(#qf-area)" initial={false} animate={{ d: area }} transition={{ duration: reduce ? 0 : 0.35 }} />
          <motion.path d={line} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" initial={false} animate={{ d: line }} transition={{ duration: reduce ? 0 : 0.35 }} />
          {points.map((p, i) =>
            p.estimated ? <circle key={i} cx={x(i)} cy={y(nums[i])} r={3.5} className="fill-card stroke-muted-foreground" strokeWidth={1.5} /> : null,
          )}
          {active !== null && (
            <g>
              <line x1={x(active)} x2={x(active)} y1={m.top} y2={m.top + plotH} className="stroke-muted-foreground/60" strokeDasharray="2 3" />
              <circle cx={x(active)} cy={y(nums[active])} r={5} className="fill-card" stroke="var(--chart-1)" strokeWidth={2.5} />
            </g>
          )}
          <rect x={m.start} y={m.top} width={plotW} height={plotH} fill="transparent" onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setActive(null)} />
        </svg>
        {ap && (
          <div
            role="status"
            style={{ left: tipLeft, top: Math.max(0, y(nums[active!]) - 92) }}
            className="pointer-events-none absolute z-10 grid w-48 -translate-x-1/2 gap-1 rounded-lg border bg-popover p-2.5 text-start text-popover-foreground shadow-lg"
          >
            <span className="text-11 font-semibold text-muted-foreground">{dayLabel(active!, locale)}</span>
            <AmountView value={ap.value} currency={currency} context="detail" className="text-15 font-bold" />
            <span className="text-11 leading-snug text-muted-foreground">
              {currency === 'USD' ? t.charts.tipUsd : fill(t.charts.tipConverted, { rate: ap.rate, cur: currency })}
              {ap.estimated && <span className="mt-0.5 block font-semibold">{t.charts.tipEstimated}</span>}
            </span>
          </div>
        )}
      </div>
      <p className="text-11 text-muted-foreground">
        {mirrored ? t.charts.axisRtl : t.charts.axisLtr}
        {estimatedDays > 0 && <> · {fill(t.charts.estimatedLegend, { n: estimatedDays })}</>}
      </p>
    </div>
  );
}

const SLICE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-neutral)'];

export function DonutCard({ currency, total }: { currency: string; total: string }) {
  const lab = useLab();
  const { t } = lab;
  const shares = sharesBySource();
  const top4 = shares.slice(0, 4);
  const rest = 1 - top4.reduce((s, x) => s + x.fraction, 0);
  const slices = [...top4.map((s) => ({ code: s.currency, f: s.fraction })), { code: t.charts.other, f: rest }];
  const R = 64;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const totalDec = parseDec(total)!;
  return (
    <Card className="gap-4 rounded-2xl border bg-card p-5 shadow-none">
      <h3 className="text-14 font-extrabold">{t.charts.bySource}</h3>
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative size-[168px] shrink-0">
          <svg viewBox="0 0 168 168" className="size-full -rotate-90" role="presentation">
            <circle cx="84" cy="84" r={R} fill="none" className="stroke-muted" strokeWidth="22" />
            {slices.map((s, i) => {
              const len = Math.max(0, s.f * C - 2);
              const el = <circle key={s.code} cx="84" cy="84" r={R} fill="none" stroke={SLICE_COLORS[i]} strokeWidth="22" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />;
              offset += s.f * C;
              return el;
            })}
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <span className="text-11 font-semibold text-muted-foreground">{t.charts.total}</span>
            <span className="text-20 font-black">
              <Amount value={total} currency={currency} context="chart" />
            </span>
          </div>
        </div>
        <ul className="grid min-w-52 flex-1 gap-2 text-13">
          {slices.map((s, i) => {
            const part = decToString(mulDec(totalDec, parseDec(s.f.toFixed(6))!), 4);
            return (
              <li key={s.code} className="flex items-center gap-2.5">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: SLICE_COLORS[i] }} />
                <span className="min-w-0 flex-1 truncate font-semibold" dir="ltr">
                  {s.code}
                </span>
                <span className="text-12 text-muted-foreground tabular-nums" dir="ltr">
                  {(s.f * 100).toFixed(1)}%
                </span>
                <span className="w-20 text-end font-semibold">
                  <Amount value={part} currency={currency} context="list" mark="none" />
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

export function TopList({ currency }: { currency: string }) {
  const lab = useLab();
  const { t, locale } = lab;
  const items = topTransactions(currency, 5);
  return (
    <Card className="gap-3 rounded-2xl border bg-card p-5 shadow-none">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-14 font-extrabold">{t.charts.top}</h3>
        <span className="text-11 text-muted-foreground">{t.charts.topNote}</span>
      </div>
      <ol className="grid gap-1">
        {items.map(({ tx, value, direct }, i) => (
          <li key={tx.id} className={cn('flex min-h-11 items-center gap-3 rounded-lg px-1 py-1.5', i > 0 && 'border-t border-border/60')}>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-11 font-bold tabular-nums text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-13 font-semibold">{locale === 'ar' ? tx.routeAr : tx.routeEn}</span>
              <span className="block truncate text-11 text-muted-foreground" dir="ltr">
                {tx.ref}
                {direct && <span className="ms-1.5 rounded border border-border px-1 text-[10px] font-semibold">{t.charts.original}</span>}
              </span>
            </span>
            <span className="text-14 font-bold">
              <Amount value={value} currency={currency} context="list" />
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** Convenience for the page: the 30-day gross aggregate in the display currency. */
export const grossAggregate = (display: string) => aggregate('gross', display);
