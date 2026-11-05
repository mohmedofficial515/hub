import { useEffect, useId, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Loader2, Sparkles, Wallet } from 'lucide-react';
import { Slider } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import type { LoyaltySummary } from '@lab/mocks/wallet';
import { messages } from '../i18n';
import { formatInt, formatUsd, ltr } from './money';
import { previewUsd } from './points';
import { focusRing, Money, useShown } from './shared';

export const VALVE_INPUT_ID = 'valve-points';

/** Below lg the points side sits after the top-up form: this row keeps points one glance from the balance. */
export function PointsChip({ loyalty, onConvert }: { loyalty: LoyaltySummary; onConvert?: () => void }) {
  const t = useT(messages);
  const locale = useLocale();
  const pts = loyalty.pointsBalance;
  const tierName = loyalty.tier.name[locale] ?? loyalty.tier.name.en;
  const canConvert = !!onConvert && loyalty.redemption.enabled && pts >= loyalty.redemption.minPoints;
  if (pts === 0) return null;
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-50/70 px-3 py-2 lg:hidden dark:border-secondary-foreground/30 dark:bg-white/[0.04]">
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary-foreground text-primary dark:text-ocean-deep">
        <Sparkles className="size-4" />
      </span>
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-extrabold text-primary dark:text-white">
          <bdi dir="ltr" className="tabular-nums">
            {formatInt(pts)}
          </bdi>{' '}
          {t.points.unit}
        </span>
        <span className="text-muted-foreground"> · {tierName}</span>
      </p>
      {canConvert && (
        <button
          type="button"
          onClick={onConvert}
          className={cn(
            'inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2 text-sm font-bold text-teal-800 hover:bg-amber-100/70 dark:text-secondary dark:hover:bg-white/10',
            focusRing,
          )}
        >
          {t.points.convertShort}
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </button>
      )}
    </div>
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
 * The valve under the points tank: choose points (Radix slider mirrored by a number field), see "adds about $X",
 * convert. On success a yellow stream runs toward the cash side; the credited amount is the server's `amountUsd`.
 * Focus never drops: the button is `aria-disabled` while busy (clicks ignored), and the result is announced.
 */
export function Valve({ loyalty, frozen, selected, onSelected, onRedeem }: ValveProps) {
  const t = useT(messages);
  const locale = useLocale();
  const shown = useShown();
  const reduce = useReducedMotion();
  const ids = useId();
  const { minPoints, enabled, pointValueUsd } = loyalty.redemption;
  const maxPoints = Math.min(loyalty.redemption.maxPoints, loyalty.pointsBalance);
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (selected < minPoints) {
      setError(t.valve.belowMin(formatInt(minPoints)));
      return;
    }
    setBusy(true);
    setError(null);
    const result = await onRedeem(selected);
    setBusy(false);
    setFlow((f) => f + 1);
    const pts = ltr(formatInt(result.points));
    setMessage(shown ? t.valve.done(pts, ltr(formatUsd(result.amountUsd))) : t.valve.doneHidden(pts));
  };

  const reason = frozen
    ? t.valve.frozen
    : !enabled
      ? t.valve.disabled
      : maxPoints < minPoints
        ? t.valve.belowMin(formatInt(minPoints))
        : null;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const preview = previewUsd(selected, pointValueUsd);
  // The stream runs from the points side toward the cash side (inline-start), with transform only.
  const streamFrom = dir === 'rtl' ? '-200%' : '200%';
  const streamTo = dir === 'rtl' ? '100%' : '-100%';

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className="relative flex flex-col gap-3 rounded-2xl border border-dashed border-amber-600/50 bg-amber-50/60 p-4 dark:border-secondary-foreground/35 dark:bg-white/[0.03]"
    >
      {/* pipe toward the cash side (wide screens, where cash sits at the inline-start) */}
      <div
        aria-hidden
        className="relative hidden h-2 overflow-hidden rounded-full border border-dashed border-amber-600/50 lg:block dark:border-secondary-foreground/40"
      >
        <AnimatePresence>
          {flow > 0 && !reduce && (
            <motion.span
              key={flow}
              className="absolute inset-y-0 start-0 w-1/2 rounded-full bg-gradient-to-r from-amber-400 to-secondary-foreground will-change-transform rtl:bg-gradient-to-l"
              initial={{ x: streamFrom }}
              animate={{ x: streamTo }}
              exit={{ opacity: 0 }}
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
          {/* wide: an arrow toward the cash side; stacked: a wallet glyph (an arrow would point at the wrong block) */}
          <ArrowLeft className="hidden size-4 lg:block rtl:rotate-180" />
          <Wallet className="size-4 lg:hidden" />
        </span>
        <div className="min-w-0">
          <h3 id={`${ids}-title`} className="text-sm font-bold text-primary dark:text-white">
            {t.valve.title}
          </h3>
          <p className="text-xs text-muted-foreground">{t.valve.into}</p>
        </div>
      </div>

      {reason ? (
        <p className="text-sm text-muted-foreground">{reason}</p>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
          <div className="space-y-1">
            <label htmlFor={VALVE_INPUT_ID} className="text-xs font-medium text-muted-foreground">
              {t.valve.pointsLabel}
            </label>
            <input
              id={VALVE_INPUT_ID}
              name="points"
              autoComplete="off"
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
          {/* Radix directly (not the shared wrapper): the focusable Thumb carries the name and value text, and
              touch-action is limited to the thumb so a vertical swipe on the track still scrolls the page. */}
          <Slider.Root
            dir={dir}
            min={0}
            max={maxPoints}
            step={50}
            value={[selected]}
            onValueChange={([v]) => set(v)}
            className="relative flex h-12 w-full items-center select-none"
          >
            <Slider.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-amber-200/70 dark:bg-white/10">
              <Slider.Range className="absolute h-full bg-gradient-to-r from-amber-400 to-secondary-foreground rtl:bg-gradient-to-l" />
            </Slider.Track>
            <Slider.Thumb
              aria-label={t.valve.pointsLabel}
              aria-valuetext={
                shown
                  ? t.valve.sliderValue(formatInt(selected), formatUsd(preview))
                  : t.valve.sliderValueHidden(formatInt(selected))
              }
              className={cn(
                'block size-7 cursor-grab touch-none rounded-full border-[3px] border-amber-500 bg-white shadow-md active:cursor-grabbing dark:bg-ocean-deep',
                focusRing,
              )}
            />
          </Slider.Root>
          <div className="flex gap-1.5" role="group" aria-label={t.valve.quick}>
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
                    : 'border-amber-500/40 bg-background hover:bg-amber-100/60 dark:hover:bg-white/10',
                  focusRing,
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p id={`${ids}-preview`} className="text-sm">
            <span className="text-muted-foreground">{t.valve.preview} </span>
            <Money value={preview} balance className="font-extrabold text-primary dark:text-white" />
            <span className="mt-0.5 block text-xs text-muted-foreground">{t.valve.previewNote}</span>
          </p>
          <button
            type="submit"
            aria-disabled={busy || undefined}
            className={cn(
              'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-secondary-foreground px-4 text-sm font-extrabold text-primary shadow-sm transition-transform hover:brightness-105 active:scale-[0.98] aria-disabled:cursor-progress aria-disabled:opacity-75 dark:text-ocean-deep',
              focusRing,
            )}
          >
            {busy && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
            {busy ? t.valve.working : t.valve.cta}
          </button>
        </form>
      )}
      <p aria-live="polite" className={cn('text-sm', error ? 'text-destructive' : 'font-medium text-teal-800 dark:text-secondary')}>
        {error ?? message}
      </p>
    </section>
  );
}
