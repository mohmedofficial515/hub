import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { focusRing, fmt, Ltr, num, useRoving } from '../../../today/v5-peacock-app/kit';
import { messages } from '../i18n';
import type { PhaseGroup } from './model';

/** Fade width at an edge that hides more stations. */
const FADE = '2.5rem';
/** A station never gets narrower than this; past it the rail scrolls. Inline, as v2 sized its stations. */
const STATION_MIN = '7.5rem';

/**
 * The plan's overview as a rail: one station per phase, all the same width, so a short phase is as readable as a long one. The
 * stations share the width while they fit (each at least 7.5rem); past that the rail scrolls sideways with snap, fades the edge
 * that hides more, shows round arrow buttons from 768 px, and opens scrolled to "You are here". Progress lives inside each station:
 * its track fills as its steps finish, and its words say "5 of 10". One Tab stop, arrows along the rail (kit `useRoving`).
 */
export function RouteLine({ groups, onGo }: { groups: PhaseGroup[]; onGo: (index: number) => void }) {
  const t = useT(messages);
  const locale = useLocale();
  const rtl = locale === 'ar';
  const anyNext = groups.some((g) => g.hasNext);
  const hereIndex = Math.max(
    0,
    groups.findIndex((g) => g.hasNext),
  );
  const { root, groupProps, itemProps } = useRoving(hereIndex);
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ back: false, forward: false });

  // RTL scrollLeft runs from 0 to negative in every current engine, so the distance from the start is its absolute value.
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const from = Math.abs(el.scrollLeft);
    setEdges({ back: from > 1, forward: from + el.clientWidth < el.scrollWidth - 1 });
  }, []);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, groups.length]);

  // Open on "You are here": centre its station when the rail scrolls. Only the rail moves, never the page.
  useEffect(() => {
    let live = true;
    const centre = () => {
      const el = scroller.current;
      const station = el?.querySelectorAll<HTMLElement>('[data-roving]')[hereIndex];
      if (!live || !el || !station || el.scrollWidth <= el.clientWidth) return;
      // Screen distance between the two centres: the same sum in both directions, and the browser clamps at the ends.
      const s = station.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      el.scrollBy({ left: s.left + s.width / 2 - (r.left + r.width / 2), behavior: 'auto' });
      measure();
    };
    // After fonts and the first layout, when the widths are final.
    const frame = requestAnimationFrame(centre);
    void document.fonts?.ready.then(() => requestAnimationFrame(centre));
    return () => {
      live = false;
      cancelAnimationFrame(frame);
    };
  }, [hereIndex, measure]);

  const page = (direction: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Forward in reading order is +x in LTR and -x in RTL.
    el.scrollBy({ left: direction * (rtl ? -1 : 1) * el.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
  };

  const end = rtl ? 'left' : 'right';
  const mask =
    edges.back || edges.forward
      ? `linear-gradient(to ${end}, ${edges.back ? `transparent 0, black ${FADE}` : 'black 0'}, ${edges.forward ? `black calc(100% - ${FADE}), transparent 100%` : 'black 100%'})`
      : undefined;
  const BackIcon = rtl ? ChevronRight : ChevronLeft;
  const ForwardIcon = rtl ? ChevronLeft : ChevronRight;

  return (
    <nav aria-label={t.route} className="relative min-w-0">
      <div
        ref={scroller}
        onScroll={measure}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
        className="min-w-0 snap-x snap-mandatory scroll-px-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div ref={root} {...groupProps} className="flex min-w-0">
          {groups.map((g, i) => {
            const isHere = anyNext && i === hereIndex;
            const complete = g.total > 0 && g.done === g.total;
            const percent = g.total ? Math.round((g.done / g.total) * 100) : 0;
            const title = g.phase?.title ?? t.unphased;
            return (
              <a
                key={g.phase?.id ?? 'loose'}
                href={`#phase-${g.index}`}
                {...itemProps(i)}
                onClick={(e) => {
                  e.preventDefault();
                  onGo(g.index);
                }}
                aria-current={isHere ? 'step' : undefined}
                aria-label={`${fmt(t.phase, { n: num(g.index, locale) })}: ${title}. ${fmt(t.progressLabel, { done: num(g.done, locale), total: num(g.total, locale) })}${isHere ? `. ${t.here}` : ''}`}
                title={title}
                style={{ flex: `1 0 0`, minWidth: STATION_MIN }}
                className={cn(
                  'group flex snap-start flex-col gap-2 rounded-lg px-2 pt-2 pb-2.5 transition-colors duration-150 hover:bg-accent',
                  isHere && 'bg-accent/60',
                  focusRing,
                )}
              >
                {/* The track: the station dot, then this phase's own fill. */}
                <span aria-hidden className="flex h-4 items-center gap-1.5">
                  <span
                    className={cn(
                      'flex shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200',
                      isHere ? 'size-4 border-foreground bg-card ring-4 ring-foreground/15' : 'size-3.5',
                      complete ? 'border-foreground bg-foreground text-background' : !isHere && 'border-muted-foreground/50 bg-card',
                    )}
                  >
                    {complete && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                  <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-foreground transition-[width] duration-500 ease-out motion-reduce:transition-none"
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                </span>
                {/* Two lines kept for every title, so all stations line up whatever their names. */}
                <span
                  dir="auto"
                  style={{ minHeight: '2lh', textAlign: rtl ? 'right' : 'left' }}
                  className={cn(
                    'line-clamp-2 text-body-sm leading-snug',
                    isHere ? 'font-semibold text-foreground' : complete ? 'text-foreground/80' : 'text-muted-foreground group-hover:text-foreground',
                  )}
                >
                  <Ltr className={cn('font-bold tabular-nums', isHere ? 'text-foreground' : 'text-muted-foreground')}>{num(g.index, locale)}</Ltr>
                  {' '}
                  {title}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 text-caption tabular-nums">
                  <span className={cn('shrink-0', isHere ? 'text-foreground' : 'text-muted-foreground')}>
                    {complete ? t.done : fmt(t.progress, { done: num(g.done, locale), total: num(g.total, locale) })}
                  </span>
                  {isHere && <span className="truncate font-semibold text-foreground">· {t.hereShort}</span>}
                </span>
              </a>
            );
          })}
        </div>
      </div>

      {(
        [
          ['back', -1, edges.back, BackIcon, t.railBack, 'start-0'],
          ['forward', 1, edges.forward, ForwardIcon, t.railForward, 'end-0'],
        ] as const
      ).map(([key, direction, shown, Icon, label, side]) => (
        <button
          key={key}
          type="button"
          tabIndex={-1}
          aria-hidden={!shown}
          aria-label={label}
          onClick={() => page(direction)}
          className={cn(
            'absolute top-1.5 hidden size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-opacity duration-150 hover:text-foreground md:flex',
            side,
            shown ? 'opacity-100' : 'pointer-events-none opacity-0',
            focusRing,
          )}
        >
          <Icon className="size-4" strokeWidth={2} />
        </button>
      ))}
      <p className="sr-only">{t.routeHint}</p>
    </nav>
  );
}
