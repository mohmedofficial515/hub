import { forwardRef, useId, useState } from 'react';
import { CreditCard, ExternalLink, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { paymentMethods, topUpPresets } from '@lab/mocks/wallet';
import { messages } from '../i18n';
import { addDecimal, compareDecimal, formatUsd, ltr, toCents } from './money';
import { focusRing, Money } from './shared';

/** Whole dollars, or dollars and cents ("50", "12.5", "12.50") — same rule as the real form. */
export const AMOUNT_RE = /^\d{1,6}(\.\d{1,2})?$/;

/** Lab-only: amounts above this simulate the backend's `wallet.topup_daily_limit_exceeded` (409). */
const MOCK_DAILY_LIMIT = '2000.00';

interface Props {
  amount: string;
  onAmount: (v: string) => void;
  available: string;
  minUsd: number;
  maxUsd: number;
}

export const TopUpForm = forwardRef<HTMLInputElement, Props>(function TopUpForm(
  { amount, onAmount, available, minUsd, maxUsd },
  inputRef,
) {
  const t = useT(messages);
  const ids = useId();
  const [method, setMethod] = useState(`${paymentMethods[0].gateway}:${paymentMethods[0].methodKind}`);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const valid = AMOUNT_RE.test(amount);
  const inRange =
    valid && compareDecimal(amount, String(minUsd)) >= 0 && compareDecimal(amount, String(maxUsd)) <= 0;
  const presets = topUpPresets.filter(
    (p) => compareDecimal(p, String(minUsd)) >= 0 && compareDecimal(p, String(maxUsd)) <= 0,
  );
  const min = ltr(formatUsd(String(minUsd)));
  const max = ltr(formatUsd(String(maxUsd)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (leaving) return; // aria-disabled while redirecting: keep focus on the button, ignore repeats
    if (!valid) return setError(t.topUp.errors.format);
    if (!inRange) return setError(t.topUp.errors.range(min, max));
    if (compareDecimal(amount, MOCK_DAILY_LIMIT) > 0) return setError(t.topUp.errors.daily);
    setError(null);
    setLeaving(true);
    window.setTimeout(() => setLeaving(false), 2400); // the real flow leaves for the hosted page here
  };

  const methodIcon = (kind: string) => (kind === 'card' ? CreditCard : Smartphone);

  return (
    <form onSubmit={submit} noValidate className="grid min-w-0 gap-4 @lg:grid-cols-2 @lg:gap-x-8" aria-describedby={`${ids}-secure`}>
      <div className="flex min-w-0 flex-col gap-4">
      <div>
        <h3 className="text-base font-bold text-primary dark:text-white">{t.topUp.title}</h3>
        <p className="text-sm text-muted-foreground">{t.topUp.hint}</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`${ids}-amount`} className="text-sm font-medium">
          {t.topUp.amountLabel}
        </label>
        <div
          dir="ltr"
          className={cn(
            'flex h-14 items-center rounded-xl border-2 bg-background px-3 transition-colors focus-within:border-secondary focus-within:ring-[3px] focus-within:ring-secondary/70 focus-within:ring-offset-2 focus-within:ring-offset-background',
            error ? 'border-destructive' : 'border-input',
          )}
        >
          <span aria-hidden className="text-2xl font-bold text-muted-foreground">
            $
          </span>
          <input
            ref={inputRef}
            id={`${ids}-amount`}
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            placeholder="50"
            onChange={(e) => {
              setError(null);
              onAmount(e.target.value.replace(/[^\d.]/g, '').slice(0, 9));
            }}
            aria-invalid={!!error}
            aria-describedby={`${ids}-range ${error ? `${ids}-error` : ''}`}
            className="h-full min-w-0 flex-1 bg-transparent px-2 text-2xl font-extrabold text-primary tabular-nums outline-none placeholder:text-muted-foreground/50 dark:text-white"
          />
        </div>
        <p id={`${ids}-range`} className="text-xs text-muted-foreground">
          {t.topUp.range(min, max)}
        </p>
      </div>

      </div>
      <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t.topUp.quick}>
        {presets.map((p) => {
          const active = valid && toCents(amount) === toCents(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => {
                setError(null);
                onAmount(p);
              }}
              aria-pressed={active}
              className={cn(
                'min-h-11 min-w-16 flex-1 rounded-xl border px-3 text-sm font-bold transition-colors',
                active
                  ? 'border-primary bg-primary text-white dark:border-white dark:bg-white dark:text-ocean-deep'
                  : 'border-input bg-background hover:border-primary/40 dark:hover:border-white/40',
                focusRing,
              )}
            >
              <bdi dir="ltr">{formatUsd(p, { whole: true })}</bdi>
            </button>
          );
        })}
      </div>

      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-sm font-medium">{t.topUp.method}</legend>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(5.75rem,1fr))] gap-2">
          {paymentMethods.map((m) => {
            const value = `${m.gateway}:${m.methodKind}`;
            const Icon = methodIcon(m.methodKind);
            const checked = method === value;
            return (
              <label
                key={value}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center justify-center gap-1 rounded-xl border px-1.5 text-xs font-bold transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-secondary/70',
                  checked
                    ? 'border-secondary bg-secondary/10 text-primary dark:text-white'
                    : 'border-input bg-background text-muted-foreground hover:text-foreground',
                )}
              >
                <input
                  type="radio"
                  name={`${ids}-method`}
                  value={value}
                  checked={checked}
                  onChange={() => setMethod(value)}
                  className="sr-only"
                />
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{t.topUp.methods[m.methodKind]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      </div>
      <div className="flex min-w-0 flex-col gap-3 @lg:col-span-2">

      {inRange && (
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-xl bg-muted/60 px-3 py-2 text-sm dark:bg-white/5">
          <span className="text-muted-foreground">{t.topUp.after}</span>
          <Money value={addDecimal(available, amount)} balance className="text-base font-extrabold text-primary dark:text-white" />
        </p>
      )}

      {error && (
        <p id={`${ids}-error`} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        aria-disabled={leaving || undefined}
        className={cn(
          'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-secondary px-5 text-base font-extrabold text-ocean-deep shadow-[0_10px_24px_-12px_var(--secondary)] transition-transform hover:brightness-105 active:scale-[0.98] aria-disabled:cursor-progress aria-disabled:opacity-80',
          focusRing,
        )}
      >
        {leaving ? <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden /> : <ExternalLink className="size-5 rtl:-scale-x-100" aria-hidden />}
        {leaving ? t.topUp.redirecting : t.topUp.cta}
      </button>
      <p id={`${ids}-secure`} className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-px size-4 shrink-0 text-secondary" aria-hidden />
        {t.topUp.secure}
      </p>
      </div>
    </form>
  );
});
