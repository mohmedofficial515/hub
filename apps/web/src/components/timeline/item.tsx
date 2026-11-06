'use client';

/**
 * @file item.tsx
 * @description The timeline's own row (08 §5.2 `TimelineItem`), not `CardRow`. A `CardRow` says what a card is now. This says what happened to a card
 * at a moment: it needs a time, an actor and a verb first, an excerpt, a "+n" expander below the row and a node on the spine. It keeps `CardRow`'s
 * contract: one neutral surface and border, coloured type icon, stretched link, actions above the link, `rowProps` for the keyboard.
 */
import { ArrowLeftRight, ChevronDown, Clock, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  absolute,
  ActorChip,
  AppLink,
  Bidi,
  cn,
  duration,
  eventLabel,
  firstName,
  fmt,
  focusRing,
  hoursFromNow,
  type HubCard,
  isOverdue,
  kitMessages,
  Ltr,
  MineMark,
  nowMs,
  Pill,
  plural,
  PriorityBadge,
  rel,
  RoleBadge,
  SkeletonRow,
  StatusBadge,
  stretchedFocus,
  time,
  typeClass,
  typeIcon,
  useCardEvents,
  useLocale,
  useMember,
  useT,
} from '@/components/kit';
import type { CardEvent } from '@/features/cards/types';
import { includedCount } from '@/features/releases/queries';
import { foldedEvents, type StreamRow } from '@/features/timeline/stream';

import { authorOf, EventDetail } from './event-detail';
import { NS, type TimelineMessages } from './messages';

/** Things that happen to a card without changing what it means. They stay a line on the spine, with no surface. */
const QUIET = new Set([
  'commented',
  'reminder_sent',
  'field_changed',
  'linked',
  'unlinked',
  'unblocked',
  'claimed',
  'unclaimed',
  'status_changed',
  'archived',
  'restored',
  'redacted',
]);
export const isQuiet = (kind: string) => QUIET.has(kind);

function TaskFacts({ card }: { card: Extract<HubCard, { type: 'task' }> }) {
  const t = useT<TimelineMessages>(NS);
  const kit = useT(kitMessages);
  const claimer = useMember(card.task.claimedById);
  return (
    <>
      {card.task.specialty && <span>{kit.sheet.task.specialties[card.task.specialty]}</span>}
      {card.task.effort && (
        <Ltr mono className="rounded-sm bg-muted px-1 text-caption text-foreground">
          {card.task.effort}
        </Ltr>
      )}
      {claimer && <span>{fmt(t.row.takenBy, { name: firstName(claimer.name) ?? '' })}</span>}
    </>
  );
}

/** The per-type muted facts of 08 §5.2. */
function Facts({ card, event }: { card: HubCard; event: CardEvent }) {
  const t = useT<TimelineMessages>(NS);
  const kit = useT(kitMessages);
  const locale = useLocale();
  switch (card.type) {
    case 'task':
      return <TaskFacts card={card} />;
    case 'decision':
    case 'need': {
      const open = card.status === 'open' || card.status === 'requested' || card.status === 'in_progress';
      const due = card.dueAt;
      return (
        <>
          {card.ownerRole && <RoleBadge role={card.ownerRole} outline={false} />}
          {card.type === 'need' && card.need.kind && <span>{kit.sheet.need.kinds[card.need.kind]}</span>}
          {open && due && isOverdue({ dueAt: due, flags: card.flags }) && (
            <Pill tone="danger" icon={Clock}>
              {fmt(t.row.overdueBy, { d: duration(Date.parse(due) - nowMs(), locale) })}
            </Pill>
          )}
          {open && due && !isOverdue({ dueAt: due, flags: card.flags }) && hoursFromNow(due) <= 24 && (
            <Pill tone="warning" icon={Clock}>
              {fmt(t.row.dueIn, { rel: rel(due, locale) })}
            </Pill>
          )}
          {open && (card.blocksCount ?? 0) > 0 && (
            <span>{plural(card.blocksCount ?? 0, locale, kit.blocksCount)}</span>
          )}
        </>
      );
    }
    case 'change': {
      const c = card.change;
      return (
        <>
          {card.branch && (
            <code dir="ltr" translate="no" className="key min-w-0 truncate text-caption">
              {card.branch}
            </code>
          )}
          {c.kind === 'pull_request' && c.prNumber && <Ltr mono>#{c.prNumber}</Ltr>}
          {c.kind === 'pull_request' && (
            <StatusBadge
              status={c.prState === 'merged' ? 'merged' : c.prState === 'closed' ? 'cancelled' : 'open'}
            />
          )}
          {c.kind !== 'session' &&
            event.kind !== 'commit' &&
            c.kind !== 'pull_request' &&
            c.commitCount > 0 && <span>{plural(c.commitCount, locale, t.row.commits)}</span>}
          {c.kind === 'session' && c.session && <span>{duration(c.session.durationSec * 1000, locale)}</span>}
          {c.session?.noSummary && <Pill tone="warning">{t.row.noSummary}</Pill>}
        </>
      );
    }
    case 'handoff': {
      const h = card.handoff;
      return (
        <>
          {h.fromRole && h.toRole && (
            <span className="inline-flex items-center gap-1.5">
              <span>{kit.roles[h.fromRole]}</span>
              <ArrowLeftRight aria-hidden className="size-3" strokeWidth={1.75} />
              <span>{kit.roles[h.toRole]}</span>
            </span>
          )}
          {h.severity === 'breaking' && (
            <Pill tone="danger" icon={TriangleAlert}>
              {kit.sheet.handoff.severities.breaking}
            </Pill>
          )}
          {card.status === 'pending' && (
            <span>
              {fmt(t.row.pendingFor, { d: duration(nowMs() - Date.parse(card.createdAt), locale) })}
            </span>
          )}
        </>
      );
    }
    case 'redesign': {
      const r = card.redesign;
      return (
        <>
          {r.page && (
            <code dir="ltr" translate="no" className="key min-w-0 truncate text-caption">
              {r.app}/{r.page}/{r.version}
            </code>
          )}
          <StatusBadge status={card.status} />
          {r.reviewScore !== undefined && <span>{fmt(t.row.score, { n: r.reviewScore })}</span>}
        </>
      );
    }
    case 'doc':
      return card.doc.path ? (
        <code dir="ltr" translate="no" className="key min-w-0 truncate text-caption">
          {card.doc.path}
        </code>
      ) : null;
    case 'release':
      return (
        <>
          {card.release.version && (
            <Ltr mono className="text-caption">
              {card.release.version}
            </Ltr>
          )}
          <span>{plural(includedCount(card.release), locale, t.row.included)}</span>
        </>
      );
    default:
      return null;
  }
}

function Verb({ event }: { event: CardEvent }) {
  const kit = useT(kitMessages);
  return <span>{eventLabel(kit, event)}</span>;
}

/** The expander: every event folded into this row, with its own time. The API sends how many; the card's history has which. */
function Collapsed({ row }: { row: StreamRow }) {
  const locale = useLocale();
  const history = useCardEvents(row.card.key);
  if (!history.data) return <SkeletonRow withAction={false} className="mt-2" />;
  return (
    <ol className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2 text-body-sm text-muted-foreground">
      {foldedEvents(history.data, row).map((e) => {
        const a = authorOf(row.card, e);
        return (
          <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <time dateTime={e.at} className="tabular-nums">
              <Ltr>{time(e.at, locale)}</Ltr>
            </time>
            {e.kind !== 'commit' && <ActorChip kind={a.kind} memberId={a.memberId} adapter={a.adapter} />}
            {e.kind !== 'commit' && <Verb event={e} />}
            <span className="min-w-0">
              <EventDetail card={row.card} event={e} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Spine({
  dashed = false,
  children,
  className,
}: {
  dashed?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex justify-center before:absolute before:inset-y-0 before:w-px',
        dashed ? 'before:border-s before:border-dashed before:border-border' : 'before:bg-border',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function TimelineItem({
  row,
  rowProps,
  actions,
  expanded,
  onToggle,
  wide,
  fresh,
  mine = false,
}: {
  row: StreamRow;
  rowProps: Record<string, unknown>;
  /** Inline actions (08 §5.2). Hidden on phones, where they move into the sheet (09 §5). */
  actions?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  wide: boolean;
  /** Prepended just now: rows fade in 160 ms, no slide (08 §3.4). */
  fresh: boolean;
  /** This card waits on me. The Mine rule marks a row; a stream keeps its order. */
  mine?: boolean;
}) {
  const t = useT<TimelineMessages>(NS);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { card, event, collapsed } = row;
  const quiet = isQuiet(event.kind) && collapsed === 0;
  const Icon = typeIcon[card.type];
  const danger =
    event.kind === 'escalated' ||
    (event.kind === 'created' && card.type === 'handoff' && card.handoff.severity === 'breaking');
  const titleId = `tl-${row.id}`;
  const actor = authorOf(card, event);
  const moreId = `${titleId}-more`;

  const expander =
    collapsed > 0 ? (
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={moreId}
        aria-describedby={titleId}
        onClick={onToggle}
        className={cn(
          'hit-44 relative z-10 inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 text-caption font-medium text-foreground tabular-nums hover:bg-accent',
          focusRing,
        )}
      >
        {expanded ? t.row.less : <Ltr>{plural(collapsed, locale, t.row.more)}</Ltr>}
        <ChevronDown
          aria-hidden
          className={cn(
            'size-3 transition-transform duration-120 motion-reduce:transition-none',
            expanded && 'rotate-180',
          )}
          strokeWidth={2}
        />
      </button>
    ) : null;

  const when = (
    <time dateTime={event.at} title={absolute(event.at, locale)} className="tabular-nums">
      <Ltr>{time(event.at, locale)}</Ltr>
    </time>
  );

  const link = (
    <AppLink
      card={card.key}
      className={cn(
        'underline-offset-4 outline-none after:absolute after:inset-0 after:rounded-lg hover:underline',
        stretchedFocus,
      )}
    >
      <Bidi>{card.title}</Bidi>
    </AppLink>
  );

  return (
    <li
      className={cn(
        'grid scroll-mt-28 grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 md:@page-md:grid-cols-[3.25rem_1.25rem_minmax(0,1fr)]',
        fresh && 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150',
      )}
    >
      <span
        className={cn(
          'hidden pe-0.5 text-end text-body-sm text-muted-foreground md:@page-md:block',
          quiet ? 'pt-1.5' : 'pt-3.5',
        )}
      >
        {when}
      </span>
      <Spine>
        <span
          className={cn(
            'relative size-2.5 rounded-full ring-4 ring-background',
            typeClass[card.type].dot,
            quiet ? 'mt-3' : 'mt-5',
          )}
        />
      </Spine>
      <div className={cn('min-w-0', quiet ? 'pb-1' : 'pb-2')}>
        {quiet ? (
          <article
            {...rowProps}
            aria-labelledby={titleId}
            className="relative scroll-mt-28 rounded-md px-3 py-1.5 outline-none transition-colors duration-120 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-body-sm text-muted-foreground">
              <span className="text-muted-foreground md:@page-md:hidden">{when}</span>
              <ActorChip kind={actor.kind} memberId={actor.memberId} adapter={actor.adapter} />
              <Verb event={event} />
              <span
                id={titleId}
                className="inline-flex min-w-0 items-baseline gap-1.5 font-medium text-foreground"
              >
                <Icon
                  aria-hidden
                  className={cn('size-3.5 shrink-0 translate-y-0.5', typeClass[card.type].fg)}
                  strokeWidth={1.75}
                />
                {link}
              </span>
            </p>
            {wide && (
              <div className="mt-0.5 line-clamp-2 text-body-sm text-muted-foreground empty:hidden">
                <EventDetail card={card} event={event} />
              </div>
            )}
          </article>
        ) : (
          <article
            {...rowProps}
            aria-labelledby={titleId}
            className={cn(
              'relative scroll-mt-28 rounded-lg border bg-card px-3 py-2.5 outline-none transition-colors duration-120 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-4',
              danger ? 'border-destructive/70' : 'border-border',
            )}
          >
            <div className="flex items-start gap-2.5">
              <span aria-hidden className={cn('pt-0.5', typeClass[card.type].fg)}>
                <Icon className="size-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p id={titleId} className="text-body-lg font-semibold text-pretty text-foreground">
                  {link}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-body-sm text-muted-foreground">
                  <span className="text-muted-foreground md:@page-md:hidden">{when}</span>
                  <span className={cn('font-medium', typeClass[card.type].fg)}>{kit.types[card.type]}</span>
                  <Ltr mono className="text-caption">
                    {card.key}
                  </Ltr>
                  {(card.priority === 'P0' || card.priority === 'P1') && (
                    <PriorityBadge priority={card.priority} />
                  )}
                  {mine && <MineMark />}
                  <span className="inline-flex flex-wrap items-center gap-x-1.5">
                    <ActorChip kind={actor.kind} memberId={actor.memberId} adapter={actor.adapter} />
                    <Verb event={event} />
                  </span>
                  {wide && <Facts card={card} event={event} />}
                </div>
                {wide && (
                  <div className="mt-1 line-clamp-2 text-body text-muted-foreground empty:hidden">
                    <EventDetail card={card} event={event} />
                  </div>
                )}
                {expanded && (
                  <div id={moreId}>
                    <Collapsed row={row} />
                  </div>
                )}
                {(wide ? actions || expander : expander) && (
                  <div className="relative z-10 mt-2 flex flex-wrap items-center gap-2 empty:hidden">
                    {expander}
                    {wide && actions}
                  </div>
                )}
              </div>
            </div>
          </article>
        )}
      </div>
    </li>
  );
}
