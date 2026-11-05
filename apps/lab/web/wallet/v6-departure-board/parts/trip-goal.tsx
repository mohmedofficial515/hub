import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Check, Pin } from 'lucide-react';
import { useT } from '@lab/i18n';
import { topUpLimits } from '@lab/mocks/wallet';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import type { BoardRow } from './departure-board';
import { ceilDollars, gapTo, ltr, usd } from './money';
import { ringLight } from './rings';

/** Whole-percent progress from decimal strings via BigInt cents (no floats on the amounts). */
function percent(have: string, of: string): number {
  const cents = (s: string) => {
    const [i, f = ''] = s.split('.');
    return BigInt(i) * BigInt(100) + BigInt((f + '00').slice(0, 2));
  };
  const total = cents(of);
  if (total === BigInt(0)) return 100;
  const p = Number((cents(have) * BigInt(100)) / total);
  return Math.max(0, Math.min(100, p));
}

/** Monzo-pot style goal for one pinned board row. Lab: stored per device (server-side goals need backend). */
export function TripGoal({
  row,
  available,
  shown,
  frozen,
  onComplete,
}: {
  row: BoardRow | undefined;
  available: string | null;
  shown: boolean;
  frozen: boolean;
  onComplete: (amount: string) => void;
}) {
  const t = useT(messages);
  const reduce = useReducedMotion();

  if (!row) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
        <Pin className="size-4 shrink-0" aria-hidden />
        {t.goalEmpty}
      </div>
    );
  }

  const pct = available ? percent(available, row.price) : 0;
  const gap = available ? gapTo(row.price, available, String(topUpLimits.minUsd)) : null;
  const fill = gap ? ceilDollars(gap) : null;

  return (
    <section aria-label={`${t.goalEyebrow}: ${row.city}`} className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] rtl:tracking-normal text-muted-foreground">{t.goalEyebrow}</p>
        <span className="text-xs text-muted-foreground">{t.goalDevice}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg font-bold">
          <bdi dir="ltr" className="me-2 font-bold text-secondary-foreground dark:text-secondary-foreground">
            <span className="rounded bg-primary-dark px-1.5 py-0.5 text-sm text-secondary-foreground">{row.code}</span>
          </bdi>
          {row.city}
        </p>
        <p className="text-sm text-muted-foreground">
          {shown && available ? (
            <>
              <bdi dir="ltr" className="font-bold text-foreground tabular-nums">
                {usd(available)}
              </bdi>{' '}
              {t.goalOf}{' '}
              <bdi dir="ltr" className="tabular-nums">
                {usd(row.price)}
              </bdi>
            </>
          ) : (
            // Hidden: the trip price only (prices are not private), never the balance side.
            <bdi dir="ltr" className="font-bold text-foreground tabular-nums">
              {usd(row.price)}
            </bdi>
          )}
        </p>
      </div>

      <div
        role="progressbar"
        aria-label={t.goalEyebrow}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shown ? pct : undefined}
        aria-valuetext={shown ? `${pct}%` : t.goalHidden}
        className="mt-3 h-3 overflow-hidden rounded-full bg-muted"
      >
        {shown && (
          <motion.div
            className={cn('h-full rounded-full', pct >= 100 ? 'bg-secondary' : 'bg-secondary-foreground')}
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: [0.2, 0.7, 0.3, 1] }}
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        {!shown ? (
          <span className="text-muted-foreground">{t.goalHidden}</span>
        ) : pct >= 100 ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
            <Check className="size-4 text-secondary" aria-hidden />
            {t.goalReached}
          </span>
        ) : (
          <span className="font-semibold tabular-nums">{pct}%</span>
        )}
        {shown && fill && !frozen && (
          <button
            type="button"
            onClick={() => onComplete(fill)}
            className={cn('min-h-11 rounded-full bg-primary px-4 font-bold text-white hover:bg-primary/90 dark:bg-secondary dark:text-primary-dark', ringLight)}
          >
            {t.goalComplete(ltr(usd(fill)))}
          </button>
        )}
        {shown && !fill && !frozen && pct >= 100 && (
          <a
            href={row.href}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 font-bold text-white hover:bg-primary/90 dark:bg-secondary dark:text-primary-dark',
              ringLight,
            )}
          >
            {row.search ? t.bookWithBalance : t.searchFlights}
            <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
          </a>
        )}
      </div>
    </section>
  );
}
