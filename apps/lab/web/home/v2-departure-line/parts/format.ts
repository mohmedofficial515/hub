/**
 * Dates, money and the results link. Digits are Latin in every locale (references.md 5.3), dates are ISO
 * `YYYY-MM-DD` strings so nothing shifts with the time zone.
 */
import type { Locale } from '@lab/i18n';
import type { Airport } from './mocks';

export type TripType = 'oneWay' | 'roundTrip' | 'multiCity';
export type CabinParam = 'economy' | 'premium_economy' | 'business' | 'first';

const tag = (locale: Locale) => (locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

/** "16 Dec" / "16 ديسمبر" */
export function shortDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(parseIso(iso));
}

/** The field value: the day large, then "Dec, Wed" / "ديسمبر، الأربعاء" */
export function fieldDate(iso: string, locale: Locale): { day: string; rest: string } {
  const d = parseIso(iso);
  return {
    day: new Intl.DateTimeFormat(tag(locale), { day: 'numeric', timeZone: 'UTC' }).format(d),
    rest: [
      new Intl.DateTimeFormat(tag(locale), { month: 'short', timeZone: 'UTC' }).format(d),
      new Intl.DateTimeFormat(tag(locale), { weekday: 'short', timeZone: 'UTC' }).format(d),
    ].join(locale === 'ar' ? '، ' : ', '),
  };
}

export function longDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseIso(iso));
}

export function monthTitle(year: number, month: number, locale: Locale): string {
  return new Intl.DateTimeFormat(tag(locale), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month, 1)),
  );
}

export function weekdayNames(locale: Locale): string[] {
  // Saturday first in Arabic (the Gulf and Egypt week), Monday first in English.
  const start = locale === 'ar' ? 6 : 1;
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(tag(locale), { weekday: 'narrow', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, 10, 1 + ((start + i) % 7))), // 2026-11-01 is a Sunday
    ),
  );
}

export function weekStart(locale: Locale): number {
  return locale === 'ar' ? 6 : 1;
}

/** "$221.15" — the amount stays a decimal string; only grouping is added. */
export function money(amount: string, currency: string): string {
  const [int, frac = '00'] = amount.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const symbol = currency === 'USD' ? '$' : `${currency} `;
  return `${symbol}${grouped}.${frac.padEnd(2, '0').slice(0, 2)}`;
}

/** -1 cheaper, 0 same, 1 dearer, compared as cents so no float is involved. */
export function trend(now: string, last: string): -1 | 0 | 1 {
  const cents = (s: string) => {
    const [i, f = '0'] = s.split('.');
    return BigInt(i) * 100n + BigInt(f.padEnd(2, '0').slice(0, 2));
  };
  const a = cents(now);
  const b = cents(last);
  return a < b ? -1 : a > b ? 1 : 0;
}

/* ---------------- the search criteria and the results link ---------------- */

export interface Leg {
  id: number;
  from: Airport | null;
  to: Airport | null;
  date: string | null;
}

export interface Party {
  adults: number;
  childAges: Array<number | null>;
  infantAges: number[];
  cabin: CabinParam;
}

export type Incomplete = 'origin' | 'destination' | 'sameAirport' | 'dates' | 'returnDate' | 'childAges' | 'dateOrder';

export interface Criteria {
  trip: TripType;
  legs: Leg[];
  returnDate: string | null;
  party: Party;
}

/** The checks `criteriaFromForm` makes (`features/flights/modify-bar/form.ts`), first failing one wins. */
export function incomplete(c: Criteria): { reason: Incomplete; field: string } | null {
  const legs = c.trip === 'multiCity' ? c.legs : c.legs.slice(0, 1);
  for (const leg of legs) {
    if (!leg.from) return { reason: 'origin', field: `from-${leg.id}` };
    if (!leg.to) return { reason: 'destination', field: `to-${leg.id}` };
    if (leg.from.code === leg.to.code) return { reason: 'sameAirport', field: `to-${leg.id}` };
    if (!leg.date) return { reason: 'dates', field: `date-${leg.id}` };
  }
  if (c.trip === 'roundTrip' && !c.returnDate) return { reason: 'returnDate', field: 'return' };
  for (let i = 1; i < legs.length; i++) {
    if (legs[i].date! < legs[i - 1].date!) return { reason: 'dateOrder', field: `date-${legs[i].id}` };
  }
  if (c.party.childAges.some((a) => a === null)) return { reason: 'childAges', field: 'party' };
  return null;
}

const TRIP: Record<TripType, string> = { oneWay: 'oneway', roundTrip: 'round', multiCity: 'multi' };

/**
 * `/{locale}/flights?trip=round&slices=CAI_DXB_2026-12-16,DXB_CAI_2026-12-23&adults=2&children=7&cabin=business&cur=USD`
 * (`features/flights/search/url-state.ts`; defaults are left out as nuqs `clearOnDefault` does).
 */
export function resultsHref(c: Criteria, locale: Locale, currency = 'USD'): string {
  const legs = c.trip === 'multiCity' ? c.legs : c.legs.slice(0, 1);
  const slices = legs.map((l) => `${l.from!.code}_${l.to!.code}_${l.date}`);
  if (c.trip === 'roundTrip') {
    const first = legs[0];
    slices.push(`${first.to!.code}_${first.from!.code}_${c.returnDate}`);
  }
  const p = new URLSearchParams();
  p.set('trip', TRIP[c.trip]);
  p.set('slices', slices.join(','));
  if (c.party.adults !== 1) p.set('adults', String(c.party.adults));
  if (c.party.childAges.length) p.set('children', c.party.childAges.join(','));
  if (c.party.infantAges.length) {
    p.set('infants', String(c.party.infantAges.length));
    p.set('infantAges', c.party.infantAges.join(','));
  }
  if (c.party.cabin !== 'economy') p.set('cabin', c.party.cabin);
  p.set('cur', currency);
  return `/${locale}/flights?${p.toString().replaceAll('%2C', ',')}`;
}
