import { ArrowLeftRight, ArrowRight, Check, Compass, Plane, Plus, Search } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { curatedDestinations, type FlightSearchEntry } from '@lab/mocks/wallet';
import { messages } from '../i18n';
import { addDecimal, compareDecimal, isDecimal, maxDecimal, subtractDecimal } from './money';
import { focusRing, Money, SectionTitle, useShown } from './shared';

export interface Trip {
  id: string;
  from: string | null;
  to: string;
  iata: string;
  price: string; // USD decimal string
  date: string | null;
  roundTrip: boolean | null;
  travellers: number | null;
  source: 'search' | 'curated';
}

/** Customer's own searches (USD, not departed, with a last-seen price), else the curated fallback. */
export function tripsFor(searches: FlightSearchEntry[], locale: 'ar' | 'en'): Trip[] {
  const own = searches
    .filter((s) => !s.departed && s.lastSeenPrice?.currency === 'USD' && s.slices.length > 0)
    .map<Trip>((s) => {
      const first = s.slices[0];
      return {
        id: s.id,
        from: first.origin.cityName ?? first.origin.iataCode,
        to: first.destination.cityName ?? first.destination.iataCode,
        iata: first.destination.iataCode,
        price: s.lastSeenPrice!.amount,
        date: first.departureDate,
        roundTrip: s.tripType === 'ROUND_TRIP',
        travellers: s.passengers.adults + s.passengers.children.length + s.passengers.infants.length,
        source: 'search',
      };
    });
  if (own.length) return own.sort((a, b) => compareDecimal(a.price, b.price));
  return curatedDestinations.map((d) => ({
    id: `cur_${d.iata}`,
    from: null,
    to: d.city[locale],
    iata: d.iata,
    price: d.fromUsd,
    date: null,
    roundTrip: null,
    travellers: null,
    source: 'curated' as const,
  }));
}

export function TripsStrip({
  trips,
  available,
  amount,
  minUsd,
  onFill,
}: {
  trips: Trip[];
  available: string;
  amount: string;
  minUsd: number;
  onFill: (gap: string) => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const shown = useShown();
  const ghost = isDecimal(amount) ? amount : '0.00';
  const withTopUp = addDecimal(available, ghost);
  const curated = trips[0]?.source === 'curated';
  const date = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en', { day: 'numeric', month: 'short' });

  return (
    <section aria-labelledby="trips-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <SectionTitle
          id="trips-title"
          title={t.trips.title}
          sub={curated ? t.trips.curated : t.trips.fromSearches}
          icon={<Compass className="size-5" aria-hidden />}
        />
        <p className="text-xs text-muted-foreground">{t.trips.indicative}</p>
      </div>

      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {trips.map((trip) => {
          const covered = compareDecimal(available, trip.price) >= 0;
          const coveredAfter = !covered && compareDecimal(withTopUp, trip.price) >= 0 && ghost !== '0.00';
          const gap = maxDecimal(subtractDecimal(trip.price, available), String(minUsd));
          return (
            <li
              key={trip.id}
              className={cn(
                'relative flex w-[78%] shrink-0 snap-start flex-col gap-3 overflow-hidden rounded-2xl border p-4 sm:w-auto',
                covered
                  ? 'border-secondary/50 bg-secondary/[0.06]'
                  : 'border-border bg-card',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {trip.from ? (
                      <>
                        <span className="truncate">{trip.from}</span>
                        {trip.roundTrip ? (
                          <ArrowLeftRight className="size-3 shrink-0" aria-hidden />
                        ) : (
                          <ArrowRight className="size-3 shrink-0 rtl:rotate-180" aria-hidden />
                        )}
                      </>
                    ) : (
                      <Plane className="size-3.5" aria-hidden />
                    )}
                  </p>
                  <p className="truncate text-lg font-extrabold text-primary dark:text-white">{trip.to}</p>
                </div>
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-bold tracking-wider text-muted-foreground">
                  {trip.iata}
                </span>
              </div>

              <div className="text-sm">
                <span className="text-muted-foreground">{trip.source === 'search' ? t.trips.lastSeen : t.trips.from} </span>
                <Money value={trip.price} className="font-extrabold text-foreground" />
                {trip.date && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {date.format(new Date(trip.date))} · {trip.roundTrip ? t.trips.roundTrip : t.trips.oneWay}
                  </span>
                )}
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-2">
                {covered ? (
                  <span className="inline-flex min-h-9 items-center gap-1 rounded-full bg-secondary/15 px-3 text-xs font-bold text-teal-800 dark:text-secondary">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    {t.trips.covered}
                  </span>
                ) : coveredAfter ? (
                  <span className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-primary/40 px-3 text-xs font-bold text-primary dark:border-white/40 dark:text-white">
                    <Check className="size-3.5" aria-hidden />
                    {t.trips.coveredAfter}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onFill(gap)}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-1 rounded-full bg-primary px-3.5 text-xs font-bold text-white hover:bg-primary/90 dark:bg-white dark:text-ocean-deep',
                      focusRing,
                    )}
                  >
                    <Plus className="size-3.5" aria-hidden />
                    {shown ? (
                      <>
                        {t.trips.add} <Money value={gap} />
                      </>
                    ) : (
                      t.trips.addHidden
                    )}
                  </button>
                )}
                <a
                  href="#search"
                  aria-label={`${t.trips.search}: ${trip.to}`}
                  className={cn(
                    'ms-auto grid size-11 place-items-center rounded-full text-teal-700 hover:bg-secondary/10 dark:text-secondary',
                    focusRing,
                  )}
                >
                  <Search className="size-4" aria-hidden />
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
