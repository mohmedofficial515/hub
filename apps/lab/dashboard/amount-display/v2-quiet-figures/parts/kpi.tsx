/**
 * KPI tiles: a replica of `SparkStatCard` (same classes, same sizes: value text-4xl sm:text-3xl font-black in an LTR span) in two forms,
 * `before` (what the dashboard prints today) and `after` (the quiet `<Amount>`), plus the live demo that converts with the header currency.
 */
import { useState, type ReactNode } from 'react';
import { Hand, Keyboard, MousePointer2, Percent, Receipt, RotateCcw, ShoppingBag, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@lab/utils';
import { Card } from '@dash/components/ui/card';
import { Amount, Equivalent } from './amount';
import { balanceEquivalent, kpis } from './convert';
import { BALANCES } from './data';
import { fill, useLab } from './env';
import { decToString, groupInt, parseDec } from './money-core';
import { ConvertedAmount, EstimatedTag } from './receipt';

/** Same markup and classes as `spark-stat-card.tsx`. */
export function Tile({
  title,
  icon: Icon,
  value,
  unit,
  subtitle,
  badge,
  footer,
  className,
}: {
  title: string;
  icon: LucideIcon;
  value: ReactNode;
  unit?: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('group relative gap-0 overflow-hidden rounded-2xl border border-border bg-card py-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)]', className)}>
      <div className="relative z-10 flex items-center justify-between p-6">
        <div aria-hidden className="pointer-events-none absolute -end-8 -top-8 size-28 rounded-full bg-primary/15 blur-2xl" />
        <div className="flex min-w-0 flex-col items-start gap-2">
          <div className="flex items-center gap-1.5">
            <p className="text-13 font-extrabold text-primary dark:text-white/80">{title}</p>
            {badge}
          </div>
          <div className="mt-1 flex flex-nowrap items-baseline gap-1.5">
            <span dir="ltr" className="flex items-baseline gap-0.5">
              <span className="text-4xl font-black leading-none tracking-tight text-foreground tabular-nums sm:text-3xl">{value}</span>
              {unit && <span className="text-lg font-bold text-muted-foreground">{unit}</span>}
            </span>
          </div>
          {subtitle && <div className="mt-1.5 text-balance text-13 font-bold text-muted-foreground">{subtitle}</div>}
          {footer}
        </div>
        <div className="relative flex items-center justify-center">
          <Icon className="size-[70px] shrink-0 text-primary/70 transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:scale-105 dark:text-muted-foreground" strokeWidth={1.25} />
          <span className="absolute right-1 top-1 size-3.5 rounded-full border-[3px] border-card bg-primary/80 shadow-sm" />
        </div>
      </div>
    </Card>
  );
}

/** Today's output: `USD 12,345,678.50`, whatever the size (formatMoneyValue / formatAmount). */
export function oldText(value: string, currency: string): string {
  const d = parseDec(value);
  if (!d) return '—';
  const [int, frac] = decToString(d, 2).split('.');
  return `${currency} ${groupInt(int)}.${frac}`;
}

export function LiveKpis() {
  const lab = useLab();
  const { t, display } = lab;
  const k = kpis(display);
  const usdKpis = display === 'USD';
  const eq = balanceEquivalent(BALANCES.supplierUsd, display);
  const tag = <EstimatedTag days={k.gross.estimatedDays} />;
  const sub = (text: string) => <span className="font-semibold">{text}</span>;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Tile
        title={t.kpi.gross}
        icon={ShoppingBag}
        badge={tag}
        value={<ConvertedAmount agg={k.gross} value={k.gross.total} context="kpi" />}
        subtitle={sub(usdKpis ? t.kpi.basisUsd : fill(t.kpi.basisConverted, { cur: display }))}
      />
      <Tile
        title={t.kpi.refunds}
        icon={RotateCcw}
        badge={<EstimatedTag days={k.refunds.estimatedDays} />}
        value={<ConvertedAmount agg={k.refunds} value={k.refunds.total} context="kpi" />}
        subtitle={sub(fill(t.kpi.refundRate, { n: k.refundRate }))}
      />
      <Tile
        title={t.kpi.net}
        icon={Receipt}
        value={<ConvertedAmount agg={k.gross} value={k.net} context="kpi" />}
        subtitle={sub(t.kpi.netNote)}
      />
      <Tile
        title={t.kpi.average}
        icon={ShoppingBag}
        value={<ConvertedAmount agg={k.gross} value={k.average} context="kpi" />}
        subtitle={sub(t.kpi.averageNote)}
      />
      <Tile title={t.kpi.refundRateTitle} icon={Percent} value={k.refundRate} unit="%" subtitle={sub(t.kpi.refundRateNote)} />
      <Tile
        title={t.kpi.balance}
        icon={Wallet}
        value={<Amount value={BALANCES.supplierUsd} currency="USD" context="kpi" tag="USD" revealNote={eq && <Equivalent value={eq.value} currency={display} context="kpi" className="text-12" />} />}
        subtitle={
          eq ? (
            <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
              <Equivalent value={eq.value} currency={display} context="kpi" />
              <span className="text-11 font-medium">{fill(t.kpi.todayRate, { rate: eq.rate })}</span>
            </span>
          ) : (
            sub(t.kpi.balanceNote)
          )
        }
      />
    </div>
  );
}

const LADDER = ['9999.00', '12345.50', '125000.00', '999950.00', '12345678.50', '1200000000.00', '12000000000.00'];

/** Section 3: the same tile before and after, with a value picker that walks the compaction ladder. */
export function KpiBeforeAfter() {
  const { t } = useLab();
  const [value, setValue] = useState(LADDER[4]);
  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label={t.kpiLab.pick} className="flex flex-wrap gap-2">
        {LADDER.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => setValue(v)}
            className={cn(
              'min-h-11 rounded-full border px-3.5 text-13 font-semibold tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9',
              value === v ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-muted',
            )}
          >
            <bdi dir="ltr">{groupInt(v.split('.')[0])}</bdi>
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-2">
          <p className="text-12 font-bold text-muted-foreground">{t.kpiLab.before}</p>
          <Tile title={t.kpi.gross} icon={ShoppingBag} value={oldText(value, 'USD')} subtitle={t.kpiLab.beforeNote} />
        </div>
        <div className="grid gap-2">
          <p className="text-12 font-bold text-primary">{t.kpiLab.after}</p>
          <Tile title={t.kpi.gross} icon={ShoppingBag} value={<Amount value={value} currency="USD" context="kpi" />} subtitle={t.kpiLab.afterNote} />
        </div>
      </div>
      <ExactCard value={value} />
    </div>
  );
}

/** The "Exact value" mini-card: states the three ways in, and holds a live trigger. */
function ExactCard({ value }: { value: string }) {
  const { t } = useLab();
  const rows: [LucideIcon, string, string][] = [
    [MousePointer2, t.exact.hover, t.exact.hoverBody],
    [Keyboard, t.exact.focus, t.exact.focusBody],
    [Hand, t.exact.tap, t.exact.tapBody],
  ];
  return (
    <Card className="gap-3 rounded-2xl border bg-card p-5 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-14 font-extrabold">{t.exact.title}</h3>
        <span className="inline-flex items-center gap-2 rounded-lg border bg-muted/60 px-3 py-1.5 text-16 font-bold">
          <Amount value={value} currency="USD" context="kpi" />
        </span>
      </div>
      <ul className="grid gap-2.5 sm:grid-cols-3">
        {rows.map(([Icon, title, body]) => (
          <li key={title} className="flex items-start gap-2.5">
            <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="text-13 font-bold">{title}</p>
              <p className="text-12 text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

