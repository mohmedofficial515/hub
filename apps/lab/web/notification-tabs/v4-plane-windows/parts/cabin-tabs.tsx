/**
 * The tab bar as a strip of cabin wall with three aircraft windows. Each window is a WAI-ARIA tab: closed windows
 * keep their pull-down shade down; the chosen one raises its shade on a spring and shows a flat sky with a cloud or
 * two drifting by (night sky in dark mode). On first paint the cabin "wakes up": the shades lift one by one and
 * close again, except the chosen one.
 */
import { type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'framer-motion';
import { Inbox, Mail, Plane, type LucideIcon } from 'lucide-react';
import { INBOX_VIEWS, type InboxView } from '@lab/mocks/notifications-inbox';
import { cn } from '@lab/utils';
import type { Messages } from '../i18n';

const ICONS: Record<InboxView, LucideIcon> = { all: Inbox, unread: Mail, trips: Plane };

/** How far a raised shade goes: a sliver stays visible at the top, as on a real window. */
const RAISED = '-90%';
const WAKE_STEP = 0.22;
const WAKE_START = 0.2;
/** When the wake-up sequence has finished (ms); the page uses it to open the tray. */
export const WAKE_MS = (WAKE_START + WAKE_STEP * 2 + 1.3) * 1000;

export const tabId = (v: InboxView) => `v4-tab-${v}`;
export const panelId = (v: InboxView) => `v4-panel-${v}`;

export function CabinTabs({
  t,
  view,
  unread,
  waking,
  rtl,
  onChange,
}: {
  t: Messages;
  view: InboxView;
  unread: number;
  waking: boolean;
  rtl: boolean;
  onChange: (v: InboxView) => void;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = INBOX_VIEWS.indexOf(view);
    const n = INBOX_VIEWS.length;
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next: InboxView | undefined;
    if (e.key === forward) next = INBOX_VIEWS[(i + 1) % n];
    else if (e.key === back) next = INBOX_VIEWS[(i - 1 + n) % n];
    else if (e.key === 'Home') next = INBOX_VIEWS[0];
    else if (e.key === 'End') next = INBOX_VIEWS[n - 1];
    if (!next) return;
    e.preventDefault();
    onChange(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={t.views.label}
      onKeyDown={onKeyDown}
      className="v4-wall v4-round border border-(--line) v4-cabin"
    >
      {INBOX_VIEWS.map((v, i) => {
        const on = v === view;
        const Icon = ICONS[v];
        return (
          <button
            key={v}
            type="button"
            role="tab"
            id={tabId(v)}
            aria-selected={on}
            aria-controls={on ? panelId(v) : undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(v)}
            className={cn(
              'v4-tab group relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl px-1 pt-1 pb-1.5',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)',
            )}
          >
            <Window on={on} index={i} waking={waking} badge={v === 'unread' ? unread : 0} badgeLabel={t.badge(unread)} />
            <span
              className={cn(
                'flex items-center gap-1.5 text-sm whitespace-nowrap transition-colors',
                on ? 'font-bold text-(--brand-ink)' : 'font-semibold text-(--ink) group-hover:text-(--brand-ink)',
              )}
            >
              <Icon aria-hidden className={cn('size-4 shrink-0', on ? 'text-(--brand-ink)' : 'text-(--ink-muted)')} />
              {t.views[v]}
            </span>
            {/* the tray latch: a small gold mark that follows the chosen window */}
            <span aria-hidden className="h-1 w-8">
              {on && (
                <motion.span
                  layoutId="v4-latch"
                  className="block h-1 w-8 rounded-full bg-(--highlight)"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Window({
  on,
  index,
  waking,
  badge,
  badgeLabel,
}: {
  on: boolean;
  index: number;
  waking: boolean;
  badge: number;
  badgeLabel: string;
}) {
  const reduce = useReducedMotion() ?? false;

  let animate: { y: string | string[] };
  let transition: Transition;
  if (waking && !reduce) {
    const delay = WAKE_START + index * WAKE_STEP;
    animate = on ? { y: ['0%', RAISED] } : { y: ['0%', RAISED, RAISED, '0%'] };
    transition = on
      ? { delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] }
      : { delay, duration: 1.3, times: [0, 0.35, 0.6, 1], ease: 'easeInOut' };
  } else {
    animate = { y: on ? RAISED : '0%' };
    // the new shade rises on a spring with a small bounce; the old one is pulled down evenly
    transition = on
      ? { type: 'spring', stiffness: 210, damping: 17, mass: 0.9, delay: 0.05 }
      : { duration: 0.38, ease: [0.4, 0, 0.2, 1] };
  }

  return (
    <span
      aria-hidden={badge ? undefined : true}
      className={cn(
        'v4-window relative block border v4-frame transition-colors',
        on ? 'border-(--brand)' : 'v4-frame-line v4-frame-hover',
      )}
    >
      {/* the pane */}
      <span className="v4-pane relative block size-full overflow-hidden border v4-frame-line v4-sky">
        <Sky moving={on && !reduce} />
        {/* the pull-down shade */}
        <motion.span
          className="absolute inset-0 block border-b v4-frame-line v4-shade"
          initial={false}
          animate={animate}
          transition={transition}
        >
          <span className="v4-grip-pos block v4-grip" />
        </motion.span>
      </span>

      {/* unread count on the frame */}
      <AnimatePresence>
        {badge > 0 && (
          <motion.span
            key="badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 26 }}
            className="v4-badge tnum flex items-center justify-center rounded-full border-2 v4-cabin-border bg-(--highlight) px-1.5 text-xs font-bold text-(--highlight-foreground)"
          >
            <span aria-hidden>{badge > 99 ? '99+' : badge}</span>
            <span className="sr-only">{badgeLabel}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** Flat sky: one colour, two simple clouds; at night two small stars. Clouds drift only behind an open shade. */
function Sky({ moving }: { moving: boolean }) {
  return (
    // decorative and physical: the wrapper is LTR so the cloud offsets mean the same on both sides
    <span aria-hidden dir="ltr" className="absolute inset-0 block">
      <span className="v4-star-a absolute block rounded-full v4-star" />
      <span className="v4-star-b absolute block rounded-full v4-star" />
      <Cloud className="v4-cloud-a" from={-34} to={70} duration={11} moving={moving} />
      <Cloud className="v4-cloud-b" from={60} to={-30} duration={16} moving={moving} />
    </span>
  );
}

function Cloud({
  className,
  from,
  to,
  duration,
  moving,
}: {
  className: string;
  from: number;
  to: number;
  duration: number;
  moving: boolean;
}) {
  const mid = (from + to) / 2;
  return (
    <motion.svg
      viewBox="0 0 40 18"
      className={cn('absolute start-0 block', className)}
      initial={false}
      animate={moving ? { x: [mid, to, from, mid] } : { x: mid }}
      transition={moving ? { duration, times: [0, 0.5, 0.5001, 1], ease: 'linear', repeat: Infinity } : { duration: 0 }}
    >
      <path
        d="M9 18a7 7 0 0 1-1-13.9A9 9 0 0 1 25 5a6.5 6.5 0 0 1 8 6.3A6.5 6.5 0 0 1 33 18Z"
        className="v4-cloud"
      />
    </motion.svg>
  );
}
