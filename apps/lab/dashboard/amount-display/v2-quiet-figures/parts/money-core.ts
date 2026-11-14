/**
 * Money core: the reference prototype that is later ported to `src/lib/money` (plan 5.1).
 *
 * Rules (plan 5.3 / D9 / D10):
 *  - amounts are decimal STRINGS; all arithmetic is BigInt (written `BigInt(10)`, never `10n`, because the dashboard targets ES2017)
 *  - no `Intl`: digit grouping is done by hand, digits are always Latin, so server and browser print the same text
 *  - compaction uses K / M / B, three significant digits at most, no trailing ".0", and carries correctly (999,950 -> 1M)
 *  - the minus sign is ASCII "-" (copy / paste and CSV safe)
 */

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const TEN = BigInt(10);

const pow10Cache = new Map<number, bigint>();
/** 10^n as a BigInt (cached). */
export function pow10(n: number): bigint {
  let hit = pow10Cache.get(n);
  if (hit === undefined) {
    hit = ONE;
    for (let i = 0; i < n; i += 1) hit *= TEN;
    pow10Cache.set(n, hit);
  }
  return hit;
}

/* ---------------------------------------------------------------- decimal value */

/** A decimal number: value = u / 10^s. `u` carries the sign. */
export interface Dec {
  u: bigint;
  s: number;
}

const DECIMAL = /^[+-]?\d+(\.\d+)?$/;

/** Parses a plain decimal string ("-1234.50"). Returns null for anything else (null, "", "1e9", "abc"). */
export function parseDec(input: string | null | undefined): Dec | null {
  if (input == null) return null;
  const text = input.trim();
  if (!DECIMAL.test(text)) return null;
  const negative = text.startsWith('-');
  const body = text.replace(/^[+-]/, '');
  const [int, frac = ''] = body.split('.');
  const u = BigInt(int + frac);
  return { u: negative ? -u : u, s: frac.length };
}

export const absDec = (d: Dec): Dec => ({ u: d.u < ZERO ? -d.u : d.u, s: d.s });

function align(a: Dec, b: Dec): [bigint, bigint, number] {
  const s = Math.max(a.s, b.s);
  return [a.u * pow10(s - a.s), b.u * pow10(s - b.s), s];
}

export const addDec = (a: Dec, b: Dec): Dec => {
  const [x, y, s] = align(a, b);
  return { u: x + y, s };
};
export const subDec = (a: Dec, b: Dec): Dec => {
  const [x, y, s] = align(a, b);
  return { u: x - y, s };
};
export const mulDec = (a: Dec, b: Dec): Dec => ({ u: a.u * b.u, s: a.s + b.s });
export const cmpDec = (a: Dec, b: Dec): number => {
  const [x, y] = align(a, b);
  return x < y ? -1 : x > y ? 1 : 0;
};
export const isZero = (d: Dec) => d.u === ZERO;
export const ZERO_DEC: Dec = { u: ZERO, s: 0 };

/** Integer division rounded half up (away from zero for negatives). */
function divRound(num: bigint, den: bigint): bigint {
  const negative = num < ZERO !== den < ZERO;
  const n = num < ZERO ? -num : num;
  const d = den < ZERO ? -den : den;
  let q = n / d;
  if ((n % d) * TWO >= d) q += ONE;
  return negative ? -q : q;
}

/** a / b with `outScale` fraction digits, rounded half up. Returns null when b is zero. */
export function divDec(a: Dec, b: Dec, outScale: number): Dec | null {
  if (b.u === ZERO) return null;
  const num = a.u * pow10(outScale + b.s);
  const den = b.u * pow10(a.s);
  return { u: divRound(num, den), s: outScale };
}

/** Rescales to `digits` fraction digits (half up) and returns the plain string "-1234.50". */
export function decToString(d: Dec, digits: number): string {
  const negative = d.u < ZERO;
  const a = negative ? -d.u : d.u;
  const q = digits < d.s ? divRound(a, pow10(d.s - digits)) : a * pow10(digits - d.s);
  const text = q.toString().padStart(digits + 1, '0');
  const int = digits === 0 ? text : text.slice(0, text.length - digits);
  const frac = digits === 0 ? '' : text.slice(text.length - digits);
  return (negative && q !== ZERO ? '-' : '') + int + (frac ? `.${frac}` : '');
}

/** Hand grouping of an integer string: "1234567" -> "1,234,567". */
export function groupInt(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/* ---------------------------------------------------------------- currencies */

const THREE_DIGITS = new Set(['KWD', 'BHD', 'OMR', 'JOD']);
const ZERO_DIGITS = new Set(['JPY', 'KRW', 'VND', 'CLP']);

/** Minor digits of a currency (ISO 4217 subset the dashboard needs). */
export function minorDigits(code: string): number {
  if (THREE_DIGITS.has(code)) return 3;
  if (ZERO_DIGITS.has(code)) return 0;
  return 2;
}

/* ---------------------------------------------------------------- compaction */

export type Unit = '' | 'K' | 'M' | 'B';
const TIERS: { unit: Unit; pow: number }[] = [
  { unit: '', pow: 0 },
  { unit: 'K', pow: 3 },
  { unit: 'M', pow: 6 },
  { unit: 'B', pow: 9 },
];

export interface Compact {
  int: string; // grouped only for the B tier above 999
  frac: string; // no trailing zeros
  unit: Unit;
}

/**
 * Three significant digits at most: 1.25M, 12.5M, 125M; 1,500 -> 1.5K; no trailing ".0".
 * Rounding can reach 1000 of a tier (999,950 -> 1000K): then the next tier is used (1M). B has no next tier, so it grows: 123,457B.
 */
export function compactAbs(a: Dec): Compact {
  let tier = a.u >= pow10(a.s + 9) ? 3 : a.u >= pow10(a.s + 6) ? 2 : a.u >= pow10(a.s + 3) ? 1 : 0;
  for (;;) {
    const den = pow10(a.s + TIERS[tier].pow);
    const whole = a.u / den;
    const wholeDigits = whole === ZERO ? 0 : whole.toString().length;
    const decimals = whole === ZERO ? (a.u === ZERO ? 0 : 2) : Math.max(0, 3 - wholeDigits);
    const q = divRound(a.u * pow10(decimals), den);
    if (tier < 3 && q >= BigInt(1000) * pow10(decimals)) {
      tier += 1;
      continue;
    }
    const intPart = (q / pow10(decimals)).toString();
    const frac = decimals === 0 ? '' : (q % pow10(decimals)).toString().padStart(decimals, '0').replace(/0+$/, '');
    return { int: tier === 3 ? groupInt(intPart) : intPart, frac, unit: TIERS[tier].unit };
  }
}

/* ---------------------------------------------------------------- contexts */

export type MoneyContext = 'kpi' | 'chart' | 'list' | 'table' | 'detail' | 'inline';
export type CompactMode = 'auto' | 'always' | 'never';

/** Plan 5.3: kpi >= 10,000; chart and list >= 1,000; table = per-column decision; detail / inline never. */
export function shouldCompact(a: Dec, ctx: MoneyContext, mode: CompactMode, columnCompact = false): boolean {
  if (mode === 'never') return false;
  if (mode === 'always') return true;
  if (ctx === 'kpi') return cmpDec(a, { u: BigInt(10000), s: 0 }) >= 0;
  if (ctx === 'chart' || ctx === 'list') return cmpDec(a, { u: BigInt(1000), s: 0 }) >= 0;
  if (ctx === 'table') return columnCompact;
  return false;
}

/** A table column is compacted, for all its rows, when its largest absolute value reaches 1,000,000. */
export function columnNeedsCompact(values: (string | null)[]): boolean {
  const limit: Dec = { u: BigInt(1000000), s: 0 };
  return values.some((v) => {
    const d = parseDec(v);
    return d !== null && cmpDec(absDec(d), limit) >= 0;
  });
}

/* ---------------------------------------------------------------- parts */

export interface AmountParts {
  negative: boolean;
  int: string;
  frac: string; // '' when compacted or the currency has no minor digits
  unit: Unit;
  compacted: boolean;
  /** The exact amount at the currency's digits, grouped, without sign: "1,250,000.50". */
  exact: string;
  currency: string;
}

export interface PartsOptions {
  context?: MoneyContext;
  compact?: CompactMode;
  columnCompact?: boolean;
}

/** Everything a renderer needs. Returns null for a missing or malformed value (the caller prints a dash). */
export function amountParts(value: string | null | undefined, currency: string, opts: PartsOptions = {}): AmountParts | null {
  const d = parseDec(value);
  if (!d) return null;
  const digits = minorDigits(currency);
  const exactStr = decToString(absDec(d), digits);
  const [exactInt, exactFrac = ''] = exactStr.split('.');
  const exact = groupInt(exactInt) + (exactFrac ? `.${exactFrac}` : '');
  // "-0.00" prints without a sign: negative only when the rounded value is not zero.
  const negative = d.u < ZERO && /[1-9]/.test(exactStr);
  const compacted = shouldCompact(absDec(d), opts.context ?? 'detail', opts.compact ?? 'auto', opts.columnCompact);
  if (compacted) {
    const c = compactAbs(absDec(d));
    return { negative, int: c.int, frac: c.frac, unit: c.unit, compacted: true, exact, currency };
  }
  return { negative, int: groupInt(exactInt), frac: exactFrac, unit: '', compacted: false, exact, currency };
}

/** "1,250,000.50" of a parts object: the number with its unit, without currency or sign. */
export const partsNumber = (p: AmountParts) => p.int + (p.frac ? `.${p.frac}` : '') + p.unit;

/* ---------------------------------------------------------------- text */

export type NegativeStyle = 'sign-first' | 'sama-ar';
export type Isolate = 'lri' | 'fsi' | false;

const LRI = '⁦';
const FSI = '⁨';
const PDI = '⁩';

/** Official sign as a text glyph, only for plain-text surfaces that have the font (not Cairo). Others fall back to the code. */
export const TEXT_GLYPH: Record<string, string> = { SAR: '⃁', USD: '$', EUR: '€', GBP: '£', TRY: '₺' };

export interface TextOptions extends PartsOptions {
  /** 'code' = "SAR 1,250.00" (toast, aria); 'glyph' = the text glyph when one exists. */
  mark?: 'code' | 'glyph';
  isolate?: Isolate;
  /** Arabic only: where the minus goes (owner question a). */
  negativeStyle?: NegativeStyle;
  locale?: 'ar' | 'en';
}

/**
 * Plain text for what cannot hold elements (toast, aria, chart text). Same order as the component: mark, space, minus, number, unit.
 * The isolate keeps the order stable inside RTL sentences (research section 3, cases E / F).
 */
export function amountText(value: string | null | undefined, currency: string, opts: TextOptions = {}): string {
  const p = amountParts(value, currency, opts);
  if (!p) return '—';
  const mark = opts.mark === 'glyph' && TEXT_GLYPH[currency] ? TEXT_GLYPH[currency] : currency;
  const samaAr = opts.locale === 'ar' && opts.negativeStyle === 'sama-ar';
  const number = partsNumber(p);
  const body = p.negative ? (samaAr ? `${mark} ${number}-` : `${mark} -${number}`) : `${mark} ${number}`;
  if (opts.isolate === 'lri') return LRI + body + PDI;
  if (opts.isolate === 'fsi') return FSI + body + PDI;
  return body;
}

/* ---------------------------------------------------------------- conversion helpers */

/** usd x rate, at 8 fraction digits at most (the API limit of decimalStringSchema). */
export function convertUsd(usd: string, rate: string): string | null {
  const a = parseDec(usd);
  const r = parseDec(rate);
  if (!a || !r) return null;
  return decToString(mulDec(a, r), 8);
}

/* ---------------------------------------------------------------- self test */

export interface TestResult {
  id: string;
  label: string;
  expected: string;
  actual: string;
  pass: boolean;
}

const compactText = (v: string) => {
  const d = parseDec(v);
  if (!d) return 'null';
  const c = compactAbs(absDec(d));
  return `${d.u < ZERO ? '-' : ''}${c.int}${c.frac ? `.${c.frac}` : ''}${c.unit}`;
};

const detail = (v: string, cur = 'USD') => {
  const p = amountParts(v, cur, { context: 'detail' });
  return p ? `${p.negative ? '-' : ''}${p.exact}` : 'null';
};
const ctxText = (v: string, ctx: MoneyContext, col = false) => {
  const p = amountParts(v, 'USD', { context: ctx, columnCompact: col });
  return p ? `${p.negative ? '-' : ''}${partsNumber(p)}` : 'null';
};

/** Runs the reference cases of plan section 12 (edge cases of P2). Pure, no DOM. [id, label, actual, expected] */
export function runSelfTest(): TestResult[] {
  const cases: [string, string, string, string][] = [
    ['compact-999', 'compact 999', compactText('999'), '999'],
    ['compact-1000', 'compact 1,000', compactText('1000'), '1K'],
    ['compact-1500', 'compact 1,500 is 1.5K, not 2K', compactText('1500'), '1.5K'],
    ['compact-9999', 'compact 9,999 carries to 10K', compactText('9999'), '10K'],
    ['compact-12345', 'compact 12,345 keeps 3 significant digits', compactText('12345'), '12.3K'],
    ['compact-999499', 'compact 999,499 stays 999K', compactText('999499'), '999K'],
    ['compact-999950', 'compact 999,950 carries to 1M, not 1000K', compactText('999950'), '1M'],
    ['compact-1250000', 'compact 1,250,000', compactText('1250000'), '1.25M'],
    ['compact-12500000', 'compact 12,500,000', compactText('12500000'), '12.5M'],
    ['compact-125000000', 'compact 125,000,000', compactText('125000000'), '125M'],
    ['compact-1.2B', 'compact 1,200,000,000', compactText('1200000000'), '1.2B'],
    ['compact-12B', 'compact 12,000,000,000.00', compactText('12000000000.00'), '12B'],
    ['compact-15d', 'compact 15 integer digits grows the B tier', compactText('123456789012345.12345678'), '123,457B'],
    ['compact-neg', 'compact negative keeps the sign', compactText('-1250000'), '-1.25M'],
    ['compact-zero', 'compact zero', compactText('0'), '0'],
    ['compact-cent', 'compact one cent', compactText('0.01'), '0.01'],
    ['exact-usd', 'detail USD 1,250.5', detail('1250.5'), '1,250.50'],
    ['exact-kwd', 'KWD keeps 3 decimals', detail('1234.567', 'KWD'), '1,234.567'],
    ['exact-jpy', 'JPY has 0 decimals', detail('18750000', 'JPY'), '18,750,000'],
    ['exact-jpy-round', 'JPY rounds half up', detail('1250.5', 'JPY'), '1,251'],
    ['exact-half-up', '2.345 rounds half up to 2.35', detail('2.345'), '2.35'],
    ['exact-15d', '15 integer digits + 8 fraction digits', detail('123456789012345.12345678'), '123,456,789,012,345.12'],
    ['exact-negzero', '-0.00 prints without a sign', detail('-0.00'), '0.00'],
    ['ctx-kpi-9999', 'kpi 9,999 is not compacted (< 10,000)', ctxText('9999', 'kpi'), '9,999.00'],
    ['ctx-kpi-10000', 'kpi 10,000 is compacted', ctxText('10000', 'kpi'), '10K'],
    ['ctx-list-1000', 'list 1,000 is compacted', ctxText('1000', 'list'), '1K'],
    ['ctx-detail-big', 'detail never compacts', ctxText('12500000', 'detail'), '12,500,000.00'],
    ['ctx-table-exact', 'table column below 1M stays exact', ctxText('845300', 'table', columnNeedsCompact(['845300', '120'])), '845,300.00'],
    ['ctx-table-compact', 'table column with a 1M value compacts every row', ctxText('845300', 'table', columnNeedsCompact(['845300', '1200000'])), '845K'],
    ['text-neg-en', 'text: mark, space, minus, number', amountText('-1250', 'SAR', { locale: 'en' }), 'SAR -1,250.00'],
    ['text-neg-sama', 'text: SAMA Arabic negative', amountText('-1250', 'SAR', { locale: 'ar', negativeStyle: 'sama-ar' }), 'SAR 1,250.00-'],
    ['text-isolate', 'text: isolate wraps with LRI / PDI', amountText('5', 'USD', { isolate: 'lri' }), '⁦USD 5.00⁩'],
    ['text-null', 'null amount prints a dash', amountText(null, 'USD'), '—'],
    ['math-mul', '1000.00 x 3.75 = 3750', convertUsd('1000.00', '3.75') ?? 'null', '3750.00000000'],
    ['math-div', 'division 3750 / 3.75 at 2 digits', decToString(divDec(parseDec('3750')!, parseDec('3.75')!, 2)!, 2), '1000.00'],
  ];
  return cases.map(([id, label, actual, expected]) => ({ id, label, expected, actual, pass: actual === expected }));
}
