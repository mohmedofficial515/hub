import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Eye, EyeOff, Lock, Sparkles } from 'lucide-react';
import { Skeleton } from '@web/components/ui/skeleton';
import { useLocale, useT } from '@lab/i18n';
import type { LoyaltySummary, WalletBalance } from '@lab/mocks/wallet';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { Flap } from './flap';
import { MASK, groupInt, pointsToUsd, usd } from './money';
import { RedeemPanel } from './redeem-panel';
import type { Story } from './log-model';

export const focusRing =
  'outline-none focus-visible:ring-[3px] focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary dark:focus-visible:ring-offset-ocean-deep';

export function StatusBar({
  balance,
  loading,
  shown,
  onToggleShown,
  holds,
  onOpenHold,
  loyalty,
  onRedeem,
}: {
  balance: WalletBalance | null;
  loading: boolean;
  shown: boolean;
  onToggleShown: () => void;
  holds: Story[];
  onOpenHold: (key: string) => void;
  loyalty: LoyaltySummary;
  onRedeem: (points: number) => Promise<string>;
}) {
  const t = useT(messages);
  const rtl = useLocale() === 'ar';
  const reduce = useReducedMotion();
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [credited, setCredited] = useState<string | null>(null);
  const redeemAndReport = async (points: number) => {
    const amount = await onRedeem(points);
    setCredited(amount);
    // The panel unmounts when no points are left; keep focus on the confirmation instead of dropping it to <body>.
    window.setTimeout(() => {
      if (!document.getElementById('v3-redeem')?.contains(document.activeElement)) document.getElementById('v3-redeem-status')?.focus();
    }, 50);
    return amount;
  };
  const frozen = balance?.status === 'FROZEN';
  const Chevron = rtl ? ChevronLeft : ChevronRight;
  const pointsUsd = pointsToUsd(loyalty.pointsBalance, loyalty.redemption.pointValueUsd);
  const canRedeem = !loading && !frozen && loyalty.redemption.enabled && loyalty.pointsBalance > 0;

  return (
    <section
      aria-labelledby="v3-available"
      className="relative overflow-hidden rounded-t-3xl bg-primary text-white shadow-xl shadow-primary/20 dark:bg-ocean-deep dark:shadow-black/30"
    >
      <div className="relative grid gap-5 p-5 md:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        {/* runway lights — decorative */}
      <div aria-hidden className="pointer-events-none absolute inset-x-6 bottom-0 flex justify-between opacity-40">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className="size-1 rounded-full bg-secondary-foreground" />
        ))}
      </div>


        <div className="min-w-0">
          <p id="v3-available" className="text-sm font-medium text-white/75">
            {t.available}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {loading || !balance ? (
              <Skeleton className="h-12 w-56 bg-white/15" />
            ) : (
              <Flap
                text={shown ? usd(balance.available) : `$${MASK}`}
                srText={shown ? usd(balance.available) : t.hiddenStatus}
                className="text-4xl font-bold tabular-nums md:text-5xl"
                tileClassName="bg-white/[0.09]"
              />
            )}
            <button
              type="button"
              onClick={onToggleShown}
              aria-pressed={shown}
              aria-label={shown ? t.hideAmounts : t.showAmounts}
              title={shown ? t.hideAmounts : t.showAmounts}
              className={cn('grid size-11 place-items-center rounded-full bg-white/10 transition hover:bg-white/20', focusRing)}
            >
              {shown ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
          <p className="mt-2 text-sm text-white/75">{t.availableHint}</p>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
          {holds.length > 0 && balance && (
            <button
              type="button"
              onClick={() => onOpenHold(holds[0].key)}
              className={cn(
                'inline-flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-start text-sm transition hover:bg-white/15',
                focusRing,
              )}
            >
              <Lock className="size-4 shrink-0 text-amber-300" aria-hidden />
              <span>
                <bdi dir="ltr" className="font-semibold tabular-nums">
                  {shown ? usd(balance.reserved) : `$${MASK}`}
                </bdi>{' '}
                {t.hold(holds.length)}
              </span>
              <Chevron className="size-4 shrink-0 opacity-70" aria-hidden />
              <span className="sr-only">{t.holdOpen}</span>
            </button>
          )}

          {loading && <Skeleton className="h-11 w-64 rounded-full bg-white/15" />}
          {!loading && loyalty.redemption.enabled && (
            <div className="inline-flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 rounded-3xl bg-white/10 ps-4 text-sm">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="size-4 text-secondary-foreground" aria-hidden />
                <span className="sr-only">{t.pointsShort}: </span>
                <bdi dir="ltr" className="font-semibold tabular-nums">
                  {groupInt(loyalty.pointsBalance)}
                </bdi>
                <span>{t.points}</span>
                {loyalty.pointsBalance > 0 && (
                  <span className="text-white/75">
                    ≈{' '}
                    <bdi dir="ltr" className="tabular-nums">
                      {shown ? usd(pointsUsd) : `$${MASK}`}
                    </bdi>
                  </span>
                )}
              </span>
              {canRedeem ? (
                <button
                  type="button"
                  aria-expanded={redeemOpen}
                  aria-controls="v3-redeem"
                  onClick={() => setRedeemOpen((o) => !o)}
                  className={cn(
                    'min-h-11 rounded-full bg-secondary-foreground px-4 text-sm font-bold text-primary-dark transition hover:brightness-105',
                    focusRing,
                  )}
                >
                  {redeemOpen ? t.convertClose : t.convert}
                </button>
              ) : loyalty.pointsBalance === 0 ? (
                <a href="#rewards" className={cn('min-h-11 content-center rounded-full px-3 text-white/85 underline-offset-4 hover:underline', focusRing)}>
                  {t.earnPoints}
                </a>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {redeemOpen && canRedeem && (
          <motion.div
            id="v3-redeem"
            key="redeem"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="relative overflow-hidden"
          >
            <RedeemPanel loyalty={loyalty} shown={shown} onRedeem={redeemAndReport} />
          </motion.div>
        )}
      </AnimatePresence>

      <p id="v3-redeem-status" tabIndex={-1} role="status" aria-live="polite" className={cn('relative px-5 text-sm outline-none md:px-7', credited && 'pb-4')}>
        {credited && (
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary/15 px-3 py-1.5 font-semibold text-white">
            <Check className="size-4 text-secondary" aria-hidden />
            <bdi dir="ltr">{shown ? usd(credited) : `$${MASK}`}</bdi> {t.redeemDone}
          </span>
        )}
      </p>

      {frozen && (
        <div role="status" className="relative flex flex-wrap items-start gap-3 border-t border-white/10 border-s-4 border-s-amber-300 bg-black/25 px-5 py-4 md:px-7">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-bold">{t.frozenTitle}</p>
            <p className="text-sm text-white/85">{t.frozenBody}</p>
          </div>
          <a href="#support" className={cn('inline-flex min-h-11 items-center rounded-full bg-white/10 px-4 text-sm font-semibold hover:bg-white/20', focusRing)}>
            {t.contactSupport}
          </a>
        </div>
      )}
    </section>
  );
}
