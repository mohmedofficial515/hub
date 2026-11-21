import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Lock } from 'lucide-react';
import { Slider } from 'radix-ui';
import { useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { addDecimal, compareDecimal, formatUsd, isDecimal, niceCeiling, ratio, toCents } from './money';
import { useShown } from './shared';

export interface TankMarker {
  id: string;
  iata: string;
  price: string; // USD decimal string
}

interface Props {
  available: string;
  reserved: string;
  amount: string; // top-up being composed ('' when none)
  minUsd: number;
  maxUsd: number;
  step?: number;
  markers: TankMarker[];
  frozen?: boolean;
  pouring?: boolean; // a top-up is being confirmed
  interactive: boolean;
  onAmount: (value: string) => void;
  /** Height of the tank in px per breakpoint is set by the caller through this class. */
  sizeClass?: string;
}

const MARKER_GAP = 7; // % of tank height between two marker labels

/**
 * The cash tank. Liquid = available, teal stripes = held for a booking, dashed ghost = the top-up being composed.
 * The open top and the printed scale say "ruler, not limit"; the dashed lines are trips from the customer's
 * searches, so the scale reads as "what this buys", not "how much fits". The fill line is a real vertical slider.
 */
export function CashTank({
  available,
  reserved,
  amount,
  minUsd,
  maxUsd,
  step = 5,
  markers,
  frozen,
  pouring,
  interactive,
  onAmount,
  sizeClass = 'h-[240px] w-[92px] sm:h-[300px] sm:w-[120px]',
}: Props) {
  const t = useT(messages);
  const shown = useShown();
  const reduce = useReducedMotion();
  const [dragScale, setDragScale] = useState<number | null>(null);

  const ghost = isDecimal(amount) && toCents(amount) > 0n ? amount : '0.00';
  const total = addDecimal(available, reserved);
  const withGhost = addDecimal(total, ghost);
  const liveScale = niceCeiling(toCents(withGhost) > 0n ? toCents(withGhost) : 10000n);
  const scale = dragScale ?? liveScale;

  const availPct = ratio(available, scale) * 100;
  const heldPct = ratio(reserved, scale) * 100;
  const totalPct = availPct + heldPct;
  const ghostPct = Math.min(100 - totalPct, ratio(ghost, scale) * 100);

  // Slider room = what still fits under the current scale (it grows once the drag ends).
  const totalWhole = Number(toCents(total) / 100n);
  const room = Math.floor((scale - totalWhole) / step) * step;
  const sliderMax = Math.max(minUsd + step, Math.min(maxUsd, room));
  const sliderValue = Math.min(sliderMax, Math.max(minUsd, Number(toCents(ghost) / 100n)));

  const placed = useMemo(() => {
    const list = markers
      .map((m) => ({ ...m, pct: ratio(m.price, scale) * 100 }))
      .filter((m) => m.pct > 2 && m.pct < 96)
      .sort((a, b) => a.pct - b.pct);
    let last = -100;
    return list.map((m) => {
      const labelPct = Math.max(m.pct, last + MARKER_GAP);
      last = labelPct;
      return { ...m, labelPct, covered: compareDecimal(available, m.price) >= 0 };
    });
  }, [markers, scale, available]);

  const ticks = [0, 0.5, 1].map((f) => ({ f, value: String(Math.round(scale * f)) }));
  const after = addDecimal(available, ghost);
  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 90, damping: 18 };

  return (
    <div className="flex items-stretch gap-1.5" data-part="cash-tank">
      {/* Scale (start side) */}
      <div className="relative w-8 shrink-0 sm:w-11" aria-hidden>
        {ticks.map(({ f, value }) => (
          <span
            key={f}
            className="absolute end-0 flex translate-y-1/2 items-center gap-1 text-[10px] font-medium text-muted-foreground tabular-nums"
            style={{ bottom: `${f * 100}%` }}
          >
            {shown ? <bdi dir="ltr">{formatUsd(value, { whole: true })}</bdi> : null}
            <span className="h-px w-1.5 bg-muted-foreground/50" />
          </span>
        ))}
      </div>

      {/* The vessel: open top, rounded base */}
      <div
        role="img"
        aria-label={
          shown ? t.cash.tankLabel(formatUsd(available), formatUsd(reserved)) : t.cash.tankLabelHidden
        }
        className={cn(
          'relative shrink-0 rounded-b-[32px] rounded-t-sm border-x-[3px] border-b-[3px] border-primary/15 bg-gradient-to-b from-transparent to-primary/[0.04] dark:border-white/15 dark:to-white/[0.04]',
          sizeClass,
        )}
      >
        {/* rim lips mark an open top */}
        <span aria-hidden className="absolute -start-[7px] -top-px h-[3px] w-3 rounded-full bg-primary/25 dark:bg-white/25" />
        <span aria-hidden className="absolute -end-[7px] -top-px h-[3px] w-3 rounded-full bg-primary/25 dark:bg-white/25" />

        <div className="absolute inset-0 overflow-hidden rounded-b-[29px]">
          {/* available liquid */}
          <motion.div
            aria-hidden
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary to-ocean dark:from-ocean-deep dark:to-ocean"
            initial={reduce ? false : { height: '0%' }}
            animate={{ height: `${availPct}%` }}
            transition={spring}
          >
            <svg
              aria-hidden
              viewBox="0 0 120 8"
              preserveAspectRatio="none"
              className="absolute inset-x-0 -top-[7px] h-2 w-full fill-ocean"
            >
              <path d="M0 8 C 20 0, 40 0, 60 4 S 100 8, 120 2 L120 8 Z" />
            </svg>
          </motion.div>

          {/* held band */}
          {heldPct > 0 && (
            <motion.div
              aria-hidden
              className="absolute inset-x-0 bg-[repeating-linear-gradient(135deg,var(--secondary)_0_6px,color-mix(in_oklab,var(--secondary)_55%,transparent)_6px_12px)]"
              initial={reduce ? false : { bottom: '0%', height: '0%' }}
              animate={{ bottom: `${availPct}%`, height: `${heldPct}%` }}
              transition={spring}
            />
          )}

          {/* ghost (top-up being composed) */}
          {ghostPct > 0 && (
            <div
              aria-hidden
              className={cn(
                'absolute inset-x-0 border-t-2 border-dashed border-primary/60 bg-primary/10 transition-[height,bottom] duration-150 dark:border-white/70 dark:bg-white/10',
                pouring &&
                  'bg-[repeating-linear-gradient(180deg,color-mix(in_oklab,var(--ocean)_35%,transparent)_0_6px,transparent_6px_12px)] motion-safe:animate-pulse',
              )}
              style={{ bottom: `${totalPct}%`, height: `${ghostPct}%` }}
            />
          )}

          {/* trip lines */}
          {placed.map((m) => (
            <span
              key={m.id}
              aria-hidden
              className={cn(
                'absolute inset-x-1 border-t border-dashed',
                m.covered ? 'border-white/60' : 'border-primary/35 dark:border-white/35',
              )}
              style={{ bottom: `${m.pct}%` }}
            />
          ))}

          {frozen && (
            <div
              aria-hidden
              className="absolute inset-0 grid place-items-center bg-[repeating-linear-gradient(45deg,rgb(255_255_255/0.55)_0_2px,transparent_2px_9px)] backdrop-blur-[3px] dark:bg-[repeating-linear-gradient(45deg,rgb(255_255_255/0.12)_0_2px,transparent_2px_9px)]"
            >
              <span className="grid size-11 place-items-center rounded-full bg-white text-primary shadow-md dark:bg-ocean-deep dark:text-white">
                <Lock className="size-5" />
              </span>
            </div>
          )}
        </div>

        {/* fill line = vertical slider over the empty part of the tank */}
        {interactive && !frozen && (
          <Slider.Root
            orientation="vertical"
            min={minUsd}
            max={sliderMax}
            step={step}
            value={[sliderValue]}
            onPointerDown={() => setDragScale(scale)}
            onValueChange={([v]) => onAmount(String(v))}
            onValueCommit={() => setDragScale(null)}
            className="absolute inset-x-0 top-1 [&>span]:inset-x-0"
            style={{ bottom: `${totalPct}%` }}
          >
            <Slider.Track className="absolute inset-0">
              <Slider.Range className="absolute inset-x-0" />
            </Slider.Track>
            <Slider.Thumb
              aria-label={t.topUp.sliderLabel}
              aria-valuetext={t.topUp.sliderValue(
                formatUsd(String(sliderValue)),
                shown ? formatUsd(after) : null,
              )}
              className="group/thumb relative -mx-[9px] flex h-11 w-[calc(100%+18px)] cursor-grab touch-none items-center justify-center outline-none active:cursor-grabbing"
            >
              <span className="absolute inset-x-0 h-[3px] rounded-full bg-primary shadow-[0_0_0_2px_var(--background)] dark:bg-white" />
              <span className="relative grid h-7 min-w-11 place-items-center rounded-full bg-primary px-2 text-[11px] font-bold text-white shadow-lg ring-2 ring-background transition-transform group-focus-visible/thumb:scale-110 group-focus-visible/thumb:ring-secondary dark:bg-white dark:text-ocean-deep">
                <span aria-hidden className="flex flex-col gap-[3px]">
                  <span className="h-px w-3.5 bg-current" />
                  <span className="h-px w-3.5 bg-current" />
                  <span className="h-px w-3.5 bg-current" />
                </span>
              </span>
            </Slider.Thumb>
          </Slider.Root>
        )}
      </div>

      {/* Trip markers (end side) */}
      <div className="relative w-11 shrink-0 sm:w-14" aria-hidden>
        {placed.map((m) => (
          <span
            key={m.id}
            className={cn(
              'absolute start-0 flex translate-y-1/2 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-wide',
              m.covered
                ? 'bg-secondary/15 text-teal-800 dark:text-secondary'
                : 'bg-muted text-muted-foreground',
            )}
            style={{ bottom: `${m.labelPct}%` }}
          >
            {m.covered && <Check className="size-3" strokeWidth={3} />}
            {m.iata}
          </span>
        ))}
      </div>
    </div>
  );
}
