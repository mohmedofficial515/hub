import { CheckCircle2, Plus, Search } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { curatedDestinations, topUpLimits, type FlightSearchEntry } from '@lab/mocks/wallet';
import { messages } from '../i18n';
import { formatDay } from './hooks';
import { LabLink } from './lab-link';
import { flightsHome, searchHref } from './search-href';
import { formatUsd, fromCents, maxCents, toCents, type Cents } from './money';

export interface Trip {
  key: string;
  iata: string;
  city: string;
  date: string | null;
  price: Cents;
  /** Pre-filled flight search (same tab); the generic search page for curated destinations. */
  href: string;
  curated: boolean;
}

const MIN = BigInt(topUpLimits.minUsd) * 100n;

/** Trips from the customer's own searches (USD `lastSeenPrice` only; other currencies need FX), else curated. */
export function useTrips(searches: FlightSearchEntry[]): Trip[] {
  const locale = useLocale();
  const fromSearches: Trip[] = searches.flatMap((s) => {
    const href = searchHref(s, locale);
    if (!href || s.lastSeenPrice?.currency !== 'USD') return [];
    const dest = s.slices[0].destination;
    return [
      {
        key: s.id,
        iata: dest.iataCode,
        city: dest.cityName ?? dest.iataCode,
        date: s.slices[0].departureDate,
        price: toCents(s.lastSeenPrice.amount),
        href,
        curated: false,
      },
    ];
  });
  if (fromSearches.length) return fromSearches;
  return curatedDestinations.map((d) => ({
    key: d.iata,
    iata: d.iata,
    city: d.city[locale],
    date: null,
    price: toCents(d.fromUsd),
    href: flightsHome(locale),
    curated: true,
  }));
}

const chipBase =
  'group flex min-h-12 items-center gap-2.5 rounded-2xl border px-3 py-1.5 text-start transition-colors focus-visible:ring-[3px] focus-visible:ring-secondary focus-visible:outline-none';

/**
 * Trips the balance covers (link to the pre-filled search) or the exact top-up that would cover them (fills
 * refuel). While amounts are hidden every chip is neutral: price only, and every chip opens its search, so
 * nothing on the chip reveals where the balance sits.
 */
export function TripChips({
  trips,
  available,
  shown,
  onGap,
}: {
  trips: Trip[];
  available: Cents;
  shown: boolean;
  onGap: (amount: string) => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const curated = trips[0]?.curated ?? false;
  const coveredCount = trips.filter((trip) => trip.price <= available).length;

  return (
    <section aria-labelledby="fp-trips" className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h3 id="fp-trips" className="text-sm font-bold text-white">
          {curated ? t.tripsCurated : t.tripsFromSearches}
          {shown && coveredCount > 0 && (
            <span className="ms-2 font-semibold text-secondary">· {t.coversCount(coveredCount, trips.length)}</span>
          )}
        </h3>
        <p className="text-xs text-white/75">
          {curated ? t.indicativeCurated : t.indicativeSearch}
          {!shown && <> {t.tripsHiddenHint}</>}
        </p>
      </div>
      <ul className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {trips.map((trip) => {
          const covered = shown && trip.price <= available;
          const gap = maxCents(trip.price - available, MIN);
          const price = formatUsd(trip.price);
          const body = (
            <>
              <span className="font-mono text-[11px] font-bold tracking-wider text-white/70" aria-hidden>
                {trip.iata}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-bold text-white">
                  {trip.city}
                  {trip.date && <span className="ms-1.5 text-xs font-normal text-white/75">{formatDay(trip.date, locale)}</span>}
                </span>
                <span className="text-xs text-white/80">
                  {trip.curated && <>{t.from} </>}
                  <bdi dir="ltr" className="tabular-nums">
                    {price}
                  </bdi>
                </span>
              </span>
            </>
          );

          if (!shown || covered) {
            return (
              <li key={trip.key} className="shrink-0">
                <LabLink
                  href={trip.href}
                  aria-label={covered ? t.coveredAria(trip.city, price) : t.searchAria(trip.city, price)}
                  className={cn(
                    chipBase,
                    covered ? 'border-secondary/60 bg-secondary/15 hover:bg-secondary/25' : 'border-white/20 bg-white/5 hover:bg-white/10',
                  )}
                >
                  {body}
                  {covered ? (
                    <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs font-bold text-ocean-deep">
                      <CheckCircle2 className="size-3.5" aria-hidden />
                      {t.covered}
                    </span>
                  ) : (
                    <Search className="size-4 text-white/70" aria-hidden />
                  )}
                </LabLink>
              </li>
            );
          }

          return (
            <li key={trip.key} className="shrink-0">
              <button
                type="button"
                onClick={() => onGap(fromCents(gap))}
                aria-label={t.gapAria(trip.city, price, formatUsd(gap))}
                className={cn(chipBase, 'border-white/20 bg-white/5 hover:bg-white/10')}
              >
                {body}
                <span className="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-bold text-ocean-deep transition-colors group-hover:bg-secondary-foreground">
                  <Plus className="size-3.5" aria-hidden />
                  <bdi dir="ltr" className="tabular-nums">
                    {formatUsd(gap)}
                  </bdi>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
