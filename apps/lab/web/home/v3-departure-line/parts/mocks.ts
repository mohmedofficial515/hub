/**
 * Version-local fixtures, shaped like the real models so a port swaps the import for the real hook:
 * - `Airport` = `src/components/shared/airport-picker/airport-api.ts` (the six "popular airports" the real picker
 *   shows first, audit shot 02).
 * - `HistoryEntry` = `FlightSearchHistoryEntryDto` (`/users/me/flight-searches`), with the fare-calendar price of
 *   today next to it (`now`), as `features/flights/history/recent-searches.tsx` shows.
 * - `contacts` = the platform settings `supportPhone` / `supportEmail` (`useSiteContacts`). Placeholder values.
 *
 * Scenarios (`#…?scenario=`): default · empty (first visit: no recent searches, no support phone set) ·
 * loading (recent searches still loading) · error (flight search in maintenance, `MaintenanceAreaGate`) ·
 * long (account history with 5 entries and long names).
 */
import type { Locale } from '@lab/i18n';

export interface Airport {
  code: string;
  city: string;
  name: string;
  country: string;
  kind?: 'airport' | 'city';
}

type Named = Record<Locale, Airport>;

const AIRPORTS: Named[] = [
  {
    ar: { code: 'CAI', city: 'القاهرة', name: 'مطار القاهرة الدولي', country: 'مصر', kind: 'airport' },
    en: { code: 'CAI', city: 'Cairo', name: 'Cairo International', country: 'Egypt', kind: 'airport' },
  },
  {
    ar: { code: 'HBE', city: 'الإسكندرية', name: 'مطار برج العرب', country: 'مصر', kind: 'airport' },
    en: { code: 'HBE', city: 'Alexandria', name: 'Borg El Arab', country: 'Egypt', kind: 'airport' },
  },
  {
    ar: { code: 'HMB', city: 'سوهاج', name: 'مطار سوهاج الدولي', country: 'مصر', kind: 'airport' },
    en: { code: 'HMB', city: 'Sohag', name: 'Sohag International', country: 'Egypt', kind: 'airport' },
  },
  {
    ar: { code: 'KWI', city: 'مدينة الكويت', name: 'مطار الكويت الدولي', country: 'الكويت', kind: 'airport' },
    en: { code: 'KWI', city: 'Kuwait City', name: 'Kuwait International', country: 'Kuwait', kind: 'airport' },
  },
  {
    ar: { code: 'DXB', city: 'دبي', name: 'مطار دبي الدولي', country: 'الإمارات', kind: 'airport' },
    en: { code: 'DXB', city: 'Dubai', name: 'Dubai International', country: 'United Arab Emirates', kind: 'airport' },
  },
  {
    ar: { code: 'JED', city: 'جدة', name: 'مطار الملك عبدالعزيز الدولي', country: 'السعودية', kind: 'airport' },
    en: { code: 'JED', city: 'Jeddah', name: 'King Abdulaziz International', country: 'Saudi Arabia', kind: 'airport' },
  },
  {
    ar: { code: 'RUH', city: 'الرياض', name: 'مطار الملك خالد الدولي', country: 'السعودية', kind: 'airport' },
    en: { code: 'RUH', city: 'Riyadh', name: 'King Khalid International', country: 'Saudi Arabia', kind: 'airport' },
  },
  {
    ar: { code: 'IST', city: 'إسطنبول', name: 'مطار إسطنبول', country: 'تركيا', kind: 'airport' },
    en: { code: 'IST', city: 'Istanbul', name: 'Istanbul Airport', country: 'Türkiye', kind: 'airport' },
  },
  {
    ar: { code: 'SAW', city: 'إسطنبول', name: 'مطار صبيحة كوكجن الدولي', country: 'تركيا', kind: 'airport' },
    en: { code: 'SAW', city: 'Istanbul', name: 'Sabiha Gökçen International', country: 'Türkiye', kind: 'airport' },
  },
  {
    ar: { code: 'LON', city: 'لندن', name: 'لندن (كل المطارات)', country: 'المملكة المتحدة', kind: 'city' },
    en: { code: 'LON', city: 'London', name: 'London (all airports)', country: 'United Kingdom', kind: 'city' },
  },
  {
    ar: { code: 'AMM', city: 'عمّان', name: 'مطار الملكة علياء الدولي', country: 'الأردن', kind: 'airport' },
    en: { code: 'AMM', city: 'Amman', name: 'Queen Alia International', country: 'Jordan', kind: 'airport' },
  },
];

/** The first six are what the real picker lists before anything is typed. */
export const POPULAR = ['CAI', 'HBE', 'HMB', 'KWI', 'DXB', 'JED'];

export function airports(locale: Locale): Airport[] {
  return AIRPORTS.map((a) => a[locale]);
}

export function airportByCode(code: string, locale: Locale): Airport | undefined {
  return AIRPORTS.find((a) => a.en.code === code)?.[locale];
}

/** Matches the IATA code, city, airport name or country, in either language (the real API does the same). */
export function searchAirports(query: string, locale: Locale): Airport[] {
  const q = query.trim().toLowerCase();
  if (!q) return POPULAR.map((code) => airportByCode(code, locale)!);
  return AIRPORTS.filter((a) =>
    [a.en, a.ar].some((x) => [x.code, x.city, x.name, x.country].some((v) => v.toLowerCase().includes(q))),
  ).map((a) => a[locale]);
}

/* ---------------- search history ---------------- */

type Cabin = 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';

export interface HistorySlice {
  departureDate: string;
  origin: { iataCode: string; cityName: string | null; name: string | null };
  destination: { iataCode: string; cityName: string | null; name: string | null };
}

export interface HistoryEntry {
  id: string;
  cabinClass: Cabin;
  currency: string;
  departed: boolean;
  lastSeenPrice: { amount: string; currency: string } | null;
  maxConnections: number | null;
  passengers: { adults: number; children: number[]; infants: number[] };
  searchedAt: string;
  slices: HistorySlice[];
  /** Lab only: today's cheapest day price from the fare calendar, as the real row asks for it. */
  now: { amount: string; currency: string } | null;
}

function slice(from: string, to: string, date: string, locale: Locale): HistorySlice {
  const o = airportByCode(from, locale)!;
  const d = airportByCode(to, locale)!;
  return {
    departureDate: date,
    origin: { iataCode: o.code, cityName: o.city, name: o.name },
    destination: { iataCode: d.code, cityName: d.city, name: d.name },
  };
}

function history(locale: Locale, long: boolean): HistoryEntry[] {
  const base: HistoryEntry[] = [
    {
      id: 'fsh_01JD8Q2K4M',
      cabinClass: 'ECONOMY',
      currency: 'USD',
      departed: false,
      lastSeenPrice: { amount: '238.40', currency: 'USD' },
      maxConnections: null,
      passengers: { adults: 1, children: [], infants: [] },
      searchedAt: '2026-11-19T18:42:00Z',
      slices: [slice('CAI', 'DXB', '2026-12-16', locale), slice('DXB', 'CAI', '2026-12-23', locale)],
      now: { amount: '221.15', currency: 'USD' },
    },
    {
      id: 'fsh_01JD6Y7T0B',
      cabinClass: 'ECONOMY',
      currency: 'USD',
      departed: false,
      lastSeenPrice: { amount: '96.70', currency: 'USD' },
      maxConnections: 0,
      passengers: { adults: 2, children: [7], infants: [] },
      searchedAt: '2026-11-17T09:05:00Z',
      slices: [slice('IST', 'AMM', '2026-12-04', locale)],
      now: { amount: '104.30', currency: 'USD' },
    },
    {
      id: 'fsh_01JD2H9C3P',
      cabinClass: 'BUSINESS',
      currency: 'USD',
      departed: false,
      lastSeenPrice: null,
      maxConnections: null,
      passengers: { adults: 1, children: [], infants: [] },
      searchedAt: '2026-11-12T21:10:00Z',
      slices: [slice('JED', 'LON', '2027-01-08', locale)],
      now: null,
    },
  ];
  if (!long) return base;
  return [
    ...base,
    {
      id: 'fsh_01JCZ0R5WQ',
      cabinClass: 'PREMIUM_ECONOMY',
      currency: 'USD',
      departed: false,
      lastSeenPrice: { amount: '412.00', currency: 'USD' },
      maxConnections: 1,
      passengers: { adults: 2, children: [11, 4], infants: [0] },
      searchedAt: '2026-11-08T07:30:00Z',
      slices: [
        slice('HMB', 'KWI', '2026-12-20', locale),
        slice('KWI', 'RUH', '2026-12-27', locale),
        slice('RUH', 'HMB', '2027-01-03', locale),
      ],
      now: null,
    },
    {
      id: 'fsh_01JCX4N8EE',
      cabinClass: 'ECONOMY',
      currency: 'USD',
      departed: false,
      lastSeenPrice: { amount: '57.90', currency: 'USD' },
      maxConnections: null,
      passengers: { adults: 1, children: [], infants: [] },
      searchedAt: '2026-11-02T13:00:00Z',
      slices: [slice('HBE', 'SAW', '2026-12-11', locale)],
      now: { amount: '57.90', currency: 'USD' },
    },
  ];
}

/* ---------------- scenarios ---------------- */

export type Scenario = 'default' | 'empty' | 'loading' | 'error' | 'long';

export function scenarioFromHash(): Scenario {
  const query = location.hash.split('?')[1] ?? '';
  const s = new URLSearchParams(query).get('scenario');
  return s === 'empty' || s === 'loading' || s === 'error' || s === 'long' ? s : 'default';
}

export interface HomeData {
  /** `account`: signed in, history from the server; `device`: a visitor, history from this browser. */
  historySource: 'account' | 'device' | null;
  history: HistoryEntry[] | 'loading';
  contacts: { supportPhone: string | null; supportEmail: string | null };
  flightSearchInMaintenance: boolean;
  /** The sandbox deployment shows its banner (DEPLOY_MODE=sandbox). */
  sandbox: boolean;
}

export function homeScenario(scenario: Scenario, locale: Locale): HomeData {
  const contacts = { supportPhone: '+90 850 000 00 00', supportEmail: 'support@goteav.com' };
  switch (scenario) {
    case 'empty':
      return { historySource: null, history: [], contacts: { supportPhone: null, supportEmail: 'support@goteav.com' }, flightSearchInMaintenance: false, sandbox: true };
    case 'loading':
      return { historySource: 'device', history: 'loading', contacts, flightSearchInMaintenance: false, sandbox: true };
    case 'error':
      return { historySource: 'device', history: history(locale, false), contacts, flightSearchInMaintenance: true, sandbox: true };
    case 'long':
      return { historySource: 'account', history: history(locale, true), contacts, flightSearchInMaintenance: false, sandbox: true };
    default:
      return { historySource: 'device', history: history(locale, false), contacts, flightSearchInMaintenance: false, sandbox: true };
  }
}

/** A fixed "today" so the calendar and the history are deterministic in screenshots. */
export const TODAY = '2026-11-21';
