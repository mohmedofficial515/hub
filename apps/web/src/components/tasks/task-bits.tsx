'use client';

/**
 * @file task-bits.tsx
 * @description Ported from v5 `pages/tasks/parts/task-bits.tsx`: what a task's row says, and the one button that moves it.
 */
import { Ban, CalendarClock, Clock, GitBranch, GitPullRequest } from 'lucide-react';

import {
  actionName,
  actionsFor,
  ActorChip,
  type AvailableAction,
  Button,
  type CardAction,
  cn,
  duration,
  fill,
  fmt,
  hoursFromNow,
  isOverdue,
  kitMessages,
  Ltr,
  MineMark,
  nowMs,
  openBlockers,
  openCard,
  Pill,
  rel,
  type TaskCard,
  Tooltip,
  useLocale,
  useSession,
  useT,
  when,
} from '@/components/kit';
import { isMine } from '@/features/tasks/model';

import type { TaskMessages } from './messages';

/** How late a task is and what is in its way. Finished work is neither. */
function urgencyOf(card: TaskCard) {
  const open = card.status !== 'done' && card.status !== 'cancelled';
  return {
    blockers: open ? openBlockers(card) : [],
    late: open && card.dueAt ? isOverdue({ dueAt: card.dueAt, flags: card.flags }) : false,
    h: open && card.dueAt ? hoursFromNow(card.dueAt) : null,
  };
}

/**
 * The signals a row must never lose, wherever it is drawn: mine, overdue or due within 24 h, and blocked. The list's table puts them under
 * the title, where its other columns already say the rest.
 */
export function TaskSignals({ card }: { card: TaskCard }) {
  const t = useT<TaskMessages>('tasks');
  const locale = useLocale();
  const { me, roles } = useSession();
  const { blockers, late, h } = urgencyOf(card);
  const mine = isMine(card, me.id, roles);
  const soon = !late && h !== null && h <= 24;
  if (!mine && !late && !soon && !blockers[0]) return null;
  return (
    <span data-task-signals className="mt-1 flex flex-wrap items-center gap-2 text-body-sm">
      {mine && <MineMark />}
      {late && card.dueAt && (
        <Pill tone="danger" icon={Clock}>
          {fmt(t.card.overdueBy, { d: duration(Date.parse(card.dueAt) - nowMs(), locale) })}
        </Pill>
      )}
      {soon && card.dueAt && (
        <Pill tone="warning" icon={Clock}>
          {fmt(t.card.dueSoon, { rel: rel(card.dueAt, locale) })}
        </Pill>
      )}
      {blockers[0] && (
        <Pill icon={Ban}>{fill(t.card.blockedBy, { key: <Ltr mono>{blockers[0]}</Ltr> })}</Pill>
      )}
    </span>
  );
}

/** What a task's row says besides its title: who, how big, how late, what is in the way. */
export function TaskFacts({ card, showAssignee = true }: { card: TaskCard; showAssignee?: boolean }) {
  const t = useT<TaskMessages>('tasks');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { me, roles } = useSession();
  const { blockers, late, h } = urgencyOf(card);
  const branch = card.task.branch ?? card.branch;
  const pr = card.task.prUrl ? /(\d+)\/?$/.exec(card.task.prUrl)?.[1] : undefined;
  return (
    <>
      {isMine(card, me.id, roles) && <MineMark />}
      <span>{kit.sheet.task.specialties[card.task.specialty]}</span>
      {card.task.effort && (
        <span className="inline-flex items-center">
          <span className="sr-only">{kit.sheet.task.effort}</span>
          <Ltr mono className="rounded-sm bg-muted px-1 text-caption text-foreground">
            {card.task.effort}
          </Ltr>
        </span>
      )}
      {showAssignee && card.assigneeId && <ActorChip memberId={card.assigneeId} />}
      {late && card.dueAt && (
        <Pill tone="danger" icon={Clock}>
          {fmt(t.card.overdueBy, { d: duration(Date.parse(card.dueAt) - nowMs(), locale) })}
        </Pill>
      )}
      {!late && h !== null && h <= 24 && card.dueAt && (
        <Pill tone="warning" icon={Clock}>
          {fmt(t.card.dueSoon, { rel: rel(card.dueAt, locale) })}
        </Pill>
      )}
      {!late && h !== null && h > 24 && card.dueAt && (
        <span className="inline-flex items-center gap-1">
          <CalendarClock aria-hidden className="size-3.5" strokeWidth={1.75} />
          {fmt(t.card.due, { when: when(card.dueAt, locale) })}
        </span>
      )}
      {pr ? (
        <span className="inline-flex items-center gap-1">
          <GitPullRequest aria-hidden className="size-3.5" strokeWidth={1.75} />
          <Ltr mono className="text-caption">
            #{pr}
          </Ltr>
        </span>
      ) : (
        branch && (
          <span className="inline-flex max-w-full min-w-0 items-center gap-1">
            <GitBranch aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
            <code dir="ltr" translate="no" className="key min-w-0 truncate text-caption">
              {branch}
            </code>
          </span>
        )
      )}
      {blockers[0] && (
        <Pill icon={Ban}>{fill(t.card.blockedBy, { key: <Ltr mono>{blockers[0]}</Ltr> })}</Pill>
      )}
    </>
  );
}

const MOVES = new Set<CardAction>(['mark_ready', 'claim', 'start', 'submit_review', 'complete']);

export type OnMove = (card: TaskCard, action: CardAction, mode: AvailableAction['mode']) => void;

/**
 * The one button that moves a task to its next column (09 §6: moves are by button). Claim runs here; Submit opens the sheet on
 * its form. A claim the member's role does not allow stays visible and disabled, naming the role (09 §6 acceptance).
 */
export function MoveButton({
  card,
  onMove,
  full = false,
  primary = false,
}: {
  card: TaskCard;
  onMove: OnMove;
  full?: boolean;
  primary?: boolean;
}) {
  const t = useT<TaskMessages>('tasks');
  const kit = useT(kitMessages);
  const { roles, me } = useSession();
  const move = actionsFor(card, roles, me.id).find((a) => MOVES.has(a.action));
  if (!move) return null;
  // A task in review is not done from its row: Review opens the card, where the evidence and the acceptance sit beside Mark done and Back to work.
  if (card.status === 'in_review' && move.action === 'complete' && move.enabled) {
    return (
      <Button
        size="sm"
        variant={primary ? 'primary' : 'outline'}
        aria-describedby={`task-${card.key}`}
        data-task-review
        onClick={() => openCard(card.key)}
        className={cn(full && 'w-full')}
      >
        {t.card.review}
      </Button>
    );
  }
  const blocked = openBlockers(card)[0];
  const label = actionName(kit, 'task', move.action);
  const button = (
    <Button
      size="sm"
      variant={primary && move.enabled ? 'primary' : 'outline'}
      disabled={!move.enabled}
      aria-describedby={`task-${card.key}`}
      aria-keyshortcuts={move.action === 'claim' ? 'c' : undefined}
      onClick={() => onMove(card, move.action, move.mode)}
      className={cn(full && 'w-full')}
    >
      {label}
    </Button>
  );
  if (move.enabled) return button;
  const reason =
    move.action === 'claim' && blocked
      ? fmt(t.card.blockedBy, { key: blocked })
      : move.needsRole
        ? fmt(t.card.noRole, { role: kit.roles[move.needsRole] })
        : null;
  if (!reason) return button;
  return (
    <Tooltip content={reason}>
      <span
        tabIndex={0}
        aria-label={`${label}: ${reason}`}
        className={cn(
          'inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
          full && 'w-full',
        )}
      >
        {button}
      </span>
    </Tooltip>
  );
}
