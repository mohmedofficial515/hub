/**
 * Mock data shaped like the planned API (plan section 7): amounts are decimal STRINGS, never floats.
 *  - `CATALOG`   ~ GET /admin/currencies/display (code, names, abbreviations, decimalDigits, enabled)
 *  - `RATES`     ~ fx_daily_rates (raw provider rate per UTC day, quote currency per 1 USD; `estimated` = no rate that day)
 *  - `DAYS`      ~ stats/timeseries buckets: per day, per source currency: `usd` (frozen at booking time, includes the customer margin)
 *                  and `native` (what the customer paid)
 *  - `TRANSACTIONS` ~ bookings / payments in their own currency, with the frozen `amountUsd`
 * The generators below use floats only to MAKE the fixtures; what they export is strings.
 */
import { decToString, divDec, mulDec, parseDec } from './money-core';

export interface CurrencyInfo {
  code: string;
  nameAr: string;
  nameEn: string;
  /** Plural for the aria label in English. */
  pluralEn: string;
  decimalDigits: number;
  enabled: boolean;
  /** Raw provider rate of the pegged / typical level, for the receipt text. */
  note?: 'pegged';
}

export const CATALOG: CurrencyInfo[] = [
  { code: 'SAR', nameAr: 'ريال سعودي', nameEn: 'Saudi riyal', pluralEn: 'Saudi riyals', decimalDigits: 2, enabled: true, note: 'pegged' },
  { code: 'USD', nameAr: 'دولار أمريكي', nameEn: 'US dollar', pluralEn: 'US dollars', decimalDigits: 2, enabled: true },
  { code: 'AED', nameAr: 'درهم إماراتي', nameEn: 'UAE dirham', pluralEn: 'UAE dirhams', decimalDigits: 2, enabled: true, note: 'pegged' },
  { code: 'TRY', nameAr: 'ليرة تركية', nameEn: 'Turkish lira', pluralEn: 'Turkish liras', decimalDigits: 2, enabled: true },
  { code: 'EUR', nameAr: 'يورو', nameEn: 'Euro', pluralEn: 'euros', decimalDigits: 2, enabled: true },
  { code: 'GBP', nameAr: 'جنيه إسترليني', nameEn: 'Pound sterling', pluralEn: 'pounds sterling', decimalDigits: 2, enabled: true },
  { code: 'KWD', nameAr: 'دينار كويتي', nameEn: 'Kuwaiti dinar', pluralEn: 'Kuwaiti dinars', decimalDigits: 3, enabled: true },
  { code: 'OMR', nameAr: 'ريال عماني', nameEn: 'Omani rial', pluralEn: 'Omani rials', decimalDigits: 3, enabled: true, note: 'pegged' },
  { code: 'JPY', nameAr: 'ين ياباني', nameEn: 'Japanese yen', pluralEn: 'Japanese yen', decimalDigits: 0, enabled: true },
  { code: 'EGP', nameAr: 'جنيه مصري', nameEn: 'Egyptian pound', pluralEn: 'Egyptian pounds', decimalDigits: 2, enabled: true },
];

/** The owner's default display currency (listed first in the switcher). */
export const OWNER_DEFAULT = 'SAR';

export const infoOf = (code: string): CurrencyInfo | undefined => CATALOG.find((c) => c.code === code);

/* ---------------------------------------------------------------- calendar */

export const DAY_COUNT = 30;
/** Last day of the period (UTC). Day 0 = 2026-10-11, day 29 = 2026-11-09. */
const START = Date.UTC(2026, 9, 11);

export interface DayInfo {
  index: number;
  iso: string; // 2026-10-11
  month: number; // 0-11
  day: number;
}
export const DAY_INFO: DayInfo[] = Array.from({ length: DAY_COUNT }, (_, index) => {
  const d = new Date(START + index * 86400000);
  return { index, iso: d.toISOString().slice(0, 10), month: d.getUTCMonth(), day: d.getUTCDate() };
});

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/** "11 Oct" / "11 أكتوبر" with Latin digits (no Intl). */
export function dayLabel(index: number, locale: 'ar' | 'en'): string {
  const d = DAY_INFO[index];
  return `${d.day} ${(locale === 'ar' ? MONTHS_AR : MONTHS_EN)[d.month]}`;
}

/* ---------------------------------------------------------------- rates */

export interface DayRate {
  rate: string;
  estimated: boolean;
}

function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Days that have no rate of their own: the previous day's rate is carried and the day is flagged `estimated` (plan 7.2). */
const ESTIMATED: Record<string, number[]> = { TRY: [12, 13], EGP: [4] };

function series(code: string, from: number, to: number, digits: number, wiggle: number, seed: number): DayRate[] {
  const rnd = seeded(seed);
  let last = '';
  return DAY_INFO.map(({ index }) => {
    const estimated = (ESTIMATED[code] ?? []).includes(index);
    if (estimated && last) return { rate: last, estimated };
    const base = from + ((to - from) * index) / (DAY_COUNT - 1);
    const value = base + (rnd() - 0.5) * wiggle;
    last = value.toFixed(digits);
    return { rate: last, estimated };
  });
}

const flat = (rate: string, code: string): DayRate[] => DAY_INFO.map(({ index }) => ({ rate, estimated: (ESTIMATED[code] ?? []).includes(index) }));

/** Quote currency per 1 USD, raw provider rate (no customer margin). */
export const RATES: Record<string, DayRate[]> = {
  USD: flat('1', 'USD'),
  SAR: flat('3.75', 'SAR'), // pegged
  AED: flat('3.6725', 'AED'), // pegged
  OMR: flat('0.3845', 'OMR'), // pegged
  TRY: series('TRY', 33.1, 35.2, 4, 0.06, 11),
  EUR: series('EUR', 0.9215, 0.9302, 4, 0.004, 12),
  GBP: series('GBP', 0.7692, 0.7811, 4, 0.004, 13),
  KWD: series('KWD', 0.3062, 0.3068, 4, 0.0006, 14),
  JPY: series('JPY', 151.2, 154.4, 2, 0.8, 15),
  EGP: series('EGP', 48.2, 49.1, 4, 0.08, 16),
};

export const rateOf = (code: string, day: number): DayRate => (RATES[code] ?? RATES.USD)[day];

/** Customer rate = raw rate + this margin. The frozen `usd` of a booking is native / customer rate, so converting it back at the raw rate is slightly lower. */
const CUSTOMER_MARGIN = 1.012;

/* ---------------------------------------------------------------- daily aggregate rows */

export interface DayRow {
  currency: string;
  usd: string;
  native: string;
  count: number;
}
export interface DayBucket {
  index: number;
  gross: DayRow[];
  refunds: DayRow[];
}

const SHARES: [string, number, number][] = [
  // code, share of gross, average order in USD
  ['USD', 0.31, 940],
  ['SAR', 0.29, 610],
  ['AED', 0.12, 720],
  ['TRY', 0.09, 480],
  ['EUR', 0.06, 880],
  ['GBP', 0.04, 1020],
  ['KWD', 0.03, 1260],
  ['JPY', 0.03, 1100],
  ['EGP', 0.03, 350],
];

function makeRow(code: string, usd: number, day: number, avg: number, rnd: () => number): DayRow | null {
  if (usd < 1) return null;
  const digits = infoOf(code)?.decimalDigits ?? 2;
  const raw = Number(rateOf(code, day).rate);
  const native = code === 'USD' ? usd : usd * raw * CUSTOMER_MARGIN;
  return {
    currency: code,
    usd: usd.toFixed(2),
    native: native.toFixed(digits),
    count: Math.max(1, Math.round(usd / (avg * (0.8 + rnd() * 0.4)))),
  };
}

export const DAYS: DayBucket[] = (() => {
  const rnd = seeded(2026);
  return DAY_INFO.map(({ index }) => {
    const weekday = (index + 6) % 7; // 0 = Sunday-ish pattern
    const weekend = weekday === 5 || weekday === 6 ? 0.78 : 1;
    const trend = 1 + index * 0.012;
    const gross = Math.round((270000 + rnd() * 90000) * weekend * trend);
    const rows: DayRow[] = [];
    const refunds: DayRow[] = [];
    for (const [code, share, avg] of SHARES) {
      const usd = Math.round(gross * share * (0.9 + rnd() * 0.2) * 100) / 100;
      const r = makeRow(code, usd, index, avg, rnd);
      if (r) rows.push(r);
      const rf = makeRow(code, Math.round(usd * (0.025 + rnd() * 0.035) * 100) / 100, index, avg, rnd);
      if (rf) refunds.push(rf);
    }
    return { index, gross: rows, refunds };
  });
})();

/* ---------------------------------------------------------------- transactions */

export type TxStatus = 'paid' | 'partial' | 'refunded' | 'pending';
export interface Transaction {
  id: string;
  ref: string;
  routeAr: string;
  routeEn: string;
  customerAr: string;
  customerEn: string;
  status: TxStatus;
  /** Day index of the booking (the rate day). */
  day: number;
  amount: string;
  currency: string;
  /** Frozen at booking time, USD. */
  amountUsd: string;
  amountPaid: string;
  amountRefunded: string;
  supplierCostUsd: string;
  marginUsd: string;
  walletAppliedUsd: string;
  discountUsd: string;
}

interface TxSeed {
  ref: string;
  routeAr: string;
  routeEn: string;
  customerAr: string;
  customerEn: string;
  status: TxStatus;
  day: number;
  amount: string;
  currency: string;
  refunded?: string;
  page: 1 | 2;
}

const SEEDS: TxSeed[] = [
  { ref: 'GT-48213', routeAr: 'الرياض - إسطنبول', routeEn: 'Riyadh - Istanbul', customerAr: 'شركة الأفق للسفر', customerEn: 'Al Ofoq Travel', status: 'paid', day: 27, amount: '4250000.00', currency: 'TRY', page: 1 },
  { ref: 'GT-48190', routeAr: 'جدة - طوكيو', routeEn: 'Jeddah - Tokyo', customerAr: 'مجموعة الندى', customerEn: 'Al Nada Group', status: 'paid', day: 25, amount: '18750000', currency: 'JPY', page: 1 },
  { ref: 'GT-48177', routeAr: 'الكويت - لندن', routeEn: 'Kuwait - London', customerAr: 'خالد المطيري', customerEn: 'Khaled Al Mutairi', status: 'paid', day: 24, amount: '1234.567', currency: 'KWD', page: 1 },
  { ref: 'GT-48166', routeAr: 'الرياض - دبي', routeEn: 'Riyadh - Dubai', customerAr: 'سارة القحطاني', customerEn: 'Sara Al Qahtani', status: 'partial', day: 28, amount: '1250.00', currency: 'SAR', refunded: '250.00', page: 1 },
  { ref: 'GT-48151', routeAr: 'دبي - باريس', routeEn: 'Dubai - Paris', customerAr: 'رحلات الخليج', customerEn: 'Gulf Journeys', status: 'paid', day: 22, amount: '4687.50', currency: 'AED', page: 1 },
  { ref: 'GT-48140', routeAr: 'القاهرة - جدة', routeEn: 'Cairo - Jeddah', customerAr: 'مها عبدالله', customerEn: 'Maha Abdullah', status: 'pending', day: 29, amount: '215000.00', currency: 'EGP', page: 1 },
  { ref: 'GT-48122', routeAr: 'الدمام - مانشستر', routeEn: 'Dammam - Manchester', customerAr: 'ياسر الحربي', customerEn: 'Yasser Al Harbi', status: 'paid', day: 19, amount: '8420.00', currency: 'GBP', page: 1 },
  { ref: 'GT-48109', routeAr: 'جدة - نيويورك', routeEn: 'Jeddah - New York', customerAr: 'شركة المسار', customerEn: 'Al Masar Co.', status: 'paid', day: 26, amount: '12450.75', currency: 'USD', page: 1 },
  { ref: 'GT-48098', routeAr: 'الرياض - فرانكفورت', routeEn: 'Riyadh - Frankfurt', customerAr: 'نورة السبيعي', customerEn: 'Noura Al Subaie', status: 'refunded', day: 21, amount: '3180.40', currency: 'EUR', refunded: '3180.40', page: 1 },
  { ref: 'GT-48087', routeAr: 'جدة - الرياض', routeEn: 'Jeddah - Riyadh', customerAr: 'عبدالعزيز الشهري', customerEn: 'Abdulaziz Al Shehri', status: 'paid', day: 29, amount: '845.00', currency: 'SAR', page: 2 },
  { ref: 'GT-48074', routeAr: 'مسقط - دبي', routeEn: 'Muscat - Dubai', customerAr: 'سالم البلوشي', customerEn: 'Salem Al Balushi', status: 'paid', day: 23, amount: '212.350', currency: 'OMR', page: 2 },
  { ref: 'GT-48060', routeAr: 'إسطنبول - القاهرة', routeEn: 'Istanbul - Cairo', customerAr: 'ليلى حسن', customerEn: 'Layla Hassan', status: 'paid', day: 20, amount: '38900.00', currency: 'TRY', page: 2 },
  { ref: 'GT-48049', routeAr: 'الرياض - لندن', routeEn: 'Riyadh - London', customerAr: 'فهد الدوسري', customerEn: 'Fahad Al Dosari', status: 'paid', day: 18, amount: '2.00', currency: 'USD', page: 2 },
];

const dec = (s: string) => parseDec(s)!;

/** usd frozen at booking time = native / (raw rate x (1 + margin)). */
function frozenUsd(amount: string, currency: string, day: number): string {
  if (currency === 'USD') return amount;
  const rate = mulDec(dec(rateOf(currency, day).rate), dec(CUSTOMER_MARGIN.toFixed(3)));
  return decToString(divDec(dec(amount), rate, 4)!, 4);
}

export const TRANSACTIONS: (Transaction & { page: 1 | 2 })[] = SEEDS.map((s, i) => {
  const usd = frozenUsd(s.amount, s.currency, s.day);
  const refunded = s.refunded ?? '0.00';
  const paid = s.status === 'pending' ? '0.00' : s.amount;
  const supplier = decToString(mulDec(dec(usd), dec('0.9400')), 4);
  const margin = decToString(mulDec(dec(usd), dec('0.0600')), 4);
  return {
    id: `tx-${i + 1}`,
    ref: s.ref,
    routeAr: s.routeAr,
    routeEn: s.routeEn,
    customerAr: s.customerAr,
    customerEn: s.customerEn,
    status: s.status,
    day: s.day,
    amount: s.amount,
    currency: s.currency,
    amountUsd: usd,
    amountPaid: paid,
    amountRefunded: refunded,
    supplierCostUsd: supplier,
    marginUsd: margin,
    walletAppliedUsd: i % 3 === 0 ? '45.0000' : '0.0000',
    discountUsd: i % 2 === 0 ? '12.5000' : '0.0000',
    page: s.page,
  };
});

/* ---------------------------------------------------------------- balances (always USD, D7) */

export const BALANCES = {
  /** Duffel supplier balance. */
  supplierUsd: '184250.7500',
  /** Accounts receivable. */
  receivableUsd: '1258400.0000',
};
