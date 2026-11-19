'use client';

/**
 * @file focus-desk.tsx
 * @description The Focus view of Tasks ("Focus desk", owner pick 2026-11-09): the six stages as one strip, the task to do
 * next on top, the chosen stage's queue under it, and what is in my hands or waiting for review beside it.
 */
import type { DoNextItem, DoNextReason } from '@hub/contracts';
import {
  Ban,
  CirclePlay,
  Eye,
  Feather,
  Hand,
  Link2,
  ListTodo,
  type LucideIcon,
  Route,
  Send,
  Sparkles,
} from 'lucide-react';

import {
  Bidi,
  Button,
  CardRow,
  cn,
  fill,
  fmt,
  focusRing,
  Ltr,
  num,
  openBlockers,
  Pill,
  plural,
  type TaskCard,
  type Tone,
  useLocale,
  useT,
} from '@/components/kit';
import type { ChatMessages } from '@/components/workbench/words';
import { type Column, COLUMNS } from '@/features/tasks/model';

import type { TaskMessages } from './messages';
import { MoveButton, type OnMove, TaskFacts } from './task-bits';

export interface FocusDeskRows {
  /** The task to do next: the first one in my hands, else the first Ready task I can claim. */
  hero: TaskCard | undefined;
  /** The chosen stage, without the hero. */
  queue: TaskCard[];
  /** The rest of what I hold, when it is not already in the queue. */
  mine: TaskCard[];
  /** In review, for QA and managers, when it is not already shown above. */
  review: TaskCard[];
  /** For everyone else: what I sent for review and still waits, when it is not already shown above. */
  sent: TaskCard[];
}

/** Do next's order (docs/16 §11) on a list: the ranked tasks first, in rank, then the rest as they came. */
export function byRank<C extends { key: string }>(
  cards: readonly C[],
  ranked: readonly string[] | undefined,
): C[] {
  if (!ranked?.length) return [...cards];
  const at = new Map(ranked.map((key, i) => [key, i]));
  return cards
    .map((card, i) => ({ card, i, rank: at.get(card.key) ?? ranked.length + i }))
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.card);
}

/**
 * Which task shows where, so each appears once and the keyboard list walks them in screen order. What is in my hands leads; with nothing there, the
 * hero is `primaryKey`, the first Ready task Do next ranks that I can claim. `ranked`, Do next's keys in order, orders the stage's queue; without it the
 * order is the board's.
 */
export function focusDeskOf(
  byColumn: Record<Column, TaskCard[]>,
  stage: Column,
  {
    meId,
    primaryKey,
    seesReview,
    ranked,
  }: {
    meId: string;
    primaryKey: string | undefined;
    seesReview: boolean;
    ranked?: readonly string[] | undefined;
  },
): FocusDeskRows {
  const inHands = [...byColumn.in_progress, ...byColumn.claimed].filter((c) => c.assigneeId === meId);
  const hero = inHands[0] ?? byColumn.ready.find((c) => c.key === primaryKey);
  const queue = byRank(byColumn[stage], ranked).filter((c) => c.key !== hero?.key);
  const shown = new Set([hero?.key, ...queue.map((c) => c.key)]);
  const mine = inHands.filter((c) => !shown.has(c.key));
  mine.forEach((c) => shown.add(c.key));
  const review = seesReview ? byColumn.in_review.filter((c) => !shown.has(c.key)) : [];
  const sent = seesReview ? [] : byColumn.in_review.filter((c) => c.assigneeId === meId && !shown.has(c.key));
  return { hero, queue, mine, review, sent };
}

export const focusDeskIds = ({ hero, queue, mine, review, sent }: FocusDeskRows) =>
  [...(hero ? [hero] : []), ...queue, ...mine, ...review, ...sent].map((c) => c.key);

const panel = 'overflow-hidden rounded-xl border border-border bg-card shadow-xs';

const REASON: Record<DoNextReason, { icon: LucideIcon; tone: Tone }> = {
  overdue: { icon: Ban, tone: 'danger' },
  blocks: { icon: Link2, tone: 'warning' },
  plan_next: { icon: Route, tone: 'info' },
  small: { icon: Feather, tone: 'muted' },
  ready: { icon: CirclePlay, tone: 'success' },
  decision: { icon: Sparkles, tone: 'muted' },
};

/**
 * Why Do next ranks this task where it does, as pills, in the panel's own words (`chat.json` panel.next.why). The row already says overdue with its
 * duration, so that reason is left to it; Ready to start says something only on the hero, and only when it is the one reason.
 */
function NextReasons({ item, hero = false }: { item: DoNextItem | undefined; hero?: boolean }) {
  const why = useT<ChatMessages>('chat').panel.next.why;
  const locale = useLocale();
  if (!item) return null;
  const shown = item.reasons.filter(
    (r) => r !== 'overdue' && r !== 'decision' && (r !== 'ready' || (hero && item.reasons.length === 1)),
  );
  if (shown.length === 0) return null;
  const words = (reason: DoNextReason) => {
    if (reason === 'blocks')
      return fmt(plural(item.blocks, locale, why.blocks), { n: num(item.blocks, locale) });
    if (reason === 'plan_next') return fill(why.planNext, { plan: <Ltr mono>{item.plan?.key ?? ''}</Ltr> });
    return reason === 'small' ? why.small : why.ready;
  };
  return (
    <span data-task-reasons className="inline-flex flex-wrap items-center gap-1.5">
      {shown.map((reason) => (
        <Pill key={reason} tone={REASON[reason].tone} icon={REASON[reason].icon}>
          {words(reason)}
        </Pill>
      ))}
    </span>
  );
}

function Count({ n }: { n: number }) {
  const locale = useLocale();
  return (
    <span className="rounded-full bg-muted px-2 text-caption font-medium text-muted-foreground tabular-nums">
      <Ltr>{num(n, locale)}</Ltr>
    </span>
  );
}

function PanelHeader({
  id,
  icon: Icon,
  title,
  count,
}: {
  id: string;
  icon: typeof ListTodo;
  title: string;
  count: number;
}) {
  return (
    <header className="flex min-h-12 items-center gap-2 border-b border-border px-4 py-2.5">
      <span
        aria-hidden
        className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary-text"
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <h2 id={id} className="text-title-sm font-semibold text-foreground">
        {title}
      </h2>
      <Count n={count} />
    </header>
  );
}

function Rows({
  cards,
  rowProps,
  onMove,
  canMove,
  primaryKey,
  empty,
  reasons,
}: {
  cards: TaskCard[];
  rowProps: (id: string) => Record<string, unknown>;
  onMove: OnMove;
  canMove: boolean;
  primaryKey: string | undefined;
  empty: string;
  reasons?: ReadonlyMap<string, DoNextItem> | undefined;
}) {
  if (cards.length === 0) {
    return (
      <p className="px-4 py-5 text-center text-body-sm text-muted-foreground">
        <Bidi>{empty}</Bidi>
      </p>
    );
  }
  return (
    <ol data-hub-list>
      {cards.map((card) => (
        <li key={card.key} className="border-b border-border last:border-b-0">
          <CardRow
            {...rowProps(card.key)}
            cardKey={card.key}
            type="task"
            title={card.title}
            priority={card.priority === 'P0' || card.priority === 'P1' ? card.priority : undefined}
            titleId={`task-${card.key}`}
            variant="flush"
            hideType
            meta={
              <>
                <TaskFacts card={card} />
                <NextReasons item={reasons?.get(card.key)} />
              </>
            }
            action={
              canMove ? (
                <MoveButton card={card} onMove={onMove} primary={card.key === primaryKey} />
              ) : undefined
            }
          />
        </li>
      ))}
    </ol>
  );
}

export function FocusDesk({
  rows,
  byColumn,
  stage,
  onStage,
  rowProps,
  onMove,
  canMove,
  primaryKey,
  specialtyFiltered,
  seesReview,
  reasons,
}: {
  rows: FocusDeskRows;
  byColumn: Record<Column, TaskCard[]>;
  stage: Column;
  onStage: (stage: Column) => void;
  rowProps: (id: string) => Record<string, unknown>;
  onMove: OnMove;
  canMove: boolean;
  /** The first Ready task I can claim. It fills a queue's button only when there is no task in Next for you. */
  primaryKey: string | undefined;
  specialtyFiltered: boolean;
  seesReview: boolean;
  /** Do next's answer by task key: why each ranked task leads. Absent while it loads or when it failed, and the desk keeps the board's order. */
  reasons?: ReadonlyMap<string, DoNextItem> | undefined;
}) {
  const t = useT<TaskMessages>('tasks');
  const locale = useLocale();
  const { hero, queue, mine, review, sent } = rows;
  // The filled button is the next thing this page wants from me: the task in "Next for you". Only with no hero does a queue fill one.
  const rowsPrimary = hero ? undefined : primaryKey;
  const stageName = t.board.columns[stage];

  const blockedBy = (column: Column) =>
    column === 'done' ? 0 : byColumn[column].filter((c) => openBlockers(c).length > 0).length;
  const blockedTotal = COLUMNS.reduce((sum, c) => sum + blockedBy(c), 0);
  const worstStage = COLUMNS.reduce((a, b) => (blockedBy(b) > blockedBy(a) ? b : a));

  const queueEmpty = stage === 'ready' && specialtyFiltered ? t.board.readyEmpty : t.focus.queueEmpty;

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t.focus.label} className={cn(panel, 'p-1.5')}>
        <ul className="grid grid-cols-3 gap-1 @page-sm:grid-cols-6">
          {COLUMNS.map((column) => {
            const count = byColumn[column].length;
            const blocked = blockedBy(column);
            const name = t.board.columns[column];
            return (
              <li key={column}>
                <button
                  type="button"
                  aria-pressed={stage === column}
                  aria-label={`${name}: ${plural(count, locale, t.board.count)}${blocked ? `${locale === 'ar' ? '، ' : ', '}${plural(blocked, locale, t.board.blocked)}` : ''}`}
                  onClick={() => onStage(column)}
                  className={cn(
                    'flex min-h-16 w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-start transition-colors duration-120 motion-reduce:transition-none',
                    stage === column
                      ? 'bg-primary/10 ring-1 ring-primary/20'
                      : 'hover:bg-accent active:bg-accent/70',
                    focusRing,
                  )}
                >
                  <span
                    className={cn(
                      'text-caption font-semibold',
                      stage === column ? 'text-primary-text' : 'text-muted-foreground',
                    )}
                  >
                    {name}
                  </span>
                  <Ltr className="text-title font-bold text-foreground tabular-nums">
                    {num(count, locale)}
                  </Ltr>
                  {blocked > 0 && (
                    <span className="text-caption font-bold text-warning-strong">
                      {plural(blocked, locale, t.board.blocked)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="grid items-start gap-4 lg:@page-lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className={panel}>
          <section aria-labelledby="focus-next" className="border-b border-border bg-primary/5">
            <h2
              id="focus-next"
              className="flex items-center gap-1.5 px-4 pt-3.5 text-caption font-bold text-primary-text"
            >
              <Sparkles aria-hidden className="size-3.5" strokeWidth={2} />
              {t.focus.next}
            </h2>
            {hero ? (
              <CardRow
                {...rowProps(hero.key)}
                cardKey={hero.key}
                type="task"
                title={hero.title}
                priority={hero.priority === 'P0' || hero.priority === 'P1' ? hero.priority : undefined}
                titleId={`task-${hero.key}`}
                variant="flush"
                lead
                hideType
                className="bg-transparent pt-2 pb-4 sm:px-4"
                meta={
                  <>
                    <TaskFacts card={hero} />
                    <NextReasons item={reasons?.get(hero.key)} hero />
                  </>
                }
                action={canMove ? <MoveButton card={hero} onMove={onMove} primary /> : undefined}
              />
            ) : (
              <p className="px-4 pt-1 pb-4 text-body-sm text-muted-foreground">{t.focus.nextEmpty}</p>
            )}
          </section>
          <section aria-labelledby="focus-queue">
            <PanelHeader
              id="focus-queue"
              icon={ListTodo}
              title={fmt(t.focus.queue, { name: stageName })}
              count={queue.length}
            />
            <Rows
              cards={queue}
              rowProps={rowProps}
              onMove={onMove}
              canMove={canMove}
              primaryKey={rowsPrimary}
              empty={queueEmpty}
              reasons={reasons}
            />
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section aria-labelledby="focus-mine" className={panel}>
            <PanelHeader id="focus-mine" icon={Hand} title={t.focus.mine} count={mine.length} />
            <Rows
              cards={mine}
              rowProps={rowProps}
              onMove={onMove}
              canMove={canMove}
              primaryKey={rowsPrimary}
              empty={t.focus.mineEmpty}
            />
          </section>
          {seesReview && (
            <section aria-labelledby="focus-review" className={panel}>
              <PanelHeader id="focus-review" icon={Eye} title={t.focus.review} count={review.length} />
              <Rows
                cards={review}
                rowProps={rowProps}
                onMove={onMove}
                canMove={canMove}
                primaryKey={rowsPrimary}
                empty={t.focus.reviewEmpty}
              />
            </section>
          )}
          {!seesReview && (
            <section aria-labelledby="focus-sent" className={panel}>
              <PanelHeader id="focus-sent" icon={Send} title={t.focus.sent} count={sent.length} />
              <Rows
                cards={sent}
                rowProps={rowProps}
                onMove={onMove}
                canMove={canMove}
                primaryKey={rowsPrimary}
                empty={t.focus.sentEmpty}
              />
            </section>
          )}
          {blockedTotal > 0 && (
            <aside className="flex flex-wrap items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-warning-soft-foreground">
              <Ban aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold">{plural(blockedTotal, locale, t.focus.blocked)}</p>
                <p className="mt-0.5 text-body-sm">{t.focus.blockedBody}</p>
              </div>
              {worstStage !== stage && (
                <Button size="sm" onClick={() => onStage(worstStage)} className="shrink-0">
                  {fmt(t.focus.blockedAction, { name: t.board.columns[worstStage] })}
                </Button>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
