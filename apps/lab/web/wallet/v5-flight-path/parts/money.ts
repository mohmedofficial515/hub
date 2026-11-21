// Decimal-string money helpers. The API returns amounts as decimal strings ("228.99"); we keep them exact by
// working in integer cents (BigInt) and never parsing to float for display.

export type Cents = bigint;

export function toCents(value: string): Cents {
  const trimmed = value.trim();
  const negative = trimmed.startsWith('-');
  const [whole = '0', fraction = ''] = trimmed.replace(/^[-+]/, '').split('.');
  const cents = BigInt(whole || '0') * 100n + BigInt((fraction + '00').slice(0, 2));
  return negative ? -cents : cents;
}

export function fromCents(cents: Cents): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  return `${negative ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}

export const ZERO: Cents = 0n;

export function maxCents(a: Cents, b: Cents): Cents {
  return a > b ? a : b;
}

/** "$1,234.50" — Latin digits in both locales (as the real site does); sign optional. */
export function formatUsd(cents: Cents, opts: { sign?: boolean; whole?: boolean } = {}): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = String(abs / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = String(abs % 100n).padStart(2, '0');
  const body = opts.whole && fraction === '00' ? `$${whole}` : `$${whole}.${fraction}`;
  if (negative) return `−${body}`;
  return opts.sign ? `+${body}` : body;
}

export const MASK = '$•••.••';

export function formatPoints(points: number): string {
  return String(Math.trunc(points)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Points → approximate USD for a preview only. `pointValueUsd` is a float in the API, so the result is
 * labelled "about"; the credited amount always comes back from the server as a decimal string.
 */
export function pointsToCents(points: number, pointValueUsd: number): Cents {
  return BigInt(Math.round(points * pointValueUsd * 100));
}

/** Same rule as the real top-up form: whole dollars or dollars and cents. */
export const AMOUNT_RE = /^\d{1,6}(\.\d{1,2})?$/;

/** Wrap an LTR amount that is interpolated into a sentence (LRI … PDI), the string form of <bdi dir="ltr">. */
export const isolate = (s: string) => `\u2066${s}\u2069`;
