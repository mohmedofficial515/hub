import { Sunrise, type LucideIcon } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import type { CardType } from '@lab/mocks/hub-today';
import { AppLink, cn, fmt, focusRingInset, Ltr, num, plural, TypeIcon, type ViewId } from '../../../kit';
import { messages } from '../i18n';

export type CounterKey = 'inbox' | 'decisions' | 'needs' | 'handoffs' | 'redesigns';

export interface CounterTile {
  key: CounterKey;
  /** What is mine: the number that matches the link and the rows (review M9). */
  value: number;
  /** The whole workspace's count, when it says something the mine count does not. */
  all?: number;
  /** Only ever counts what is routed to me. */
  overdue?: number;
  view: ViewId;
  query?: Record<string, string>;
  type?: CardType;
  icon?: LucideIcon;
}

/**
 * 7-day shapes per counter (oldest first, last point = today = 1). The API has no counter history yet, so the lab
 * derives a series that ends on today's value. README deviation: replace with the real endpoint. No trend word sits beside it:
 * a word read as fact, and it inverted on every action (review M4). Words return with the history endpoint.
 */
const SHAPES: Record<CounterKey, number[]> = {
  inbox: [0.45, 0.7, 0.55, 0.9, 0.6, 1.2, 1],
  decisions: [0.6, 0.6, 0.8, 0.8, 1.2, 1, 1],
  needs: [1.3, 1, 1, 1.3, 1, 0.7, 1],
  handoffs: [1, 1.5, 0.5, 1, 1.5, 1, 1],
  redesigns: [0.5, 0.5, 1, 1, 1.5, 1, 1],
};

const seriesFor = (key: CounterKey, value: number) => SHAPES[key].map((f) => Math.max(0, Math.round(f * value)));

/** Oldest point at the inline start, today at the inline end (mirrored in RTL like every time axis). */
function Sparkline({ series }: { series: number[] }) {
  const w = 56;
  const h = 20;
  const max = Math.max(1, ...series);
  const pts = series.map((v, i) => [2 + (i * (w - 4)) / (series.length - 1), h - 3 - (v / max) * (h - 6)] as const);
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} aria-hidden className="h-5 w-14 shrink-0 overflow-visible rtl:-scale-x-100">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" className="stroke-muted-foreground/60" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.25" className="fill-muted-foreground" />
    </svg>
  );
}

/**
 * A strip of quiet tiles that link away. Tiles whose section is already on this page (Awaiting, Tasks ready,
 * Sessions) were dropped: they repeated the section counts just below (review M2). Numerals are 18 px, so the order
 * is page title, then counters, then card titles.
 */
export function CountersBand({ tiles }: { tiles: CounterTile[] }) {
  const t = useT(messages);
  const locale = useLocale();

  if (tiles.every((tile) => tile.value === 0 && !tile.all)) {
    return (
      <section aria-labelledby="counters-title" className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-body text-muted-foreground">
        <h2 id="counters-title" className="sr-only">
          {t.counters.label}
        </h2>
        <Sunrise aria-hidden className="size-4.5 shrink-0" strokeWidth={1.75} />
        {t.counters.quietAll}
      </section>
    );
  }

  return (
    <section aria-labelledby="counters-title">
      <h2 id="counters-title" className="sr-only">
        {t.counters.label}
      </h2>
      <ul className={cn('grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border', tiles.length >= 5 ? 'md:grid-cols-5' : 'md:grid-cols-4')}>
        {tiles.map((tile, i) => {
          const series = seriesFor(tile.key, tile.value);
          const Icon = tile.icon;
          const odd = tiles.length % 2 === 1 && i === tiles.length - 1;
          return (
            <li key={tile.key} className={cn('flex min-w-0', odd && 'max-md:col-span-2')}>
              <AppLink
                view={tile.view}
                query={tile.query}
                className={cn('flex w-full min-w-0 flex-col gap-1 bg-card px-3 py-2.5 transition-colors duration-120 hover:bg-accent', focusRingInset)}
              >
                <span className="flex min-w-0 items-start gap-1.5 text-body-sm text-muted-foreground">
                  {tile.type ? <TypeIcon type={tile.type} className="mt-0.5" /> : Icon && <Icon aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />}
                  <span className="min-w-0">{t.counters.tiles[tile.key]}</span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-title font-bold text-foreground tabular-nums">
                    <Ltr>{num(tile.value, locale)}</Ltr>
                  </span>
                  <Sparkline series={series} />
                </span>
                <span className="sr-only">{fmt(t.counters.series, { values: series.join(', ') })}</span>
                <span className="flex min-h-5 flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
                  {tile.all !== undefined && tile.all > tile.value && <span>{fmt(tile.key === 'needs' ? t.counters.scopeNeeds : t.counters.scope, { all: num(tile.all, locale) })}</span>}
                  {tile.overdue ? (
                    <span className="inline-flex items-center gap-1 font-medium text-destructive-soft-foreground">
                      <span aria-hidden className="size-1.5 rounded-full bg-destructive" />
                      {plural(tile.overdue, locale, t.counters.overdue)}
                    </span>
                  ) : null}
                </span>
              </AppLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
