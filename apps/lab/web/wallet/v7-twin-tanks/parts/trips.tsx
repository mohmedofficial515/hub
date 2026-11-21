import { ArrowLeftRight, ArrowRight, Check, Compass, Eye, Plane, Plus, Search } from 'lucide-react';
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
  searchedAt: string | null;
  /** Flight results pre-filled from the search (same tab), or the plain search page for curated cards. */
  href: string;
}

const TRIP_PARAM: Record<FlightSearchEntry['tripType'], string> = {
  ONE_WAY: 'oneway',
  ROUND_TRIP: 'round',
  MULTI_CITY: 'multi',
};
const CABIN_PARAM: Record<FlightSearchEntry['cabinClass'], string> = {
  ECONOMY: 'economy',
  PREMIUM_ECONOMY: 'premium_economy',
  BUSINESS: 'business',
  FIRST: 'first',
};

/**
 * The results link that runs a saved search again, in the real site's format
 * (web `features/flights/history/history-href.ts` → `flightsHref` → nuqs `serializeFlightSearch`):
 * `/{locale}/flights?trip=round&slices=CAI_IST_2026-11-14,IST_CAI_2026-11-21&adults=2&children=7,4&infants=1&cabin=business&cur=USD`.
 * Keys keep the parser order and values equal to the default (adults 1, no children/infants, economy) are left out,
 * as nuqs `clearOnDefault` does. `trip` is written only when it agrees with the number of slices; otherwise the
 * results page guesses it from the slices (the lab's round-trip mocks carry one slice).
 */
export function flightSearchHref(s: FlightSearchEntry, locale: 'ar' | 'en'): string {
  const slices = s.slices.map(
    (x) => `${x.origin.iataCode.toUpperCase()}_${x.destination.iataCode.toUpperCase()}_${x.departureDate.slice(0, 10)}`,
  );
  const expected = s.tripType === 'ONE_WAY' ? 1 : s.tripType === 'ROUND_TRIP' ? 2 : null;
  const tripAgrees = expected === null ? slices.length >= 2 : slices.length === expected;
  const parts: string[] = [];
  if (tripAgrees) parts.push(`trip=${TRIP_PARAM[s.tripType]}`);
  parts.push(`slices=${slices.join(',')}`);
  if (s.passengers.adults !== 1) parts.push(`adults=${s.passengers.adults}`);
  if (s.passengers.children.length) parts.push(`children=${s.passengers.children.join(',')}`);
  if (s.passengers.infants.length) parts.push(`infants=${s.passengers.infants.length}`);
  if (s.passengers.infants.some((age) => age !== 0)) parts.push(`infantAges=${s.passengers.infants.join(',')}`);
  if (s.cabinClass !== 'ECONOMY') parts.push(`cabin=${CABIN_PARAM[s.cabinClass]}`);
  parts.push(`cur=${(s.lastSeenPrice?.currency ?? s.currency).toUpperCase()}`);
  return `/${locale}/flights?${parts.join('&')}`;
}

/** The plain flight search (no saved search to re-run). */
export const flightsHome = (locale: 'ar' | 'en') => `/${locale}/flights`;

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
        searchedAt: s.searchedAt,
        href: flightSearchHref(s, locale),
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
    searchedAt: null,
    href: flightsHome(locale),
  }));
}

/**
 * Where "Book with your balance" goes. Amounts shown: the most recent search the balance covers, else the most
 * recent search. Hidden: the most recent search (the target must not depend on the balance). No search: the plain
 * flight search.
 */
export function bookWithHref(trips: Trip[], available: string, shown: boolean, locale: 'ar' | 'en'): string {
  const own = trips
    .filter((t) => t.source === 'search')
    .sort((a, b) => (b.searchedAt ?? '').localeCompare(a.searchedAt ?? ''));
  const covered = shown ? own.find((t) => compareDecimal(available, t.price) >= 0) : undefined;
  return (covered ?? own[0])?.href ?? flightsHome(locale);
}

export function TripsStrip({
  trips,
  available,
  amount,
  minUsd,
  onFill,
  onShowAmounts,
}: {
  trips: Trip[];
  available: string;
  amount: string;
  minUsd: number;
  onFill: (gap: string) => void;
  onShowAmounts: () => void;
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

      {/* Neutral state: while amounts are hidden, nothing on a card may say whether the balance covers it. */}
      {!shown && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          <Eye className="size-4 shrink-0 text-secondary" aria-hidden />
          <span>{t.trips.hiddenNote}</span>
          <button
            type="button"
            onClick={onShowAmounts}
            className={cn(
              'inline-flex min-h-11 items-center rounded-md px-1 font-bold text-teal-700 underline underline-offset-4 dark:text-secondary',
              focusRing,
            )}
          >
            {t.showAmounts}
          </button>
        </p>
      )}

      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {trips.map((trip) => {
          const covered = shown && compareDecimal(available, trip.price) >= 0;
          const coveredAfter = shown && !covered && ghost !== '0.00' && compareDecimal(withTopUp, trip.price) >= 0;
          const gap = maxDecimal(subtractDecimal(trip.price, available), String(minUsd));
          return (
            <li
              key={trip.id}
              className={cn(
                'relative flex w-[78%] shrink-0 snap-start flex-col gap-3 overflow-hidden rounded-2xl border p-4 sm:w-auto',
                covered ? 'border-secondary/50 bg-secondary/[0.06]' : 'border-border bg-card',
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
                      <Plane className="size-3.5 rtl:-scale-x-100" aria-hidden />
                    )}
                  </p>
                  <p className="truncate text-lg font-extrabold text-primary dark:text-white">{trip.to}</p>
                </div>
                <span
                  translate="no"
                  className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-bold tracking-wider text-muted-foreground"
                >
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
                {!shown ? (
                  <a
                    href={trip.href}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/30 px-3.5 text-xs font-bold text-primary hover:bg-primary/5 dark:border-white/30 dark:text-white dark:hover:bg-white/10',
                      focusRing,
                    )}
                  >
                    <Search className="size-3.5" aria-hidden />
                    {trip.source === 'search' ? t.trips.searchAgain : t.trips.search}
                    <span className="sr-only">: {trip.to}</span>
                  </a>
                ) : covered ? (
                  <>
                    <span className="inline-flex min-h-9 items-center gap-1 rounded-full bg-secondary/15 px-3 text-xs font-bold text-teal-800 dark:text-secondary">
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                      {t.trips.covered}
                    </span>
                    <a
                      href={trip.href}
                      className={cn(
                        'ms-auto inline-flex min-h-11 items-center gap-1 rounded-full bg-primary px-3.5 text-xs font-bold text-white hover:bg-primary/90 dark:bg-white dark:text-ocean-deep',
                        focusRing,
                      )}
                    >
                      {t.trips.book}
                      <span className="sr-only">: {trip.to}</span>
                      <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
                    </a>
                  </>
                ) : (
                  <>
                    {coveredAfter ? (
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
                        {t.trips.add} <Money value={gap} />
                      </button>
                    )}
                    <a
                      href={trip.href}
                      aria-label={`${t.trips.search}: ${trip.to}`}
                      className={cn(
                        'ms-auto grid size-11 place-items-center rounded-full text-teal-700 hover:bg-secondary/10 dark:text-secondary',
                        focusRing,
                      )}
                    >
                      <Search className="size-4" aria-hidden />
                    </a>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
