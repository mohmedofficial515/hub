import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Infinity as InfinityIcon, Loader2, Lock, Plane, X, XCircle } from 'lucide-react';
import { Skeleton } from '@web/components/ui/skeleton';
import { useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { formatUsd, fromCents, ltr, toCents } from './money';
import { focusRing, Money, useShown } from './shared';

/** Available, counting up in whole cents when it changes (e.g. after a redeem). Static under reduced motion. */
function CountUp({ value }: { value: string }) {
  const reduce = useReducedMotion();
  const [shownCents, setShownCents] = useState(() => toCents(value));
  const prev = useRef(toCents(value));
  useEffect(() => {
    const to = toCents(value);
    const from = prev.current;
    prev.current = to;
    if (reduce || from === to) {
      setShownCents(to);
      return;
    }
    const controls = animate(Number(from), Number(to), {
      duration: 0.9,
      ease: 'easeOut',
      onUpdate: (v) => setShownCents(BigInt(Math.round(v))),
    });
    return () => controls.stop();
  }, [value, reduce]);
  return (
    <bdi dir="ltr" className="tabular-nums">
      {formatUsd(fromCents(shownCents))}
    </bdi>
  );
}

export function CashCaption({
  available,
  reserved,
  holdLabel,
  frozen,
  bookHref,
  onHold,
}: {
  available: string;
  reserved: string;
  holdLabel: string | null;
  frozen: boolean;
  /** Flight results pre-filled from a saved search (same tab). */
  bookHref: string;
  onHold: () => void;
}) {
  const t = useT(messages);
  const shown = useShown();
  const t2 = t.cash;
  const hasHold = toCents(reserved) > 0n;
  const empty = toCents(available) <= 0n;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div>
        <p className="text-xs font-bold tracking-wide text-primary/70 uppercase dark:text-white/70">{t2.label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{t2.available}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-3xl leading-tight font-extrabold text-primary sm:text-4xl dark:text-white">
            {shown ? <CountUp value={available} /> : <Money value={available} balance />}
          </p>
          {!frozen && (
            <p className="inline-flex items-center gap-1 text-sm font-bold text-teal-800 sm:text-base dark:text-secondary">
              <InfinityIcon className="size-4 shrink-0" aria-hidden />
              {t2.noCap}
            </p>
          )}
        </div>
      </div>

      {hasHold && (
        <button
          type="button"
          onClick={onHold}
          className={cn(
            'flex min-h-11 items-center gap-2 rounded-xl border border-secondary/40 bg-secondary/[0.07] px-3 py-2 text-start text-xs hover:bg-secondary/15',
            focusRing,
          )}
        >
          <span
            aria-hidden
            className="h-6 w-2.5 shrink-0 rounded-sm bg-[repeating-linear-gradient(135deg,var(--secondary)_0_3px,color-mix(in_oklab,var(--secondary)_45%,transparent)_3px_6px)]"
          />
          <span className="min-w-0">
            <span className="block font-bold text-foreground">
              {t2.held} <Money value={reserved} balance />
            </span>
            <span className="line-clamp-2 block text-muted-foreground">{t2.heldFor(holdLabel ?? t2.heldBooking)}</span>
          </span>
        </button>
      )}

      {frozen ? (
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-400/30 dark:bg-amber-400/10">
          <p className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-100">
            <Lock className="size-4" aria-hidden />
            {t2.frozenTitle}
          </p>
          <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">{t2.frozenBody}</p>
          <a href="#support" className={cn('mt-1 inline-flex min-h-11 items-center font-bold text-amber-900 underline underline-offset-4 dark:text-amber-100', focusRing)}>
            {t2.contactSupport}
          </a>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t2.noCapHint}</p>
          {!empty && (
          <a
            href={bookHref}
            className={cn(
              'inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-primary px-3 py-1.5 text-center text-sm leading-tight font-extrabold sm:w-fit sm:px-4 text-primary hover:bg-primary hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-ocean-deep',
              focusRing,
            )}
          >
            <Plane className="size-4 rtl:-scale-x-100" aria-hidden />
            {t2.bookWith}
          </a>
          )}
        </>
      )}
    </div>
  );
}

/** Lab-only: the top-up the customer is returning from (`?payment=`). */
export const RETURNING_TOPUP = '100.00';

export function TopUpBanner({
  result,
  onRetry,
}: {
  result: 'pending' | 'done' | 'failed' | null;
  onRetry: () => void;
}) {
  const t = useT(messages);
  const [dismissed, setDismissed] = useState(false);
  // The live region and its box exist first; the text arrives after mount, so screen readers announce the result.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 250);
    return () => window.clearTimeout(id);
  }, []);
  const amount = ltr(formatUsd(RETURNING_TOPUP));
  const show = result && !dismissed;
  return (
    <div aria-live="polite" role="status">
      {show && (
        <div
          className={cn(
            'flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm',
            result === 'pending' && 'border-secondary/40 bg-card text-foreground',
            result === 'done' && 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100',
            result === 'failed' && 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-100',
          )}
        >
          {result === 'pending' && <Loader2 className="size-5 shrink-0 motion-safe:animate-spin text-secondary" aria-hidden />}
          {result === 'done' && <CheckCircle2 className="size-5 shrink-0" aria-hidden />}
          {result === 'failed' && <XCircle className="size-5 shrink-0" aria-hidden />}
          <p className="min-h-5 flex-1">
            {mounted && result === 'pending' && t.banner.pending(amount)}
            {mounted && result === 'done' && t.banner.done(amount)}
            {mounted && result === 'failed' && t.banner.failed}
          </p>
          {result === 'failed' && (
            <button
              type="button"
              onClick={onRetry}
              className={cn('min-h-11 shrink-0 rounded-xl bg-rose-700 px-4 font-bold text-white hover:bg-rose-800', focusRing)}
            >
              {t.banner.retry}
            </button>
          )}
          {result !== 'pending' && (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label={t.banner.dismiss}
              className={cn('grid size-11 shrink-0 place-items-center rounded-full hover:bg-black/5 dark:hover:bg-white/10', focusRing)}
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PanelSkeleton() {
  const t = useT(messages);
  return (
    <div aria-busy="true" aria-label={t.loading} className="space-y-10">
      <div className="rounded-3xl border border-border bg-card p-6 dark:bg-secondary-dark">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="relative h-[220px] w-[88px] shrink-0 overflow-hidden rounded-b-[32px] rounded-t-sm border-x-[3px] border-b-[3px] border-border">
                <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_30%,color-mix(in_oklab,var(--muted-foreground)_15%,transparent)_50%,transparent_70%)] bg-[length:200%_100%] motion-safe:animate-[shimmer_1.6s_linear_infinite]" />
              </div>
              <div className="flex-1 space-y-3 pt-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-9 w-36" />
                <Skeleton className="h-11 w-full max-w-60" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </div>
      <style>{'@keyframes shimmer{from{background-position:200% 0}to{background-position:-200% 0}}'}</style>
    </div>
  );
}

