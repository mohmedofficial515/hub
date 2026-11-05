import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CreditCard, ExternalLink, Loader2, ShieldCheck, Smartphone, X } from 'lucide-react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { paymentMethods, topUpLimits, topUpPresets } from '@lab/mocks/wallet';
import { messages } from '../i18n';
import { Amount } from './amount';
import { AMOUNT_RE, formatUsd, isolate, toCents, type Cents } from './money';

export interface RefuelRequest {
  amount: string;
  method?: string;
  nonce: number;
}

const MIN = BigInt(topUpLimits.minUsd) * 100n;
const MAX = BigInt(topUpLimits.maxUsd) * 100n;
const methodValue = (m: (typeof paymentMethods)[number]) => `${m.gateway}:${m.methodKind}`;
const presets = topUpPresets.filter((p) => {
  const c = toCents(p);
  return c >= MIN && c <= MAX;
});

const CEILINGS = [250n, 500n, 1000n, 2500n, 5000n, 10000n].map((d) => d * 100n);

/**
 * Mini altimeter: current altitude, then a dotted climb to the altitude after the top-up. While amounts are hidden
 * the climb is a fixed illustration (same shape for every balance), so its heights reveal nothing.
 */
function ClimbPreview({ from, to, shown }: { from: Cents; to: Cents; shown: boolean }) {
  const reduce = useReducedMotion();
  const ceiling = CEILINGS.find((c) => c >= to) ?? to;
  const y = (v: Cents) => 50 - Number((v * 1000n) / (ceiling === 0n ? 1n : ceiling)) * 0.042;
  const y0 = shown ? y(from) : 36;
  const y1 = shown ? y(to) : 14;
  return (
    <svg viewBox="0 0 120 56" className="h-12 w-24 shrink-0 overflow-visible rtl:-scale-x-100" aria-hidden>
      <line x1="0" y1="52" x2="120" y2="52" className="stroke-border" strokeWidth="1" />
      <path d={`M2 52 C 22 52, 26 ${y0}, 46 ${y0}`} fill="none" className="stroke-primary dark:stroke-ocean-light" strokeWidth="2.5" strokeLinecap="round" />
      <motion.path
        key={shown ? `${from}-${to}` : 'hidden'}
        d={`M46 ${y0} C 70 ${y0}, 80 ${y1}, 108 ${y1}`}
        fill="none"
        className="stroke-secondary"
        strokeWidth="2.5"
        strokeDasharray="2 5"
        strokeLinecap="round"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
      />
      <circle cx="46" cy={y0} r="3.5" className="fill-primary dark:fill-ocean-light" />
      <circle cx="108" cy={y1} r="5" className="fill-secondary" />
    </svg>
  );
}

interface RefuelProps {
  available: Cents;
  shown: boolean;
  request: RefuelRequest | null;
  initialAmount?: string;
  onClose?: () => void;
  className?: string;
}

export function Refuel({ available, shown, request, initialAmount = '', onClose, className }: RefuelProps) {
  const t = useT(messages);
  const ids = useId();
  const [amount, setAmount] = useState(initialAmount);
  const [method, setMethod] = useState(methodValue(paymentMethods[0]));
  const [touched, setTouched] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'redirecting' | 'lab'>('idle');
  const submitRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!request) return;
    setAmount(request.amount);
    if (request.method) setMethod(request.method);
    setTouched(true);
    setPhase('idle');
    requestAnimationFrame(() => submitRef.current?.focus({ preventScroll: false }));
  }, [request]);

  const valid = AMOUNT_RE.test(amount);
  const cents = valid ? toCents(amount) : null;
  const inRange = cents !== null && cents >= MIN && cents <= MAX;
  const minLabel = isolate(formatUsd(MIN, { whole: true }));
  const maxLabel = isolate(formatUsd(MAX, { whole: true }));
  const error = !touched || amount === '' ? null : !valid ? t.format : !inRange ? t.range(minLabel, maxLabel) : null;
  const after = useMemo(() => (inRange && cents !== null ? available + cents : null), [available, cents, inRange]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!inRange) return;
    setPhase('redirecting');
    setTimeout(() => setPhase('lab'), 1400);
  };

  const methodIcon = (kind: string) => (kind === 'card' ? CreditCard : Smartphone);

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby={`${ids}-title`}
      className={cn('rounded-2xl bg-card p-4 text-card-foreground shadow-xl shadow-black/10 sm:p-5', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id={`${ids}-title`} className="text-lg font-bold">
          {t.refuelTitle}
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeRefuel}
            className="-me-2 grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-secondary/60 focus-visible:outline-none lg:hidden"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      {/* Method first: no "enter an amount first" dead dropdown. */}
      <fieldset className="mt-3">
        <legend className="mb-2 text-sm font-medium text-muted-foreground">{t.method}</legend>
        <div className="grid grid-cols-3 gap-2">
          {paymentMethods.map((m) => {
            const value = methodValue(m);
            const Icon = methodIcon(m.methodKind);
            return (
              <label key={value} className="relative">
                <input
                  type="radio"
                  name={`${ids}-method`}
                  value={value}
                  checked={method === value}
                  onChange={() => setMethod(value)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border px-2 text-center text-xs font-semibold transition-colors sm:text-sm',
                    'peer-checked:border-secondary peer-checked:bg-secondary/10 peer-checked:text-foreground',
                    'peer-focus-visible:ring-[3px] peer-focus-visible:ring-secondary/50',
                    'hover:bg-muted',
                  )}
                >
                  <Icon className="hidden size-4 shrink-0 min-[400px]:block" aria-hidden />
                  <span className="truncate">{t.kind[m.methodKind]}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4">
        <span id={`${ids}-presets`} className="sr-only">
          {t.presets}
        </span>
        <div role="group" aria-labelledby={`${ids}-presets`} className="grid grid-cols-4 gap-2">
          {presets.map((p) => {
            const active = amount === p;
            return (
              <button
                key={p}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setAmount(p);
                  setTouched(true);
                  setPhase('idle');
                }}
                className={cn(
                  'min-h-11 rounded-xl border text-sm font-bold tabular-nums transition-colors focus-visible:ring-[3px] focus-visible:ring-secondary/50 focus-visible:outline-none',
                  active
                    ? 'border-transparent bg-primary text-primary-foreground dark:bg-secondary dark:text-ocean-deep'
                    : 'border-border hover:bg-muted',
                )}
              >
                <bdi dir="ltr">${p}</bdi>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor={`${ids}-amount`} className="mb-1.5 block text-sm font-medium text-muted-foreground">
          {t.amount}
        </label>
        <div className="flex items-stretch gap-3">
          <div
            dir="ltr"
            className={cn(
              'flex min-h-12 flex-1 items-center rounded-xl border bg-background ps-3 focus-within:ring-[3px] focus-within:ring-secondary/50',
              error ? 'border-destructive' : 'border-input',
            )}
          >
            <span className="text-lg font-bold text-muted-foreground" aria-hidden>
              $
            </span>
            <input
              id={`${ids}-amount`}
              name="amountUsd"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
              value={amount}
              placeholder="0.00"
              aria-invalid={!!error}
              aria-describedby={`${ids}-hint ${error ? `${ids}-error` : ''}`}
              onChange={(e) => {
                setAmount(e.target.value.replace(/[^\d.]/g, ''));
                setPhase('idle');
              }}
              onBlur={() => setTouched(true)}
              className="h-full w-full min-w-0 bg-transparent px-2 text-lg font-bold tabular-nums outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          {after !== null && (
            <div className="flex items-center gap-2">
              <ClimbPreview from={available} to={after} shown={shown} />
              <div className="hidden text-xs leading-tight sm:block">
                <div className="text-muted-foreground">{t.afterTopUp}</div>
                <Amount cents={after} shown={shown} className="text-sm font-bold" />
              </div>
            </div>
          )}
        </div>
        {after !== null && (
          <p className="mt-1.5 text-xs text-muted-foreground sm:hidden">
            {t.afterTopUp} <Amount cents={after} shown={shown} className="font-bold text-foreground" />
          </p>
        )}
        {error && (
          <p id={`${ids}-error`} className="mt-1.5 text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <p id={`${ids}-hint`} className="mt-2 flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-secondary" aria-hidden />
          <span>{t.hint(minLabel, maxLabel)}</span>
        </p>
      </div>

      <button
        ref={submitRef}
        type="submit"
        disabled={phase === 'redirecting'}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 text-base font-bold text-ocean-deep transition-colors hover:bg-secondary/90 focus-visible:ring-[3px] focus-visible:ring-secondary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none disabled:opacity-70"
      >
        {phase === 'redirecting' ? (
          <>
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            {t.redirecting}
          </>
        ) : (
          <>
            {t.submit}
            <ExternalLink className="size-4 rtl:-scale-x-100" aria-hidden />
            <span className="sr-only">{t.opensProvider}</span>
          </>
        )}
      </button>
      <div role="status" aria-live="polite">
        <AnimatePresence>
          {phase === 'lab' && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-2 text-center text-xs text-muted-foreground"
            >
              {t.labRedirect}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
