// Decimal-string money helpers. The API sends amounts as decimal strings ("228.99"); every comparison and sum
// here runs on integer cents (BigInt), never on floats. Display formatting hands the string straight to Intl.

const DECIMAL_RE = /^-?\d+(\.\d{1,2})?$/;

export function isDecimal(value: string): boolean {
  return DECIMAL_RE.test(value);
}

export function toCents(value: string): bigint {
  if (!isDecimal(value)) return 0n;
  const negative = value.startsWith('-');
  const [whole, frac = ''] = value.replace('-', '').split('.');
  const cents = BigInt(whole) * 100n + BigInt((frac + '00').slice(0, 2));
  return negative ? -cents : cents;
}

export function fromCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

export const addDecimal = (a: string, b: string) => fromCents(toCents(a) + toCents(b));
export const subtractDecimal = (a: string, b: string) => fromCents(toCents(a) - toCents(b));
export function compareDecimal(a: string, b: string): -1 | 0 | 1 {
  const d = toCents(a) - toCents(b);
  return d === 0n ? 0 : d > 0n ? 1 : -1;
}
export const maxDecimal = (a: string, b: string) => (compareDecimal(a, b) >= 0 ? a : b);

/** Ratio for drawing only (a gauge height). Never used to produce a displayed amount. */
export function ratio(part: string, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(1, Number(toCents(part)) / (whole * 100)));
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const plain = new Intl.NumberFormat('en-US');

/** "$1,234.50" — Latin digits, always rendered inside <bdi dir="ltr">. Intl formats the decimal string exactly. */
export function formatUsd(value: string, opts: { whole?: boolean } = {}): string {
  const f = opts.whole ? usdWhole : usd;
  return f.format(value as unknown as number);
}

export const formatInt = (n: number) => plain.format(n);

/** Gauge ceilings: the scale steps up as value grows — it is a ruler, never a cap. */
const NICE = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
export function niceCeiling(cents: bigint, headroom = 1.15): number {
  const need = (Number(cents) / 100) * headroom;
  return NICE.find((n) => n >= need) ?? NICE[NICE.length - 1];
}

/** Wraps an amount that is interpolated into a sentence in LTR isolates (same effect as <bdi dir="ltr">). */
export const ltr = (s: string) => `⁦${s}⁩`;
