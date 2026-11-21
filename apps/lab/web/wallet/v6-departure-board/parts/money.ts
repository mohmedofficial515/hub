// Decimal-string helpers. Re-uses the real site's exact BigInt helpers (read-only import) so the port is 1:1.
import {
  addDecimal,
  compareDecimal,
  formatMoney,
  isDecimalString,
  normalizeDecimalInput,
  subtractDecimal,
} from '@web/apiEndpoint/shared/money';

export { addDecimal, compareDecimal, normalizeDecimalInput, subtractDecimal, isDecimalString };

export const MASK = '•••••';

/** "$1,234.56" with Latin digits; callers wrap it in <bdi dir="ltr">. */
export function usd(amount: string): string {
  return formatMoney(amount, 'USD', 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Whole-dollar display for compact board cells ("$184"). Rounds up so a gap is never understated. */
export function usdCeil(amount: string): string {
  const [int, frac = ''] = amount.replace('-', '').split('.');
  const up = /[1-9]/.test(frac) ? (BigInt(int) + BigInt(1)).toString() : int;
  return formatMoney(up, 'USD', 'en-US', { maximumFractionDigits: 0 });
}

/** Top-up input rule from the real top-up card. */
export const AMOUNT_PATTERN = /^\d{1,6}(\.\d{1,2})?$/;

export function maxDecimal(a: string, b: string): string {
  return compareDecimal(a, b) >= 0 ? a : b;
}

/** Gap to cover `price` from `have`, clamped up to `min` (top-up minimum). Returns null when already covered. */
export function gapTo(price: string, have: string, min: string): string | null {
  if (compareDecimal(have, price) >= 0) return null;
  return maxDecimal(subtractDecimal(price, have), min);
}

/** Round a decimal string up to whole dollars ("59.5" → "60"): gap chips fill whole amounts. */
export function ceilDollars(amount: string): string {
  const [int, frac = ''] = amount.split('.');
  return /[1-9]/.test(frac) ? (BigInt(int) + BigInt(1)).toString() : int;
}

/**
 * Lab stand-in for `POST /loyalty/redeem`: the server returns `amountUsd` as a decimal string. The point value is a
 * float in the API (`pointValueUsd`), so any preview is "about"; here it is converted once to micro-dollars.
 */
export function pointsToUsd(points: number, pointValueUsd: number): string {
  const micro = BigInt(Math.round(pointValueUsd * 1_000_000)) * BigInt(points);
  const cents = micro / BigInt(10_000);
  const s = cents.toString().padStart(3, '0');
  return `${s.slice(0, -2)}.${s.slice(-2)}`;
}

export function groupInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

/** Wraps an LTR token (amount) in Unicode isolates so it keeps its order inside an Arabic sentence string. */
export function ltr(s: string): string {
  return `\u2066${s}\u2069`;
}
