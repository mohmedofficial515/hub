/**
 * Calm conversion. Two layers:
 *  1. a converted aggregate gets a 2px dotted underline; its card shows the short "how this number was calculated" and a link to
 *  2. the full conversion RECEIPT (side sheet): result, source currency, rate min / avg / max for the period, a per-source-currency
 *     breakdown, record count, estimated days, "raw provider rate, no customer margin" and a mini rate sparkline.
 * The same receipt opens from the persistent basis line under the header ("How is this calculated?").
 */
import { AlertTriangle, FileText } from 'lucide-react';
import { cn } from '@lab/utils';
import { Badge } from '@dash/components/ui/badge';
import { AmountView, Reveal, type AmountProps } from './amount';
import { aggregate, rateStats, sourceBreakdown, type Aggregate } from './convert';
import { dayLabel, DAY_COUNT, infoOf } from './data';
import { fill, useLab } from './env';
import { amountParts, groupInt } from './money-core';
import { Overlay } from './overlay';

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
          <bdi dir="ltr">{groupInt(String(agg.records))}</bdi> {t.n.rc.recordsUnit}
          {agg.directRecords > 0 && (
            <span className="mt-0.5 block text-11 text-muted-foreground">
              {fill(r.direct, { n: groupInt(String(agg.directRecords)), cur: agg.display })} <AmountView value={agg.directNative} currency={agg.display} context="kpi" softCents={false} />
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

/** Small warning tag next to an aggregate that used estimated days (a basis that differs: shown only then). */
export function EstimatedTag({ days }: { days: number }) {
  const { t } = useLab();
  if (days <= 0) return null;
  return (
    <Badge variant="attention" className="h-5 gap-1 px-1.5 text-11 font-semibold" title={fill(t.receipt.estimated, { n: days })}>
      <AlertTriangle aria-hidden />
      {t.states.estimatedTag}
    </Badge>
  );
}

/** Neutral badge for a figure whose basis DIFFERS from the page basis (balances, ratios). Never on every tile. */
export function BasisBadge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-5 items-center rounded-md bg-muted px-1.5 text-11 font-semibold text-muted-foreground">{children}</span>;
}

/**
 * A converted aggregate: 2px dotted underline + a card with the short receipt (+ the exact value when compacted) and the way to the
 * full receipt. When nothing was converted (USD) it is just the exact-value reveal of a plain amount.
 */
export function ConvertedAmount({ agg, value, className, figure, ...rest }: { agg: Aggregate; value: string; figure?: string } & Omit<AmountProps, 'value' | 'currency' | 'tag' | 'reveal' | 'revealNote'>) {
  const lab = useLab();
  const parts = amountParts(value, agg.display, { context: rest.context, compact: rest.compact });
  const label = parts ? `${lab.t.receipt.aria} ${parts.exact} ${agg.display}` : lab.t.receipt.aria;
  return (
    <Reveal
      label={label}
      className={cn(agg.converted && 'border-b-2 border-dotted border-muted-foreground pb-[3px] hover:border-foreground', className)}
      content={
        <div className="grid min-w-60 gap-3">
          {parts?.compacted && (
            <div className="grid gap-1">
              <span className="text-11 font-semibold text-muted-foreground">{lab.t.reveal.exact}</span>
              <AmountView value={value} currency={agg.display} context="detail" className="text-15 font-bold" />
            </div>
          )}
          <ReceiptBody agg={agg} />
          {agg.converted && (
            <button
              type="button"
              onClick={() => lab.openReceipt(figure)}
              className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-12 font-bold text-primary outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
            >
              <FileText className="size-4" aria-hidden />
              {lab.t.n.rc.full}
            </button>
          )}
        </div>
      }
    >
      <AmountView value={value} currency={agg.display} {...rest} />
    </Reveal>
  );
}

/** Rate sparkline: geometry only (a number is fine here, no money is printed from it). Direction forced to LTR. */
export function RateSpark({ daily, className }: { daily: { rate: string; estimated: boolean }[]; className?: string }) {
  const W = 320;
  const H = 56;
  const v = daily.map((d) => Number(d.rate));
  const min = Math.min(...v);
  const span = Math.max(...v) - min || 1;
  const x = (i: number) => (i / (v.length - 1)) * W;
  const y = (n: number) => H - 6 - ((n - min) / span) * (H - 12);
  const path = v.map((n, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(n).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden preserveAspectRatio="none" style={{ direction: 'ltr' }}>
      <path d={path} fill="none" stroke="var(--chart-1)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {daily.map((d, i) => d.estimated && <circle key={i} cx={x(i)} cy={y(v[i])} r="3.5" fill="var(--card)" stroke="var(--muted-foreground)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}

/** The full conversion receipt (side sheet), driven by the lab state so the basis line and any figure can open it. */
export function ReceiptSheet() {
  const lab = useLab();
  const { t, locale, display, receipt, closeReceipt } = lab;
  if (!receipt.open) return <Overlay open={false} onClose={closeReceipt} title="" children={null} />;
  return <ReceiptContent figure={receipt.figure} onClose={closeReceipt} locale={locale} display={display} t={t} />;
}

function ReceiptContent({ figure, onClose, locale, display, t }: { figure?: string; onClose: () => void; locale: 'ar' | 'en'; display: string; t: ReturnType<typeof useLab>['t'] }) {
  const agg = aggregate('gross', display);
  const stats = rateStats(display);
  const sources = sourceBreakdown(display);
  const rc = t.n.rc;
  const info = infoOf(display);
  const name = info ? (locale === 'ar' ? info.nameAr : info.nameEn) : display;
  const usd = display === 'USD';
  return (
    <Overlay open onClose={onClose} title={rc.title} description={figure ? fill(rc.figure, { name: figure }) : fill(rc.lead, { cur: display })}>
      <div className="grid gap-4 p-4" data-testid="receipt">
        <div className="rounded-xl bg-muted/50 p-3">
          <p className="text-11 font-medium text-muted-foreground">{rc.result}</p>
          <p className="mt-1 text-3xl font-black">
            <AmountView value={agg.total} currency={display} context="detail" />
          </p>
          <p className="mt-1.5 text-12 text-muted-foreground">{usd ? t.receipt.notConverted : fill(rc.formula, { cur: display })}</p>
        </div>

        <dl className="rounded-xl border px-3">
          <Row label={t.receipt.source}>{t.receipt.sourceValue}</Row>
          <Row label={t.receipt.target}>
            <bdi dir="ltr">{display}</bdi> · {name}
          </Row>
          <Row label={t.receipt.period}>
            {dayLabel(0, locale)} - {dayLabel(DAY_COUNT - 1, locale)} · {fill(t.receipt.days, { n: DAY_COUNT })}
          </Row>
          <Row label={t.receipt.records}>
            <bdi dir="ltr">{groupInt(String(agg.records))}</bdi> {rc.recordsUnit}
          </Row>
          <Row label={rc.estimatedRow}>
            {agg.estimatedDays === 0 ? (
              rc.none
            ) : (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <bdi dir="ltr">{agg.estimatedDays}</bdi>
                <EstimatedTag days={agg.estimatedDays} />
              </span>
            )}
          </Row>
        </dl>

        <div className="rounded-xl border p-3">
          <p className="text-12 font-bold">{rc.sourcesTitle}</p>
          <p className="mt-0.5 text-11 text-muted-foreground">{rc.sourcesLead}</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[19rem] text-start text-12">
              <thead>
                <tr className="text-11 text-muted-foreground">
                  <th className="py-1 pe-2 text-start font-semibold">{rc.colCur}</th>
                  <th className="px-2 py-1 text-end font-semibold">{rc.colShare}</th>
                  <th className="px-2 py-1 text-start font-semibold">{rc.colHow}</th>
                  <th className="ps-2 py-1 text-end font-semibold">{rc.colRecords}</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((r) => (
                  <tr key={r.currency} className="border-t border-border/60">
                    <td className="py-1.5 pe-2 font-bold" dir="ltr">
                      {r.currency}
                    </td>
                    <td className="px-2 py-1.5 text-end tabular-nums" dir="ltr">
                      {(r.share * 100).toFixed(1)}%
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {usd ? rc.howUsd : r.direct ? rc.howDirect : fill(rc.howRate, { rate: r.avgRate ?? '' })}
                    </td>
                    <td className="ps-2 py-1.5 text-end tabular-nums" dir="ltr">
                      {groupInt(String(r.records))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {!usd && (
          <div className="rounded-xl border p-3">
            <p className="text-12 font-bold">
              {rc.rateTitle} <bdi dir="ltr" className="font-medium text-muted-foreground">(1 USD = {display})</bdi>
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center" dir="ltr">
              {([
                [rc.min, stats.min],
                [rc.avg, stats.avg],
                [rc.max, stats.max],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="rounded-lg bg-muted/50 px-2 py-2">
                  <p className="text-11 font-medium text-muted-foreground">{k}</p>
                  <p className="text-14 font-black tabular-nums">{v}</p>
                </div>
              ))}
            </div>
            {stats.flat ? (
              <p className="mt-2 rounded-lg bg-muted/40 px-3 py-2 text-11 text-muted-foreground">{rc.flat}</p>
            ) : (
              <>
                <RateSpark className="mt-3 h-14 w-full" daily={stats.daily} />
                <div className="mt-1 flex justify-between text-11 text-muted-foreground" dir="ltr">
                  <span>{dayLabel(0, locale)}</span>
                  <span>{dayLabel(DAY_COUNT - 1, locale)}</span>
                </div>
              </>
            )}
            {agg.estimatedDays > 0 && <p className="mt-2 text-11 text-muted-foreground">{fill(t.receipt.estimated, { n: agg.estimatedDays })}</p>}
          </div>
        )}
        <p className="rounded-lg bg-muted/40 p-3 text-12 leading-5 text-muted-foreground">{t.receipt.basisValue}. {rc.noMargin}</p>
      </div>
    </Overlay>
  );
}
