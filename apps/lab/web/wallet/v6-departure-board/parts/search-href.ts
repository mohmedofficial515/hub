import type { FlightSearchEntry } from '@lab/mocks/wallet';

/**
 * Results link that re-runs one of the customer's flight searches, in the exact format of the real site:
 * `historyHref(entry)` → `flightsHref(criteriaOfEntry(entry))` → nuqs `serializeFlightSearch('/flights', …)`
 * (web: src/features/flights/history/history-href.ts, src/features/flights/search/url-state.ts,
 * src/apiEndpoint/search-history/adapters.ts). Keys equal to their nuqs default are left out (clearOnDefault):
 * `adults=1`, `children=[]`, `infants=0`, `cabin=economy`.
 *
 *   /ar/flights?trip=round&slices=CAI_IST_2026-11-14,IST_CAI_2026-11-21&cur=USD
 *
 * Opened in the same tab (owner decision). At port time this whole file is replaced by `historyHref(entry)` plus the
 * locale prefix that `Link` from `@/i18n/routing` adds.
 */

const TRIP: Record<FlightSearchEntry['tripType'], string> = { ONE_WAY: 'oneway', ROUND_TRIP: 'round', MULTI_CITY: 'multi' };

/**
 * Lab-only: the shared mock stores a round trip with its outbound slice only, while the real
 * `FlightSearchHistoryEntry` carries both. The inbound slice is derived (reverse route, +7 days) so the link is a
 * valid round-trip search; the port uses the entry's own slices.
 */
const LAB_RETURN_DAYS = 7;

function slicesOf(entry: FlightSearchEntry) {
  const slices = entry.slices.map((s) => ({ origin: s.origin.iataCode, destination: s.destination.iataCode, date: s.departureDate }));
  if (entry.tripType === 'ROUND_TRIP' && slices.length === 1) {
    const out = slices[0];
    const back = new Date(Date.parse(`${out.date}T00:00:00Z`) + LAB_RETURN_DAYS * 86_400_000).toISOString().slice(0, 10);
    slices.push({ origin: out.destination, destination: out.origin, date: back });
  }
  return slices;
}

/** Infant ages are only sent when some lap infant is not under 1 (`canonicalInfantAges`, INFANT_AGE = 0). */
function infantAges(ages: number[]): string | null {
  return ages.some((a) => a !== 0) ? ages.join(',') : null;
}

export function searchHref(entry: FlightSearchEntry, locale: 'ar' | 'en'): string {
  const p: [string, string][] = [];
  p.push(['trip', TRIP[entry.tripType]]);
  p.push(['slices', slicesOf(entry).map((s) => `${s.origin}_${s.destination}_${s.date}`).join(',')]);
  const { adults, children, infants } = entry.passengers;
  if (adults !== 1) p.push(['adults', String(adults)]);
  if (children.length) p.push(['children', children.join(',')]);
  if (infants.length) p.push(['infants', String(infants.length)]);
  const ages = infantAges(infants);
  if (ages) p.push(['infantAges', ages]);
  const cabin = entry.cabinClass.toLowerCase();
  if (cabin !== 'economy') p.push(['cabin', cabin]);
  p.push(['cur', (entry.lastSeenPrice?.currency ?? entry.currency).toUpperCase()]);
  // nuqs renders commas and underscores literally; every value here is [A-Z0-9_,-] so no escaping is needed.
  return `/${locale}/flights?${p.map(([k, v]) => `${k}=${v}`).join('&')}`;
}

/** A blank search (curated destinations have no origin or date to pre-fill). */
export function newSearchHref(locale: 'ar' | 'en'): string {
  return `/${locale}/flights`;
}
