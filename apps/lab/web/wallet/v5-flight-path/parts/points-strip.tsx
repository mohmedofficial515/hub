import { useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import type { LoyaltySummary } from '@lab/mocks/wallet';
import { messages } from '../i18n';
import { LabLink } from './lab-link';
import { formatPoints, formatUsd, isolate, pointsToCents, toCents } from './money';
import { rewardsHref } from './search-href';

/** Inline points → wallet redemption (same API as the rewards page: POST /loyalty/redeem). */
export function PointsStrip({
  loyalty,
  shown,
  frozen,
  onRedeem,
  onRedeemed,
  onFocusFallback,
}: {
  loyalty: LoyaltySummary;
  shown: boolean;
  frozen: boolean;
  onRedeem: (points: number) => Promise<{ amountUsd: string; points: number }>;
  onRedeemed: (message: string) => void;
  /** Called after a redemption when the trigger is gone (points fell below the minimum): focus the result. */
  onFocusFallback: () => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const ids = useId();
  const reduce = useReducedMotion();
  const { pointsBalance, redemption, tier, nextTier } = loyalty;
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState(String(Math.min(pointsBalance, redemption.maxPoints)));
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const canRedeem = redemption.enabled && !frozen && pointsBalance >= redemption.minPoints;
  const n = Number(points);
  const pointsError =
    points === '' || !Number.isInteger(n)
      ? t.belowMin(isolate(formatPoints(redemption.minPoints)))
      : n < redemption.minPoints
        ? t.belowMin(isolate(formatPoints(redemption.minPoints)))
        : n > Math.min(redemption.maxPoints, pointsBalance)
          ? t.aboveMax(isolate(formatPoints(Math.min(redemption.maxPoints, pointsBalance))))
          : null;
  // Errors appear only after the customer edits or leaves the field (not on the prefilled default).
  const shownError = touched ? pointsError : null;
  const tierName = tier.name[locale] ?? tier.name.en;
  const nextName = nextTier ? (nextTier.name[locale] ?? nextTier.name.en) : null;
  const value = pointsToCents(pointsBalance, redemption.pointValueUsd);

  /** The form unmounts on close, so focus goes back to the trigger (or the result when the trigger is gone). */
  const close = (afterRedeem: boolean) => {
    setOpen(false);
    setTouched(false);
    requestAnimationFrame(() => {
      if (triggerRef.current) triggerRef.current.focus();
      else if (afterRedeem) onFocusFallback();
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (pointsError || busy) return;
    setBusy(true);
    const result = await onRedeem(n);
    setBusy(false);
    const p = isolate(formatPoints(result.points));
    onRedeemed(shown ? t.redeemed(p, isolate(formatUsd(toCents(result.amountUsd)))) : t.redeemedHidden(p));
    close(true);
  };

  return (
    <div className="rounded-2xl bg-secondary-foreground text-ocean-deep">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 sm:px-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ocean-deep/10" aria-hidden>
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-base font-extrabold whitespace-nowrap">
            {t.pointsLabel(formatPoints(pointsBalance))}
            {/* Hidden amounts: the count stays, the dollar value does not. */}
            {pointsBalance > 0 && shown && (
              <span className="ms-2 font-bold">
                ≈{' '}
                <bdi dir="ltr" className="tabular-nums">
                  {formatUsd(value)}
                </bdi>
              </span>
            )}
          </p>
          <p className="text-xs font-medium text-ocean-deep/80">
            {frozen
              ? t.frozenPoints
              : pointsBalance === 0
                ? t.earnPoints
                : pointsBalance < redemption.minPoints
                  ? t.needMore(formatPoints(redemption.minPoints - pointsBalance))
                  : nextTier?.remainingPoints && nextName
                    ? t.tierLine(tierName, formatPoints(nextTier.remainingPoints), nextName)
                    : t.tierOnly(tierName)}
            {canRedeem && (
              <>
                {' · '}
                <LabLink
                  href={rewardsHref(locale)}
                  className="rounded font-bold underline underline-offset-2 focus-visible:ring-[3px] focus-visible:ring-ocean-deep/40 focus-visible:outline-none"
                >
                  {t.rewardsTiers}
                </LabLink>
              </>
            )}
          </p>
        </div>
        {canRedeem ? (
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={open}
            aria-controls={`${ids}-form`}
            onClick={() => setOpen((o) => !o)}
            className="min-h-11 w-full rounded-xl bg-ocean-deep px-4 text-sm font-bold text-white transition-colors sm:w-auto hover:bg-ocean-deep/90 focus-visible:ring-[3px] focus-visible:ring-ocean-deep/40 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-foreground focus-visible:outline-none"
          >
            {t.redeemCta}
          </button>
        ) : (
          !frozen && (
            <LabLink
              href={rewardsHref(locale)}
              className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold underline underline-offset-4 focus-visible:ring-[3px] focus-visible:ring-ocean-deep/40 focus-visible:outline-none"
            >
              {t.rewardsLink}
            </LabLink>
          )
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && canRedeem && (
          <motion.form
            id={`${ids}-form`}
            onSubmit={submit}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-end gap-3 border-t border-ocean-deep/15 p-3 sm:px-4">
              <div className="min-w-0 flex-1 basis-56">
                <label htmlFor={`${ids}-points`} className="mb-1 block text-xs font-bold">
                  {t.pointsToMove}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={`${ids}-points`}
                    name="points"
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    value={points}
                    onChange={(e) => {
                      setPoints(e.target.value.replace(/\D/g, ''));
                      setTouched(true);
                    }}
                    onBlur={() => setTouched(true)}
                    aria-invalid={!!shownError}
                    aria-describedby={`${ids}-preview`}
                    className={cn(
                      'h-11 w-full min-w-0 rounded-xl border-2 bg-white/70 px-3 text-base font-bold tabular-nums text-ocean-deep outline-none focus-visible:ring-[3px] focus-visible:ring-ocean-deep/40',
                      shownError ? 'border-red-700' : 'border-ocean-deep/20',
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPoints(String(Math.min(pointsBalance, redemption.maxPoints)));
                      setTouched(true);
                    }}
                    className="min-h-11 shrink-0 rounded-xl border-2 border-ocean-deep/25 px-3 text-xs font-bold hover:bg-ocean-deep/10 focus-visible:ring-[3px] focus-visible:ring-ocean-deep/40 focus-visible:outline-none"
                  >
                    {t.allPoints}
                  </button>
                </div>
                <p id={`${ids}-preview`} className="mt-1 text-xs font-medium">
                  {shownError ? (
                    <span className="font-bold text-red-800">{shownError}</span>
                  ) : pointsError ? null : shown ? (
                    <>
                      {t.previewAbout}{' '}
                      <bdi dir="ltr" className="font-bold tabular-nums">
                        {formatUsd(pointsToCents(n, redemption.pointValueUsd))}
                      </bdi>{' '}
                      · {t.exactNote}
                    </>
                  ) : (
                    t.previewHidden
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="min-h-11 rounded-xl px-3 text-sm font-bold hover:bg-ocean-deep/10 focus-visible:ring-[3px] focus-visible:ring-ocean-deep/40 focus-visible:outline-none"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex min-h-11 items-center gap-2 rounded-xl bg-ocean-deep px-4 text-sm font-bold text-white hover:bg-ocean-deep/90 focus-visible:ring-[3px] focus-visible:ring-ocean-deep/40 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-foreground focus-visible:outline-none disabled:opacity-60"
                >
                  {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
                  {busy ? t.redeeming : t.confirmRedeem}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
