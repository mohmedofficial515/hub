'use client';

/**
 * @file board.tsx
 * @description Ported from v5 `pages/tasks/parts/board.tsx`. Backlog and Done fold to rails, so the width goes to work that is moving.
 */
import { LayoutGroup, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, CircleCheck, Inbox } from 'lucide-react';

import {
  Bidi,
  CardRow,
  cn,
  fmt,
  focusRing,
  Ltr,
  num,
  openBlockers,
  plural,
  type TaskCard,
  useLocale,
  useT,
} from '@/components/kit';
import { type Column, COLUMNS } from '@/features/tasks/model';

import type { TaskMessages } from './messages';
import { MoveButton, type OnMove, TaskFacts } from './task-bits';

const RAILS = new Set<Column>(['backlog', 'done']);

const EASE = [0.2, 0.8, 0.2, 1] as const;

function BoardCard({
  card,
  rowProps,
  onMove,
  canMove,
  primary,
}: {
  card: TaskCard;
  rowProps: Record<string, unknown>;
  onMove: OnMove;
  canMove: boolean;
  primary: boolean;
}) {
  return (
    // `layoutId` is the page's signature: claiming a task lets you watch it travel to the next column.
    <motion.li layout="position" layoutId={`task-${card.key}`} transition={{ duration: 0.28, ease: EASE }}>
      <CardRow
        {...rowProps}
        cardKey={card.key}
        type="task"
        title={card.title}
        priority={card.priority === 'P0' || card.priority === 'P1' ? card.priority : undefined}
        titleId={`task-${card.key}`}
        hideType
        className="sm:px-3"
        meta={
          <>
            <TaskFacts card={card} />
            {canMove && (
              <span className="relative z-10 mt-1 basis-full empty:hidden">
                <MoveButton card={card} onMove={onMove} full primary={primary} />
              </span>
            )}
          </>
        }
      />
    </motion.li>
  );
}

export function TaskBoard({
  byColumn,
  rowProps,
  openRails,
  onToggleRail,
  onMove,
  canMove,
  specialtyFiltered,
  primaryKey,
}: {
  byColumn: Record<Column, TaskCard[]>;
  rowProps: (id: string) => Record<string, unknown>;
  openRails: Set<Column>;
  onToggleRail: (column: Column) => void;
  onMove: OnMove;
  canMove: boolean;
  specialtyFiltered: boolean;
  /** The one filled button of the page: the first Ready task I can claim. */
  primaryKey?: string | undefined;
}) {
  const t = useT<TaskMessages>('tasks');
  const locale = useLocale();
  const Flow = locale === 'ar' ? ChevronLeft : ChevronRight;
  return (
    <LayoutGroup>
      <motion.div
        layoutScroll
        role="group"
        aria-label={t.board.label}
        className="relative -mx-4 flex snap-x snap-proximity items-stretch gap-2 overflow-x-auto scroll-ps-4 px-4 pb-3 md:-mx-6 md:scroll-ps-6 md:px-6"
      >
        {COLUMNS.map((column, index) => {
          const cards = byColumn[column];
          const name = t.board.columns[column];
          const isRail = RAILS.has(column) && !openRails.has(column);
          const blocked = cards.filter((c) => openBlockers(c).length > 0).length;
          const next = COLUMNS[index + 1];

          if (isRail) {
            return (
              <section key={column} aria-labelledby={`col-${column}`} className="w-19 shrink-0 snap-start">
                <button
                  type="button"
                  aria-expanded={false}
                  aria-label={`${fmt(t.board.expand, { name })}: ${plural(cards.length, locale, t.board.count)}`}
                  onClick={() => onToggleRail(column)}
                  className={cn(
                    'flex h-full min-h-40 w-full flex-col items-center gap-1 rounded-lg border border-dashed border-border px-1 py-3 text-center text-body-sm text-muted-foreground transition-colors duration-120 hover:bg-accent hover:text-foreground',
                    focusRing,
                  )}
                >
                  {column === 'done' ? (
                    <CircleCheck aria-hidden className="size-4" strokeWidth={1.75} />
                  ) : (
                    <Inbox aria-hidden className="size-4" strokeWidth={1.75} />
                  )}
                  <span id={`col-${column}`} className="font-medium">
                    {name}
                  </span>
                  <Ltr className="text-title font-bold text-foreground tabular-nums">
                    {num(cards.length, locale)}
                  </Ltr>
                </button>
              </section>
            );
          }

          const emptyText =
            column === 'ready' && specialtyFiltered ? t.board.readyEmpty : t.board.columnEmpty;
          return (
            <section
              key={column}
              aria-labelledby={`col-${column}`}
              className="flex w-72 shrink-0 snap-start flex-col gap-2 md:w-52 lg:@page-lg:w-auto lg:min-w-52 lg:flex-1 lg:@page-lg:basis-0"
            >
              <header className="flex min-h-9 items-center gap-2 border-b border-border pb-1.5">
                <h2 id={`col-${column}`} className="text-body font-semibold text-foreground">
                  {RAILS.has(column) ? (
                    <button
                      type="button"
                      aria-expanded
                      aria-label={fmt(t.board.collapse, { name })}
                      onClick={() => onToggleRail(column)}
                      className={cn('hit-44 rounded-sm underline-offset-4 hover:underline', focusRing)}
                    >
                      {name}
                    </button>
                  ) : (
                    name
                  )}
                </h2>
                <span className="rounded-full bg-muted px-2 text-caption font-medium text-muted-foreground tabular-nums">
                  <span className="sr-only">{plural(cards.length, locale, t.board.count)}</span>
                  <Ltr>
                    <span aria-hidden>{num(cards.length, locale)}</span>
                  </Ltr>
                </span>
                {blocked > 0 && (
                  <span className="text-body-sm text-muted-foreground">
                    {plural(blocked, locale, t.board.blocked)}
                  </span>
                )}
                {column === 'done' && (
                  <span className="text-body-sm text-muted-foreground">{t.board.doneWindow}</span>
                )}
                {next && (
                  <span title={fmt(t.board.next, { name: t.board.columns[next] })} className="ms-auto">
                    <Flow aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.75} />
                  </span>
                )}
              </header>
              {cards.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-body-sm text-muted-foreground">
                  <Bidi>{emptyText}</Bidi>
                </p>
              ) : (
                <ul data-hub-list className="flex flex-col gap-2">
                  {cards.map((card) => (
                    <BoardCard
                      key={card.key}
                      card={card}
                      rowProps={rowProps(card.key)}
                      onMove={onMove}
                      canMove={canMove}
                      primary={card.key === primaryKey}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </motion.div>
    </LayoutGroup>
  );
}
