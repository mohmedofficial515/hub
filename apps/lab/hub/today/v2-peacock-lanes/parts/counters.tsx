import { Inbox, UserRoundCheck, type LucideIcon } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { CardType } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { fmt, HubLink, Ltr, TypeDot } from './atoms';
import { num, plural } from './format';
import { typeClass } from './type-meta';

export type CounterKey = 'inbox' | 'awaiting' | 'decisions' | 'needs' | 'handoffs' | 'tasks' | 'redesigns' | 'sessions';

export interface CounterTile {
  key: CounterKey;
  value: number;
  to: string;
  type?: CardType;
  icon?: LucideIcon;
  overdue?: number;
}

/**
 * 7-day shapes per counter (oldest first, last point = today = 1). The API has no history for
 * counters yet; the lab derives a plausible series that ends on today's value.
 */
const SHAPES: Record<CounterKey, number[]> = {
  inbox: [0.45, 0.7, 0.55, 0.9, 0.6, 1.2, 1],
  awaiting: [0.5, 0.7, 0.7, 0.85, 1, 0.85, 1],
  decisions: [0.6, 0.6, 0.8, 0.8, 1.2, 1, 1],
  needs: [1.3, 1, 1, 1.3, 1, 0.7, 1],
  handoffs: [1, 1.5, 0.5, 1, 1.5, 1, 1],
  tasks: [2, 1.7, 1.7, 1.3, 1.3, 1, 1],
  redesigns: [0.5, 0.5, 1, 1, 1.5, 1, 1],
  sessions: [0, 1, 2, 1, 0, 1, 1],
};

export function seriesFor(key: CounterKey, value: number) {
  return SHAPES[key].map((f) => Math.max(0, Math.round(f * value)));
}

export function trendOf(series: number[]): 'rising' | 'falling' | 'steady' | 'quiet' {
  const head = (series[0] + series[1] + series[2]) / 3;
  const tail = (series[series.length - 1] + series[series.length - 2]) / 2;
  if (series.every((v) => v === 0)) return 'quiet';
  if (tail > head * 1.15) return 'rising';
  if (tail < head * 0.85) return 'falling';
  return 'steady';
}

/** Oldest point at the inline start, today at the inline end (mirrored in RTL like every time axis). */
function Sparkline({ series, type }: { series: number[]; type?: CardType }) {
  const w = 64;
  const h = 26;
  const max = Math.max(1, ...series);
  const pts = series.map((v, i) => [2 + (i * (w - 4)) / (series.length - 1), h - 3 - (v / max) * (h - 6)] as const);
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} aria-hidden className="h-6.5 w-16 shrink-0 overflow-visible rtl:-scale-x-100">
      <polyline
        points={pts.map((p) => p.join(',')).join(' ')}
        fill="none"
        className="stroke-muted-foreground/70"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lx} cy={ly} r="2.75" className={type ? typeClass[type].fill : 'fill-primary'} />
    </svg>
  );
}

const LAST_SPAN: Record<number, string> = { 0: '', 1: 'md:col-span-4 xl:col-span-1', 2: 'md:col-span-3 xl:col-span-1', 3: 'md:col-span-2 xl:col-span-1' };

export function CountersBand({ tiles }: { tiles: CounterTile[] }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <section aria-labelledby="counters-title">
      <h2 id="counters-title" className="sr-only">
        {t.counters.label}
      </h2>
      <ul
        className={cn(
          // `relative` keeps the sr-only series text inside the scroller (absolute children escape otherwise).
          'relative flex snap-x snap-mandatory gap-px overflow-x-auto rounded-xl border border-border bg-border [scrollbar-width:none]',
          'md:grid md:grid-cols-4 md:overflow-visible',
          tiles.length === 7 ? 'xl:grid-cols-7' : 'xl:grid-cols-8',
        )}
      >
        {tiles.map((tile, i) => {
          const series = seriesFor(tile.key, tile.value);
          const trend = trendOf(series);
          const Icon = tile.icon;
          const label = t.counters.tiles[tile.key];
          return (
            <li
              key={tile.key}
              className={cn(
                'flex w-40 shrink-0 snap-start md:w-auto',
                // md shows 4 per row: the last tile fills a short last row so no empty cell shows.
                i === tiles.length - 1 && LAST_SPAN[tiles.length % 4],
              )}
            >
              <HubLink
                to={tile.to}
                className={cn(
                  'flex w-full flex-col gap-1.5 rounded-none bg-card px-3.5 pt-3 pb-3 transition-colors duration-150 hover:bg-accent',
                  'focus-visible:ring-inset focus-visible:ring-offset-0',
                )}
              >
                <span className="flex min-h-8 items-start gap-1.5 text-caption text-muted-foreground">
                  {tile.type ? (
                    <TypeDot type={tile.type} className="mt-1" />
                  ) : (
                    Icon && <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
                  )}
                  <span className="line-clamp-2">{label}</span>
                </span>
                <span className="flex items-end justify-between gap-2">
                  <span className="text-display font-semibold text-foreground tabular-nums">
                    <Ltr>{num(tile.value, locale)}</Ltr>
                  </span>
                  <Sparkline series={series} type={tile.type} />
                </span>
                <span className="sr-only">{fmt(t.counters.series, { values: series.join(', ') })}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
                  {tile.overdue ? (
                    <span className="inline-flex items-center gap-1 font-medium text-destructive">
                      <span aria-hidden className="size-1.5 rounded-full bg-destructive" />
                      {plural(tile.overdue, locale, t.counters.overdue)}
                    </span>
                  ) : null}
                  <span>{t.counters.trend[trend]}</span>
                </span>
              </HubLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export const counterIcons = { inbox: Inbox, awaiting: UserRoundCheck };
