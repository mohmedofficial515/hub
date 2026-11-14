/**
 * Mock data shaped like the API: every amount and every rate is a DECIMAL STRING, never a float.
 * Generated here only because 30 days x 6 currencies is too long to type; the generator uses numbers once,
 * at module load, and immediately turns them into strings. Display code never touches a float.
 */
import { SIGN_PATHS } from './sign-paths';
import { decToFixed, minorDigits, parseDec, divDec, mulDec } from './money-core';

export interface CurrencyMeta {
  code: string;
  names: { ar: string; en: string };
  /** Text glyph the code is commonly shown with; two enabled currencies sharing it make it ambiguous. */
  glyph: string;
  enabled: boolean;
  /** Owner default (setting `dashboard.defaultDisplayCurrency`). */
  isDefault?: boolean;
}

export const CATALOG: CurrencyMeta[] = [
  { code: 'SAR', names: { ar: 'ريال سعودي', en: 'Saudi riyal' }, glyph: '⃁', enabled: true, isDefault: true },
  { code: 'USD', names: { ar: 'دولار أمريكي', en: 'US dollar' }, glyph: '$', enabled: true },
  { code: 'AED', names: { ar: 'درهم إماراتي', en: 'UAE dirham' }, glyph: 'د.إ', enabled: true },
  { code: 'EUR', names: { ar: 'يورو', en: 'Euro' }, glyph: '€', enabled: true },
  { code: 'GBP', names: { ar: 'جنيه إسترليني', en: 'Pound sterling' }, glyph: '£', enabled: true },
  { code: 'KWD', names: { ar: 'دينار كويتي', en: 'Kuwaiti dinar' }, glyph: 'د.ك', enabled: true },
  { code: 'TRY', names: { ar: 'ليرة تركية', en: 'Turkish lira' }, glyph: '₺', enabled: true },
  { code: 'JPY', names: { ar: 'ين ياباني', en: 'Japanese yen' }, glyph: '¥', enabled: true },
  { code: 'EGP', names: { ar: 'جنيه مصري', en: 'Egyptian pound' }, glyph: 'E£', enabled: true },
  { code: 'CAD', names: { ar: 'دولار كندي', en: 'Canadian dollar' }, glyph: '$', enabled: true },
];
export const hasOfficialSign = (code: string): boolean => code in SIGN_PATHS;
export const DEFAULT_CURRENCY = 'SAR';

/* ---------------------------------------------------------------- rates (units of currency per 1 USD) */

export const DAYS: string[] = (() => {
  const out: string[] = [];
  const start = Date.UTC(2026, 9, 11);
  for (let i = 0; i < 30; i += 1) out.push(new Date(start + i * 86400000).toISOString().slice(0, 10));
  return out;
})();

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DayRate {
  date: string;
  /** Decimal string, or null when the provider had no rate that day (the day is then "estimated"). */
  rate: string | null;
}

const RATE_SPEC: Record<string, { from: number; to: number; wobble: number; dp: number; missing?: number[] }> = {
  SAR: { from: 3.75, to: 3.75, wobble: 0, dp: 4 },
  AED: { from: 3.6725, to: 3.6725, wobble: 0, dp: 4 },
  EUR: { from: 0.9215, to: 0.9302, wobble: 0.004, dp: 4 },
  GBP: { from: 0.7712, to: 0.7788, wobble: 0.003, dp: 4 },
  KWD: { from: 0.3062, to: 0.3068, wobble: 0.0004, dp: 4 },
  TRY: { from: 33.02, to: 35.1, wobble: 0.12, dp: 4, missing: [14, 15] },
  JPY: { from: 148.2, to: 152.6, wobble: 0.7, dp: 2 },
  EGP: { from: 48.45, to: 49.4, wobble: 0.15, dp: 4, missing: [9] },
  CAD: { from: 1.378, to: 1.391, wobble: 0.004, dp: 4 },
};

export const RATES: Record<string, DayRate[]> = (() => {
  const out: Record<string, DayRate[]> = { USD: DAYS.map((date) => ({ date, rate: '1' })) };
  Object.entries(RATE_SPEC).forEach(([code, spec], k) => {
    const r = rng(1000 + k);
    out[code] = DAYS.map((date, i) => {
      if (spec.missing?.includes(i)) return { date, rate: null };
      const v = spec.from + ((spec.to - spec.from) * i) / (DAYS.length - 1) + (r() - 0.5) * 2 * spec.wobble;
      return { date, rate: v.toFixed(spec.dp) };
    });
  });
  return out;
})();

/* ---------------------------------------------------------------- aggregate series (reporting basis: USD) */

export interface SeriesPart {
  /** Currency the customers paid in. */
  cur: string;
  usd: string;
  /** What was actually charged, in that currency (includes the customer margin for non-pegged ones). */
  native: string;
}
export interface SeriesDay {
  date: string;
  bookings: number;
  gross: SeriesPart[];
  refunds: SeriesPart[];
}

const MIX: Array<[string, number, number]> = [
  // currency, share of the day's USD, customer margin on top of the raw rate
  ['USD', 0.42, 0],
  ['SAR', 0.26, 0],
  ['TRY', 0.12, 0.018],
  ['EUR', 0.08, 0.012],
  ['KWD', 0.07, 0.01],
  ['JPY', 0.05, 0.015],
];

export const SERIES: SeriesDay[] = (() => {
  const r = rng(77);
  return DAYS.map((date, i) => {
    const base = 330000 + 120000 * Math.sin(i / 3.2) + i * 4200 + r() * 60000;
    const make = (total: number): SeriesPart[] =>
      MIX.map(([cur, share, margin]) => {
        const usd = Math.round(total * share * (0.92 + r() * 0.16) * 100) / 100;
        const day = RATES[cur][i].rate ?? RATES[cur][i - 1].rate ?? '1';
        const nativeDec = mulDec(parseDec(usd.toFixed(2)), parseDec((Number(day) * (1 + margin)).toFixed(6)));
        return { cur, usd: usd.toFixed(2), native: decToFixed(nativeDec, minorDigits(cur)) };
      });
    return { date, bookings: 90 + Math.round(r() * 70), gross: make(base), refunds: make(base * 0.035) };
  });
})();

/** Balances stay in USD (decision D7). */
export const BALANCES = {
  receivableUsd: '1842650.40',
  walletsUsd: '9876543.21',
  duffelUsd: '412880.05',
};

export interface RankItem {
  id: string;
  name: { ar: string; en: string };
  usd: string;
}
export const RANKING: RankItem[] = [
  { id: 'ruh', name: { ar: 'الرياض', en: 'Riyadh' }, usd: '3184220.75' },
  { id: 'ist', name: { ar: 'إسطنبول', en: 'Istanbul' }, usd: '2410980.10' },
  { id: 'dxb', name: { ar: 'دبي', en: 'Dubai' }, usd: '1976430.00' },
  { id: 'cai', name: { ar: 'القاهرة', en: 'Cairo' }, usd: '812650.90' },
  { id: 'lon', name: { ar: 'لندن', en: 'London' }, usd: '9420.30' },
];

/* ---------------------------------------------------------------- transactions in their own currency */

export type TxStatus = 'confirmed' | 'partial' | 'refunded' | 'pending';
export interface Tx {
  id: string;
  ref: string;
  customer: { ar: string; en: string };
  route: string;
  /** Day of the booking: the day whose rate converts it. */
  date: string;
  currency: string;
  total: string;
  paid: string;
  /** The customer rate frozen on the booking (units per USD, margin included). */
  fxRate: string;
  status: TxStatus;
}
const tx = (
  n: number,
  ref: string,
  cu: [string, string],
  route: string,
  dayIdx: number,
  currency: string,
  total: string,
  paid: string,
  fxRate: string,
  status: TxStatus,
): Tx => ({
  id: `tx${n}`,
  ref,
  customer: { ar: cu[0], en: cu[1] },
  route,
  date: DAYS[dayIdx],
  currency,
  total,
  paid,
  fxRate,
  status,
});
export const TXS: Tx[] = [
  tx(1, 'GT-48213', ['سارة العتيبي', 'Sara Al-Otaibi'], 'RUH - JED', 28, 'SAR', '1250.00', '1250.00', '3.7500', 'confirmed'),
  tx(2, 'GT-48214', ['Michael Brown', 'Michael Brown'], 'LHR - JFK', 28, 'USD', '12450.75', '12450.75', '1', 'confirmed'),
  tx(3, 'GT-48215', ['محمد يلماز', 'Mehmet Yilmaz'], 'IST - RUH', 27, 'TRY', '4250000.00', '2000000.00', '34.8400', 'partial'),
  tx(4, 'GT-48216', ['كينجي تاناكا', 'Kenji Tanaka'], 'NRT - DXB', 26, 'JPY', '18750000', '18750000', '151.9000', 'confirmed'),
  tx(5, 'GT-48217', ['فهد المطيري', 'Fahad Al-Mutairi'], 'KWI - LHR', 25, 'KWD', '1234.567', '1234.567', '0.3095', 'confirmed'),
  tx(6, 'GT-48218', ['Claire Dubois', 'Claire Dubois'], 'CDG - RUH', 25, 'EUR', '8990.40', '0.00', '0.9380', 'pending'),
  tx(7, 'GT-48219', ['نورة السالم', 'Noura Al-Salem'], 'DXB - CAI', 24, 'AED', '15300.00', '15300.00', '3.6725', 'confirmed'),
  tx(8, 'GT-48220', ['James Carter', 'James Carter'], 'LGW - DXB', 23, 'GBP', '2780.10', '2780.10', '0.7851', 'refunded'),
  tx(9, 'GT-48221', ['شركة الأفق', 'Al-Ofoq Co.'], 'RUH - IST', 22, 'SAR', '89000.00', '89000.00', '3.7500', 'confirmed'),
  tx(10, 'GT-48222', ['أحمد حسن', 'Ahmed Hassan'], 'CAI - JED', 21, 'EGP', '245000.00', '120000.00', '49.5600', 'partial'),
  tx(11, 'GT-48223', ['Lena Fischer', 'Lena Fischer'], 'FRA - JFK', 20, 'USD', '480.00', '480.00', '1', 'confirmed'),
  tx(12, 'GT-48224', ['ياسر القحطاني', 'Yasser Al-Qahtani'], 'JED - MED', 20, 'SAR', '999.00', '999.00', '3.7500', 'confirmed'),
];
/** Total of a booking in USD, as the API sends it (`totals.totalUsd`). */
export const txUsd = (x: Tx): string => decToFixed(divDec(parseDec(x.total), parseDec(x.fxRate), 6), 2);

/* ---------------------------------------------------------------- KPI "before / after" values */

export const KPI_SAMPLES = ['9999.00', '125000.50', '12345678.50', '999950000.00', '12000000000.00'];
