import type { LucideIcon } from 'lucide-react';
import { RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { Card } from '@dash/components/ui/card';
import { fill, messages } from '../i18n';
import { useEnv } from './env';

/**
 * Faithful replica of `SparkStatCard` (src/components/analytics/stats/spark-stat-card.tsx): same card, same paddings,
 * same value classes (`text-4xl sm:text-3xl font-black` in an LTR span), same icon. Only two slots are used beyond
 * the real ones: `badge` (the real slot next to the title) carries the basis chip, and `titleSwap` replaces the title
 * text while the reader scrubs the chart (same line, same size).
 */
export function KpiTile({
  title,
  titleSwap,
  value,
  unit,
  icon: Icon,
  subtitle,
  badge,
  footer,
  className,
}: {
  title: string;
  titleSwap?: ReactNode;
  value: ReactNode;
  unit?: string;
  icon: LucideIcon;
  subtitle?: string;
  badge?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        'group relative gap-0 overflow-hidden rounded-2xl py-0',
        'border border-border bg-card',
        'shadow-[0_2px_16px_rgba(0,0,0,0.06)]',
        'transition-all duration-300 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        className,
      )}
    >
      <div className="relative z-10 flex items-center justify-between p-6">
        <div aria-hidden className="pointer-events-none absolute -end-8 -top-8 size-28 rounded-full bg-primary/15 blur-2xl" />
        <div className="flex min-w-0 flex-col items-start gap-2">
          <div className="flex min-h-5 flex-wrap items-center gap-1.5">
            <p className="text-13 font-extrabold text-primary dark:text-white/80" aria-live="polite">
              {titleSwap ?? title}
            </p>
            {badge}
          </div>
          <div className="mt-1 flex flex-nowrap items-baseline gap-1.5">
            <span dir="ltr" className="flex items-baseline gap-0.5">
              <span className="text-4xl font-black leading-none tracking-tight tabular-nums text-foreground sm:text-3xl">{value}</span>
              {unit && <span className="text-lg font-bold text-muted-foreground">{unit}</span>}
            </span>
          </div>
          {subtitle && <p className="mt-1.5 text-balance text-13 font-bold text-muted-foreground">{subtitle}</p>}
          {footer}
        </div>
        <div className="relative flex items-center justify-center">
          <Icon className="size-[70px] shrink-0 text-primary/70 transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:scale-105 dark:text-muted-foreground motion-reduce:transition-none" strokeWidth={1.25} />
          <span className="absolute end-1 top-1 size-3.5 rounded-full border-[3px] border-card bg-primary/80 shadow-sm" />
        </div>
      </div>
    </Card>
  );
}

/** Small neutral chip stating the basis of a tile: "SAR · day rates", "USD balance". No colour border. */
export function BasisChip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-10 font-bold text-muted-foreground" dir="ltr">
      {children}
    </span>
  );
}

/**
 * "View in: USD | SAR" (Airwallex-style). Overrides the page currency for ONE card; "Reset" returns it to the page.
 */
export function ViewIn({
  value,
  override,
  onChange,
  options,
}: {
  value: string;
  override: string | null;
  onChange: (code: string | null) => void;
  options: string[];
}) {
  const t = useT(messages);
  const env = useEnv();
  const label = t.viewIn;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span id="viewin-label" className="text-12 font-medium text-muted-foreground">
        {label}
      </span>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border bg-muted/60 p-0.5">
        {options.map((c) => {
          const on = c === value;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(c === env.display ? null : c)}
              className={cn(
                'min-h-11 min-w-14 rounded-md px-3 text-12 font-bold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:min-h-8',
                on ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span dir="ltr">{c}</span>
            </button>
          );
        })}
      </div>
      {override && override !== env.display && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-12 font-bold text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:min-h-8"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          {fill(t.resetTo, { cur: env.display })}
        </button>
      )}
    </div>
  );
}

/** Card chrome shared by the live cards: title, optional note, "View in", body. Neutral surface, no coloured edge. */
export function MoneyCard({
  id,
  title,
  note,
  control,
  children,
  className,
}: {
  id?: string;
  title: string;
  note?: ReactNode;
  control?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn('scroll-mt-40 min-w-0 rounded-2xl border bg-card p-4 shadow-sm sm:p-5', className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-15 font-bold text-foreground">{title}</h3>
          {note && <p className="mt-0.5 text-12 text-muted-foreground">{note}</p>}
        </div>
        {control}
      </div>
      {children}
    </section>
  );
}
