import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronsUp, EyeOff, Lock } from 'lucide-react';
import { useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { addDecimal, compareDecimal, formatUsd, isDecimal, nextNice, niceCeiling, ratio, toCents } from './money';
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
  /** Height and width of the vessel per breakpoint. */
  sizeClass?: string;
}

const MARKER_GAP = 7; // % of tank height between two marker labels
const GROW_AT = 0.9; // a drag past 90% of the height grows the scale
const GROW_EVERY_MS = 450;
const TICKS = [0, 0.25, 0.5, 0.75, 1];

/**
 * The cash tank, in two sibling layers:
 * - a decorative vessel (`role="img"`): liquid = available, teal stripes = held, dashed ghost = the top-up being
 *   composed, dashed trip lines;
 * - the fill line, a real `role="slider"` laid over it. Its range is the per-top-up range (min…max), so End means
 *   "the maximum" and never escalates. The gauge scale is visual only: dragging past the top grows it live.
 * While amounts are hidden the vessel is neutral (mist, no level, no trip lines, unlabelled ticks) and only the
 * top-up being composed is drawn, from the bottom, against a scale that depends on that amount alone.
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
  const vesselRef = useRef<HTMLDivElement>(null);
  const [dragScale, setDragScale] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const lastGrow = useRef(0);

  const ghost = isDecimal(amount) && toCents(amount) > 0n ? amount : '0.00';
  // Hidden: the gauge has no base (nothing may hint at the balance).
  const base = shown ? addDecimal(available, reserved) : '0.00';
  const withGhost = addDecimal(base, ghost);
  const liveScale = niceCeiling(toCents(withGhost) > 0n ? toCents(withGhost) : 10000n);
  // While dragging, the scale only changes when the drag pushes past the top (see fromPointer).
  const scale = dragScale ?? liveScale;

  const availPct = shown ? ratio(available, scale) * 100 : 0;
  const heldPct = shown ? ratio(reserved, scale) * 100 : 0;
  const basePct = availPct + heldPct;
  const ghostPct = Math.min(100 - basePct, ratio(ghost, scale) * 100);
  const linePct = basePct + ghostPct;

  const baseWhole = Number(toCents(base) / 100n);
  const value = Math.min(maxUsd, Math.max(minUsd, Number(toCents(ghost)) / 100));

  const placed = useMemo(() => {
    if (!shown) return [];
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
  }, [markers, scale, available, shown]);

  const after = addDecimal(available, ghost);
  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 90, damping: 18 };

  const clamp = (n: number) => Math.min(maxUsd, Math.max(minUsd, n));
  const snap = (n: number) => clamp(Math.round(n / step) * step);
  const emit = (n: number) => onAmount(String(n));

  // Pointer → amount. Near the top the scale steps up (live), so a drag can keep pushing past the rim.
  const fromPointer = (clientY: number) => {
    const el = vesselRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const frac = (r.bottom - clientY) / r.height;
    let s = scale;
    const now = performance.now();
    if (frac >= GROW_AT && s < baseWhole + maxUsd && now - lastGrow.current > GROW_EVERY_MS) {
      const grown = nextNice(s);
      if (grown > s) {
        s = grown;
        lastGrow.current = now;
        setDragScale(grown);
      }
    }
    emit(snap(Math.min(1, Math.max(0, frac)) * s - baseWhole));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({ preventScroll: true });
    setDragScale(scale);
    setDragging(true);
    fromPointer(e.clientY);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging) fromPointer(e.clientY);
  };
  const endDrag = () => {
    setDragging(false);
    setDragScale(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowUp: value + step,
      ArrowRight: value + step,
      ArrowDown: value - step,
      ArrowLeft: value - step,
      PageUp: value + step * 10,
      PageDown: value - step * 10,
      Home: minUsd,
      End: maxUsd,
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    emit(snap(keys[e.key]));
  };

  return (
    <div className="flex items-stretch gap-1.5 pt-6" data-part="cash-tank">
      {/* Scale (start side): tick marks always; numbers only when amounts are shown */}
      <div className="relative w-9 shrink-0 sm:w-12" aria-hidden>
        {!frozen && <ChevronsUp className="absolute end-0 -top-6 size-4 text-secondary" />}
        {TICKS.map((f) => (
          <span
            key={f}
            className="absolute end-0 flex translate-y-1/2 items-center gap-1 text-xs font-medium text-muted-foreground tabular-nums"
            style={{ bottom: `${f * 100}%` }}
          >
            {shown && f * 2 === Math.round(f * 2) ? (
              <bdi dir="ltr">{formatUsd(String(Math.round(scale * f)), { whole: true })}</bdi>
            ) : null}
            <span className={cn('h-0.5 bg-muted-foreground/60', f * 2 === Math.round(f * 2) ? 'w-2.5' : 'w-1.5')} />
          </span>
        ))}
      </div>

      <div ref={vesselRef} className={cn('relative shrink-0', sizeClass)}>
        {/* Decorative layer: the vessel and what is in it. No interactive children. */}
        <div
          role="img"
          aria-label={shown ? t.cash.tankLabel(formatUsd(available), formatUsd(reserved)) : t.cash.tankLabelHidden}
          className="absolute inset-0 rounded-t-sm rounded-b-[32px] border-x-[3px] border-b-[3px] border-primary/60 bg-gradient-to-b from-transparent to-primary/[0.05] dark:border-white/50 dark:to-white/[0.05]"
        >
          {/* rim lips flare outward: an open top, not a lid */}
          <span aria-hidden className="absolute -start-[11px] -top-[3px] h-[5px] w-4 -rotate-12 rounded-full bg-primary/60 dark:bg-white/55" />
          <span aria-hidden className="absolute -end-[11px] -top-[3px] h-[5px] w-4 rotate-12 rounded-full bg-primary/60 dark:bg-white/55" />

          <div className="absolute inset-0 overflow-hidden rounded-b-[29px]">
            {shown ? (
              <>
                {/* available liquid: a full-height layer moved with transform */}
                <motion.div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-primary to-ocean will-change-transform dark:from-ocean-deep dark:to-ocean"
                  initial={reduce ? false : { y: '100%' }}
                  animate={{ y: `${100 - availPct}%` }}
                  transition={spring}
                >
                  {availPct > 0 && <svg aria-hidden viewBox="0 0 120 8" preserveAspectRatio="none" className="absolute inset-x-0 -top-[7px] h-2 w-full fill-ocean">
                    <path d="M0 8 C 20 0, 40 0, 60 4 S 100 8, 120 2 L120 8 Z" />
                  </svg>}
                </motion.div>

                {/* held band */}
                {heldPct > 0 && (
                  <motion.div
                    aria-hidden
                    className="absolute inset-0 will-change-transform"
                    initial={reduce ? false : { y: '100%' }}
                    animate={{ y: `${100 - basePct}%` }}
                    transition={spring}
                  >
                    <div
                      className="absolute inset-x-0 top-0 bg-[repeating-linear-gradient(135deg,var(--secondary)_0_6px,color-mix(in_oklab,var(--secondary)_55%,transparent)_6px_12px)]"
                      style={{ height: `${heldPct}%` }}
                    />
                  </motion.div>
                )}
              </>
            ) : (
              <HiddenMist reduce={!!reduce} seal={!frozen} />
            )}

            {/* ghost (top-up being composed): positioned with transform, height follows the amount */}
            {ghostPct > 0 && (
              <div
                aria-hidden
                className={cn('absolute inset-0', !dragging && 'transition-transform duration-150')}
                style={{ transform: `translateY(${100 - linePct}%)` }}
              >
                <div
                  className={cn(
                    'absolute inset-x-0 top-0 border-t-2 border-dashed',
                    shown
                      ? 'border-primary/70 bg-primary/12 dark:border-white/75 dark:bg-white/12'
                      : 'border-teal-700 bg-secondary/30 dark:border-secondary dark:bg-secondary/30',
                    pouring &&
                      'bg-[repeating-linear-gradient(180deg,color-mix(in_oklab,var(--ocean)_35%,transparent)_0_6px,transparent_6px_12px)] motion-safe:animate-pulse',
                  )}
                  style={{ height: `${ghostPct}%` }}
                />
              </div>
            )}

            {/* trip lines (amounts shown only) */}
            {placed.map((m) => (
              <span
                key={m.id}
                aria-hidden
                className={cn(
                  'absolute inset-x-1 border-t border-dashed',
                  m.covered ? 'border-white/70' : 'border-primary/45 dark:border-white/40',
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
        </div>

        {/* Interactive layer: a sibling of the image, never inside it */}
        {interactive && !frozen && (
          <div
            className="pointer-events-none absolute inset-0 will-change-transform"
            style={{ transform: `translateY(${100 - linePct}%)`, transition: dragging || reduce ? 'none' : 'transform 150ms ease-out' }}
          >
            <div
              role="slider"
              tabIndex={0}
              aria-label={t.topUp.sliderLabel}
              aria-orientation="vertical"
              aria-valuemin={minUsd}
              aria-valuemax={maxUsd}
              aria-valuenow={value}
              aria-valuetext={t.topUp.sliderValue(formatUsd(String(value)), shown ? formatUsd(after) : null)}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={onKeyDown}
              className="group/thumb pointer-events-auto absolute -inset-x-[10px] top-0 flex h-11 -translate-y-1/2 cursor-grab touch-none items-center justify-center outline-none select-none active:cursor-grabbing"
            >
              <span className="absolute inset-x-0 h-[3px] rounded-full bg-primary shadow-[0_0_0_2px_var(--background)] dark:bg-white" />
              <span className="relative grid h-7 min-w-12 place-items-center rounded-full bg-primary px-2 text-xs font-bold text-white tabular-nums shadow-lg ring-2 ring-background transition-transform group-focus-visible/thumb:scale-110 group-focus-visible/thumb:ring-[3px] group-focus-visible/thumb:ring-secondary dark:bg-white dark:text-ocean-deep">
                {ghostPct > 0 ? (
                  <bdi dir="ltr">+{formatUsd(String(value), { whole: Number.isInteger(value) })}</bdi>
                ) : (
                  <span aria-hidden className="flex flex-col gap-[3px]">
                    <span className="h-px w-3.5 bg-current" />
                    <span className="h-px w-3.5 bg-current" />
                    <span className="h-px w-3.5 bg-current" />
                  </span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Trip markers (end side), amounts shown only */}
      <div className={cn('relative shrink-0', placed.length ? 'w-12 sm:w-14' : 'w-1')} aria-hidden>
        {placed.map((m) => (
          <span
            key={m.id}
            translate="no"
            className={cn(
              'absolute start-0 flex translate-y-1/2 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs leading-none font-bold tracking-wide',
              m.covered ? 'bg-secondary/15 text-teal-800 dark:text-secondary' : 'bg-muted text-muted-foreground',
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

/** Neutral vessel while amounts are hidden: drifting mist, no level, an eye-off seal. */
function HiddenMist({ reduce, seal }: { reduce: boolean; seal: boolean }) {
  return (
    <div aria-hidden className="absolute inset-0">
      <motion.div
        className="absolute -inset-y-1/2 inset-x-0 bg-[radial-gradient(60%_30%_at_30%_30%,color-mix(in_oklab,var(--ocean)_22%,transparent),transparent),radial-gradient(55%_25%_at_70%_60%,color-mix(in_oklab,var(--secondary)_20%,transparent),transparent),radial-gradient(70%_30%_at_40%_85%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent)] blur-md dark:bg-[radial-gradient(60%_30%_at_30%_30%,rgb(255_255_255/0.10),transparent),radial-gradient(55%_25%_at_70%_60%,color-mix(in_oklab,var(--secondary)_22%,transparent),transparent),radial-gradient(70%_30%_at_40%_85%,rgb(255_255_255/0.06),transparent)]"
        animate={reduce ? undefined : { y: ['0%', '-16%', '0%'] }}
        transition={reduce ? undefined : { duration: 9, ease: 'easeInOut', repeat: Infinity }}
      />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(180deg,transparent_0_10px,color-mix(in_oklab,var(--primary)_6%,transparent)_10px_11px)] dark:bg-[repeating-linear-gradient(180deg,transparent_0_10px,rgb(255_255_255/0.05)_10px_11px)]" />
      {seal && <span className="absolute start-1/2 top-3 grid size-9 -translate-x-1/2 place-items-center rounded-full bg-card/90 text-primary shadow-sm ring-1 ring-primary/15 rtl:translate-x-1/2 dark:bg-ocean-deep/90 dark:text-white dark:ring-white/20">
        <EyeOff className="size-4" />
      </span>}
    </div>
  );
}
