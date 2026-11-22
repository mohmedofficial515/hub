/**
 * The live ticket: the sticky summary drawn as a boarding pass that fills in while the customer works. Navy header
 * strip (route, flights, price-hold timer), a tear line, the passengers exactly as they will be printed, a tear line,
 * then every price line in the booking currency, the currency switch and what will be charged.
 */
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Clock, Loader2, Luggage, Plane } from 'lucide-react';
import { cn } from '@lab/utils';
import { useLocale } from '@lab/i18n';
import type { T } from '../i18n';
import {
  CANCEL_QUOTE_USD,
  CHECKOUT,
  ITINERARY,
  TOTALS,
  fromUsd,
  type CheckoutCurrency,
  type PassengerSlot,
} from './data';
import { clock, duration, longDateTime, mmss, money, shortDate } from './money';
import { Num, focusRing } from './ui';

function TearLine() {
  return (
    <div aria-hidden className="relative my-0 h-0">
      <span className="absolute inset-x-5 top-0 border-t border-dashed border-(--border-strong)" />
      <span className="absolute -start-2.5 -top-2.5 size-5 rounded-full border border-(--border) bg-(--background)" />
      <span className="absolute -end-2.5 -top-2.5 size-5 rounded-full border border-(--border) bg-(--background)" />
    </div>
  );
}

function RouteArc() {
  return (
    <svg aria-hidden viewBox="0 0 120 36" className="h-9 w-full min-w-16" preserveAspectRatio="none">
      <path d="M4 32 Q60 -6 116 32" fill="none" stroke="var(--highlight)" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Line({ label, amount, sub, strong }: { label: ReactNode; amount: string; sub?: ReactNode; strong?: boolean }) {
  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <dt className={cn('min-w-0 text-sm', strong ? 'font-semibold text-(--foreground)' : 'text-(--ink)')}>{label}</dt>
        <dd className="shrink-0 text-sm text-(--foreground)">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={amount}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="inline-block"
            >
              <Num>{amount}</Num>
            </motion.span>
          </AnimatePresence>
        </dd>
      </div>
      {sub}
    </div>
  );
}

export interface TicketPassenger {
  slot: PassengerSlot;
  name: string;
}

export function Ticket({
  t,
  currency,
  onCurrency,
  switching,
  passengers,
  lockSeconds,
  charge,
  cta,
  className,
}: {
  t: T;
  currency: CheckoutCurrency;
  onCurrency: (c: CheckoutCurrency) => void;
  switching: CheckoutCurrency | null;
  passengers: TicketPassenger[];
  lockSeconds: number | null;
  charge: { label: string; amount: string }[] | null;
  cta?: ReactNode;
  className?: string;
}) {
  const lang = useLocale();
  const k = t.ticket;
  const totals = TOTALS[currency];
  const out = ITINERARY[0].segments[0];
  const fmt = (a: string) => money(a, currency);
  const lockLow = lockSeconds !== null && lockSeconds > 0 && lockSeconds < 120;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-(--border) bg-(--card)',
        cta && 'flex max-h-[calc(100dvh-12rem)] min-h-[30rem] flex-col',
        className,
      )}
    >
      {/* With a CTA (desktop rail) the body scrolls inside and the total + CTA stay pinned at the bottom. */}
      <div className={cn(cta && 'min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain')}>
      {/* Header strip: solid navy block, no gradient */}
      <div className="bg-(--surface-brand) px-5 pt-4 pb-5 text-(--on-brand)">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-(--on-brand-muted)">{k.title}</h2>
          {lockSeconds !== null && (
            <p
              className={cn('flex items-center gap-1.5 text-sm font-semibold', lockLow ? 'text-(--highlight)' : 'text-(--on-brand)')}
              title={lockSeconds > 0 ? k.lockHint : k.lockEndedHint}
            >
              <Clock aria-hidden className="size-4" />
              {lockSeconds > 0 ? (
                <span>
                  {k.lock('')}
                  <Num>{mmss(lockSeconds)}</Num>
                </span>
              ) : (
                <span>{k.lockEnded}</span>
              )}
            </p>
          )}
        </div>

        <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-3">
          <div>
            <p translate="no" className="font-mono text-3xl font-bold tracking-wide">{out.from.iata}</p>
            <p className="text-sm text-(--on-brand-muted)">{out.from.city[lang]}</p>
          </div>
          <div className="relative pb-5">
            <RouteArc />
            <Plane aria-hidden className="absolute start-1/2 top-0 size-4 -translate-x-1/2 text-(--highlight) rtl:translate-x-1/2 rtl:-scale-x-100" />
          </div>
          <div className="text-end">
            <p translate="no" className="font-mono text-3xl font-bold tracking-wide">{out.to.iata}</p>
            <p className="text-sm text-(--on-brand-muted)">{out.to.city[lang]}</p>
          </div>
        </div>

        <ul className="mt-4 space-y-2 border-t border-(--on-brand-line) pt-3">
          {ITINERARY.map((slice) => {
            const s = slice.segments[0];
            return (
              <li key={slice.kind} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{slice.kind === 'outbound' ? k.outbound : k.return}</span>
                  <span className="text-(--on-brand-muted)"> · {shortDate(s.departAt, lang)}</span>
                </span>
                <Num className="font-semibold">
                  {clock(s.departAt)} → {clock(s.arriveAt)}
                </Num>
                <span className="col-span-2 truncate text-xs text-(--on-brand-muted)">
                  <Num>{s.flightNumber}</Num> · {s.carrier.name[lang]} · {k.direct} · {duration(s.durationMin, lang)} · {k.cabin}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="px-5 pt-4 pb-4">
        <h3 className="text-xs font-semibold text-(--ink-muted)">{k.passengers}</h3>
        <ol className="mt-2 space-y-1.5">
          {passengers.map(({ slot, name }, i) => (
            <li key={slot.slotId} className="flex min-h-7 items-center gap-2.5">
              <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-(--surface-3) text-xs font-bold text-(--ink)">
                {i + 1}
              </span>
              <AnimatePresence mode="wait" initial={false}>
                {name ? (
                  <motion.bdi
                    key={name}
                    dir="ltr"
                    translate="no"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="min-w-0 truncate font-mono text-sm font-semibold tracking-wide text-(--foreground)"
                  >
                    {name}
                  </motion.bdi>
                ) : (
                  <motion.span key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-(--ink-muted)">
                    {k.emptySlot(i + 1, t.pax.type[slot.type])}
                  </motion.span>
                )}
              </AnimatePresence>
            </li>
          ))}
        </ol>
      </div>

      <TearLine />

      <div className="px-5 pt-4 pb-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-(--brand-ink)">{k.priceTitle}</h3>
          <label className="flex items-center gap-2 text-xs text-(--ink-muted)">
            <span>{k.pricesIn}</span>
            <span className="relative">
              <select
                aria-label={k.currency}
                value={switching ?? currency}
                disabled={switching !== null}
                onChange={(e) => onCurrency(e.target.value as CheckoutCurrency)}
                className={cn(
                  'h-9 appearance-none rounded-md border border-(--input) bg-(--card) ps-2.5 pe-7 font-mono text-sm font-semibold text-(--foreground)',
                  focusRing,
                )}
              >
                {(['SAR', 'USD', 'TRY'] as const).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute end-2 top-1/2 size-3.5 -translate-y-1/2" />
            </span>
          </label>
        </div>
        <p aria-live="polite" className="min-h-0 text-xs text-(--ink-muted)">
          {switching && (
            <span className="mt-2 flex items-center gap-1.5">
              <Loader2 aria-hidden className="size-3.5 motion-safe:animate-spin" />
              {k.switching(switching)}
            </span>
          )}
        </p>

        <dl className={cn('mt-2 transition-opacity duration-200', switching && 'opacity-50')}>
          <Line label={k.fare(CHECKOUT.passengerSlots.length)} amount={fmt(totals.fare)} />
          <Line label={k.taxes} amount={fmt(totals.taxes)} />
          <Line
            label={k.extras}
            amount={fmt(totals.services)}
            sub={
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-(--ink-muted)">
                <Luggage aria-hidden className="size-3.5" />
                {k.bag(CHECKOUT.extras[0].weightKg)} · {k.outbound}
              </p>
            }
          />
          <Line label={k.fees} amount={fmt(totals.fees)} />
          <Line label={k.serviceFee} amount={fmt(totals.serviceFee)} />
          <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-(--border) pt-3">
            <dt className="text-base font-bold text-(--foreground)">{k.total}</dt>
            <dd className="text-2xl font-bold text-(--brand-ink)">
              <Num>{fmt(totals.total)}</Num>
            </dd>
          </div>
          {charge?.map((row) => (
            <div key={row.label} className="mt-1 flex items-baseline justify-between gap-3">
              <dt className="min-w-0 text-sm text-(--ink-muted)">{row.label}</dt>
              <dd className="shrink-0 text-sm font-semibold text-(--foreground)">
                <Num>{row.amount}</Num>
              </dd>
            </div>
          ))}
        </dl>

        <details className="group mt-4 rounded-lg bg-(--surface-2) [&_summary::-webkit-details-marker]:hidden">
          <summary className={cn('flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-sm font-semibold text-(--foreground)', focusRing)}>
            <span className="flex-1">{k.cancelTitle}</span>
            <span className="rounded-full bg-(--surface-3) px-2 py-0.5 text-xs font-semibold text-(--ink)">{k.cancelBadge}</span>
            <ChevronDown aria-hidden className="size-4 transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="px-3 pb-3 text-sm">
            <p className="leading-6 text-(--ink)">{k.nonRefundable}</p>
            <dl className="mt-2">
              <Line label={k.airlinePenalty} amount={`− ${fmt(fromUsd(CANCEL_QUOTE_USD.airlinePenalty, currency))}`} />
              <Line label={k.cancellationFee} amount={`− ${fmt(fromUsd(CANCEL_QUOTE_USD.cancellationFee, currency))}`} />
              <Line label={k.serviceFeeKept} amount={`− ${fmt(totals.serviceFee)}`} />
              <Line strong label={k.refundAbout} amount={fmt(fromUsd(CANCEL_QUOTE_USD.estimatedRefund, currency))} />
            </dl>
            <p className="mt-2 leading-6 text-(--ink-muted)">{k.voidUntil(longDateTime(CANCEL_QUOTE_USD.voidUntil, lang))}</p>
          </div>
        </details>

      </div>
      </div>
      {cta && (
        <div className="border-t border-(--border) px-5 pt-3 pb-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm text-(--ink)">
              {k.total} <Num className="ms-1 font-bold text-(--brand-ink)">{fmt(totals.total)}</Num>
            </p>
            {lockSeconds !== null && lockSeconds > 0 && (
              <p className={cn('flex items-center gap-1 text-sm font-semibold', lockLow ? 'text-(--warning-ink)' : 'text-(--ink-muted)')}>
                <Clock aria-hidden className="size-4" />
                <span className="sr-only">{k.lock('')}</span>
                <Num>{mmss(lockSeconds)}</Num>
              </p>
            )}
          </div>
          {cta}
        </div>
      )}
    </div>
  );
}
