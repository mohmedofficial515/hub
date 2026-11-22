import type { Locale } from '@lab/i18n';
import type { FareOption, Itinerary, OfferSort, PassengerType } from '../mock';
import { SEARCH } from '../mock';
import { compareDecimal, intlLocale } from './money';

export type RefundStatus = 'refundable' | 'nonRefundable' | 'unknown';

/** Three states, never a guess: `allowed: null` from the airline stays "unknown" (L-13). */
export function refundStatusOf(fare: FareOption): RefundStatus {
  const { allowed } = fare.conditions.refund;
  if (allowed === null) return 'unknown';
  return allowed ? 'refundable' : 'nonRefundable';
}

export interface Filters {
  stops: number[]; // 0, 1, 2 (2 = two or more)
  refundable: boolean;
  changeable: boolean;
  bagIncluded: boolean;
  airlines: string[];
}

export const NO_FILTERS: Filters = { stops: [], refundable: false, changeable: false, bagIncluded: false, airlines: [] };

export const activeFilterCount = (f: Filters) =>
  f.stops.length + f.airlines.length + Number(f.refundable) + Number(f.changeable) + Number(f.bagIncluded);

/** A fare passes the fare-rule filters (refundable, changeable, bag) on its own. */
function fareMatches(fare: FareOption, f: Filters) {
  if (f.refundable && fare.conditions.refund.allowed !== true) return false;
  if (f.changeable && fare.conditions.change.allowed !== true) return false;
  if (f.bagIncluded && !fare.checkedBaggageIncluded) return false;
  return true;
}

/** The fares of an itinerary that the filters allow. */
export function eligibleFares(it: Itinerary, f: Filters) {
  return it.fares.filter((fare) => fareMatches(fare, f));
}

export function itineraryMatches(it: Itinerary, f: Filters) {
  if (f.airlines.length && !f.airlines.includes(it.owner.iataCode)) return false;
  if (f.stops.length) {
    const worst = Math.min(2, Math.max(...it.slices.map((s) => s.stopsCount)));
    if (!f.stops.includes(worst)) return false;
  }
  return eligibleFares(it, f).length > 0;
}

/** The total the card shows for a fare: with bags priced in when the switch is on and the bag is sold here. */
export function shownTotal(fare: FareOption, withBag: boolean) {
  return withBag && fare.withCheckedBag ? fare.withCheckedBag.total : fare.price.total;
}

/** The fare a card opens on: the cheapest eligible fare (with bags priced in when the switch is on). */
export function defaultFare(it: Itinerary, f: Filters, withBag: boolean): FareOption {
  const fares = eligibleFares(it, f);
  const pool = fares.length ? fares : it.fares;
  return [...pool].sort((a, b) => compareDecimal(shownTotal(a, withBag), shownTotal(b, withBag)))[0];
}

export function sortItineraries(list: Itinerary[], sort: OfferSort) {
  const key = sort === 'price' ? 'price' : sort === 'duration' ? 'durationMinutes' : sort === 'departure' ? 'departureAt' : sort === 'arrival' ? 'arrivalAt' : 'best';
  return [...list].sort((a, b) => a.sortKeys[key] - b.sortKeys[key]);
}

export const clockOf = (local: string) => local.slice(11, 16);

export function dateOf(local: string, locale: Locale) {
  const date = new Date(`${local.slice(0, 10)}T00:00:00Z`);
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date);
}

export function dayOffsetOf(dep: string, arr: string) {
  return Math.round((Date.parse(`${arr.slice(0, 10)}T00:00:00Z`) - Date.parse(`${dep.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

export function durationOf(minutes: number, locale: Locale) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (locale === 'ar') return m ? `${h} س ${m} د` : `${h} س`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "2 × Adult at 1,856.10": passengers of one type that cost the same (the server's unit price, never summed). */
export function typePrices(fare: FareOption) {
  const typeOf = new Map(SEARCH.passengers.map((p) => [p.slotId, p.type]));
  const rows: { type: PassengerType; count: number; unit: string }[] = [];
  for (const line of fare.price.perPassenger) {
    const type = typeOf.get(line.slotId) ?? 'ADULT';
    const row = rows.find((r) => r.type === type && r.unit === line.total);
    if (row) row.count += 1;
    else rows.push({ type, count: 1, unit: line.total });
  }
  return rows;
}
