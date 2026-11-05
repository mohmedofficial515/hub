// Currency / FX fixtures shaped like Goteav-Dashboard/src/apiEndpoint/fx
// (CurrencyDto, AdminFxRatesDto["rates"][n] = FxRate, FxOverrideDto).
// Rates are decimal strings (1 USD = rate x quote currency), never parsed to float for display.
//
// PROPOSED EXTENSION (not in the real API yet): `Currency.names`, `Currency.abbr` (ar / en / tr),
// `FX_HISTORY` (8 daily market points per currency) and `FX_REFRESH_PROPOSAL` (provider dry-run).
// Everything marked PROPOSED must be added to the backend contract before a port.

export type PaymentMode = 'CHARGEABLE' | 'DISPLAY_ONLY';
export type FxRateSource = 'provider' | 'manual';
export type FxOverrideState = 'active' | 'expired' | 'revoked';

export const FX_BASE_CURRENCY = 'USD';
/** Same threshold as the real refresh flow (`FX_OUTLIER_PERCENT`). */
export const FX_OUTLIER_PERCENT = 5;
/** Fixed "now" so the demo is deterministic. */
export const FX_NOW_ISO = '2026-10-28T10:30:00.000Z';

/** PROPOSED EXTENSION: the same text in the three languages the business works in. */
export interface TrilingualText {
  ar: string;
  en: string;
  tr: string;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string | null;
  decimalDigits: number;
  enabled: boolean;
  paymentMode: PaymentMode;
  effectivePaymentMode: PaymentMode;
  chargeCurrency: string | null;
  effectiveChargeCurrency: string;
  gatewaySupported: boolean;
  degraded: boolean;
  marginPercentOverride: number | null;
  /** PROPOSED EXTENSION */
  names: TrilingualText;
  /** PROPOSED EXTENSION */
  abbr: TrilingualText;
}

export interface FxRate {
  currency: string;
  raw: string;
  effective: string;
  source: FxRateSource;
  provider: string;
  fetchedAt: string;
  isStale: boolean;
  expiresAt: string | null;
  rateId: string | null;
}

export interface FxOverride {
  id: string;
  quoteCurrency: string;
  rate: string;
  active: boolean;
  createdAt: string;
  createdById: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedById: string | null;
  note: string | null;
}

export interface AdminFxRatesEnvelope {
  base: 'USD';
  provider: string;
  safetyMarginPercent: number;
  staleAfterMinutes: number;
}

export const FX_ENVELOPE: AdminFxRatesEnvelope = {
  base: 'USD',
  provider: 'frankfurter',
  safetyMarginPercent: 1.5,
  staleAfterMinutes: 120,
};

// ── decimal-string maths (8 fractional digits, BigInt) ────────────────────────────────────────────

const ONE = 100_000_000n;

export function parseDec(s: string): bigint {
  const neg = s.startsWith('-');
  const [i = '0', f = ''] = s.replace('-', '').split('.');
  const v = BigInt(i || '0') * ONE + BigInt((f + '00000000').slice(0, 8));
  return neg ? -v : v;
}

/** Fixed-digit string, rounded half up. */
export function fmtDec(v: bigint, digits = 8): string {
  const neg = v < 0n;
  let a = neg ? -v : v;
  const drop = 8 - digits;
  if (drop > 0) {
    const p = 10n ** BigInt(drop);
    a = ((a + p / 2n) / p) * p;
  }
  const int = a / ONE;
  const frac = (a % ONE).toString().padStart(8, '0').slice(0, digits);
  return `${neg ? '-' : ''}${int}${digits > 0 ? `.${frac}` : ''}`;
}

export const mulDec = (a: string, b: string, digits = 8) => fmtDec((parseDec(a) * parseDec(b)) / ONE, digits);

/** raw x (1 + pct/100) */
export const applyMargin = (raw: string, pct: number) =>
  fmtDec((parseDec(raw) * (ONE + BigInt(Math.round(pct * 1_000_000)))) / ONE, 8);

/** Signed percent change from a to b, 2 decimals (display number only). */
export const pctDelta = (a: string, b: string): number => {
  const base = parseDec(a);
  if (base === 0n) return 0;
  return Number(((parseDec(b) - base) * 10_000n) / base) / 100;
};

/** Thousands-grouped fixed-digit string for display (still no float). */
export function fmtRate(s: string, digits: number): string {
  const [i, f] = fmtDec(parseDec(s), digits).split('.');
  const grouped = (i ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return f ? `${grouped}.${f}` : grouped;
}

/** amountUsd x rate formatted with the currency's decimals. */
export const convertUsd = (amountUsd: string, rate: string, digits: number) => fmtRate(mulDec(amountUsd, rate), digits);

// ── fixtures ──────────────────────────────────────────────────────────────────────────────────────

type Seed = Omit<Currency, 'effectivePaymentMode' | 'effectiveChargeCurrency' | 'degraded'>;

const seeds: Seed[] = [
  {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    decimalDigits: 2,
    enabled: true,
    paymentMode: 'CHARGEABLE',
    chargeCurrency: null,
    gatewaySupported: true,
    marginPercentOverride: 0,
    names: { ar: 'الدولار الأمريكي', en: 'US Dollar', tr: 'ABD Doları' },
    abbr: { ar: '$', en: 'USD', tr: 'ABD$' },
  },
  {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    decimalDigits: 2,
    enabled: true,
    paymentMode: 'CHARGEABLE',
    chargeCurrency: null,
    gatewaySupported: true,
    marginPercentOverride: null,
    names: { ar: 'اليورو', en: 'Euro', tr: 'Euro' },
    abbr: { ar: 'يورو', en: 'EUR', tr: '€' },
  },
  {
    code: 'GBP',
    name: 'Pound Sterling',
    symbol: '£',
    decimalDigits: 2,
    enabled: true,
    paymentMode: 'CHARGEABLE',
    chargeCurrency: null,
    gatewaySupported: true,
    marginPercentOverride: null,
    names: { ar: 'الجنيه الإسترليني', en: 'Pound Sterling', tr: 'İngiliz Sterlini' },
    abbr: { ar: 'ج.إ', en: 'GBP', tr: '£' },
  },
  {
    code: 'TRY',
    name: 'Turkish Lira',
    symbol: '₺',
    decimalDigits: 2,
    enabled: true,
    paymentMode: 'CHARGEABLE',
    chargeCurrency: null,
    gatewaySupported: true,
    marginPercentOverride: 3,
    names: { ar: 'الليرة التركية', en: 'Turkish Lira', tr: 'Türk Lirası' },
    abbr: { ar: 'ل.ت', en: 'TRY', tr: 'TL' },
  },
  {
    code: 'SAR',
    name: 'Saudi Riyal',
    symbol: null,
    decimalDigits: 2,
    enabled: true,
    paymentMode: 'CHARGEABLE',
    chargeCurrency: null,
    gatewaySupported: true,
    marginPercentOverride: 0,
    names: { ar: 'الريال السعودي', en: 'Saudi Riyal', tr: 'Suudi Riyali' },
    abbr: { ar: 'ر.س', en: 'SAR', tr: 'SR' },
  },
  {
    code: 'AED',
    name: 'UAE Dirham',
    symbol: null,
    decimalDigits: 2,
    enabled: true,
    paymentMode: 'CHARGEABLE',
    chargeCurrency: null,
    gatewaySupported: true,
    marginPercentOverride: 0,
    names: { ar: 'الدرهم الإماراتي', en: 'UAE Dirham', tr: 'BAE Dirhemi' },
    abbr: { ar: 'د.إ', en: 'AED', tr: 'AED' },
  },
  {
    code: 'EGP',
    name: 'Egyptian Pound',
    symbol: 'E£',
    decimalDigits: 2,
    enabled: true,
    paymentMode: 'DISPLAY_ONLY',
    chargeCurrency: 'USD',
    gatewaySupported: false,
    marginPercentOverride: 2.5,
    names: { ar: 'الجنيه المصري', en: 'Egyptian Pound', tr: 'Mısır Lirası' },
    abbr: { ar: 'ج.م', en: 'EGP', tr: 'E£' },
  },
  {
    code: 'KWD',
    name: 'Kuwaiti Dinar',
    symbol: null,
    decimalDigits: 3,
    enabled: true,
    paymentMode: 'CHARGEABLE',
    chargeCurrency: null,
    gatewaySupported: false,
    marginPercentOverride: 0.8,
    names: { ar: 'الدينار الكويتي', en: 'Kuwaiti Dinar', tr: 'Kuveyt Dinarı' },
    abbr: { ar: 'د.ك', en: 'KWD', tr: 'KD' },
  },
  {
    code: 'QAR',
    name: 'Qatari Riyal',
    symbol: null,
    decimalDigits: 2,
    enabled: false,
    paymentMode: 'DISPLAY_ONLY',
    chargeCurrency: 'SAR',
    gatewaySupported: false,
    marginPercentOverride: null,
    names: { ar: 'الريال القطري', en: 'Qatari Riyal', tr: 'Katar Riyali' },
    abbr: { ar: 'ر.ق', en: 'QAR', tr: 'QR' },
  },
  {
    code: 'JOD',
    name: 'Jordanian Dinar',
    symbol: null,
    decimalDigits: 3,
    enabled: false,
    paymentMode: 'DISPLAY_ONLY',
    chargeCurrency: null,
    gatewaySupported: false,
    marginPercentOverride: 0.5,
    names: { ar: 'الدينار الأردني', en: 'Jordanian Dinar', tr: 'Ürdün Dinarı' },
    abbr: { ar: 'د.أ', en: 'JOD', tr: 'JD' },
  },
];

export const CURRENCIES: Currency[] = seeds.map((s) => {
  const degraded = s.paymentMode === 'CHARGEABLE' && !s.gatewaySupported;
  return {
    ...s,
    degraded,
    effectivePaymentMode: degraded ? 'DISPLAY_ONLY' : s.paymentMode,
    effectiveChargeCurrency: degraded ? 'USD' : (s.chargeCurrency ?? 'USD'),
  };
});

/** Provider raw rates per 1 USD. */
const RAW: Record<string, string> = {
  USD: '1.00000000',
  EUR: '0.86140000',
  GBP: '0.74310000',
  TRY: '43.12500000',
  SAR: '3.75000000',
  AED: '3.67250000',
  EGP: '49.38000000',
  KWD: '0.30690000',
  QAR: '3.64100000',
  JOD: '0.70900000',
};

/** Minutes since the last fetch (stale after FX_ENVELOPE.staleAfterMinutes). */
const AGE_MIN: Record<string, number> = {
  USD: 12, EUR: 12, GBP: 12, TRY: 190, SAR: 12, AED: 12, EGP: 12, KWD: 12, QAR: 47, JOD: 405,
};

/** Active pinned rates (units per 1 USD). */
const PINNED: Record<string, string> = { EGP: '50.00000000', KWD: '0.30950000' };

const minutesBefore = (min: number) => new Date(new Date(FX_NOW_ISO).getTime() - min * 60_000).toISOString();

export const marginOf = (c: Pick<Currency, 'marginPercentOverride'>) =>
  c.marginPercentOverride ?? FX_ENVELOPE.safetyMarginPercent;

export const FX_RATES: FxRate[] = CURRENCIES.map((c) => {
  const pin = PINNED[c.code];
  const age = AGE_MIN[c.code] ?? 12;
  return {
    currency: c.code,
    raw: RAW[c.code] ?? '1.00000000',
    effective: pin ?? applyMargin(RAW[c.code] ?? '1', marginOf(c)),
    source: pin ? 'manual' : 'provider',
    provider: pin ? 'manual' : FX_ENVELOPE.provider,
    fetchedAt: minutesBefore(c.code === 'USD' ? 12 : age),
    isStale: c.code !== 'USD' && age > FX_ENVELOPE.staleAfterMinutes,
    expiresAt: c.code === 'EGP' ? '2026-10-30T08:10:00.000Z' : null,
    rateId: c.code === 'USD' ? null : `rate_${c.code.toLowerCase()}_01`,
  };
});

export const FX_OVERRIDES: FxOverride[] = [
  {
    id: 'ovr_egp_2', quoteCurrency: 'EGP', rate: '50.00000000', active: true,
    createdAt: '2026-10-27T08:10:00.000Z', createdById: 'staff_amal', expiresAt: '2026-10-30T08:10:00.000Z',
    revokedAt: null, revokedById: null, note: 'Hold until the central-bank announcement',
  },
  {
    id: 'ovr_kwd_1', quoteCurrency: 'KWD', rate: '0.30950000', active: true,
    createdAt: '2026-10-22T13:40:00.000Z', createdById: 'staff_omar', expiresAt: null,
    revokedAt: null, revokedById: null, note: 'Match gateway quote until KWD settlement goes live',
  },
  {
    id: 'ovr_try_1', quoteCurrency: 'TRY', rate: '41.50000000', active: false,
    createdAt: '2026-10-20T09:00:00.000Z', createdById: 'staff_amal', expiresAt: null,
    revokedAt: '2026-10-24T11:20:00.000Z', revokedById: 'staff_omar', note: 'Provider lagged during the holiday',
  },
  {
    id: 'ovr_egp_1', quoteCurrency: 'EGP', rate: '48.90000000', active: false,
    createdAt: '2026-10-18T07:30:00.000Z', createdById: 'staff_amal', expiresAt: '2026-10-25T07:30:00.000Z',
    revokedAt: null, revokedById: null, note: 'Weekly hold',
  },
];

/** Derived state (the contract has no single field, same as the real `fxOverrideState`). */
export function fxOverrideState(o: FxOverride, nowIso = FX_NOW_ISO): FxOverrideState {
  if (o.revokedAt) return 'revoked';
  if (!o.active || (o.expiresAt && o.expiresAt <= nowIso)) return 'expired';
  return 'active';
}

/** Daily market percent steps, oldest to newest (7 steps give 8 points). */
const DRIFT: Record<string, number[]> = {
  USD: [0, 0, 0, 0, 0, 0, 0],
  EUR: [0.2, -0.1, 0.3, -0.2, 0.1, 0.2, -0.1],
  GBP: [-0.3, 0.1, 0.2, 0.4, -0.2, -0.1, 0.3],
  TRY: [0.6, 0.5, 0.7, 0.4, 0.8, 0.6, 0.5],
  SAR: [0, 0, 0, 0, 0, 0, 0],
  AED: [0, 0, 0, 0, 0, 0, 0],
  EGP: [0.4, 0.2, -0.3, 0.5, 0.1, 0.3, -0.2],
  KWD: [0.05, -0.05, 0.1, -0.1, 0.05, 0.1, 0.05],
  QAR: [0, 0, 0.01, 0, -0.01, 0, 0],
  JOD: [0, 0, 0, 0.01, 0, 0, 0],
};

/** PROPOSED EXTENSION: last 8 market effective points per currency, oldest to newest. */
export const FX_HISTORY: Record<string, string[]> = Object.fromEntries(
  CURRENCIES.map((c) => {
    const margin = marginOf(c);
    const steps = DRIFT[c.code] ?? [];
    let raw = RAW[c.code] ?? '1';
    const rawSeries = [raw];
    for (let i = steps.length - 1; i >= 0; i--) {
      raw = applyMargin(raw, -(steps[i] ?? 0));
      rawSeries.unshift(raw);
    }
    return [c.code, rawSeries.map((r) => applyMargin(r, c.code === 'USD' ? 0 : margin))];
  }),
);

/** PROPOSED EXTENSION: what the provider would return on the next refresh (dry run). */
export const FX_REFRESH_PROPOSAL: Record<string, string> = {
  EUR: '0.86010000',
  GBP: '0.74520000',
  TRY: '45.54000000', // +5.6% -> outlier
  SAR: '3.75000000',
  AED: '3.67250000',
  EGP: '49.61000000',
  KWD: '0.30710000',
  QAR: '3.64100000',
  JOD: '0.74670000', // +5.3% -> outlier (a peg should not move)
};

/** ISO codes offered as a "charge in" target. */
export const CHARGE_CURRENCY_OPTIONS = ['USD', 'EUR', 'SAR', 'AED'] as const;
