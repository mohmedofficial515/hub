'use client';

/**
 * @file relay.tsx
 * @description Ported from the approved design, pages/handoffs. Contract: apps/web/README.md.
 */
import { ChevronRight } from 'lucide-react';

import { cn, focusRingInset, type HandoffCard, Ltr, num, plural, useLocale, useT } from '@/components/kit';
import type { HandoffsMessages } from '@/features/handoffs/messages';
import { useHandoffStale } from '@/features/handoffs/queries';

export type RelayStage = 'pending' | 'acknowledged' | 'applied';
const STAGES: RelayStage[] = ['pending', 'acknowledged', 'applied'];

/**
 * The page's focal point and its status filter in one: the road a handoff travels, with how many stand at each stop. The
 * question this page answers is "was it received?", so the first stop is the one you read first. Pressing a stop narrows the
 * list; pressing it again returns to everything still in motion.
 */
export function Relay({
  cards,
  stage,
  onChange,
}: {
  cards: HandoffCard[];
  stage: RelayStage | 'all' | null;
  onChange: (stage: RelayStage | 'all' | null) => void;
}) {
  const t = useT<HandoffsMessages>('handoffs');
  const locale = useLocale();
  const allActive = stage === 'all';
  const isHandoffStale = useHandoffStale();
  return (
    <div
      role="group"
      aria-label={t.relay.label}
      className="grid grid-cols-3 overflow-hidden rounded-lg border border-border bg-card md:grid-cols-[1fr_1fr_1fr_auto]"
    >
      {STAGES.map((s, i) => {
        const rows = cards.filter((c) => c.status === s);
        const active = stage === s;
        const breaking = s !== 'applied' ? rows.filter((c) => c.handoff.severity === 'breaking').length : 0;
        const stale = rows.filter(isHandoffStale).length;
        return (
          <button
            key={s}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? null : s)}
            className={cn(
              'relative flex min-h-11 min-w-0 flex-col items-start gap-0.5 px-3 py-3 text-start transition-colors duration-120 hover:bg-accent md:px-5 md:py-4',
              i > 0 && 'border-s border-border',
              active && 'bg-accent',
              focusRingInset,
            )}
          >
            <span className="text-title font-bold text-foreground tabular-nums">
              <Ltr>{num(rows.length, locale)}</Ltr>
            </span>
            <span
              className={cn(
                'pe-3 text-body-sm',
                active ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {t.relay[s]}
            </span>
            {(breaking > 0 || stale > 0) && (
              <span className="flex flex-wrap gap-x-2 text-caption font-medium">
                {breaking > 0 && (
                  <span className="text-destructive-soft-foreground">
                    {plural(breaking, locale, t.relay.breaking)}
                  </span>
                )}
                {stale > 0 && (
                  <span className="text-warning-soft-foreground">{plural(stale, locale, t.relay.stale)}</span>
                )}
              </span>
            )}
            {i < STAGES.length - 1 && (
              <ChevronRight
                aria-hidden
                className="absolute end-1 top-1/2 size-4 -translate-y-1/2 text-muted-foreground rtl:-scale-x-100 md:end-2"
                strokeWidth={1.75}
              />
            )}
          </button>
        );
      })}
      <button
        type="button"
        aria-pressed={allActive}
        onClick={() => onChange(allActive ? null : 'all')}
        className={cn(
          'relative col-span-3 flex min-h-11 items-center gap-2 border-t border-border px-3 text-start text-body-sm transition-colors duration-120 hover:bg-accent md:col-span-1 md:flex-col md:items-start md:justify-center md:gap-0.5 md:border-s md:border-t-0 md:px-4',
          allActive ? 'bg-accent font-semibold text-foreground' : 'text-muted-foreground',
          focusRingInset,
        )}
      >
        <span className="font-semibold text-foreground tabular-nums md:text-title md:font-bold">
          <Ltr>{num(cards.length, locale)}</Ltr>
        </span>
        {t.relay.all}
      </button>
    </div>
  );
}
