/**
 * Quiet conversion: a converted aggregate gets a small dotted underline; the popover is the "how this number was calculated" receipt.
 * The underline is the only visible sign that a figure was converted (no badge, no colour).
 */
import { AlertTriangle } from 'lucide-react';
import { cn } from '@lab/utils';
import { Badge } from '@dash/components/ui/badge';
import { AmountView, Reveal, type AmountProps } from './amount';
import type { Aggregate } from './convert';
import { dayLabel, DAY_COUNT, infoOf } from './data';
import { fill, useLab } from './env';
import { amountParts } from './money-core';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] items-baseline gap-x-3 gap-y-0.5 py-1.5 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-border/60">
      <dt className="text-11 font-semibold text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-12 font-medium text-foreground">{children}</dd>
    </div>
  );
}

export function ReceiptBody({ agg }: { agg: Aggregate }) {
  const { t, locale } = useLab();
  const info = infoOf(agg.display);
  const name = info ? (locale === 'ar' ? info.nameAr : info.nameEn) : agg.display;
  const r = t.receipt;
  if (!agg.converted) {
    return (
      <div className="grid gap-1">
        <h4 className="text-13 font-bold">{r.title}</h4>
        <p className="text-12 text-muted-foreground">{r.notConverted}</p>
      </div>
    );
  }
  const rate = agg.rateFirst === agg.rateLast ? agg.rateFirst : `${agg.rateFirst} → ${agg.rateLast}`;
  return (
    <div className="grid gap-1">
      <h4 className="text-13 font-bold">{r.title}</h4>
      <dl className="mt-1">
        <Row label={r.source}>{r.sourceValue}</Row>
        <Row label={r.target}>
          <bdi dir="ltr">{agg.display}</bdi> · {name}
        </Row>
        <Row label={r.rate}>
          <span>{r.rateValue}</span>
          <span className="mt-0.5 block text-11 text-muted-foreground" dir="ltr">
            1 USD = {rate} {agg.display}
          </span>
        </Row>
        <Row label={r.period}>
          {dayLabel(0, locale)} - {dayLabel(DAY_COUNT - 1, locale)} · {fill(r.days, { n: DAY_COUNT })}
        </Row>
        <Row label={r.records}>
          {fill(r.recordsValue, { n: agg.records })}
          {agg.directRecords > 0 && (
            <span className="mt-0.5 block text-11 text-muted-foreground">
              {fill(r.direct, { n: agg.directRecords, cur: agg.display })} <AmountView value={agg.directNative} currency={agg.display} context="kpi" />
            </span>
          )}
        </Row>
        <Row label={r.basis}>{r.basisValue}</Row>
      </dl>
      {agg.estimatedDays > 0 && (
        <p className="mt-1 flex items-start gap-1.5 rounded-md bg-or/12 px-2 py-1.5 text-11 font-medium text-or-soft-foreground">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
          {fill(r.estimated, { n: agg.estimatedDays })}
        </p>
      )}
    </div>
  );
}

/** Small warning tag next to an aggregate that used estimated days. */
export function EstimatedTag({ days }: { days: number }) {
  const { t } = useLab();
  if (days <= 0) return null;
  return (
    <Badge variant="attention" className="h-5 gap-1 px-1.5 text-10 font-semibold" title={fill(t.receipt.estimated, { n: days })}>
      <AlertTriangle aria-hidden />
      {t.states.estimatedTag}
    </Badge>
  );
}

/**
 * A converted aggregate: dotted underline + receipt popover (+ the exact value when the figure is compacted).
 * When nothing was converted (USD) it is just the exact-value reveal of a plain Amount.
 */
export function ConvertedAmount({ agg, value, className, ...rest }: { agg: Aggregate; value: string } & Omit<AmountProps, 'value' | 'currency' | 'tag' | 'reveal' | 'revealNote'>) {
  const lab = useLab();
  const parts = amountParts(value, agg.display, { context: rest.context, compact: rest.compact });
  const label = parts ? `${lab.t.receipt.aria} ${parts.exact} ${agg.display}` : lab.t.receipt.aria;
  return (
    <Reveal
      label={label}
      className={cn(
        agg.converted && 'border-b-[1.5px] border-dotted border-muted-foreground/70 pb-[3px] hover:border-foreground',
        className,
      )}
      content={
        <div className="grid min-w-60 gap-3">
          {parts?.compacted && (
            <div className="grid gap-1">
              <span className="text-11 font-semibold text-muted-foreground">{lab.t.reveal.exact}</span>
              <AmountView value={value} currency={agg.display} context="detail" className="text-15 font-bold" />
            </div>
          )}
          <ReceiptBody agg={agg} />
        </div>
      }
    >
      <AmountView value={value} currency={agg.display} {...rest} />
    </Reveal>
  );
}
