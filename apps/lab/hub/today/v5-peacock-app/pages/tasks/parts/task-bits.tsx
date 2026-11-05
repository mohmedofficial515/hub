import { Ban, CalendarClock, Clock, GitBranch, GitPullRequest } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { members } from '@lab/mocks/hub-app';
import { actionsFor, Avatar, Button, cn, duration, fill, firstName, fmt, hoursFromNow, isOverdue, kitMessages, Ltr, MineMark, nowMs, openBlockers, Pill, rel, Tooltip, useSession, when, type CardAction, type TaskCard } from '../../../kit';
import { messages } from '../i18n';

/** What a task's row says besides its title: who, how big, how late, what is in the way. */
export function TaskFacts({ card, showAssignee = true }: { card: TaskCard; showAssignee?: boolean }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { me, roles } = useSession();
  const mine = card.assigneeId === me.id || (card.status === 'ready' && !!card.ownerRole && roles.includes(card.ownerRole));
  const member = members.find((m) => m.id === card.assigneeId);
  const blockers = card.status === 'done' || card.status === 'cancelled' ? [] : openBlockers(card);
  const open = card.status !== 'done' && card.status !== 'cancelled';
  const late = open && card.dueAt ? isOverdue({ dueAt: card.dueAt, flags: card.flags }) : false;
  const h = open && card.dueAt ? hoursFromNow(card.dueAt) : null;
  const branch = card.task.branch ?? card.branch;
  const pr = card.task.prUrl ? /(\d+)$/.exec(card.task.prUrl)?.[1] : undefined;
  return (
    <>
      {mine && <MineMark />}
      <span>{kit.sheet.task.specialties[card.task.specialty]}</span>
      {card.task.effort && (
        <span className="inline-flex items-center">
          <span className="sr-only">{kit.sheet.task.effort}</span>
          <Ltr mono className="rounded-sm bg-muted px-1 text-caption text-foreground">
            {card.task.effort}
          </Ltr>
        </span>
      )}
      {showAssignee && member && (
        <span className="inline-flex items-center gap-1.5" title={member.name[locale]}>
          <Avatar member={member} size="xs" />
          <span>{firstName(member.name[locale])}</span>
        </span>
      )}
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
      {blockers[0] && <Pill icon={Ban}>{fill(t.card.blockedBy, { key: <Ltr mono>{blockers[0]}</Ltr> })}</Pill>}
    </>
  );
}

const MOVES = new Set<CardAction>(['mark_ready', 'claim', 'start', 'submit', 'done']);

/**
 * The one button that moves a task to its next column (09 §6: moves are by button). Claim runs here; Submit opens the sheet on
 * its form. A claim the member's role does not allow stays visible and disabled, naming the role (09 §6 acceptance).
 */
export function MoveButton({ card, onMove, full = false, primary = false }: { card: TaskCard; onMove: (card: TaskCard, action: CardAction, mode: string) => void; full?: boolean; primary?: boolean }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const { roles, me } = useSession();
  const available = actionsFor(card, roles, me.id);
  const move = available.find((a) => MOVES.has(a.action));
  if (!move) return null;
  const blocked = openBlockers(card)[0];
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
      {kit.actions[move.action]}
    </Button>
  );
  if (move.enabled) return button;
  const reason = move.action === 'claim' && blocked ? fmt(t.card.blockedBy, { key: blocked }) : move.needsRole ? fmt(t.card.noRole, { role: kit.roles[move.needsRole] }) : null;
  if (!reason) return button;
  return (
    <Tooltip content={reason}>
      <span tabIndex={0} aria-label={`${kit.actions[move.action]}: ${reason}`} className={cn('inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring', full && 'w-full')}>
        {button}
      </span>
    </Tooltip>
  );
}
