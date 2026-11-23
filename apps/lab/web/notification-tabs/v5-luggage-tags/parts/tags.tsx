/**
 * The view tabs as luggage tags hanging from a riveted rail.
 *
 * Each tag is a WAI-ARIA tab. It hangs on a strap from the rail and swings around its eyelet:
 * - opening: the rail draws itself from the inline start, then the tags drop onto it one after another and swing to
 *   rest (a soft, under-damped spring on rotation);
 * - inactive: short strap, slightly tilted, paper white;
 * - chosen: the strap lets the tag down further, it straightens and turns navy; the tag it replaces swings back up;
 * - hover: a small sway; a count change (an entry read): a jiggle.
 * The strap is drawn from the tag's own `y`, so it always ends exactly at the eyelet.
 */
import './luggage.css';
import { useEffect, useRef, useSyncExternalStore, type KeyboardEvent } from 'react';
import { motion, useAnimationControls, useMotionValue, useTransform } from 'framer-motion';
import { Inbox, Mail, Plane, type LucideIcon } from 'lucide-react';
import type { InboxView } from '@lab/mocks/notifications-inbox';
import { cn } from '@lab/utils';
import type { Messages } from '../i18n';

const ICONS: Record<InboxView, LucideIcon> = { all: Inbox, unread: Mail, trips: Plane };

/** Eyelet centre and radius in the tag's 100 × 120 view box. */
const EYE_CY = 14;
const EYE_R = 5.5;

type Size = { w: number; h: number; short: number; long: number };
const WIDE: Size = { w: 128, h: 154, short: 14, long: 42 };
const NARROW: Size = { w: 100, h: 120, short: 8, long: 26 };

const query = '(min-width: 640px)';
function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}

export const tabId = (v: InboxView) => `lt-tab-${v}`;
export const panelId = (v: InboxView) => `lt-panel-${v}`;

export function LuggageTags({
  views,
  view,
  counts,
  rtl,
  t,
  onSelect,
}: {
  views: InboxView[];
  view: InboxView;
  /** null while the inbox is loading or failed: the tags show `--`. */
  counts: Record<InboxView, number> | null;
  rtl: boolean;
  t: Messages;
  onSelect: (v: InboxView) => void;
}) {
  const size = useWide() ? WIDE : NARROW;
  const area = size.long + size.h + 14;
  // Mirrored tilts so the row reads the same way in both directions.
  const tilts = [-4, 3, -5].map((d) => (rtl ? -d : d));

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, from: InboxView) => {
    const i = views.indexOf(from);
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next: InboxView | undefined;
    if (e.key === forward) next = views[(i + 1) % views.length];
    else if (e.key === back) next = views[(i - 1 + views.length) % views.length];
    else if (e.key === 'Home') next = views[0];
    else if (e.key === 'End') next = views[views.length - 1];
    if (!next) return;
    e.preventDefault();
    onSelect(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    <div className="relative">
      {/* The rail: a hairline with a rivet at each end, drawn from the inline start. */}
      <motion.div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-(--rail)"
        style={{ transformOrigin: rtl ? 'right' : 'left' }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Rivet className="-start-1" />
        <Rivet className="-end-1" />
      </motion.div>

      <div role="tablist" aria-label={t.tabsLabel} className="grid grid-cols-3" style={{ height: area }}>
        {views.map((v, i) => (
          <LuggageTag
            key={v}
            index={i}
            view={v}
            active={v === view}
            count={counts ? counts[v] : null}
            tilt={tilts[i]}
            size={size}
            t={t}
            onSelect={onSelect}
            onKeyDown={onKeyDown}
          />
        ))}
      </div>
    </div>
  );
}

function Rivet({ className }: { className: string }) {
  return (
    <span
      className={cn('absolute -top-[3px] size-[7px] rounded-full border border-(--rail) bg-(--card)', className)}
    />
  );
}

function LuggageTag({
  index,
  view,
  active,
  count,
  tilt,
  size,
  t,
  onSelect,
  onKeyDown,
}: {
  index: number;
  view: InboxView;
  active: boolean;
  count: number | null;
  tilt: number;
  size: Size;
  t: Messages;
  onSelect: (v: InboxView) => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>, from: InboxView) => void;
}) {
  const Icon = ICONS[view];
  const eyeY = (EYE_CY / 120) * size.h;
  const eyeR = (EYE_R / 100) * size.w;
  const origin = `50% ${eyeY}px`;

  // The tag's drop; the strap follows it down to the top of the eyelet.
  const y = useMotionValue(-140);
  const strap = useTransform(y, (v) => Math.max(0, v + eyeY - eyeR));

  // Only the first appearance waits its turn in the drop.
  const first = useRef(true);
  const delay = first.current ? 0.35 + index * 0.16 : 0;
  useEffect(() => {
    first.current = false;
  }, []);

  // Sway on hover, jiggle when the count changes.
  const sway = useAnimationControls();
  const prev = useRef(count);
  useEffect(() => {
    if (prev.current === count) return;
    const was = prev.current;
    prev.current = count;
    if (was === null || count === null) return;
    void sway.start({ rotate: [0, -9, 7, -4, 2, 0], transition: { duration: 0.8, ease: 'easeOut' } });
  }, [count, sway]);
  const onHover = () => {
    void sway.start({ rotate: [0, 4, -3, 1.5, 0], transition: { duration: 0.9, ease: 'easeOut' } });
  };

  const code = count === null ? '--' : String(count).padStart(2, '0');

  return (
    <div className="relative flex justify-center">
      {/* Clip where the strap holds the rail. */}
      <motion.span
        aria-hidden
        className="absolute -top-[3px] z-10 h-[7px] w-3 rounded-[2px] border border-(--rail) bg-(--card)"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: delay + 0.05, type: 'spring', stiffness: 500, damping: 20 }}
      />
      {/* The strap, from the rail to the eyelet; it rides over the paper like a real strap through the hole. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute top-0 z-10 w-0.5 rounded-full bg-(--tag-strap)"
        style={{ height: strap }}
      />

      <motion.div
        className="absolute top-0"
        style={{ y, width: size.w, height: size.h, transformOrigin: origin }}
        initial={{ rotate: tilt * 5, opacity: 0 }}
        animate={{ y: active ? size.long : size.short, rotate: active ? 0 : tilt, opacity: 1 }}
        transition={{
          y: { type: 'spring', stiffness: 260, damping: 17, delay },
          rotate: { type: 'spring', stiffness: 110, damping: 6, mass: 0.9, delay },
          opacity: { duration: 0.15, delay },
        }}
      >
        <motion.div className="size-full" style={{ transformOrigin: origin }} animate={sway} onHoverStart={onHover}>
          <button
            type="button"
            role="tab"
            id={tabId(view)}
            aria-selected={active}
            aria-controls={active ? panelId(view) : undefined}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(view)}
            onKeyDown={(e) => onKeyDown(e, view)}
            className="group relative block size-full cursor-pointer rounded-[10px] outline-offset-4 focus-visible:outline-2 focus-visible:outline-(--ring)"
          >
            <TagPaper active={active} />
            <span
              className="relative flex h-full flex-col items-center justify-end px-2 pb-2.5 sm:pb-3"
              style={{ paddingTop: eyeY + eyeR + 6 }}
            >
              <Icon
                aria-hidden
                className={cn(
                  'size-[18px] shrink-0 transition-colors sm:size-5',
                  active ? 'text-(--tag-eyelet)' : 'text-(--ink-muted) group-hover:text-(--brand-ink)',
                )}
              />
              <span
                className={cn(
                  'mt-1 max-w-full truncate text-sm leading-tight font-bold transition-colors sm:text-[15px]',
                  active ? 'text-(--tag-on-chosen)' : 'text-(--brand-ink)',
                )}
              >
                {t.views[view]}
              </span>
              {/* Perforation, then the count written like a bag-tag code. */}
              <span
                aria-hidden
                className={cn(
                  'mt-2 w-full border-t border-dashed transition-colors',
                  active ? 'border-(--tag-on-chosen-muted)/50' : 'border-(--border-strong)',
                )}
              />
              <span aria-hidden className="mt-1.5 flex items-baseline gap-1.5 tnum">
                <span
                  className={cn(
                    'text-xs font-semibold tracking-[0.14em]',
                    active ? 'text-(--tag-on-chosen-muted)' : 'text-(--ink-muted)',
                  )}
                  dir="ltr"
                >
                  {t.codes[view]}
                </span>
                <motion.span
                  key={code}
                  initial={{ y: -8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                  className={cn(
                    'text-xl leading-none font-bold sm:text-2xl',
                    active ? 'text-(--tag-on-chosen)' : 'text-(--brand-ink)',
                  )}
                  dir="ltr"
                >
                  {code}
                </motion.span>
              </span>
              {count !== null && <span className="sr-only">{`, ${t.count[view](count)}`}</span>}
            </span>
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}

/** The tag itself: chamfered top corners, rounded foot, a punched eyelet with a gold ring. */
function TagPaper({ active }: { active: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 100 120" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
      <path
        className="lt-paper"
        d="M20 0.5 H80 L99.5 20 V112 Q99.5 119.5 92 119.5 H8 Q0.5 119.5 0.5 112 V20 Z"
        fill={active ? 'var(--tag-chosen)' : 'var(--tag-paper)'}
        stroke={active ? 'var(--tag-chosen-edge)' : 'var(--tag-edge)'}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
      <circle cx={50} cy={EYE_CY} r={EYE_R + 1.6} fill="none" stroke="var(--tag-eyelet)" strokeWidth={2.4} />
      <circle cx={50} cy={EYE_CY} r={EYE_R} fill="var(--card)" />
    </svg>
  );
}
