import { CheckCircle2, Plus } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { curatedDestinations, topUpLimits, type FlightSearchEntry } from '@lab/mocks/wallet';
import { messages } from '../i18n';
import { formatDay } from './hooks';
import { formatUsd, fromCents, MASK, maxCents, toCents, type Cents } from './money';

interface Trip {
  key: string;
  iata: string;
  city: string;
  date: string | null;
  price: Cents;
}

const MIN = BigInt(topUpLimits.minUsd) * 100n;

/**
 * Trips the balance covers, or the exact top-up that would cover them. Source: the customer's own searches
 * (`lastSeenPrice`, USD only here; other currencies need FX), else a curated fallback.
 */
export function TripChips({
  available,
  shown,
  searches,
  onGap,
}: {
  available: Cents;
  shown: boolean;
  searches: FlightSearchEntry[];
  onGap: (amount: string) => void;
}) {
  const t = useT(messages);
  const locale = useLocale();

  const fromSearches: Trip[] = searches
    .filter((s) => !s.departed && s.lastSeenPrice?.currency === 'USD')
    .map((s) => {
      const dest = s.slices[0].destination;
      return {
        key: s.id,
        iata: dest.iataCode,
        city: dest.cityName ?? dest.iataCode,
        date: s.slices[0].departureDate,
        price: toCents(s.lastSeenPrice!.amount),
      };
    });
  const curated = fromSearches.length === 0;
  const trips: Trip[] = curated
    ? curatedDestinations.map((d) => ({ key: d.iata, iata: d.iata, city: d.city[locale], date: null, price: toCents(d.fromUsd) }))
    : fromSearches;

  return (
    <section aria-labelledby="fp-trips" className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h3 id="fp-trips" className="text-sm font-bold text-white">
          {curated ? t.tripsCurated : t.tripsFromSearches}
        </h3>
        <p className="text-xs text-white/70">{curated ? t.indicativeCurated : t.indicativeSearch}</p>
      </div>
      <ul className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {trips.map((trip) => {
          const covered = trip.price <= available;
          const gap = maxCents(trip.price - available, MIN);
          const price = formatUsd(trip.price);
          const gapLabel = shown ? formatUsd(gap) : MASK;
          return (
            <li key={trip.key} className="shrink-0">
              <button
                type="button"
                onClick={() => (covered ? undefined : onGap(fromCents(gap)))}
                aria-label={covered ? t.coveredAria(trip.city, price) : t.gapAria(trip.city, price, gapLabel)}
                className={cn(
                  'group flex min-h-12 items-center gap-2.5 rounded-2xl border px-3 py-1.5 text-start transition-colors focus-visible:ring-[3px] focus-visible:ring-secondary focus-visible:outline-none',
                  covered
                    ? 'border-secondary/60 bg-secondary/15 hover:bg-secondary/25'
                    : 'border-white/20 bg-white/5 hover:bg-white/10',
                )}
              >
                <span className="font-mono text-[11px] font-bold tracking-wider text-white/60" aria-hidden>
                  {trip.iata}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-sm font-bold text-white">
                    {trip.city}
                    {trip.date && (
                      <span className="ms-1.5 text-xs font-normal text-white/70">{formatDay(trip.date, locale)}</span>
                    )}
                  </span>
                  <span className="text-xs text-white/75">
                    {curated && <>{t.from} </>}
                    <bdi dir="ltr" className="tabular-nums">
                      {price}
                    </bdi>
                  </span>
                </span>
                {covered ? (
                  <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs font-bold text-ocean-deep">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    {t.covered}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-bold text-ocean-deep transition-colors group-hover:bg-secondary-foreground">
                    <Plus className="size-3.5" aria-hidden />
                    <bdi dir="ltr" className="tabular-nums">
                      {gapLabel}
                    </bdi>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
