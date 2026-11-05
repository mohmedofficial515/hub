import { forwardRef, useId, useImperativeHandle, useRef, useState } from 'react';
import { CreditCard, ExternalLink, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@web/components/ui/skeleton';
import { useT } from '@lab/i18n';
import { paymentMethods, topUpLimits, topUpPresets, type PaymentMethodOption } from '@lab/mocks/wallet';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { Flap } from './flap';
import { AMOUNT_PATTERN, MASK, addDecimal, ltr, compareDecimal, normalizeDecimalInput, usd } from './money';

export interface GateHandle {
  /** Fill the amount (from a board gap or "try again") and move focus to the submit button. */
  fill: (amount: string) => void;
}

const ring =
  'outline-none focus-visible:ring-[3px] focus-visible:ring-secondary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card';

type Parsed = { ok: true; value: string } | { ok: false; reason: 'empty' | 'format' | 'range' };

export function parseAmount(raw: string): Parsed {
  const v = normalizeDecimalInput(raw);
  if (!v) return { ok: false, reason: 'empty' };
  if (!AMOUNT_PATTERN.test(v)) return { ok: false, reason: 'format' };
  if (compareDecimal(v, String(topUpLimits.minUsd)) < 0 || compareDecimal(v, String(topUpLimits.maxUsd)) > 0)
    return { ok: false, reason: 'range' };
  return { ok: true, value: v };
}

export const Gate = forwardRef<
  GateHandle,
  {
    raw: string;
    onRaw: (raw: string) => void;
    available: string | null;
    shown: boolean;
    frozen: boolean;
    loading: boolean;
  }
>(function Gate({ raw, onRaw, available, shown, frozen, loading }, ref) {
  const t = useT(messages);
  const id = useId();
  const submitRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const [method, setMethod] = useState<PaymentMethodOption>(paymentMethods[0]);
  const [touched, setTouched] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useImperativeHandle(ref, () => ({
    fill(amount) {
      onRaw(amount);
      setTouched(true);
      rootRef.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      window.setTimeout(() => submitRef.current?.focus({ preventScroll: true }), 50);
    },
  }));

  const parsed = parseAmount(raw);
  const min = ltr(usd(String(topUpLimits.minUsd)));
  const max = ltr(usd(String(topUpLimits.maxUsd)));
  const error = touched && !parsed.ok && parsed.reason !== 'empty' ? (parsed.reason === 'range' ? t.errRange(min, max) : t.errAmount) : null;
  const after = parsed.ok && available ? addDecimal(available, parsed.value) : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!parsed.ok) return;
    setRedirecting(true); // real app: POST /wallet/top-ups → window.location = hosted URL
    window.setTimeout(() => setRedirecting(false), 2500);
  }

  if (loading) {
    return (
      <section aria-busy className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-4 h-16 w-full" />
        <div className="mt-4 grid grid-cols-4 gap-2">
          {topUpPresets.map((p) => (
            <Skeleton key={p} className="h-11" />
          ))}
        </div>
        <Skeleton className="mt-5 h-12 w-full" />
      </section>
    );
  }

  if (frozen) {
    return (
      <section aria-labelledby={`${id}-closed`} className="grid content-start gap-3 rounded-2xl border border-border bg-card p-5 md:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] rtl:tracking-normal text-muted-foreground">{t.gateEyebrow}</p>
        <div className="rounded-xl bg-primary-dark p-4 text-white">
          <Lock className="mb-3 size-5 text-amber-300" aria-hidden />
          <h2 id={`${id}-closed`}>
            <Flap text={t.gateClosed} srText={t.gateClosed} className="text-lg font-bold text-amber-300" stagger={0.02} />
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">{t.gateClosedBody}</p>
      </section>
    );
  }

  return (
    <section ref={rootRef} aria-labelledby={`${id}-title`} className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm md:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] rtl:tracking-normal text-muted-foreground">{t.gateEyebrow}</p>
      <h2 id={`${id}-title`} className="mt-1 text-xl font-bold text-primary dark:text-foreground">
        {t.gateTitle}
      </h2>

      <form onSubmit={submit} noValidate className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4">
        <div>
          <label htmlFor={`${id}-amt`} className="text-sm font-medium text-muted-foreground">
            {t.amountLabel}
          </label>
          <div
            dir="ltr"
            className={cn(
              'mt-1.5 flex items-baseline gap-1 rounded-xl border-2 bg-background px-4 py-2 transition-colors focus-within:border-secondary',
              error ? 'border-destructive' : 'border-border',
            )}
          >
            <span className="text-3xl font-bold text-muted-foreground" aria-hidden>
              $
            </span>
            <input
              id={`${id}-amt`}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={raw}
              onChange={(e) => onRaw(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={!!error}
              aria-describedby={`${id}-hint ${error ? `${id}-err` : ''}`}
              size={1}
              className="w-full min-w-0 flex-1 bg-transparent text-4xl font-bold tabular-nums text-foreground outline-none placeholder:text-muted-foreground/50 md:text-5xl"
            />
          </div>
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">
            {t.limits(min, max)}
          </p>
          {error && (
            <p id={`${id}-err`} role="alert" className="mt-1 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>

        <fieldset className="min-w-0">
          <legend className="sr-only">{t.presets}</legend>
          <div className="grid grid-cols-4 gap-2">
            {topUpPresets.map((p) => {
              const on = normalizeDecimalInput(raw) === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    onRaw(p);
                    setTouched(true);
                  }}
                  className={cn(
                    'min-h-11 rounded-lg border text-sm font-bold tabular-nums transition',
                    on
                      ? 'border-primary bg-primary text-white dark:border-secondary dark:bg-secondary dark:text-primary-dark'
                      : 'border-border hover:border-primary/40 dark:hover:border-secondary/60',
                    ring,
                  )}
                >
                  <bdi dir="ltr">${p}</bdi>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3 text-sm">
          <span className="text-muted-foreground">{t.afterTopUp}</span>
          <bdi dir="ltr" className="font-bold tabular-nums">
            {after ? (shown ? usd(after) : `$${MASK}`) : '—'}
          </bdi>
        </div>

        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm font-medium text-muted-foreground">{t.methodLabel}</legend>
          <div className="grid grid-cols-3 gap-2">
            {paymentMethods.map((m) => {
              const on = m.methodKind === method.methodKind && m.gateway === method.gateway;
              return (
                <label
                  key={`${m.gateway}-${m.methodKind}`}
                  className={cn(
                    'relative flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 text-center text-sm font-semibold transition',
                    'has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-secondary/70',
                    on ? 'border-secondary bg-secondary/10' : 'border-border hover:border-primary/40',
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-method`}
                    className="sr-only"
                    checked={on}
                    onChange={() => setMethod(m)}
                  />
                  {m.methodKind === 'card' && <CreditCard className="size-4 shrink-0" aria-hidden />}
                  <span dir={m.methodKind === 'card' ? undefined : 'ltr'}>{t.methods[m.methodKind]}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <button
          ref={submitRef}
          type="submit"
          disabled={redirecting}
          className={cn(
            'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-secondary px-5 text-base font-bold text-primary-dark transition hover:brightness-105 disabled:opacity-70',
            ring,
          )}
        >
          {redirecting ? (
            <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <ExternalLink className="size-5 rtl:-scale-x-100" aria-hidden />
          )}
          {redirecting ? t.redirecting : t.proceed}
        </button>

        <ul className="grid gap-1.5 text-xs text-muted-foreground">
          <li className="flex gap-2">
            <ShieldCheck className="size-4 shrink-0 text-secondary" aria-hidden />
            {t.secure}
          </li>
          <li className="ps-6">{t.autoApplied}</li>
        </ul>
      </form>
    </section>
  );
});
