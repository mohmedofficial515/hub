/**
 * money-core: pure reference prototype of `src/lib/money` (plan section 5.1).
 *
 * Rules this file proves (see `runSelfTest` at the bottom):
 *  - Amounts are DECIMAL STRINGS. They are parsed into BigInt, never into floats, never through Intl.
 *  - `BigInt(10)` instead of `10n` literals: the dashboard compiles to ES2017.
 *  - Grouping and compaction are written by hand: Latin digits, `K / M / B`, 3 significant digits at most,
 *    no trailing ".0", correct carry (999,950 -> 1M, not 1000K; 1,500 -> 1.5K, not 2K).
 *  - Minor digits per currency: KWD/BHD/OMR/JOD 3, JPY 0, everything else 2.
 *  - Text built for places that cannot hold elements (aria, toast, chart tooltip) is wrapped in
 *    FSI ... PDI so the sign never jumps to the other side inside an Arabic sentence.
 */

/* ------------------------------------------------------------------ decimal core */

/** value = n / 10^s, `n` carries the sign. */
export interface Dec {
  n: bigint;
  s: number;
}

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TEN = BigInt(10);
const TWO = BigInt(2);

const pow10 = (k: number): bigint => {
  let r = ONE;
  for (let i = 0; i < k; i += 1) r *= TEN;
  return r;
};
const babs = (x: bigint): bigint => (x < ZERO ? -x : x);

/** Parses "-1234.5", "+7", ".5", "12". Anything else throws. Never accepts exponents or separators. */
export function parseDec(input: string): Dec {
  const m = /^([+-])?(\d*)(?:\.(\d*))?$/.exec(input.trim());
  if (!m || (m[2] === '' && (m[3] ?? '') === '')) throw new Error(`Invalid decimal: "${input}"`);
  const frac = m[3] ?? '';
  const n = BigInt((m[2] || '0') + frac);
  return { n: m[1] === '-' ? -n : n, s: frac.length };
}

export function rescaleDec(d: Dec, s: number): Dec {
  if (s === d.s) return d;
  if (s > d.s) return { n: d.n * pow10(s - d.s), s };
  return roundDec(d, s);
}

/** Round half away from zero to `digits` decimals. */
export function roundDec(d: Dec, digits: number): Dec {
  if (digits >= d.s) return { n: d.n * pow10(digits - d.s), s: digits };
  const factor = pow10(d.s - digits);
  const a = babs(d.n);
  let q = a / factor;
  if ((a % factor) * TWO >= factor) q += ONE;
  return { n: d.n < ZERO ? -q : q, s: digits };
}

export const addDec = (a: Dec, b: Dec): Dec => {
  const s = Math.max(a.s, b.s);
  return { n: rescaleDec(a, s).n + rescaleDec(b, s).n, s };
};
export const mulDec = (a: Dec, b: Dec): Dec => ({ n: a.n * b.n, s: a.s + b.s });
export const cmpDec = (a: Dec, b: Dec): number => {
  const s = Math.max(a.s, b.s);
  const x = rescaleDec(a, s).n;
  const y = rescaleDec(b, s).n;
  return x < y ? -1 : x > y ? 1 : 0;
};
/** a / b rounded to `scale` decimals (half away from zero). */
export function divDec(a: Dec, b: Dec, scale: number): Dec {
  if (b.n === ZERO) throw new Error('Division by zero');
  const num = a.n * pow10(scale + b.s);
  const den = b.n * pow10(a.s);
  const neg = num < ZERO !== den < ZERO;
  const an = babs(num);
  const ad = babs(den);
  let q = an / ad;
  if ((an % ad) * TWO >= ad) q += ONE;
  return { n: neg ? -q : q, s: scale };
}
export const isZeroDec = (d: Dec): boolean => d.n === ZERO;

/** Plain decimal text with exactly `digits` decimals (rounded). */
export function decToFixed(d: Dec, digits: number): string {
  const r = roundDec(d, digits);
  const neg = r.n < ZERO;
  const a = babs(r.n).toString().padStart(digits + 1, '0');
  const int = digits === 0 ? a : a.slice(0, a.length - digits);
  const frac = digits === 0 ? '' : a.slice(a.length - digits);
  return `${neg ? '-' : ''}${int}${frac ? `.${frac}` : ''}`;
}
/** Shortest plain text (no trailing zeros) of the exact value. */
export function decToString(d: Dec): string {
  const t = decToFixed(d, d.s);
  return t.includes('.') ? t.replace(/\.?0+$/, '') : t;
}

export const sumDec = (list: Dec[]): Dec => list.reduce((acc, x) => addDec(acc, x), { n: ZERO, s: 0 });

/* ------------------------------------------------------------------ currency digits */

const THREE = new Set(['KWD', 'BHD', 'OMR', 'JOD']);
const ZERO_DIGITS = new Set(['JPY', 'KRW', 'VND', 'CLP']);
export function minorDigits(code: string): number {
  return THREE.has(code) ? 3 : ZERO_DIGITS.has(code) ? 0 : 2;
}

/* ------------------------------------------------------------------ grouping + compaction */

export function groupInt(int: string): string {
  let out = '';
  for (let i = 0; i < int.length; i += 1) {
    if (i > 0 && (int.length - i) % 3 === 0) out += ',';
    out += int[i];
  }
  return out;
}

export type Unit = '' | 'K' | 'M' | 'B';
const UNITS: Record<number, Unit> = { 0: '', 3: 'K', 6: 'M', 9: 'B' };

function fixedParts(d: Dec, digits: number): { int: string; frac: string } {
  const t = decToFixed({ n: babs(d.n), s: d.s }, digits);
  const [int, frac = ''] = t.split('.');
  return { int, frac };
}

/**
 * Compacts |value| >= 1,000 to at most 3 significant digits with K / M / B.
 * Returns null below 1,000. Carry: 999,950 -> "1" M, 9,999 -> "10" K, 1,500 -> "1.5" K.
 * Above 999,999,999,999 the integer part stays in full, grouped ("123,457B"): nothing wider than B exists.
 */
export function compactDec(d: Dec): { number: string; unit: Unit } | null {
  const abs: Dec = { n: babs(d.n), s: d.s };
  const intPart = abs.n / pow10(abs.s);
  if (intPart < BigInt(1000)) return null;
  const len = intPart.toString().length;
  let e = Math.min(9, 3 * Math.floor((len - 1) / 3));
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const scaled: Dec = { n: abs.n, s: abs.s + e };
    const intDigits = Math.max(1, (scaled.n / pow10(scaled.s)).toString().length);
    let dp = Math.max(0, 3 - intDigits);
    let r = roundDec(scaled, dp);
    const rDigits = Math.max(1, (r.n / pow10(dp)).toString().length);
    if (rDigits > intDigits) {
      if (rDigits > 3 && e < 9) {
        e += 3;
        continue;
      }
      dp = Math.max(0, 3 - rDigits);
      r = roundDec(scaled, dp);
    }
    const { int, frac } = fixedParts(r, dp);
    const trimmed = frac.replace(/0+$/, '');
    return { number: groupInt(int) + (trimmed ? `.${trimmed}` : ''), unit: UNITS[e] };
  }
  return null;
}

/* ------------------------------------------------------------------ amount parts + text */

export type AmountContext = 'kpi' | 'chart' | 'list' | 'table' | 'detail' | 'inline';
/** Plan 5.3: thresholds per context. `table` is decided per column (`columnCompact`). */
export const COMPACT_FROM: Record<AmountContext, number> = {
  kpi: 10000,
  chart: 1000,
  list: 1000,
  table: 1000,
  detail: Infinity,
  inline: Infinity,
};
/** Table rule: a column compacts, for all its rows, once its largest absolute value reaches 1,000,000. */
export const TABLE_COLUMN_THRESHOLD = 1000000;

export interface AmountInput {
  value: string;
  currency: string;
  context: AmountContext;
  compact?: 'auto' | 'always' | 'never';
  /** For `table`: the column decision (max >= 1M) made once by the caller. */
  columnCompact?: boolean;
}
export interface AmountParts {
  negative: boolean;
  zero: boolean;
  /** Text of the digits as shown, e.g. "1.25" or "1,250.00". */
  number: string;
  unit: Unit;
  compacted: boolean;
  /** Full-precision text with grouping and the currency digits, no sign, e.g. "12,345,678.50". */
  exact: string;
  currency: string;
}

export function amountParts(input: AmountInput): AmountParts {
  const d = parseDec(input.value);
  const digits = minorDigits(input.currency);
  const rounded = roundDec(d, digits);
  const { int, frac } = fixedParts(rounded, digits);
  const exact = groupInt(int) + (frac ? `.${frac}` : '');
  const negative = rounded.n < ZERO;
  const mode = input.compact ?? 'auto';
  let want = false;
  if (mode === 'always') want = true;
  else if (mode === 'auto') {
    if (input.context === 'table') want = !!input.columnCompact;
    else {
      const from = COMPACT_FROM[input.context];
      want = from !== Infinity && babs(rounded.n) >= BigInt(from) * pow10(digits);
    }
  }
  const c = want ? compactDec(rounded) : null;
  return {
    negative,
    zero: rounded.n === ZERO,
    number: c ? c.number : exact,
    unit: c ? c.unit : '',
    compacted: !!c,
    exact,
    currency: input.currency,
  };
}

export const FSI = '⁨';
export const PDI = '⁩';
export type Lang = 'ar' | 'en';
export interface TextOptions {
  /** 'leading': "SAR -1,250.00" (default). 'trailing': Arabic sample form "SAR 1,250.00-". */
  negativeStyle?: 'leading' | 'trailing';
  isolate?: boolean;
  /** Replaces the ISO code (e.g. a text glyph). */
  sign?: string;
}

/** Plain text for aria, toasts, CSV-adjacent text and chart tooltips: "[sign] [-]number[unit]". */
export function amountText(input: AmountInput, opts: TextOptions = {}): string {
  const p = amountParts(input);
  const sign = opts.sign ?? input.currency;
  const trailing = opts.negativeStyle === 'trailing' && p.negative;
  const body = `${sign} ${p.negative && !trailing ? '-' : ''}${p.number}${p.unit}${trailing ? '-' : ''}`;
  return opts.isolate === false ? body : `${FSI}${body}${PDI}`;
}

/* ------------------------------------------------------------------ amount in words (demo currencies) */

type Forms = [one: string, two: string, few: string, many: string];
interface WordCurrency {
  en: { one: string; many: string; subOne: string; subMany: string };
  ar: { main: Forms; mainFem: boolean; sub: Forms; subFem: boolean };
}
const SUB_AR: Record<string, [Forms, boolean]> = {
  halala: [['هللة', 'هللتان', 'هللات', 'هللة'], true],
  cent: [['سنت', 'سنتان', 'سنتات', 'سنتاً'], false],
  fils: [['فلس', 'فلسان', 'فلوس', 'فلساً'], false],
  penny: [['بنس', 'بنسان', 'بنسات', 'بنساً'], false],
  kurus: [['قرش', 'قرشان', 'قروش', 'قرشاً'], false],
};
const mk = (
  en: [string, string, string, string],
  main: Forms,
  fem: boolean,
  sub: keyof typeof SUB_AR,
): WordCurrency => ({
  en: { one: en[0], many: en[1], subOne: en[2], subMany: en[3] },
  ar: { main, mainFem: fem, sub: SUB_AR[sub][0], subFem: SUB_AR[sub][1] },
});
const WORD_CURRENCIES: Record<string, WordCurrency> = {
  SAR: mk(['Saudi riyal', 'Saudi riyals', 'halala', 'halalas'], ['ريال سعودي', 'ريالان سعوديان', 'ريالات سعودية', 'ريالاً سعودياً'], false, 'halala'),
  USD: mk(['US dollar', 'US dollars', 'cent', 'cents'], ['دولار أمريكي', 'دولاران أمريكيان', 'دولارات أمريكية', 'دولاراً أمريكياً'], false, 'cent'),
  AED: mk(['UAE dirham', 'UAE dirhams', 'fils', 'fils'], ['درهم إماراتي', 'درهمان إماراتيان', 'دراهم إماراتية', 'درهماً إماراتياً'], false, 'fils'),
  EUR: mk(['euro', 'euros', 'cent', 'cents'], ['يورو', 'يوروان', 'يوروهات', 'يورو'], false, 'cent'),
  GBP: mk(['pound sterling', 'pounds sterling', 'penny', 'pence'], ['جنيه إسترليني', 'جنيهان إسترلينيان', 'جنيهات إسترلينية', 'جنيهاً إسترلينياً'], false, 'penny'),
  KWD: mk(['Kuwaiti dinar', 'Kuwaiti dinars', 'fils', 'fils'], ['دينار كويتي', 'ديناران كويتيان', 'دنانير كويتية', 'ديناراً كويتياً'], false, 'fils'),
  JPY: mk(['Japanese yen', 'Japanese yen', 'sen', 'sen'], ['ين ياباني', 'ينان يابانيان', 'ينات يابانية', 'يناً يابانياً'], false, 'cent'),
  TRY: mk(['Turkish lira', 'Turkish liras', 'kurus', 'kurus'], ['ليرة تركية', 'ليرتان تركيتان', 'ليرات تركية', 'ليرة تركية'], true, 'kurus'),
  EGP: mk(['Egyptian pound', 'Egyptian pounds', 'piastre', 'piastres'], ['جنيه مصري', 'جنيهان مصريان', 'جنيهات مصرية', 'جنيهاً مصرياً'], false, 'kurus'),
  CAD: mk(['Canadian dollar', 'Canadian dollars', 'cent', 'cents'], ['دولار كندي', 'دولاران كنديان', 'دولارات كندية', 'دولاراً كندياً'], false, 'cent'),
};
export const hasWords = (code: string): boolean => code in WORD_CURRENCIES;

const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function en999(n: number): string {
  const out: string[] = [];
  if (n >= 100) {
    out.push(`${EN_ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) {
    out.push(EN_TENS[Math.floor(n / 10)] + (n % 10 ? `-${EN_ONES[n % 10]}` : ''));
  } else if (n > 0) out.push(EN_ONES[n]);
  return out.join(' ');
}
const SCALES_EN = ['', 'thousand', 'million', 'billion', 'trillion'];
export function numberToWordsEn(value: bigint): string {
  if (value === ZERO) return 'zero';
  const groups: number[] = [];
  let v = value;
  while (v > ZERO) {
    groups.push(Number(v % BigInt(1000)));
    v /= BigInt(1000);
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    if (groups[i] === 0) continue;
    parts.push(`${en999(groups[i])}${SCALES_EN[i] ? ` ${SCALES_EN[i]}` : ''}`);
  }
  return parts.join(' ');
}

const AR_M = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const AR_F = ['', 'واحدة', 'اثنتان', 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثماني', 'تسع', 'عشر', 'إحدى عشرة', 'اثنتا عشرة', 'ثلاث عشرة', 'أربع عشرة', 'خمس عشرة', 'ست عشرة', 'سبع عشرة', 'ثماني عشرة', 'تسع عشرة'];
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const AR_HUND = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];
function ar999(n: number, fem: boolean): string {
  const ones = fem ? AR_F : AR_M;
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(AR_HUND[Math.floor(n / 100)]);
    n %= 100;
  }
  if (n > 0) {
    if (n < 20) parts.push(ones[n]);
    else parts.push(n % 10 ? `${ones[n % 10]} و${AR_TENS[Math.floor(n / 10)]}` : AR_TENS[Math.floor(n / 10)]);
  }
  return parts.join(' و');
}
const AR_SCALE: Array<[string, string, string]> = [
  ['', '', ''],
  ['ألف', 'ألفان', 'آلاف'],
  ['مليون', 'مليونان', 'ملايين'],
  ['مليار', 'ملياران', 'مليارات'],
];
export function numberToWordsAr(value: bigint, fem = false): string {
  if (value === ZERO) return 'صفر';
  const groups: number[] = [];
  let v = value;
  while (v > ZERO) {
    groups.push(Number(v % BigInt(1000)));
    v /= BigInt(1000);
  }
  const parts: string[] = [];
  for (let i = Math.min(groups.length - 1, 3); i >= 0; i -= 1) {
    const g = groups[i];
    if (g === 0) continue;
    if (i === 0) parts.push(ar999(g, fem));
    else if (g === 1) parts.push(AR_SCALE[i][0]);
    else if (g === 2) parts.push(AR_SCALE[i][1]);
    else if (g >= 3 && g <= 10) parts.push(`${ar999(g, false)} ${AR_SCALE[i][2]}`);
    else parts.push(`${ar999(g, false)} ${AR_SCALE[i][0]}`);
  }
  return parts.join(' و');
}

function arNoun(n: bigint, forms: Forms, fem: boolean): string {
  const last2 = Number(n % BigInt(100));
  if (n === ONE) return `${forms[0]} ${fem ? 'واحدة' : 'واحد'}`;
  if (n === TWO) return forms[1];
  const w = numberToWordsAr(n, fem);
  if (last2 >= 3 && last2 <= 10) return `${w} ${forms[2]}`;
  if (last2 === 0) return `${w} ${forms[0]}`;
  return `${w} ${forms[3]}`;
}

/**
 * The amount written in words, in the UI language. Demo currencies only (`hasWords`); `null` otherwise.
 * Arabic follows the cheque convention (counted noun by the last two digits). A linguist must review it
 * before the port: this is a prototype, not a certified wording.
 */
export function amountInWords(value: string, currency: string, lang: Lang): string | null {
  const cfg = WORD_CURRENCIES[currency];
  if (!cfg) return null;
  const digits = minorDigits(currency);
  const d = roundDec(parseDec(value), digits);
  const a = babs(d.n);
  const whole = a / pow10(digits);
  const frac = a % pow10(digits);
  const neg = d.n < ZERO;
  const parts: string[] = [];
  if (lang === 'en') {
    if (whole > ZERO || frac === ZERO) parts.push(`${numberToWordsEn(whole)} ${whole === ONE ? cfg.en.one : cfg.en.many}`);
    if (frac > ZERO) parts.push(`${numberToWordsEn(frac)} ${frac === ONE ? cfg.en.subOne : cfg.en.subMany}`);
    return (neg ? 'minus ' : '') + parts.join(' and ');
  }
  if (whole > ZERO || frac === ZERO) parts.push(arNoun(whole, cfg.ar.main, cfg.ar.mainFem));
  if (frac > ZERO) parts.push(arNoun(frac, cfg.ar.sub, cfg.ar.subFem));
  return (neg ? 'سالب ' : '') + parts.join(' و');
}

/* ------------------------------------------------------------------ self test */

export interface TestResult {
  name: string;
  ok: boolean;
  got: string;
  want: string;
}

export function runSelfTest(): TestResult[] {
  const out: TestResult[] = [];
  const eq = (name: string, got: string, want: string) => out.push({ name, ok: got === want, got, want });
  const cmp = (v: string, ctx: AmountContext, cur = 'USD', col = false) => {
    const p = amountParts({ value: v, currency: cur, context: ctx, columnCompact: col });
    return `${p.negative ? '-' : ''}${p.number}${p.unit}`;
  };
  eq('chart 999 stays exact', cmp('999', 'chart'), '999.00');
  eq('chart 1,000 -> 1K', cmp('1000', 'chart'), '1K');
  eq('chart 1,500 -> 1.5K (not 2K)', cmp('1500', 'chart'), '1.5K');
  eq('kpi 9,999 stays exact', cmp('9999', 'kpi'), '9,999.00');
  eq('kpi 10,000 -> 10K', cmp('10000', 'kpi'), '10K');
  eq('chart 9,999 -> 10K (carry, 3 sig digits)', cmp('9999', 'chart'), '10K');
  eq('999,950 -> 1M (not 1000K)', cmp('999950', 'chart'), '1M');
  eq('999,499.99 -> 999K', cmp('999499.99', 'chart'), '999K');
  eq('999,500 -> 1M (3 significant digits round up)', cmp('999500', 'chart'), '1M');
  eq('1,250,000 -> 1.25M', cmp('1250000', 'kpi'), '1.25M');
  eq('12,500,000 -> 12.5M', cmp('12500000', 'kpi'), '12.5M');
  eq('125,500,000 -> 126M (half up)', cmp('125500000', 'kpi'), '126M');
  eq('1.2e9 -> 1.2B', cmp('1200000000', 'kpi'), '1.2B');
  eq('12e9 -> 12B', cmp('12000000000', 'kpi'), '12B');
  eq('999,999,999 -> 1B', cmp('999999999', 'kpi'), '1B');
  eq('123,456,789,012,345.12345678 -> 123,457B', cmp('123456789012345.12345678', 'kpi'), '123,457B');
  eq('negative -1,250,000 -> -1.25M', cmp('-1250000', 'kpi'), '-1.25M');
  eq('zero keeps 2 digits', cmp('0', 'detail'), '0.00');
  eq('negative zero after rounding is not negative', cmp('-0.001', 'detail'), '0.00');
  eq('KWD 3 decimals', cmp('1234.567', 'detail', 'KWD'), '1,234.567');
  eq('JPY 0 decimals', cmp('18750000', 'detail', 'JPY'), '18,750,000');
  eq('one cent', cmp('0.01', 'detail'), '0.01');
  eq('exact 15 integer digits + 8 fraction digits kept as decimal', cmp('123456789012345.12345678', 'detail', 'USD'), '123,456,789,012,345.12');
  eq('decimal rounding is exact (2.345 -> 2.35)', cmp('2.345', 'detail'), '2.35');
  eq('detail never compacts', cmp('12345678.5', 'detail'), '12,345,678.50');
  eq('table column below 1M stays exact', cmp('845300', 'table', 'USD', false), '845,300.00');
  eq('table column >= 1M compacts uniformly', cmp('845300', 'table', 'USD', true), '845K');
  eq('table column compacts but keeps small rows exact', cmp('950', 'table', 'USD', true), '950.00');
  eq('mul 1234.56 x 3.75 exact', decToString(mulDec(parseDec('1234.56'), parseDec('3.75'))), '4629.6');
  eq('div 100 / 3.75', decToFixed(divDec(parseDec('100'), parseDec('3.75'), 6), 6), '26.666667');
  eq('amountText isolates + sign + minus', amountText({ value: '-1250', currency: 'SAR', context: 'detail' }), `${FSI}SAR -1,250.00${PDI}`);
  eq('amountText trailing minus (Arabic sample form)', amountText({ value: '-1250', currency: 'SAR', context: 'detail' }, { negativeStyle: 'trailing', isolate: false }), 'SAR 1,250.00-');
  eq('words en SAR 1250', amountInWords('1250', 'SAR', 'en') ?? '', 'one thousand two hundred fifty Saudi riyals');
  eq('words ar SAR 1250', amountInWords('1250', 'SAR', 'ar') ?? '', 'ألف ومئتان وخمسون ريالاً سعودياً');
  eq('words en USD 1.01', amountInWords('1.01', 'USD', 'en') ?? '', 'one US dollar and one cent');
  eq('words ar AED 2', amountInWords('2', 'AED', 'ar') ?? '', 'درهمان إماراتيان');
  eq('words ar USD 3,000,000', amountInWords('3000000', 'USD', 'ar') ?? '', 'ثلاثة ملايين دولار أمريكي');
  eq('minorDigits', `${minorDigits('KWD')}${minorDigits('JPY')}${minorDigits('SAR')}`, '302');
  return out;
}
