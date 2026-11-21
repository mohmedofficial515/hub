import { useId, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useT } from '@lab/i18n';
import type { LoyaltySummary } from '@lab/mocks/wallet';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { groupInt, pointsToUsd, usd } from './money';
import { ringBar as focusRing } from './rings';

const STEP = 50;

/**
 * Inline points → wallet conversion (same endpoint as the rewards page: POST /loyalty/redeem { points }).
 * Lives inside the status bar so the converted value lands in the balance right above it and re-flips the board.
 */
export function RedeemPanel({
  loyalty,
  shown,
  onRedeem,
}: {
  loyalty: LoyaltySummary;
  shown: boolean;
  onRedeem: (points: number) => Promise<string>;
}) {
  const t = useT(messages);
  const id = useId();
  const { minPoints, pointValueUsd } = loyalty.redemption;
  const max = Math.min(loyalty.redemption.maxPoints, loyalty.pointsBalance);
  const [raw, setRaw] = useState(String(max));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const belowMin = max < minPoints;
  const points = /^\d{1,7}$/.test(raw) ? Number(raw) : NaN;
  const valid = Number.isInteger(points) && points >= minPoints && points <= max;
  const preview = valid ? pointsToUsd(points, pointValueUsd) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onRedeem(points);
      setRaw(String(Math.max(0, Math.min(loyalty.redemption.maxPoints, loyalty.pointsBalance - points))));
    } catch {
      // Disabled, below minimum, network… POST /loyalty/redeem is atomic, so no points were used.
      setFailed(true);
      window.setTimeout(() => document.getElementById(`${id}-err`)?.focus(), 30);
    } finally {
      setBusy(false);
    }
  }

  if (belowMin) {
    return (
      <div className="border-t border-white/10 px-5 py-4 text-sm md:px-7">
        {t.redeemBelowMin(groupInt(minPoints))}{' '}
        <a href="#rewards" className={cn('font-semibold text-secondary-foreground underline underline-offset-4', focusRing)}>
          {t.rewardsLink}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border-t border-white/10 bg-black/15 px-5 py-5 md:px-7" noValidate>
      <p className="font-bold">{t.redeemTitle}</p>
      {!belowMin && (
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={`${id}-pts`} className="text-sm text-white/80">
                {t.redeemPoints}
              </label>
              <span className="text-xs text-white/70">{t.redeemMinMax(groupInt(minPoints), groupInt(max))}</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                aria-label={t.pointsSlider}
                min={minPoints}
                max={max}
                step={STEP}
                value={Number.isFinite(points) ? Math.min(Math.max(points, minPoints), max) : minPoints}
                onChange={(e) => {
                  setFailed(false);
                  setRaw(e.target.value);
                }}
                className={cn('h-11 min-w-0 flex-1 cursor-pointer accent-[var(--secondary-foreground)]', focusRing)}
                dir="ltr"
              />
              <input
                id={`${id}-pts`}
                name="points"
                autoComplete="off"
                inputMode="numeric"
                dir="ltr"
                value={raw}
                aria-invalid={!valid}
                aria-describedby={`${id}-hint`}
                onChange={(e) => {
                  setFailed(false);
                  setRaw(e.target.value.replace(/[^\d]/g, ''));
                }}
                className={cn(
                  'h-11 w-24 rounded-lg border border-white/20 bg-white/10 px-3 text-center font-semibold tabular-nums text-white',
                  focusRing,
                )}
              />
              <button
                type="button"
                onClick={() => setRaw(String(max))}
                className={cn('h-11 min-w-11 rounded-lg px-3 text-sm font-semibold text-white/90 hover:bg-white/10', focusRing)}
              >
                {t.redeemAll}
              </button>
            </div>
            <p id={`${id}-hint`} className="mt-2 text-xs text-white/70">
              {valid ? t.redeemNote : t.redeemInvalid}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:flex-col md:items-end">
            {/* Owner decision: while hidden, points carry no $ value anywhere. */}
            <p className="text-sm text-white/80">
              {shown ? (
                <>
                  {t.redeemPreview}{' '}
                  <bdi dir="ltr" className="text-lg font-bold tabular-nums text-white">
                    ≈ {preview ? usd(preview) : '—'}
                  </bdi>
                </>
              ) : (
                t.redeemValueHidden
              )}
            </p>
            <button
              type="submit"
              disabled={!valid || busy}
              className={cn(
                'inline-flex min-h-11 items-center gap-2 rounded-full bg-secondary-foreground px-5 font-bold text-primary-dark transition hover:brightness-105 disabled:opacity-60',
                focusRing,
              )}
            >
              {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
              {busy ? t.redeeming : failed ? t.redeemRetry : t.redeemConfirm}
            </button>
          </div>
        </div>
      )}
      {failed && (
        <p
          id={`${id}-err`}
          tabIndex={-1}
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg bg-red-500/15 px-3 py-2.5 text-sm font-medium text-white outline-none ring-1 ring-red-300/40"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-300" aria-hidden />
          {t.redeemError}
        </p>
      )}
    </form>
  );
}
