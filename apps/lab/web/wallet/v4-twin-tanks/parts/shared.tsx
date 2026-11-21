import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { formatUsd } from './money';

const SHOWN_KEY = 'wallet.balance.shown';

/** Balances start hidden; the eye shows them and the choice is remembered in this browser (same key as today). */
export function useAmountsShown() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    try {
      setShown(localStorage.getItem(SHOWN_KEY) === '1');
    } catch {
      /* storage blocked: stay hidden */
    }
  }, []);
  const toggle = () =>
    setShown((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SHOWN_KEY, next ? '1' : '0');
      } catch {
        /* this visit only */
      }
      return next;
    });
  return { shown, toggle };
}

export const ShownContext = createContext(false);
export const useShown = () => useContext(ShownContext);

/**
 * A money amount, isolated LTR. `balance` amounts follow the eye toggle; movements (what a transaction moved)
 * stay visible like today's history.
 */
export function Money({
  value,
  balance = false,
  sign,
  whole,
  className,
}: {
  value: string;
  balance?: boolean;
  sign?: '+' | '−';
  whole?: boolean;
  className?: string;
}) {
  const shown = useShown();
  const t = useT(messages);
  if (balance && !shown) {
    return (
      <span className={cn('tracking-widest', className)}>
        <span aria-hidden>{t.masked}</span>
        <span className="sr-only">{t.hidden}</span>
      </span>
    );
  }
  return (
    <bdi dir="ltr" className={cn('tabular-nums', className)}>
      {sign}
      {formatUsd(value, { whole })}
    </bdi>
  );
}

export function SectionTitle({ title, sub, icon, id }: { title: string; sub?: ReactNode; icon?: ReactNode; id?: string }) {
  return (
    <div className="flex items-start gap-3">
      {icon && (
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary/10 text-secondary dark:bg-secondary/15">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-bold text-primary dark:text-white">
          {title}
        </h2>
        {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

/** Shared focus ring that reads on white, navy and dark surfaces. */
export const focusRing =
  'outline-none focus-visible:ring-[3px] focus-visible:ring-secondary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background';
