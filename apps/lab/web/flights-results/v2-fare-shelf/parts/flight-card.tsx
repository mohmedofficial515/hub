import { useId } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChevronDown, Info, Sparkles, Tag, Zap, type LucideIcon } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { SEARCH, type FareOption, type HighlightKey, type Itinerary } from '../mock';
import { FareFacts, RefundBadge } from './fare-facts';
import { FareShelf } from './fare-shelf';
import { Amount, compareDecimal, formatMoney } from './money';
import { shownTotal, typePrices } from './model';
import { SliceRow } from './slice-row';

const MARKER: Record<HighlightKey, { icon: LucideIcon; tone: string }> = {
  best: { icon: Sparkles, tone: 'text-highlight-ink' }, // gold: a small touch, always beside a word
  price: { icon: Tag, tone: 'text-brand-ink' },
  duration: { icon: Zap, tone: 'text-brand-ink' },
};

/**
 * One itinerary. Reading order, phone and desktop alike: who flies it, the total for everyone, the flights, what the
 * fare includes. The price column holds a single neutral action that opens the fare shelf; the teal button lives in
 * the shelf.
 */
export function FlightCard({
  itinerary,
  fare,
  markers,
  withBag,
  open,
  onToggle,
  onSelectFare,
}: {
  itinerary: Itinerary;
  fare: FareOption;
  markers: HighlightKey[];
  withBag: boolean;
  open: boolean;
  onToggle: () => void;
  onSelectFare: (fare: FareOption) => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const shelfId = useId();
  const currency = fare.price.currency;
  const total = shownTotal(fare, withBag);
  const fromTotal = [...itinerary.fares].map((f) => shownTotal(f, withBag)).sort(compareDecimal)[0];
  const adult = typePrices(fare).find((r) => r.type === 'ADULT');
  const bagsAdded = withBag && fare.withCheckedBag && fare.withCheckedBag.bagsPrice !== '0.00' ? fare.withCheckedBag.bagsPrice : null;
  const bagNotSold = withBag && !fare.checkedBaggageIncluded && !fare.withCheckedBag;
  const count = itinerary.fares.length;

  return (
    <article
      aria-label={`${itinerary.owner.name[locale]}, ${formatMoney(total, currency, locale)}`}
      className={cn(
        'overflow-hidden rounded-2xl border bg-card transition-[border-color] duration-200',
        open ? 'border-border-strong' : 'border-border hover:border-border-strong',
      )}
    >
      <div className="grid [grid-template-areas:'head'_'price'_'route'_'facts'_'act'] md:grid-cols-[minmax(0,1fr)_16rem] md:[grid-template-areas:'head_price'_'route_price'_'facts_act']">
        {/* Who flies it, plus the strip's markers as icon + word */}
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-4 [grid-area:head] md:px-6 md:pt-5">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 font-mono text-sm font-semibold text-brand-ink"
          >
            {itinerary.owner.iataCode}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base leading-snug font-semibold text-brand-ink">{itinerary.owner.name[locale]}</h3>
            <p className="truncate text-xs text-ink-muted">
              {t.card.cabin[fare.cabinClass]}
              <span aria-hidden> · </span>
              {fare.fareBrandName}
            </p>
          </div>
          {markers.length > 0 && (
            <ul className="flex w-full flex-wrap gap-x-3 gap-y-1 sm:w-auto">
              {markers.map((m) => {
                const { icon: Icon, tone } = MARKER[m];
                return (
                  <li key={m} className="inline-flex items-center gap-1 text-xs font-semibold text-ink">
                    <Icon className={cn('size-4', tone)} aria-hidden />
                    {t.card.markers[m]}
                  </li>
                );
              })}
            </ul>
          )}
        </header>

        {/* Total first: for everyone, taxes in, the per-adult figure under it */}
        <div className="mx-4 mt-4 border-t border-border pt-4 [grid-area:price] md:mx-0 md:mt-0 md:flex md:flex-col md:border-s md:border-t-0 md:px-6 md:pt-5 md:pb-2">
          <p className="text-xs font-medium text-ink-muted">{t.card.totalFor(SEARCH.passengers.length)}</p>
          <Amount amount={total} currency={currency} locale={locale} className="mt-0.5 text-3xl leading-tight font-bold text-brand-ink" />
          <div>
            <PriceBreakdown fare={fare} bagsPrice={bagsAdded} />
          </div>
          {adult && (
            <p className="mt-1 text-xs text-ink-muted tnum">
              {formatMoney(adult.unit, currency, locale)} {t.card.perAdult}
            </p>
          )}
          {bagsAdded && <p className="mt-1 text-xs text-ink">{t.card.bagsAdded(formatMoney(bagsAdded, currency, locale))}</p>}
          {bagNotSold && <p className="mt-1 text-xs text-ink">{t.card.bagNotSold}</p>}
        </div>

        {/* The flights, one line each */}
        <div className="space-y-4 px-4 pt-4 [grid-area:route] md:px-6">
          {itinerary.slices.map((slice, i) => (
            <SliceRow key={i} slice={slice} direction={i === 0 ? 'outbound' : 'inbound'} />
          ))}
        </div>

        {/* What the chosen fare includes, in words */}
        <div className="flex flex-col gap-3 px-4 pt-4 pb-4 [grid-area:facts] md:px-6 md:pb-5">
          <FareFacts fare={fare} />
          <RefundBadge fare={fare} />
        </div>

        {/* The card's one action: open the shelf. Neutral outline, so the list does not become a column of teal. */}
        <div className="flex flex-col gap-2 border-t border-border px-4 py-3 [grid-area:act] md:justify-end md:border-s md:border-t-0 md:px-6 md:pt-0 md:pb-5">
          <p className="text-xs text-ink-muted">
            {t.card.faresFrom(count)} <span className="font-semibold text-ink tnum">{formatMoney(fromTotal, currency, locale)}</span>
          </p>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={shelfId}
            className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-border-strong bg-card px-4 text-sm font-bold text-brand-ink transition-colors duration-150 outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            {open ? t.card.hideFares : count > 1 ? t.card.compare : t.card.seeFare}
            <ChevronDown className={cn('size-4 transition-transform duration-200 motion-reduce:transition-none', open && 'rotate-180')} aria-hidden />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && <FareShelf id={shelfId} itinerary={itinerary} selected={fare} onSelect={onSelectFare} withBag={withBag} />}
      </AnimatePresence>
    </article>
  );
}

/** "Taxes included", with the breakdown one tap away: base, taxes, total, and each passenger type. */
function PriceBreakdown({ fare, bagsPrice }: { fare: FareOption; bagsPrice: string | null }) {
  const t = useT(messages);
  const locale = useLocale();
  const money = (v: string) => formatMoney(v, fare.price.currency, locale);

  return (
    <Popover.Root>
      <Popover.Trigger
        className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-md text-xs font-medium text-ink underline decoration-border-strong underline-offset-4 outline-none hover:decoration-ink focus-visible:ring-2 focus-visible:ring-ring md:min-h-8"
        aria-label={`${t.card.includes}. ${t.card.breakdown}`}
      >
        <Info className="size-4 shrink-0 text-ink-muted" aria-hidden />
        {t.card.includes}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={16}
          className="fr z-40 w-72 rounded-2xl border border-border bg-popover p-4 text-sm text-ink shadow-xl outline-none"
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
        >
          <p className="mb-3 font-semibold text-brand-ink">{t.card.breakdown}</p>
          <dl className="space-y-2">
            <Row label={t.card.base} value={money(fare.price.base)} />
            <Row label={t.card.taxes} value={money(fare.price.taxes)} />
            {bagsPrice && <Row label={t.card.bagsLine} value={money(bagsPrice)} />}
            <div className="border-t border-border pt-2">
              <Row label={t.card.total} value={money(bagsPrice && fare.withCheckedBag ? fare.withCheckedBag.total : fare.price.total)} strong />
            </div>
          </dl>
          <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-ink-muted">
            {typePrices(fare).map((r) => (
              <li key={r.type + r.unit} className="tnum">
                {t.card.typeCount(t.card.perType[r.type], r.count, money(r.unit))}
              </li>
            ))}
          </ul>
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? 'font-semibold text-brand-ink' : 'text-ink'}>{label}</dt>
      <dd className={cn('tnum', strong ? 'font-bold text-brand-ink' : 'text-ink')}>{value}</dd>
    </div>
  );
}
