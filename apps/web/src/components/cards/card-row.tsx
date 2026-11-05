'use client';

/**
 * @file card-row.tsx
 * @description Ported from F:/Goteav/redesign/hub/today/v5-peacock-app/kit/card-row.tsx. Contract: apps/web/README.md.
 */
import type { ComponentProps, ReactNode } from 'react';

import { PriorityBadge } from '@/components/cards/badges';
import { stretchedFocus, typeClass, typeIcon } from '@/components/cards/meta';
import { Bidi, Ltr } from '@/components/common/text';
import { AppLink } from '@/components/shell/router';
import type { CardType, Priority } from '@/features/cards/types';
import { useT } from '@/lib/i18n';
import { type CardAction, kitMessages } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface CardRowProps extends Omit<ComponentProps<'article'>, 'title'> {
  cardKey: string;
  type: CardType;
  title: string;
  priority?: Priority | undefined;
  /** `danger` makes the card's border a uniform rust hairline, for overdue or escalated cards. A row in a joined list has no border of its own to colour. */
  tone?: 'type' | 'danger' | undefined;
  /** Second line, after type word + key + priority: pills, due date, actor. */
  meta?: ReactNode | undefined;
  /** Buttons at the inline end. They sit above the stretched link. */
  action?: ReactNode | undefined;
  /** The lead row of a triage list: a slightly larger title, and on phone the action goes full width. */
  lead?: boolean | undefined;
  /** `flush` is for rows in a joined list (hairline between rows, no own radius). */
  variant?: 'card' | 'flush' | undefined;
  /** Open the sheet on this action when the row itself is opened. */
  openAction?: CardAction | undefined;
  /** Id for the title, so the row and its buttons can `aria-labelledby` / `aria-describedby` it. */
  titleId?: string | undefined;
  /** Drop the type word from the meta line, in a list where every row is the same type (Tasks board, Docs recents). */
  hideType?: boolean | undefined;
}

/**
 * The app's row: one neutral surface, one uniform border, a coloured type icon and type word. No card has a coloured
 * side or top edge (owner decision 2026-11-04). The whole row opens the card through a stretched link. Spread `rowProps(id)` from
 * `useKeyboardList` on it. Rows are about 72 px at two lines, per review M3.
 */
export function CardRow({
  cardKey,
  type,
  title,
  priority,
  tone = 'type',
  meta,
  action,
  lead = false,
  variant = 'card',
  openAction,
  titleId,
  hideType = false,
  className,
  ...rest
}: CardRowProps) {
  const t = useT(kitMessages);
  const TypeIconGlyph = typeIcon[type];
  const id = titleId ?? `row-${cardKey}`;
  return (
    <article
      aria-labelledby={id}
      className={cn(
        'relative grid gap-x-3 gap-y-2 bg-card px-3 py-3 outline-none transition-colors duration-120 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        'grid-cols-[auto_minmax(0,1fr)] sm:px-4',
        action && !lead && 'grid-cols-[auto_minmax(0,1fr)_auto] items-center',
        action && lead && 'items-center sm:grid-cols-[auto_minmax(0,1fr)_auto]',
        variant === 'card'
          ? cn('rounded-lg border', tone === 'danger' ? 'border-destructive/70' : 'border-border')
          : 'border-b border-border last:border-b-0',
        lead && 'py-3.5',
        className,
      )}
      {...rest}
    >
      {/* The word is in the meta line just below, so the icon stays decorative here. */}
      <span aria-hidden className={cn('self-start pt-0.5', typeClass[type].fg)}>
        <TypeIconGlyph className="size-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p
          id={id}
          className={cn('font-semibold text-pretty text-foreground', lead ? 'text-title-sm' : 'text-body-lg')}
        >
          <AppLink
            card={cardKey}
            action={openAction}
            className={cn(
              'underline-offset-4 outline-none after:absolute after:inset-0 hover:underline',
              stretchedFocus,
              variant === 'card' && 'after:rounded-lg',
            )}
          >
            <Bidi>{title}</Bidi>
          </AppLink>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-body-sm text-muted-foreground">
          {hideType ? (
            <span className="sr-only">{t.types[type]}</span>
          ) : (
            <span className={cn('font-medium', typeClass[type].fg)}>{t.types[type]}</span>
          )}
          <Ltr mono className="text-caption">
            {cardKey}
          </Ltr>
          {priority && <PriorityBadge priority={priority} />}
          {meta}
        </div>
      </div>
      {action && (
        <div
          className={cn(
            'relative z-10 flex items-center gap-2',
            lead && 'col-span-2 sm:col-span-1 *:max-sm:w-full',
          )}
        >
          {action}
        </div>
      )}
    </article>
  );
}
