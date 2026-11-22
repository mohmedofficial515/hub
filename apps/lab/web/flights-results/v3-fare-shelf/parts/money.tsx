import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Locale } from '@lab/i18n';
import { cn } from '@lab/utils';

/** Latin digits in both languages, as the site shows them today. */
export const intlLocale = (locale: Locale) => (locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB');

/**
 * Formats a decimal string exactly: Intl accepts a numeric string (ES2023), so the amount never becomes a float.
 * Returns the number and the currency separately, in the locale's order.
 */
export function moneyParts(amount: string, currency: string, locale: Locale) {
  const format = new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency, currencyDisplay: 'symbol' });
  const parts = format.formatToParts(amount as unknown as number);
  const number = parts
    .filter((p) => ['integer', 'group', 'decimal', 'fraction', 'minusSign'].includes(p.type))
    .map((p) => p.value)
    .join('');
  const symbol = parts.find((p) => p.type === 'currency')?.value.replace(/\.$/, '') ?? currency;
  const currencyFirst = parts.findIndex((p) => p.type === 'currency') < parts.findIndex((p) => p.type === 'integer');
  return { number, symbol, currencyFirst };
}

/** One-line text form, for sentences and aria labels. */
export function formatMoney(amount: string, currency: string, locale: Locale) {
  const { number, symbol, currencyFirst } = moneyParts(amount, currency, locale);
  return currencyFirst ? `${symbol} ${number}` : `${number} ${symbol}`;
}

/** Exact difference of two decimal strings with two places (BigInt cents, no float math). */
export function subtractDecimal(a: string, b: string): string {
  const cents = (v: string) => {
    const [i, f = ''] = v.split('.');
    return BigInt(i + (f + '00').slice(0, 2));
  };
  const diff = cents(a) - cents(b);
  const sign = diff < 0n ? '-' : '';
  const abs = diff < 0n ? -diff : diff;
  const s = abs.toString().padStart(3, '0');
  return `${sign}${s.slice(0, -2)}.${s.slice(-2)}`;
}

/** Ordering of decimal strings without floats. */
export function compareDecimal(a: string, b: string): number {
  const d = subtractDecimal(a, b);
  return d.startsWith('-') ? -1 : /^0\.00$/.test(d) ? 0 : 1;
}

/**
 * A signed difference such as "+684.00 SAR". The sign and figure are isolated left-to-right (`<bdi dir="ltr">`), so in
 * Arabic it reads "+684.00 ر.س" and never "684.00+".
 */
export function SignedMoney({ amount, currency, locale }: { amount: string; currency: string; locale: Locale }) {
  const { number, symbol, currencyFirst } = moneyParts(amount, currency, locale);
  const figure = <bdi dir="ltr">+{number}</bdi>;
  return currencyFirst ? (
    <>
      {symbol} {figure}
    </>
  ) : (
    <>
      {figure} {symbol}
    </>
  );
}

/**
 * An amount with the currency set smaller (a fixed 12px, never an em fraction: no text under 12px or at 13px). When the value changes (another fare, the bag switch), the figure slides
 * in from below: a short confirmation that the price moved. Reduced motion swaps it without movement.
 */
export function Amount({
  amount,
  currency,
  locale,
  className,
  currencyClassName,
}: {
  amount: string;
  currency: string;
  locale: Locale;
  className?: string;
  currencyClassName?: string;
}) {
  const reduce = useReducedMotion();
  const { number, symbol, currencyFirst } = moneyParts(amount, currency, locale);
  const cur = <span className={cn('text-xs font-semibold text-ink-muted', currencyClassName)}>{symbol}</span>;

  return (
    <span className={cn('inline-flex items-baseline gap-1 tnum', className)}>
      {currencyFirst && cur}
      <span className="relative inline-flex overflow-hidden" dir="ltr">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={number}
            initial={reduce ? { opacity: 1 } : { y: '60%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { y: '-60%', opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.24, ease: [0.23, 1, 0.32, 1] }}
            className="inline-block"
          >
            {number}
          </motion.span>
        </AnimatePresence>
      </span>
      {!currencyFirst && cur}
    </span>
  );
}
