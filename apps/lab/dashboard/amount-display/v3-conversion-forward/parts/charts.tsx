import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { Badge } from '@dash/components/ui/badge';
import { fill, messages } from '../i18n';
import { Amount } from './amount';
import { type Aggregate, type DayPoint, ranking } from './engine';
import { useEnv } from './env';
import { amountText, cmpDec, compactDec, decToFixed, decToString, divDec, groupInt, parseDec } from './money-core';
import { toNum } from './receipt';

/* Geometry helpers: numbers are used for coordinates only. Every printed amount goes through money-core. */

/** Tick text WITHOUT a currency sign (Airwallex / Salla pattern): "1M", "750K", "0". The unit is said once, in the card note. */
export function tickLabel(n: number): string {
  if (n === 0) return '0';
  const s = String(Math.round(n * 100) / 100);
  const c = compactDec(parseDec(s));
  return c ? `${c.number}${c.unit}` : groupInt(s.split('.')[0]) + (s.includes('.') ? `.${s.split('.')[1]}` : '');
}
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n * p;
}
const fmtDay = (iso: string, lang: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/* ---------------------------------------------------------------- area chart */

export function AreaChart({
  points,
  currency,
  onScrub,
  height = 240,
}: {
  points: DayPoint[];
  currency: string;
  onScrub?: (p: DayPoint | null) => void;
  height?: number;
}) {
  const env = useEnv();
  const lang = useLocale();
  const t = useT(messages);
  const uid = useId().replace(/:/g, '');
  const [ref, W] = useWidth<HTMLDivElement>();
  const [idx, setIdx] = useState<number | null>(null);
  const flip = lang === 'ar' && env.dec.axis === 'rtl';
  const n = points.length;
  const nums = useMemo(() => points.map((p) => toNum(p.value)), [points]);
  const top = niceMax(Math.max(...nums));
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i);
  const padA = 46; // axis side
  const padB = 12;
  const pl = flip ? padB : padA;
  const pr = flip ? padA : padB;
  const pt = 12;
  const pb = 26;
  const H = height;
  const x = (i: number) => {
    const f = n > 1 ? i / (n - 1) : 0;
    return flip ? W - pr - f * (W - pl - pr) : pl + f * (W - pl - pr);
  };
  const y = (v: number) => H - pb - (v / top) * (H - pt - pb);
  const line = nums.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;

  useEffect(() => onScrub?.(idx == null ? null : points[idx]), [idx, points, onScrub]);

  const at = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    const px = clientX - r.left;
    let best = 0;
    let dist = Infinity;
    for (let i = 0; i < n; i += 1) {
      const d = Math.abs(x(i) - px);
      if (d < dist) {
        dist = d;
        best = i;
      }
    }
    setIdx(best);
  };
  const onKey = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (e.key === 'Escape') setIdx(null);
    if (!step) return;
    e.preventDefault();
    const dir = flip ? -step : step;
    setIdx((cur) => Math.min(n - 1, Math.max(0, (cur ?? (dir > 0 ? -1 : n)) + dir)));
  };
  const p = idx == null ? null : points[idx];
  const tipLeft = idx == null ? 0 : Math.min(Math.max(x(idx), 90), W - 90);
  const labelEvery = W < 420 ? 7 : 5;

  return (
    <div ref={ref} dir="ltr" className="relative w-full select-none" style={{ height: H }}>
      <svg
        width={W}
        height={H}
        tabIndex={0}
        role="group"
        aria-label={t.chartAria}
        onPointerMove={(e: PointerEvent<SVGSVGElement>) => at(e.clientX, e.currentTarget)}
        onPointerDown={(e: PointerEvent<SVGSVGElement>) => at(e.clientX, e.currentTarget)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setIdx(null)}
        onKeyDown={onKey}
        onBlur={() => setIdx(null)}
        className="touch-pan-y rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
      >
        <defs>
          <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray={v === 0 ? undefined : '3 4'} />
            <text x={flip ? W - pr + 6 : pl - 6} y={y(v) + 4} textAnchor={flip ? 'start' : 'end'} className="fill-muted-foreground text-[10px] tabular-nums">
              {tickLabel(v)}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#g${uid})`} />
        <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((pnt, i) =>
          pnt.estimated ? <circle key={pnt.date} cx={x(i)} cy={y(nums[i])} r="3.5" fill="var(--card)" stroke="var(--warning)" strokeWidth="2" /> : null,
        )}
        {points.map((pnt, i) =>
          i % labelEvery === 0 ? (
            <text key={pnt.date} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {fmtDay(pnt.date, lang)}
            </text>
          ) : null,
        )}
        {idx != null && (
          <g>
            <line x1={x(idx)} x2={x(idx)} y1={pt} y2={y(0)} stroke="var(--muted-foreground)" strokeDasharray="3 3" opacity="0.7" />
            <circle cx={x(idx)} cy={y(nums[idx])} r="5" fill="var(--card)" stroke="var(--chart-1)" strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {p && (
        <div
          className="pointer-events-none absolute top-1 z-10 w-max max-w-[15rem] -translate-x-1/2 rounded-lg border bg-popover px-3 py-2 text-start text-12 text-popover-foreground shadow-lg"
          style={{ left: tipLeft }}
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          <p className="flex items-center gap-1.5 font-medium text-muted-foreground">
            {fmtDay(p.date, lang)}
            {p.estimated && (
              <Badge variant="warning" className="px-1.5 py-0 text-10">
                {t.estimatedShort}
              </Badge>
            )}
          </p>
          <p className="mt-0.5 text-14 font-black">
            <Amount value={decToString(p.value)} currency={currency} context="detail" plain noTrigger />
          </p>
          {currency !== 'USD' && (
            <p className="mt-1 text-11 leading-4 text-muted-foreground">
              {fill(t.tipConverted, { usd: amountText({ value: decToString(p.usd), currency: 'USD', context: 'detail' }), rate: decToFixed(p.rate, currency === 'JPY' ? 2 : 4) })}
            </p>
          )}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {p ? `${fmtDay(p.date, lang)}: ${decToString(p.value)} ${currency}` : ''}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- donut */

const SLICE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--muted-foreground)'];

export function Donut({ agg, label }: { agg: Aggregate; label: string }) {
  const t = useT(messages);
  const R = 42;
  const C = 2 * Math.PI * R;
  const total = agg.slices.reduce((a, s) => a + toNum(s.usd), 0) || 1;
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative size-44 shrink-0" dir="ltr">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={t.donutAria}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--muted)" strokeWidth="11" />
          {agg.slices.map((s, i) => {
            const len = (toNum(s.usd) / total) * C;
            const el = (
              <circle
                key={s.cur}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={SLICE_COLORS[i % SLICE_COLORS.length]}
                strokeWidth="11"
                strokeDasharray={`${Math.max(0, len - 1.2)} ${C - Math.max(0, len - 1.2)}`}
                strokeDashoffset={-acc}
              />
            );
            acc += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-10 font-medium text-muted-foreground">{label}</span>
          <span className="text-xl font-black">
            <Amount value={decToString(agg.gross)} currency={agg.display} context="chart" noTrigger={false} from="USD" plain />
          </span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {agg.slices.map((s, i) => {
          const pct = decToString(divDec(s.usd, parseDec(decToString(agg.grossUsd)), 4));
          return (
            <li key={s.cur} className="flex items-center gap-2 text-12">
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }} />
              <span dir="ltr" className="w-9 font-bold">
                {s.cur}
              </span>
              <span className="text-muted-foreground tabular-nums" dir="ltr">
                {(Number(pct) * 100).toFixed(1)}%
              </span>
              <span className="ms-auto font-semibold">
                <Amount value={decToString(s.value)} currency={agg.display} context="list" plain from={s.cur === agg.display ? undefined : 'USD'} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- top-N list */

export function TopList({ currency }: { currency: string }) {
  const lang = useLocale();
  const t = useT(messages);
  const items = ranking(currency);
  const maxUsd = items.reduce((m, r) => (cmpDec(parseDec(r.usd), m) > 0 ? parseDec(r.usd) : m), parseDec('0'));
  return (
    <div>
      <ol className="space-y-2.5">
        {items.map((r, i) => {
          const w = toNum(divDec(parseDec(r.usd), maxUsd, 4)) * 100;
          return (
            <li key={r.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-13">
              <span className="text-12 font-bold text-muted-foreground tabular-nums" dir="ltr">
                {i + 1}
              </span>
              <span className="truncate font-medium">{r.name[lang]}</span>
              <span className="text-end font-bold">
                <Amount value={decToString(r.value)} currency={currency} context="list" from={currency === 'USD' ? undefined : 'USD'} />
              </span>
              <span />
              <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <span className={cn('block h-full rounded-full bg-primary/70')} style={{ width: `${Math.max(3, w)}%` }} />
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-11 text-muted-foreground">{t.rankNote}</p>
    </div>
  );
}
