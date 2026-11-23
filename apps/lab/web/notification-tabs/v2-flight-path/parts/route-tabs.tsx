/**
 * The three views as airports on one dashed route arc. The SVG (route, contrail, plane) is decoration only and hidden
 * from assistive tech; the airports are real `role=tab` buttons with the WAI-ARIA tabs keyboard (roving tab index,
 * arrows that follow the page direction, Home and End).
 *
 * Geometry is drawn in logical coordinates (x grows from the inline start) and the SVG is mirrored in RTL, so the plane
 * always flies "forward" in the reading direction. The arc is a symmetric quadratic curve: the first and last
 * airports sit on its ends (t = 0, t = 1), the middle one on its top (t = 0.5).
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, type AnimationPlaybackControls } from 'framer-motion';
import { Inbox, Mail, Plane, type LucideIcon } from 'lucide-react';
import { INBOX_VIEWS, type InboxView } from '@lab/mocks/notifications-inbox';
import { cn } from '@lab/utils';

const ICONS: Record<InboxView, LucideIcon> = { all: Inbox, unread: Mail, trips: Plane };
const STOP: Record<InboxView, number> = { all: 0, unread: 0.5, trips: 1 };
/** The dashed route runs a little past the outer airports, as if it came from and went on to somewhere else. */
const TAIL = 0.14;
const NODE_R = 24;
const TOP = 10;
const EASE = [0.45, 0, 0.2, 1] as const;

export const tabId = (view: InboxView) => `fp-tab-${view}`;
export const panelId = (view: InboxView) => `fp-panel-${view}`;

interface Props {
  view: InboxView;
  onChange: (view: InboxView) => void;
  unread: number;
  rtl: boolean;
  labels: Record<InboxView, string> & { label: string };
  unreadLabel: (count: number) => string;
  /** Called once the plane has landed on the chosen airport (or at once with reduced motion). */
  onLanded?: () => void;
}

export function RouteTabs({ view, onChange, unread, rtl, labels, unreadLabel, onLanded }: Props) {
  const reduce = useReducedMotion() ?? false;
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Flatter arc on phones so the three names keep their room and the block stays short.
  const h = w < 420 ? 16 : w < 640 ? 28 : 40;
  const midY = TOP + NODE_R;
  const baseY = midY + h;
  const height = baseY + NODE_R + 40;
  const x0 = w / 6;
  const x2 = (w * 5) / 6;
  const at = (t: number) => ({ x: x0 + (x2 - x0) * t, y: baseY - 4 * h * t * (1 - t) });
  const path = (a: number, b: number) => {
    const n = Math.max(2, Math.ceil(Math.abs(b - a) * 48));
    let d = '';
    for (let i = 0; i <= n; i++) {
      const { x, y } = at(a + ((b - a) * i) / n);
      d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  };

  // ---- the flight ----
  const p = useMotionValue(reduce ? STOP[view] : -TAIL);
  const [pos, setPos] = useState(p.get());
  const [from, setFrom] = useState(p.get());
  const [flying, setFlying] = useState(false);
  const [landings, setLandings] = useState(0);
  const flight = useRef<AnimationPlaybackControls | null>(null);
  const opened = useRef(false);
  useMotionValueEvent(p, 'change', setPos);

  useEffect(() => {
    const target = STOP[view];
    flight.current?.stop();
    if (reduce) {
      p.set(target);
      setFlying(false);
      onLanded?.();
      return;
    }
    // On open the plane waits for the route to draw and the airports to appear, then comes in from the tail.
    const delay = opened.current ? 0 : 1.15;
    opened.current = true;
    const start = p.get();
    setFrom(start);
    setFlying(true);
    flight.current = animate(p, target, {
      delay,
      duration: 0.5 + Math.abs(target - start) * 0.55,
      ease: EASE,
      onComplete: () => {
        setFlying(false);
        setLandings((n) => n + 1);
        onLanded?.();
      },
    });
    return () => flight.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, reduce]);

  const plane = at(pos);
  const backwards = STOP[view] < from;
  const angle = (Math.atan2(-4 * h * (1 - 2 * pos), x2 - x0) * 180) / Math.PI + (backwards ? 180 : 0);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: InboxView) => {
    const index = INBOX_VIEWS.indexOf(current);
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
    <div ref={wrap} className="relative w-full select-none" style={{ height }}>
      <svg
        aria-hidden
        width={w}
        height={height}
        className="pointer-events-none absolute inset-0 overflow-visible"
        style={rtl ? { transform: 'scaleX(-1)' } : undefined}
      >
        <defs>
          <mask id="fp-route-reveal" maskUnits="userSpaceOnUse">
            <motion.path
              d={path(-TAIL, 1 + TAIL)}
              fill="none"
              stroke="white"
              strokeWidth={10}
              initial={{ pathLength: reduce ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: 'easeInOut' }}
            />
          </mask>
        </defs>
        {/* the planned route */}
        <path
          d={path(-TAIL, 1 + TAIL)}
          mask="url(#fp-route-reveal)"
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth={2}
          strokeDasharray="2 7"
          strokeLinecap="round"
        />
        {/* the contrail: solid, from where the plane took off to where it is */}
        <motion.path
          d={path(from, pos)}
          fill="none"
          stroke="var(--highlight)"
          strokeWidth={2.5}
          strokeLinecap="round"
          initial={false}
          animate={{ opacity: flying ? 1 : 0 }}
          transition={{ duration: flying ? 0.1 : 0.7 }}
        />
        <motion.g
          initial={false}
          animate={{ opacity: flying ? 1 : 0, scale: flying ? 1 : 0.5 }}
          transition={{ duration: 0.25 }}
          style={{ x: plane.x, y: plane.y }}
        >
          <g transform={`rotate(${angle.toFixed(1)})`}>
            <path
              d="M11 0 C11 1.2 9.6 1.6 8 1.6 L2.5 1.6 L-3 9.5 L-5.6 9.5 L-2.6 1.6 L-7.5 1.6 L-9.6 4.4 L-11.4 4.4 L-10 0 L-11.4 -4.4 L-9.6 -4.4 L-7.5 -1.6 L-2.6 -1.6 L-5.6 -9.5 L-3 -9.5 L2.5 -1.6 L8 -1.6 C9.6 -1.6 11 -1.2 11 0 Z"
              fill="var(--brand)"
              stroke="var(--background)"
              strokeWidth={1.25}
              strokeLinejoin="round"
            />
          </g>
        </motion.g>
      </svg>

      <div role="tablist" aria-label={labels.label} className="absolute inset-0">
        {INBOX_VIEWS.map((value, i) => {
          const active = value === view;
          const Icon = ICONS[value];
          const node = at(STOP[value]);
          const count = value === 'unread' ? unread : 0;
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
              initial={reduce ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: reduce ? 0 : 0.3 + i * 0.2, type: 'spring', stiffness: 420, damping: 22 }}
              className="group absolute flex w-28 -translate-x-1/2 cursor-pointer flex-col items-center gap-1.5 outline-none max-[419px]:w-[6.5rem] rtl:translate-x-1/2"
              style={{ insetInlineStart: (node.x / w) * 100 + '%', top: node.y - NODE_R }}
            >
              <span
                className={cn(
                  'relative flex size-12 items-center justify-center rounded-full border transition-colors duration-300',
                  'group-focus-visible:ring-2 group-focus-visible:ring-(--brand) group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-(--background)',
                  active
                    ? 'border-(--brand) bg-(--brand) text-(--brand-foreground)'
                    : 'border-(--border-strong) bg-(--background) text-(--ink-muted) group-hover:border-(--brand) group-hover:text-(--brand-ink)',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {/* landing ping: one gold ring that opens out when the plane touches down */}
                {active && landings > 0 && (
                  <motion.span
                    key={landings}
                    aria-hidden
                    className="absolute inset-0 rounded-full border-2 border-(--highlight)"
                    initial={{ opacity: 0.9, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.55 }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                  />
                )}
                {count > 0 && (
                  <motion.span
                    key={count}
                    initial={reduce ? false : { scale: 0.5 }}
                    animate={{ scale: 1 }}
                    className="tnum absolute -end-2 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-(--background) bg-(--action-text) px-1 text-xs leading-none font-bold text-white dark:text-(--navy-950)"
                  >
                    <span aria-hidden>{count}</span>
                    <span className="sr-only">{unreadLabel(count)}</span>
                  </motion.span>
                )}
              </span>
              <span
                className={cn(
                  'text-sm leading-tight whitespace-nowrap transition-colors',
                  active ? 'font-bold text-(--brand-ink)' : 'font-semibold text-(--ink) group-hover:text-(--brand-ink)',
                )}
              >
                {labels[value]}
              </span>
              {/* gold touch: a short bar under the chosen airport's name */}
              <span
                aria-hidden
                className={cn(
                  'h-[3px] w-6 rounded-full bg-(--highlight) transition-opacity duration-300',
                  active ? 'opacity-100' : 'opacity-0',
                )}
              />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
