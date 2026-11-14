/**
 * Display-currency conversion rules of the plan (D2, D3, D4, D7, D8), done on decimal strings.
 *  - aggregate = per-day USD x the day's raw rate; a record whose OWN currency equals the display currency counts its original amount (D4)
 *  - averages and ratios are computed from the converted sums (D8)
 *  - rankings stay ordered by USD, balances stay USD (D7)
 */
import { DAYS, DAY_COUNT, rateOf, TRANSACTIONS, type DayRow, type Transaction } from './data';
import { addDec, cmpDec, decToString, divDec, mulDec, parseDec, subDec, ZERO_DEC, type Dec } from './money-core';

const d = (s: string) => parseDec(s) ?? ZERO_DEC;

export interface SeriesPoint {
  index: number;
  /** Decimal string in the display currency, 4 fraction digits (like the API). */
  value: string;
  estimated: boolean;
  /** Raw rate of that day (display currency per USD). */
  rate: string;
}

export interface Aggregate {
  display: string;
  total: string;
  series: SeriesPoint[];
  records: number;
  /** Records counted at their original amount because their currency equals the display currency. */
  directRecords: number;
  directNative: string;
  estimatedDays: number;
  rateFirst: string;
  rateLast: string;
  converted: boolean;
}

function dayValue(rows: DayRow[], display: string, day: number): { value: Dec; records: number; direct: number; directNative: Dec } {
  const rate = d(rateOf(display, day).rate);
  let value = ZERO_DEC;
  let records = 0;
  let direct = 0;
  let directNative = ZERO_DEC;
  for (const row of rows) {
    records += row.count;
    if (row.currency === display) {
      // D4: the original amount, no conversion.
      value = addDec(value, d(row.native));
      direct += row.count;
      directNative = addDec(directNative, d(row.native));
    } else {
      value = addDec(value, display === 'USD' ? d(row.usd) : mulDec(d(row.usd), rate));
    }
  }
  return { value, records, direct, directNative };
}

export function aggregate(kind: 'gross' | 'refunds', display: string): Aggregate {
  let total = ZERO_DEC;
  let records = 0;
  let directRecords = 0;
  let directNative = ZERO_DEC;
  let estimatedDays = 0;
  const series: SeriesPoint[] = DAYS.map((bucket) => {
    const r = dayValue(kind === 'gross' ? bucket.gross : bucket.refunds, display, bucket.index);
    total = addDec(total, r.value);
    records += r.records;
    directRecords += r.direct;
    directNative = addDec(directNative, r.directNative);
    const rate = rateOf(display, bucket.index);
    if (rate.estimated) estimatedDays += 1;
    return { index: bucket.index, value: decToString(r.value, 4), estimated: rate.estimated, rate: rate.rate };
  });
  return {
    display,
    total: decToString(total, 4),
    series,
    records,
    directRecords,
    directNative: decToString(directNative, 4),
    estimatedDays,
    rateFirst: rateOf(display, 0).rate,
    rateLast: rateOf(display, DAY_COUNT - 1).rate,
    converted: display !== 'USD',
  };
}

export interface Kpis {
  gross: Aggregate;
  refunds: Aggregate;
  net: string;
  /** Average order = converted gross / records (D8). */
  average: string;
  /** Refund rate in percent = converted refunds / converted gross x 100 (D8), 2 digits. */
  refundRate: string;
}

export function kpis(display: string): Kpis {
  const gross = aggregate('gross', display);
  const refunds = aggregate('refunds', display);
  const net = decToString(subDec(d(gross.total), d(refunds.total)), 4);
  const average = decToString(divDec(d(gross.total), { u: BigInt(gross.records), s: 0 }, 4) ?? ZERO_DEC, 4);
  const refundRate = decToString(divDec(mulDec(d(refunds.total), d('100')), d(gross.total), 4) ?? ZERO_DEC, 2);
  return { gross, refunds, net, average, refundRate };
}

/** Revenue share per source currency over the period, in USD (display independent: shares do not change with the switcher). */
export function sharesBySource(): { currency: string; usd: string; fraction: number }[] {
  const sums = new Map<string, Dec>();
  for (const b of DAYS) for (const r of b.gross) sums.set(r.currency, addDec(sums.get(r.currency) ?? ZERO_DEC, d(r.usd)));
  const all = [...sums.values()].reduce(addDec, ZERO_DEC);
  return [...sums.entries()]
    .map(([currency, usd]) => ({ currency, usd: decToString(usd, 2), fraction: Number(divDec(usd, all, 6)!.u) / 1e6 }))
    .sort((a, b) => b.fraction - a.fraction);
}

/** Per-transaction equivalent in the display currency, or null when the transaction already is in it. */
export function equivalent(tx: Transaction, display: string): { value: string; currency: string; rate: string; day: number } | null {
  if (tx.currency === display) return null;
  const rate = rateOf(display, tx.day).rate;
  return { value: decToString(mulDec(d(tx.amountUsd), d(rate)), 4), currency: display, rate, day: tx.day };
}

/** Value of a transaction in the display currency for rankings: original amount when same currency, else usd x day rate. Order is by USD. */
export function topTransactions(display: string, count: number) {
  return [...TRANSACTIONS]
    .sort((a, b) => Number(b.amountUsd) - Number(a.amountUsd))
    .slice(0, count)
    .map((tx) => {
      const eq = equivalent(tx, display);
      return { tx, value: eq ? eq.value : tx.amount, direct: eq === null };
    });
}

/** A balance stays in USD; this is its equivalent at today's (last day's) rate. */
export function balanceEquivalent(usd: string, display: string): { value: string; rate: string } | null {
  if (display === 'USD') return null;
  const rate = rateOf(display, DAY_COUNT - 1).rate;
  return { value: decToString(mulDec(d(usd), d(rate)), 4), rate };
}

/* ---------------------------------------------------------------- receipt data (v4) */

export interface SourceRow {
  /** Currency the customers paid in. */
  currency: string;
  records: number;
  /** Contribution to the display total, decimal string at 4 digits. */
  value: string;
  /** Share of the display total, 0..1 (presentation only). */
  share: number;
  /** Counted at its original amount (source = display currency) instead of USD x day rate. */
  direct: boolean;
  /** Average of the day rates applied to this source (display per USD); null when direct or the display is USD. */
  avgRate: string | null;
}

export interface RateStats {
  min: string;
  avg: string;
  max: string;
  /** Daily raw rates in order, for the sparkline. */
  daily: { rate: string; estimated: boolean }[];
  flat: boolean;
}

/** Per source-currency breakdown of the gross total in the display currency (same rules as `aggregate`). */
export function sourceBreakdown(display: string): SourceRow[] {
  const sums = new Map<string, { value: Dec; records: number }>();
  for (const bucket of DAYS) {
    const rate = d(rateOf(display, bucket.index).rate);
    for (const row of bucket.gross) {
      const cur = sums.get(row.currency) ?? { value: ZERO_DEC, records: 0 };
      const add = row.currency === display ? d(row.native) : display === 'USD' ? d(row.usd) : mulDec(d(row.usd), rate);
      sums.set(row.currency, { value: addDec(cur.value, add), records: cur.records + row.count });
    }
  }
  const total = [...sums.values()].reduce((acc, x) => addDec(acc, x.value), ZERO_DEC);
  const avg = rateStats(display).avg;
  return [...sums.entries()]
    .map(([currency, x]) => ({
      currency,
      records: x.records,
      value: decToString(x.value, 4),
      share: Number(divDec(x.value, total, 6)?.u ?? 0) / 1e6,
      direct: currency === display,
      avgRate: currency === display || display === 'USD' ? null : avg,
    }))
    .sort((a, b) => b.share - a.share);
}

/** Min / average / max of the daily raw rates of the display currency over the period. */
export function rateStats(display: string): RateStats {
  const daily = DAYS.map((b) => rateOf(display, b.index));
  let min = d(daily[0].rate);
  let max = min;
  let sum = ZERO_DEC;
  for (const r of daily) {
    const v = d(r.rate);
    if (cmpDec(v, min) < 0) min = v;
    if (cmpDec(v, max) > 0) max = v;
    sum = addDec(sum, v);
  }
  const digits = display === 'JPY' ? 2 : display === 'USD' ? 0 : 4;
  const avg = divDec(sum, { u: BigInt(daily.length), s: 0 }, digits) ?? ZERO_DEC;
  return {
    min: decToString(min, digits),
    avg: decToString(avg, digits),
    max: decToString(max, digits),
    daily: daily.map((r) => ({ rate: r.rate, estimated: r.estimated })),
    flat: cmpDec(min, max) === 0,
  };
}
