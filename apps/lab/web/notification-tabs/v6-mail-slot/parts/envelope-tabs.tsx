/**
 * The three views as envelopes hanging under a mail slot. Each tab is a flat envelope (seen from the back): a body
 * with two fold lines, a triangular flap sealed with a small gold dot, and the view's icon and name. The chosen tab's
 * flap turns open over its top edge (rotateX) and a sheet of paper peeks out; the others stay sealed. The unread
 * view carries an airmail stamp with the count, whose dashed edge is navy, teal and gold.
 *
 * On first paint the slot draws itself and the envelopes drop through it one after another (they are clipped at
 * the slot while they fall). Phones get compact pills with a small flap that keeps the same motion.
 *
 * WAI-ARIA tabs as on the real page: only the chosen tab is in the Tab order, the arrow keys follow the page
 * direction, Home and End jump to the ends.
 */
import { forwardRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Inbox, Mail, Plane, type LucideIcon } from 'lucide-react';
import { INBOX_VIEWS, type InboxView } from '@lab/mocks/notifications-inbox';
import { cn } from '@lab/utils';
import type { Messages } from '../i18n';

const ICONS: Record<InboxView, LucideIcon> = { all: Inbox, unread: Mail, trips: Plane };

export const tabId = (view: InboxView) => `mail-slot-tab-${view}`;
export const panelId = (view: InboxView) => `mail-slot-panel-${view}`;

const SLOT_MS = 0.38;
const DROP_GAP = 0.12;

type Props = {
  t: Messages;
  view: InboxView;
  rtl: boolean;
  unread: number;
  /** The slot and the envelopes have arrived; until then the row clips at the slot. */
  ready: boolean;
  onReady: () => void;
  onChange: (view: InboxView) => void;
  /** Changes each time a flying letter lands in the stamp (a small thump). */
  thump: number;
};

export const EnvelopeTabs = forwardRef<HTMLSpanElement, Props>(function EnvelopeTabs(
  { t, view, rtl, unread, ready, onReady, onChange, thump },
  stampRef,
) {
  const reduce = useReducedMotion() ?? false;
  const [hover, setHover] = useState<InboxView | null>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, from: InboxView) => {
    const index = INBOX_VIEWS.indexOf(from);
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next: InboxView | undefined;
    if (event.key === forward) next = INBOX_VIEWS[(index + 1) % INBOX_VIEWS.length];
    else if (event.key === back) next = INBOX_VIEWS[(index - 1 + INBOX_VIEWS.length) % INBOX_VIEWS.length];
    else if (event.key === 'Home') next = INBOX_VIEWS[0];
    else if (event.key === 'End') next = INBOX_VIEWS[INBOX_VIEWS.length - 1];
    if (!next) return;
    event.preventDefault();
    onChange(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    <div className="relative">
      {/* The mail slot: a hairline plate with two gold screws. */}
      <motion.div
        aria-hidden
        className="absolute inset-x-0 top-0 flex h-2.5 items-center rounded-full border border-(--border-strong) bg-(--surface-3) px-1.5"
        initial={reduce ? false : { scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: SLOT_MS, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <span className="size-1 rounded-full bg-(--highlight)" />
        <span className="mx-1.5 h-px flex-1 bg-(--border-strong)" />
        <span className="size-1 rounded-full bg-(--highlight)" />
      </motion.div>

      <div
        role="tablist"
        aria-label={t.views.label}
        className={cn('flex gap-2 pt-6 sm:gap-4 sm:pt-14', !ready && 'overflow-hidden')}
      >
        {INBOX_VIEWS.map((value, i) => {
          const active = value === view;
          const Icon = ICONS[value];
          const open = active && ready;
          const peek = !active && hover === value && ready;
          return (
            <motion.button
              key={value}
              type="button"
              role="tab"
              id={tabId(value)}
              aria-selected={active}
              aria-controls={active ? panelId(value) : undefined}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(value)}
              onKeyDown={(event) => onKeyDown(event, value)}
              onPointerEnter={() => setHover(value)}
              onPointerLeave={() => setHover((h) => (h === value ? null : h))}
              initial={reduce ? false : { y: '-170%' }}
              animate={{ y: '0%' }}
              transition={{
                type: 'spring',
                stiffness: 320,
                damping: 24,
                delay: SLOT_MS * 0.8 + i * DROP_GAP,
              }}
              onAnimationComplete={i === INBOX_VIEWS.length - 1 ? onReady : undefined}
              style={
                {
                  '--env-bg': active ? 'var(--card)' : 'var(--surface-2)',
                  '--env-edge': active ? 'var(--brand)' : 'var(--border-strong)',
                } as CSSProperties
              }
              className={cn(
                'group relative h-[52px] min-w-0 flex-1 cursor-pointer rounded-full outline-none sm:h-24 sm:rounded-lg',
                'focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2 focus-visible:ring-offset-(--background)',
              )}
            >
              <Flap open={open} peek={peek} />

              {/* The sheet that peeks out of the open envelope; the body covers its lower part. */}
              <motion.span
                aria-hidden
                className="absolute inset-x-[30%] top-0 z-10 h-3.5 rounded-t-[3px] border border-b-0 border-(--border-strong) bg-(--card) sm:inset-x-[16%] sm:h-7"
                initial={false}
                animate={{ y: open ? '-62%' : '0%' }}
                transition={
                  open
                    ? { type: 'spring', stiffness: 380, damping: 22, delay: 0.32 }
                    : { duration: 0.14, ease: 'easeIn' }
                }
              >
                <span className="mx-auto mt-1 hidden h-px w-3/5 bg-(--border-strong) sm:mt-2 sm:block" />
                <span className="mx-auto mt-1.5 hidden h-px w-2/5 bg-(--border-strong) sm:block" />
              </motion.span>

              {/* Body: the envelope's back with its two fold lines. */}
              <span
                className={cn(
                  'absolute inset-0 z-20 overflow-hidden rounded-full border bg-(--env-bg) transition-colors duration-300 sm:rounded-lg',
                  active ? 'border-(--env-edge) border-[1.5px]' : 'border-(--env-edge) group-hover:border-(--brand)/50',
                )}
              >
                <svg
                  aria-hidden
                  className="absolute inset-0 hidden size-full sm:block"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <polyline
                    points="0,100 50,56 100,100"
                    fill="none"
                    stroke="var(--line)"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <span className="absolute inset-x-0 bottom-0 flex h-full items-center justify-center pt-2.5 sm:h-auto sm:pt-0 sm:pb-3">
                  <span
                    className={cn(
                      'flex min-w-0 items-center gap-2 rounded-md bg-(--env-bg) px-2 text-sm transition-colors sm:py-0.5 sm:text-[15px]',
                      active ? 'font-bold text-(--brand-ink)' : 'font-semibold text-(--ink) group-hover:text-(--brand-ink)',
                    )}
                  >
                    <Icon
                      aria-hidden
                      className={cn(
                        'hidden size-[18px] shrink-0 sm:block',
                        active ? 'text-(--action-text)' : 'text-(--ink-muted)',
                      )}
                    />
                    <span className="truncate">{t.views[value]}</span>
                    {value === 'unread' && unread > 0 && <span className="sr-only">{t.stampLabel(unread)}</span>}
                  </span>
                </span>
              </span>

              {value === 'unread' && <Stamp ref={stampRef} count={unread} thump={thump} />}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
});

/**
 * The flap: two faces of one triangle. Closed it points down over the body, sealed with a gold dot; open it turns
 * over the top edge and shows its inside. It sits above the body while closed and drops behind the sheet once open.
 */
function Flap({ open, peek }: { open: boolean; peek: boolean }) {
  const angle = open ? 180 : peek ? 32 : 0;
  return (
    <motion.span
      aria-hidden
      className="absolute inset-x-[24%] top-0 block h-3.5 origin-top sm:inset-x-1.5 sm:h-11"
      style={{ transformPerspective: 520, transformStyle: 'preserve-3d' }}
      initial={false}
      animate={{ rotateX: angle, zIndex: open ? 0 : 30 }}
      transition={{
        rotateX: open
          ? { type: 'spring', stiffness: 170, damping: 17, delay: 0.08 }
          : { type: 'spring', stiffness: 260, damping: 26 },
        zIndex: { duration: 0, delay: open ? 0.3 : 0 },
      }}
    >
      {/* Outer face: the sealed side. */}
      <span className="absolute inset-0 block" style={{ backfaceVisibility: 'hidden' }}>
        <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon
            points="0,0 100,0 50,100"
            fill="var(--env-bg)"
            stroke="var(--env-edge)"
            strokeWidth="1"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="absolute start-1/2 bottom-0 hidden size-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-(--highlight) ring-2 ring-(--env-bg) sm:block rtl:translate-x-1/2" />
      </span>
      {/* Inner face: seen once the flap has turned over. Drawn upside down so it lands the right way up. */}
      <span className="absolute inset-0 block" style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)' }}>
        <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon
            points="0,100 100,100 50,0"
            fill="var(--surface-3)"
            stroke="var(--env-edge)"
            strokeWidth="1"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </span>
    </motion.span>
  );
}

/**
 * Airmail stamp with the unread count. The dashed edge is three dash patterns laid over each other (navy, teal,
 * gold), flat. The number ticks: the new one drops in from above while the old one falls out.
 */
const Stamp = forwardRef<HTMLSpanElement, { count: number; thump: number }>(function Stamp({ count, thump }, ref) {
  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.span
          ref={ref}
          aria-hidden
          key="stamp"
          className="absolute -top-3 end-1 z-40 block h-9 w-8 sm:-top-4 sm:end-4 sm:h-11 sm:w-10"
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: -6 }}
          exit={{ scale: 0, rotate: 20, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 20 }}
        >
          <motion.span
            key={thump}
            className="absolute inset-0 block rounded-[3px] bg-(--card)"
            initial={thump ? { scale: 1.22 } : false}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 14 }}
          >
            <svg className="absolute inset-0 size-full" viewBox="0 0 40 44" preserveAspectRatio="none">
              {[
                ['var(--brand)', 0],
                ['var(--action)', -4],
                ['var(--highlight)', -8],
              ].map(([color, offset]) => (
                <rect
                  key={String(color)}
                  x="1.5"
                  y="1.5"
                  width="37"
                  height="41"
                  rx="2.5"
                  fill="none"
                  stroke={String(color)}
                  strokeWidth="3"
                  strokeDasharray="4 8"
                  strokeDashoffset={Number(offset)}
                />
              ))}
              <rect x="5.5" y="5.5" width="29" height="33" rx="1" fill="none" stroke="var(--line)" strokeWidth="1" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={count}
                  className="tnum block text-sm leading-none font-bold text-(--brand-ink)"
                  initial={{ y: -14, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 14, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                >
                  {count}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.span>
        </motion.span>
      )}
    </AnimatePresence>
  );
});
