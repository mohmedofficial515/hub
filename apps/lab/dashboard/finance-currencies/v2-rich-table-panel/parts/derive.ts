import {
  FX_ENVELOPE,
  FX_NOW_ISO,
  fxOverrideState,
  marginOf,
  pctDelta,
  type Currency,
  type FxOverride,
  type FxRate,
} from '@lab/mocks/currencies';
import type { Locale } from '@lab/i18n';
import type { CurrencyMessages } from '../i18n';
import { fill } from '../i18n';
import type { MarkRing } from './marks';

export interface Row {
  currency: Currency;
  rate: FxRate;
  /** Market effective points, oldest to newest. */
  history: string[];
}

export interface Meta {
  row: Row;
  code: string;
  isBase: boolean;
  /** Active manual pin, if any. */
  pin: FxOverride | null;
  ageMin: number;
  ring: MarkRing;
  changePct: number;
  margin: number;
  /** Percent gap between effective and raw. */
  spreadPct: number;
  stale: boolean;
  hidden: boolean;
  displayOnly: boolean;
  searchText: string;
}

export const BASE = 'USD';

export function buildMeta(row: Row, overrides: FxOverride[], clockIso: string): Meta {
  const { currency: c, rate, history } = row;
  const pin = overrides.find((o) => o.quoteCurrency === c.code && fxOverrideState(o, clockIso) === 'active') ?? null;
  const ageMin = Math.max(0, Math.round((new Date(clockIso).getTime() - new Date(rate.fetchedAt).getTime()) / 60_000));
  const window = FX_ENVELOPE.staleAfterMinutes;
  const remaining = rate.isStale ? 0 : Math.max(0, 1 - ageMin / window);
  const ring: MarkRing = { remaining, tone: rate.isStale ? 'stale' : remaining < 0.4 ? 'aging' : 'fresh' };
  const prev = history[history.length - 2] ?? history[history.length - 1] ?? rate.effective;
  const cur = history[history.length - 1] ?? rate.effective;
  return {
    row,
    code: c.code,
    isBase: c.code === BASE,
    pin,
    ageMin,
    ring,
    changePct: pctDelta(prev, cur),
    margin: marginOf(c),
    spreadPct: pctDelta(rate.raw, rate.effective),
    stale: rate.isStale,
    hidden: !c.enabled,
    displayOnly: c.effectivePaymentMode === 'DISPLAY_ONLY',
    searchText: [c.code, c.name, ...Object.values(c.names), ...Object.values(c.abbr), c.symbol ?? '']
      .join(' ')
      .toLowerCase(),
  };
}

export const localName = (c: Currency, locale: Locale) => c.names[locale];
export const otherLangs = (locale: Locale) => (['ar', 'en', 'tr'] as const).filter((l) => l !== locale);

export function fmtPct(n: number, digits = 2) {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toFixed(digits)}%`;
}

export function relTime(min: number, t: CurrencyMessages) {
  if (min < 1) return t.now;
  const v = min < 60 ? fill(t.minutesShort, { n: min }) : fill(t.hoursShort, { n: Math.round(min / 60) });
  return fill(t.ago, { time: v });
}

export function fmtDate(iso: string, locale: Locale, withTime = false) {
  const tag = locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB';
  return new Intl.DateTimeFormat(tag, {
    day: '2-digit',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
    timeZone: 'UTC',
  }).format(new Date(iso));
}

export const CLOCK_START = FX_NOW_ISO;
