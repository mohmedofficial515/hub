'use client';

/**
 * @file counters.tsx
 * @description A strip of quiet tiles that link away. Tiles whose section is already on this page (Awaiting, Tasks ready, Sessions) were dropped:
 * they repeated the section counts just below (review M2). The design's sparklines are gone, since no counter history exists (docs/15 §8).
 */
import { type LucideIcon, Sunrise } from 'lucide-react';

import {
  AppLink,
  type CardListItem,
  cn,
  fmt,
  focusRingInset,
  Ltr,
  num,
  plural,
  TypeIcon,
  useLocale,
  useT,
  type ViewId,
} from '@/components/kit';

import { NS, type TodayMessages } from './messages';

export type CounterKey = 'inbox' | 'decisions' | 'needs' | 'handoffs' | 'redesigns';

export interface CounterTile {
  key: CounterKey;
  /** What is mine: the number that matches the link and the rows (review M9). */
  value: number;
  /** The whole project's count, when it says something the mine count does not. */
  all?: number | undefined;
  /** Only ever counts what is routed to me. */
  overdue?: number | undefined;
  view: ViewId;
  query?: Record<string, string> | undefined;
  type?: CardListItem['type'] | undefined;
  icon?: LucideIcon | undefined;
}

export function CountersBand({ tiles }: { tiles: CounterTile[] }) {
  const t = useT<TodayMessages>(NS);
  const locale = useLocale();

  if (tiles.every((tile) => tile.value === 0 && !tile.all)) {
    return (
      <section
        aria-labelledby="counters-title"
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-body text-muted-foreground"
      >
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
      <ul
        className={cn(
          'grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border',
          tiles.length >= 5 ? 'md:@page-md:grid-cols-5' : 'md:@page-md:grid-cols-4',
        )}
      >
        {tiles.map((tile, i) => {
          const Icon = tile.icon;
          const odd = tiles.length % 2 === 1 && i === tiles.length - 1;
          return (
            <li key={tile.key} className={cn('flex min-w-0', odd && 'max-md:col-span-2')}>
              <AppLink
                view={tile.view}
                query={tile.query}
                className={cn(
                  'flex w-full min-w-0 flex-col gap-1 bg-card px-3 py-2.5 transition-colors duration-120 hover:bg-accent',
                  focusRingInset,
                )}
              >
                <span className="flex min-w-0 items-start gap-1.5 text-body-sm text-muted-foreground">
                  {tile.type ? (
                    <TypeIcon type={tile.type} className="mt-0.5" />
                  ) : (
                    Icon && <Icon aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                  )}
                  <span className="min-w-0">{t.counters.tiles[tile.key]}</span>
                </span>
                <span className="text-title font-bold text-foreground tabular-nums">
                  <Ltr>{num(tile.value, locale)}</Ltr>
                </span>
                <span className="flex min-h-5 flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
                  {tile.all !== undefined && tile.all > tile.value && (
                    <span>
                      {fmt(tile.key === 'needs' ? t.counters.scopeNeeds : t.counters.scope, {
                        all: num(tile.all, locale),
                      })}
                    </span>
                  )}
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
