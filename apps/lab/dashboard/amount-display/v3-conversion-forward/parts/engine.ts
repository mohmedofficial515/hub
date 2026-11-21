/**
 * Conversion engine of the demo: the plan's server rules, written out so the owner can try them.
 *  - Aggregates = per-day USD x that day's rate.
 *  - EXCEPT a transaction whose own currency equals the display currency contributes its ORIGINAL amount (D4).
 *  - Averages and ratios come from the converted sums (D8). Rankings stay ordered by USD. Balances stay USD (D7).
 *  - A day with no provider rate carries the previous rate and is flagged "estimated".
 */
import { addDec, cmpDec, decToFixed, divDec, minorDigits, mulDec, parseDec, sumDec, type Dec } from './money-core';
import { BALANCES, DAYS, RANKING, RATES, SERIES, TXS, txUsd, type RankItem, type SeriesPart, type Tx } from './data';

export interface RateAt {
  rate: Dec;
  estimated: boolean;
}
export function rateOn(code: string, date: string): RateAt {
  const list = RATES[code];
  if (!list) return { rate: parseDec('1'), estimated: true };
  const i = Math.max(0, DAYS.indexOf(date));
  const hit = list[i]?.rate;
  if (hit) return { rate: parseDec(hit), estimated: false };
  for (let k = i - 1; k >= 0; k -= 1) if (list[k].rate) return { rate: parseDec(list[k].rate!), estimated: true };
  return { rate: parseDec('1'), estimated: true };
}

const part = (p: SeriesPart, display: string, date: string): Dec => {
  if (display === 'USD') return parseDec(p.usd);
  if (p.cur === display) return parseDec(p.native);
  return mulDec(parseDec(p.usd), rateOn(display, date).rate);
};

export interface DayPoint {
  date: string;
  value: Dec;
  usd: Dec;
  estimated: boolean;
  rate: Dec;
}
export interface Slice {
  cur: string;
  usd: Dec;
  value: Dec;
}
export interface Aggregate {
  display: string;
  days: DayPoint[];
  gross: Dec;
  refunds: Dec;
  net: Dec;
  grossUsd: Dec;
  bookings: number;
  average: Dec;
  /** Percent, 2 decimals. */
  refundPct: Dec;
  records: number;
  ownRecords: number;
  estimatedDays: string[];
  rate: { min: Dec; avg: Dec; max: Dec };
  rateSeries: Array<{ date: string; rate: Dec; estimated: boolean }>;
  slices: Slice[];
  periodRate: Dec;
}

const cache = new Map<string, Aggregate>();
export function aggregate(display: string): Aggregate {
  const hit = cache.get(display);
  if (hit) return hit;
  const days: DayPoint[] = [];
  const refunds: Dec[] = [];
  const bySlice = new Map<string, { usd: Dec[]; value: Dec[] }>();
  let records = 0;
  let own = 0;
  let bookings = 0;
  const rateSeries: Aggregate['rateSeries'] = [];
  for (const day of SERIES) {
    const r = rateOn(display, day.date);
    rateSeries.push({ date: day.date, rate: r.rate, estimated: r.estimated });
    const values = day.gross.map((p) => part(p, display, day.date));
    days.push({
      date: day.date,
      value: sumDec(values),
      usd: sumDec(day.gross.map((p) => parseDec(p.usd))),
      estimated: r.estimated && display !== 'USD',
      rate: r.rate,
    });
    refunds.push(sumDec(day.refunds.map((p) => part(p, display, day.date))));
    bookings += day.bookings;
    records += day.gross.length;
    own += day.gross.filter((p) => p.cur === display && display !== 'USD').length;
    day.gross.forEach((p, i) => {
      const s = bySlice.get(p.cur) ?? { usd: [], value: [] };
      s.usd.push(parseDec(p.usd));
      s.value.push(values[i]);
      bySlice.set(p.cur, s);
    });
  }
  const gross = sumDec(days.map((d) => d.value));
  const grossUsd = sumDec(days.map((d) => d.usd));
  const refundSum = sumDec(refunds);
  const rates = rateSeries.map((x) => x.rate);
  const min = rates.reduce((a, b) => (cmpDec(b, a) < 0 ? b : a));
  const max = rates.reduce((a, b) => (cmpDec(b, a) > 0 ? b : a));
  const agg: Aggregate = {
    display,
    days,
    gross,
    refunds: refundSum,
    net: addDec(gross, { n: -refundSum.n, s: refundSum.s }),
    grossUsd,
    bookings,
    average: divDec(gross, parseDec(String(bookings)), minorDigits(display) + 2),
    refundPct: mulDec(divDec(refundSum, gross, 6), parseDec('100')),
    records,
    ownRecords: own,
    estimatedDays: rateSeries.filter((x) => x.estimated && display !== 'USD').map((x) => x.date),
    rate: { min, avg: divDec(sumDec(rates), parseDec(String(rates.length)), 6), max },
    rateSeries,
    slices: [...bySlice.entries()]
      .map(([cur, s]) => ({ cur, usd: sumDec(s.usd), value: sumDec(s.value) }))
      .sort((a, b) => cmpDec(b.usd, a.usd)),
    periodRate: grossUsd.n === BigInt(0) ? parseDec('1') : divDec(gross, grossUsd, 6),
  };
  cache.set(display, agg);
  return agg;
}

/** Ranking: ordered by USD always; the shown value uses the period's effective rate. */
export function ranking(display: string): Array<RankItem & { value: Dec }> {
  const eff = aggregate(display).periodRate;
  return [...RANKING]
    .sort((a, b) => cmpDec(parseDec(b.usd), parseDec(a.usd)))
    .map((r) => ({ ...r, value: display === 'USD' ? parseDec(r.usd) : mulDec(parseDec(r.usd), eff) }));
}

/** Equivalent of a transaction in the display currency at the rate of its booking day; null when same currency. */
export function txEquivalent(x: Tx, display: string): { value: Dec; rate: Dec; estimated: boolean } | null {
  if (x.currency === display) return null;
  const r = rateOn(display, x.date);
  return { value: mulDec(parseDec(txUsd(x)), r.rate), rate: r.rate, estimated: r.estimated };
}

export { BALANCES };
