import { motion, useReducedMotion } from 'framer-motion';
import { Gift, Sparkles } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import type { LoyaltySummary } from '@lab/mocks/wallet';
import { messages } from '../i18n';
import { formatInt, formatUsd } from './money';
import { focusRing, useShown } from './shared';

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
        'relative shrink-0 rounded-b-[28px] rounded-t-sm border-x-[3px] border-b-[3px] border-amber-600/70 dark:border-secondary-foreground/60',
        sizeClass,
      )}
    >
      <div className="absolute inset-0 overflow-hidden rounded-b-[25px]">
        <motion.div
          className="absolute inset-0 bg-gradient-to-t from-amber-400 to-secondary-foreground will-change-transform"
          initial={reduce ? false : { y: '100%' }}
          animate={{ y: `${100 - pct}%` }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 80, damping: 18, delay: 0.15 }}
        >
          {slicePct > 0 && (
            <div
              className="absolute inset-x-0 top-0 border-t-2 border-dashed border-amber-800/70 bg-[repeating-linear-gradient(135deg,rgb(146_64_14/0.25)_0_5px,transparent_5px_10px)]"
              style={{ height: `${slicePct}%` }}
            />
          )}
        </motion.div>
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
  const shown = useShown();
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
        {/* The $ value is money: it follows the eye toggle (count only while hidden). */}
        {shown && (
          <p className="text-sm text-muted-foreground">
            {t.points.worth}{' '}
            <bdi dir="ltr" className="font-bold text-foreground tabular-nums">
              {formatUsd(previewUsd(pts, loyalty.redemption.pointValueUsd))}
            </bdi>
          </p>
        )}
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

