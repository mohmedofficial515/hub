import { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowUp, Gift, Loader2, Sparkles } from 'lucide-react';
import { Slider } from '@web/components/ui/slider';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import type { LoyaltySummary } from '@lab/mocks/wallet';
import { messages } from '../i18n';
import { formatInt, formatUsd, ltr } from './money';
import { focusRing } from './shared';

const PT_NICE = [500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
const ptCeiling = (n: number) => PT_NICE.find((x) => x >= n * 1.15) ?? PT_NICE[PT_NICE.length - 1];

/** Preview only, labelled "about": pointValueUsd is a float in the API. Computed in whole cents. */
export function previewUsd(points: number, pointValueUsd: number): string {
  const centsPerPoint = Math.round(pointValueUsd * 10000); // hundredths of a cent
  const cents = Math.floor((points * centsPerPoint) / 100);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

/** The points tank: yellow liquid, a line at the redeem minimum, and the slice that the valve would move. */
export function PointsTank({
  loyalty,
  selected,
  sizeClass = 'h-[150px] w-[72px] sm:h-[220px] sm:w-[96px]',
}: {
  loyalty: LoyaltySummary;
  selected: number;
  sizeClass?: string;
}) {
  const t = useT(messages);
  const reduce = useReducedMotion();
  const pts = loyalty.pointsBalance;
  const scale = ptCeiling(Math.max(pts, loyalty.redemption.minPoints * 2));
  const pct = Math.min(100, (pts / scale) * 100);
  const slicePct = Math.min(pct, (selected / scale) * 100);
  const minPct = (loyalty.redemption.minPoints / scale) * 100;

  return (
    <div
      role="img"
      aria-label={t.points.tankLabel(formatInt(pts))}
      className={cn(
        'relative shrink-0 rounded-b-[28px] rounded-t-sm border-x-[3px] border-b-[3px] border-amber-500/25 dark:border-secondary-foreground/30',
        sizeClass,
      )}
    >
      <div className="absolute inset-0 overflow-hidden rounded-b-[25px]">
        <motion.div
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-amber-400 to-secondary-foreground"
          initial={reduce ? false : { height: '0%' }}
          animate={{ height: `${pct}%` }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 80, damping: 18, delay: 0.15 }}
        />
        {slicePct > 0 && (
          <div
            className="absolute inset-x-0 border-t-2 border-dashed border-amber-800/70 bg-[repeating-linear-gradient(135deg,rgb(146_64_14/0.25)_0_5px,transparent_5px_10px)] transition-[height,bottom] duration-150"
            style={{ bottom: `${pct - slicePct}%`, height: `${slicePct}%` }}
          />
        )}
        <span
          className="absolute inset-x-1 border-t border-dashed border-amber-900/40 dark:border-amber-100/50"
          style={{ bottom: `${minPct}%` }}
        />
      </div>
      {pts === 0 && (
        <span className="absolute inset-0 grid place-items-center text-amber-500/70">
          <Gift className="size-7" aria-hidden />
        </span>
      )}
    </div>
  );
}

export function PointsCaption({ loyalty, failed }: { loyalty: LoyaltySummary; failed?: boolean }) {
  const t = useT(messages);
  const locale = useLocale();
  const pts = loyalty.pointsBalance;
  const tierName = loyalty.tier.name[locale] ?? loyalty.tier.name.en;
  const next = loyalty.nextTier;
  const nextName = next ? (next.name[locale] ?? next.name.en) : '';
  const progress =
    next?.remainingPoints != null ? loyalty.lifetimePoints / (loyalty.lifetimePoints + next.remainingPoints) : 1;

  if (pts === 0 || failed) {
    return (
      <div className="min-w-0 space-y-2">
        <p className="text-xs font-bold tracking-wide text-amber-700 uppercase dark:text-secondary-foreground">
          {t.points.label}
        </p>
        <p className="font-bold text-primary dark:text-white">{t.points.emptyTitle}</p>
        <p className="text-sm text-muted-foreground">{t.points.emptyBody}</p>
        <RewardsLink />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <div>
        <p className="text-xs font-bold tracking-wide text-amber-700 uppercase dark:text-secondary-foreground">
          {t.points.label}
        </p>
        <p className="mt-1 text-2xl font-extrabold text-primary sm:text-3xl dark:text-white">
          <bdi dir="ltr" className="tabular-nums">
            {formatInt(pts)}
          </bdi>{' '}
          <span className="text-base font-bold text-muted-foreground">{t.points.unit}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {t.points.worth}{' '}
          <bdi dir="ltr" className="font-bold text-foreground tabular-nums">
            {formatUsd(previewUsd(pts, loyalty.redemption.pointValueUsd))}
          </bdi>
        </p>
      </div>
      <div className="space-y-1.5">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t.points.tier}</span>
          <span className="rounded-full bg-secondary-foreground px-2.5 py-0.5 text-xs font-bold text-primary dark:text-ocean-deep">
            {tierName}
          </span>
        </p>
        {next?.remainingPoints != null && (
          <>
            <div
              className="h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              aria-label={t.points.toNext(formatInt(next.remainingPoints), nextName)}
            >
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${progress * 100}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              {t.points.toNext(formatInt(next.remainingPoints), nextName)}
            </p>
          </>
        )}
      </div>
      <RewardsLink />
    </div>
  );
}

function RewardsLink() {
  const t = useT(messages);
  return (
    <a
      href="#rewards"
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-bold text-teal-700 underline-offset-4 hover:underline dark:text-secondary',
        focusRing,
      )}
    >
      <Sparkles className="size-4" aria-hidden />
      {t.points.rewards}
    </a>
  );
}

interface ValveProps {
  loyalty: LoyaltySummary;
  frozen: boolean;
  selected: number;
  onSelected: (n: number) => void;
  onRedeem: (points: number) => Promise<{ amountUsd: string; points: number }>;
}

/**
 * The valve between the tanks: choose points (slider mirrored by a number field), see "adds about $X", convert.
 * On success a yellow stream runs toward the cash tank; the credited amount shown is the server's `amountUsd`.
 */
export function Valve({ loyalty, frozen, selected, onSelected, onRedeem }: ValveProps) {
  const t = useT(messages);
  const locale = useLocale();
  const reduce = useReducedMotion();
  const ids = useId();
  const { minPoints, enabled, pointValueUsd } = loyalty.redemption;
  const maxPoints = Math.min(loyalty.redemption.maxPoints, loyalty.pointsBalance);
  const canRedeem = enabled && !frozen && maxPoints >= minPoints;
  const [text, setText] = useState(String(selected));
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setText(String(selected)), [selected]);

  const set = (n: number) => {
    setError(null);
    setMessage(null);
    onSelected(Math.max(0, Math.min(maxPoints, Math.round(n))));
  };

  const submit = async () => {
    if (selected < minPoints) {
      setError(t.valve.belowMin(formatInt(minPoints)));
      return;
    }
    setBusy(true);
    setError(null);
    const result = await onRedeem(selected);
    setBusy(false);
    setFlow((f) => f + 1);
    setMessage(t.valve.done(ltr(formatInt(result.points)), ltr(formatUsd(result.amountUsd))));
  };

  const reason = frozen ? t.valve.frozen : !enabled ? t.valve.disabled : maxPoints < minPoints ? t.valve.belowMin(formatInt(minPoints)) : null;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className="relative flex h-full flex-col gap-3 rounded-2xl border border-dashed border-amber-500/40 bg-amber-50/60 p-4 dark:border-secondary-foreground/25 dark:bg-white/[0.03]"
    >
      {/* pipe + stream toward the cash tank (start side on wide screens, up when stacked) */}
      <div aria-hidden className="relative hidden h-2 overflow-hidden rounded-full border border-dashed border-amber-500/50 xl:block dark:border-secondary-foreground/40">
        <AnimatePresence>
          {flow > 0 && !reduce && (
            <motion.span
              key={flow}
              className="absolute inset-y-0 w-1/2 rounded-full bg-gradient-to-r from-amber-400 to-secondary-foreground rtl:bg-gradient-to-l"
              initial={{ insetInlineStart: '100%' }}
              animate={{ insetInlineStart: '-50%' }}
              transition={{ duration: 0.7, ease: 'easeInOut' }}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary-foreground text-primary dark:text-ocean-deep"
        >
          <ArrowLeft className="hidden size-4 xl:block rtl:rotate-180" />
          <ArrowUp className="size-4 xl:hidden" />
        </span>
        <h3 id={`${ids}-title`} className="text-sm font-bold text-primary dark:text-white">
          {t.valve.title}
        </h3>
      </div>

      {reason ? (
        <p className="text-sm text-muted-foreground">{reason}</p>
      ) : (
        <>
          <div className="space-y-1">
            <label htmlFor={`${ids}-pts`} className="text-xs font-medium text-muted-foreground">
              {t.valve.pointsLabel}
            </label>
            <input
              id={`${ids}-pts`}
              inputMode="numeric"
              dir="ltr"
              value={text}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, '').slice(0, 7);
                setText(v);
                if (v) set(Number(v));
              }}
              onBlur={() => setText(String(selected))}
              className={cn(
                'h-11 w-full rounded-lg border border-input bg-background px-3 text-end text-lg font-bold tabular-nums',
                focusRing,
              )}
              aria-describedby={`${ids}-preview`}
            />
          </div>
          <Slider
            dir={dir}
            min={0}
            max={maxPoints}
            step={50}
            value={[selected]}
            onValueChange={([v]) => set(v)}
            aria-label={t.valve.pointsLabel}
            className="py-3"
          />
          <div className="flex gap-1.5" role="group" aria-label={t.valve.pointsLabel}>
            {(
              [
                [t.valve.min, minPoints],
                [t.valve.half, Math.max(minPoints, Math.floor(maxPoints / 100) * 50)],
                [t.valve.all, maxPoints],
              ] as const
            ).map(([label, n]) => (
              <button
                key={label}
                type="button"
                onClick={() => set(n)}
                aria-pressed={selected === n}
                className={cn(
                  'min-h-11 flex-1 rounded-lg border text-xs font-bold transition-colors',
                  selected === n
                    ? 'border-amber-500 bg-secondary-foreground text-primary dark:text-ocean-deep'
                    : 'border-amber-500/30 bg-background hover:bg-amber-100/60 dark:hover:bg-white/10',
                  focusRing,
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p id={`${ids}-preview`} className="text-sm">
            <span className="text-muted-foreground">{t.valve.preview} </span>
            <bdi dir="ltr" className="font-extrabold text-primary tabular-nums dark:text-white">
              {formatUsd(previewUsd(selected, pointValueUsd))}
            </bdi>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">{t.valve.previewNote}</span>
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className={cn(
              'mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-secondary-foreground px-4 text-sm font-extrabold text-primary shadow-sm transition-transform hover:brightness-105 active:scale-[0.98] disabled:opacity-70 dark:text-ocean-deep',
              focusRing,
            )}
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {busy ? t.valve.working : t.valve.cta}
          </button>
        </>
      )}
      <p aria-live="polite" className={cn('text-sm', error ? 'text-destructive' : 'font-medium text-teal-800 dark:text-secondary')}>
        {error ?? message}
      </p>
    </section>
  );
}
