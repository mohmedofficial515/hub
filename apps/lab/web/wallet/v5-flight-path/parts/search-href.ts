import type { Locale } from '@lab/i18n';
import type { FlightSearchEntry } from '@lab/mocks/wallet';

/**
 * The results link that runs a flight-search history entry again, in the real site's URL format
 * (`web/src/features/flights/history/history-href.ts` → `flightsHref(criteriaOfEntry(entry))`, nuqs serializer
 * with clear-on-default):
 *
 *   /{locale}/flights?trip=round&slices=CAI_IST_2026-11-14,IST_CAI_2026-11-21&adults=2&children=7,4&infants=1
 *     &infantAges=1&cabin=business&cur=USD
 *
 * Defaults are omitted exactly like the serializer does (adults=1, children=[], infants=0, cabin=economy).
 * At port time call the real `historyHref(entry)` and prefix the locale through next-intl's `Link`; this helper
 * only exists because the lab cannot import project code.
 *
 * Lab gap: the mock round trips carry a single slice (no return leg). The real `validCriteria` would reject such an
 * entry (`historyHref` → null); here the trip type is derived from the slice count so the link stays testable.
 */
export function searchHref(entry: FlightSearchEntry, locale: Locale): string | null {
  if (entry.departed || entry.slices.length === 0) return null;
  const derived = entry.slices.length === 1 ? 'oneway' : entry.slices.length === 2 ? 'round' : 'multi';
  const declared = { ONE_WAY: 'oneway', ROUND_TRIP: 'round', MULTI_CITY: 'multi' }[entry.tripType];
  const expected = declared === 'oneway' ? 1 : declared === 'round' ? 2 : entry.slices.length;
  const trip = entry.slices.length === expected ? declared : derived;

  const parts: string[] = [
    `trip=${trip}`,
    `slices=${entry.slices.map((s) => `${s.origin.iataCode}_${s.destination.iataCode}_${s.departureDate}`).join(',')}`,
  ];
  const { adults, children, infants } = entry.passengers;
  if (adults !== 1) parts.push(`adults=${adults}`);
  if (children.length) parts.push(`children=${children.join(',')}`);
  if (infants.length) parts.push(`infants=${infants.length}`);
  // `infantAges` only when some lap infant is 1 year old (canonicalInfantAges).
  if (infants.some((age) => age !== 0)) parts.push(`infantAges=${infants.join(',')}`);
  const cabin = entry.cabinClass.toLowerCase();
  if (cabin !== 'economy') parts.push(`cabin=${cabin}`);
  parts.push(`cur=${(entry.lastSeenPrice?.currency ?? entry.currency).toUpperCase()}`);

  return `/${locale}/flights?${parts.join('&')}`;
}

/** The flight search page with no criteria (curated destinations and the generic CTA). */
export const flightsHome = (locale: Locale) => `/${locale}/flights`;
export const rewardsHref = (locale: Locale) => `/${locale}/account/rewards`;
/** Needs backend: the wallet reference carries a payment id, not a booking id (see README). */
export const bookingHref = (locale: Locale, ref: string) => `/${locale}/account/bookings/${ref}`;
