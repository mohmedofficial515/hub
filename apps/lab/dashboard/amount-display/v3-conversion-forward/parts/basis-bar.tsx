import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { fill, messages } from '../i18n';
import { CurrencySign } from './currency-sign';
import { showsSign, useEnv } from './env';

/**
 * Persistent, calm basis bar under the topbar on money pages. It states the basis in words where the money is:
 * display currency, how conversion happens, what stays in USD. Collapses to a one-line chip on scroll and below sm.
 */
export function BasisBar({ forceCollapsed }: { forceCollapsed?: boolean }) {
  const env = useEnv();
  const t = useT(messages);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 90);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const collapsed = forceCollapsed || scrolled;
  const usd = env.display === 'USD';
  const sign = showsSign(env, env.display, false);

  const badge = (
    <span dir="ltr" className="inline-flex items-center gap-1.5 rounded-md bg-background px-1.5 py-0.5 font-bold text-foreground" style={{ ['--sign-box' as string]: '1em' }}>
      {sign && <CurrencySign code={env.display} />}
      <span dir="ltr">{env.display}</span>
    </span>
  );
  const basis = usd ? t.basisUsd : t.basisConverted;

  return (
    <div className="px-3 pb-2 lg:px-8" data-testid="basis-bar" data-collapsed={collapsed}>
      {/* Chip: below sm always, above sm once the page scrolled. */}
      <button
        type="button"
        onClick={() => env.openReceipt()}
        className={cn(
          'min-h-11 items-center gap-1.5 rounded-full border bg-muted/70 px-3 text-11 font-medium text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:min-h-8',
          collapsed ? 'inline-flex' : 'inline-flex sm:hidden',
        )}
      >
        {badge}
        <span>{usd ? t.basisChipUsd : t.basisChip}</span>
        <Info className="size-3.5" aria-hidden />
        <span className="sr-only">{t.howCalc}</span>
      </button>
      {/* Bar */}
      <div
        className={cn(
          'flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border bg-muted/50 px-3 py-2 text-12 text-muted-foreground',
          collapsed ? 'hidden' : 'hidden sm:flex',
        )}
      >
        {badge}
        <span>{basis}</span>
        <span aria-hidden className="text-border">
          ·
        </span>
        <span>{fill(t.basisBalances, { cur: 'USD' })}</span>
        <button
          type="button"
          onClick={() => env.openReceipt()}
          className="ms-auto inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 font-bold text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          <Info className="size-3.5" aria-hidden />
          {t.howCalc}
        </button>
      </div>
    </div>
  );
}
