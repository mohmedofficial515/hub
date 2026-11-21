import type { ReactNode } from 'react';
import { ArrowLeftRight, ChevronDown, Clock, TriangleAlert } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { members, type CardEvent } from '@lab/mocks/hub-app';
import type { StreamRow } from '@lab/mocks/hub-app/timeline';
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
  getCard,
  hoursFromNow,
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
  StatusBadge,
  stretchedFocus,
  time,
  typeClass,
  typeIcon,
  type HubCard,
} from '../../../kit';
import { messages } from '../i18n';

/**
 * The timeline's own row (08 §5.2 `TimelineItem`), not `CardRow`. A `CardRow` says what a card is now. This says what
 * happened to a card at a moment: it needs a time, an actor and a verb first, an excerpt, a "+n" expander below and a
 * node on the spine. It keeps `CardRow`'s contract: one neutral surface and border, coloured type icon, stretched link,
 * actions above the link, `rowProps` for the keyboard. See NOTES.md.
 */

/** Things that happen to a card without changing what it means. They stay a line on the spine, with no surface. */
const QUIET = new Set(['commented', 'reminder_sent', 'field_changed', 'linked', 'unlinked', 'unblocked', 'claimed', 'unclaimed', 'status_changed', 'archived', 'restored', 'redacted']);
export const isQuiet = (kind: string) => QUIET.has(kind);

const authorOf = (card: HubCard, event: CardEvent) => {
  // Commits arrive through the github adapter, but a person wrote them (09 §5: "Sara · 12 files +240 −35").
  if (card.type === 'change' && event.actorKind === 'system' && card.change.authorUserId) return { kind: 'user' as const, memberId: card.change.authorUserId };
  return { kind: event.actorKind, memberId: event.actorId, adapter: event.adapter };
};

/** The per-type muted facts of 08 §5.2. */
function Facts({ card, event }: { card: HubCard; event: CardEvent }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  switch (card.type) {
    case 'task': {
      const name = members.find((m) => m.id === card.task.claimedById)?.name[locale];
      return (
        <>
          <span>{kit.sheet.task.specialties[card.task.specialty]}</span>
          {card.task.effort && (
            <Ltr mono className="rounded-sm bg-muted px-1 text-caption text-foreground">
              {card.task.effort}
            </Ltr>
          )}
          {name && <span>{fmt(t.row.takenBy, { name: firstName(name) })}</span>}
        </>
      );
    }
    case 'decision':
    case 'need': {
      const blocks = card.links.filter((l) => l.kind === 'blocks').length;
      const open = card.status === 'open' || card.status === 'requested' || card.status === 'in_progress';
      const due = card.dueAt;
      return (
        <>
          {card.ownerRole && <RoleBadge role={card.ownerRole} outline={false} />}
          {card.type === 'need' && <span>{kit.sheet.need.kinds[card.need.kind]}</span>}
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
          {blocks > 0 && <span>{plural(blocks, locale, t.row.blocks)}</span>}
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
          {c.kind === 'pull_request' && <StatusBadge status={c.prState === 'merged' ? 'merged' : c.prState === 'closed' ? 'cancelled' : 'open'} />}
          {c.kind !== 'session' && event.kind !== 'commit' && c.kind !== 'pull_request' && c.commitCount > 0 && <span>{plural(c.commitCount, locale, t.row.commits)}</span>}
          {c.kind === 'session' && c.session && <span>{duration(c.session.durationSec * 1000, locale)}</span>}
          {c.session?.noSummary && <Pill tone="warning">{t.row.noSummary}</Pill>}
        </>
      );
    }
    case 'handoff': {
      const h = card.handoff;
      return (
        <>
          <span className="inline-flex items-center gap-1.5">
            <span>{kit.roles[h.fromRole]}</span>
            <ArrowLeftRight aria-hidden className="size-3" strokeWidth={1.75} />
            <span>{kit.roles[h.toRole]}</span>
          </span>
          {h.severity === 'breaking' && (
            <Pill tone="danger" icon={TriangleAlert}>
              {kit.sheet.handoff.severities.breaking}
            </Pill>
          )}
          {card.status === 'pending' && <span>{fmt(t.row.pendingFor, { d: duration(nowMs() - Date.parse(card.createdAt), locale) })}</span>}
        </>
      );
    }
    case 'redesign': {
      const r = card.redesign;
      return (
        <>
          <code dir="ltr" translate="no" className="key min-w-0 truncate text-caption">
            {r.app}/{r.page}/{r.version}
          </code>
          <StatusBadge status={card.status} />
          {r.reviewScore !== undefined && <span>{fmt(t.row.score, { n: r.reviewScore })}</span>}
        </>
      );
    }
    case 'doc':
      return (
        <code dir="ltr" translate="no" className="key min-w-0 truncate text-caption">
          {card.doc.path}
        </code>
      );
    case 'release':
      return (
        <>
          <Ltr mono className="text-caption">
            {card.release.version}
          </Ltr>
          <span>{plural(card.release.includedKeys.length, locale, t.row.included)}</span>
        </>
      );
    default:
      return null;
  }
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/** One line on what this event did. Mock event data is English, so localised text comes from the card where it exists. */
function EventDetail({ card, event }: { card: HubCard; event: CardEvent }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const d = event.data;
  switch (event.kind) {
    case 'commented': {
      const comment = card.comments.find((c) => c.at === event.at);
      const text = comment?.body[locale] ?? str(d.excerpt);
      return text ? <Bidi>{text}</Bidi> : null;
    }
    case 'decided':
      if (card.type !== 'decision') return null;
      return (
        <>
          <span className="font-medium text-foreground">
            <Bidi>{card.decision.options.find((o) => o.id === card.decision.chosenOptionId)?.title[locale] ?? str(d.optionTitle)}</Bidi>
          </span>
          {card.decision.rationale && (
            <>
              {' '}
              <Bidi>{card.decision.rationale[locale]}</Bidi>
            </>
          )}
        </>
      );
    case 'status_changed':
      if (!d.from || !d.to) return null;
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StatusBadge status={str(d.from)} />
          <span aria-hidden className="inline-block rtl:-scale-x-100">
            →
          </span>
          <StatusBadge status={str(d.to)} />
        </span>
      );
    case 'field_changed':
      if (!d.field) return null;
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span>{str(d.field)}:</span>
          <Ltr mono className="text-caption">
            {str(d.from) || '—'}
          </Ltr>
          <span aria-hidden className="inline-block rtl:-scale-x-100">
            →
          </span>
          <Ltr mono className="text-caption text-foreground">
            {str(d.to)}
          </Ltr>
        </span>
      );
    case 'delivered':
      return d.location ? (
        <code dir="ltr" translate="no" className="key break-all">
          {str(d.location)}
        </code>
      ) : null;
    case 'commit':
      return (
        <code dir="ltr" translate="no" className="key inline-block max-w-full truncate align-bottom text-start">
          <span className="text-muted-foreground">{str(d.sha)}</span> <span className="text-foreground">{str(d.message)}</span>
        </code>
      );
    case 'pr_opened':
    case 'pr_merged':
    case 'pr_closed':
      return (
        <code dir="ltr" translate="no" className="key">
          {str(d.head)} → {str(d.base)}
        </code>
      );
    case 'escalated':
      return d.toRole ? <>{fmt(t.row.escalatedTo, { role: kit.roles[str(d.toRole) as keyof typeof kit.roles] ?? str(d.toRole) })}</> : null;
    case 'session_logged':
      if (card.type !== 'change' || !card.change.session?.changed) return null;
      return <Bidi>{card.change.session.changed[locale]}</Bidi>;
    case 'acknowledged':
    case 'verified':
    case 'dismissed':
    case 'approved':
    case 'rejected':
    case 'changes_requested':
      return d.note || d.reason ? <Bidi>{str(d.note ?? d.reason)}</Bidi> : null;
    case 'created':
      return card.body ? <Bidi>{card.body[locale]}</Bidi> : null;
    case 'linked':
      return d.otherCardKey ? <Ltr mono>{str(d.otherCardKey)}</Ltr> : null;
    default:
      return null;
  }
}

function Verb({ event }: { event: CardEvent }) {
  const kit = useT(kitMessages);
  return <span>{eventLabel(kit, event)}</span>;
}

/** The expander: every event folded into this row, with its own time. */
function Collapsed({ card, events }: { card: HubCard; events: CardEvent[] }) {
  const locale = useLocale();
  return (
    <ol className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2 text-body-sm text-muted-foreground">
      {events.map((e) => {
        const a = authorOf(card, e);
        return (
          <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <time dateTime={e.at} className="tabular-nums">
              <Ltr>{time(e.at, locale)}</Ltr>
            </time>
            {e.kind !== 'commit' && <ActorChip kind={a.kind} memberId={a.memberId} adapter={a.adapter} />}
            {e.kind !== 'commit' && <Verb event={e} />}
            <span className="min-w-0">
              <EventDetail card={card} event={e} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Spine({ dashed = false, children, className }: { dashed?: boolean; children?: ReactNode; className?: string }) {
  return (
    <span aria-hidden className={cn('relative flex justify-center before:absolute before:inset-y-0 before:w-px', dashed ? 'before:border-s before:border-dashed before:border-border' : 'before:bg-border', className)}>
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
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { card, event, collapsed } = row;
  const current = getCard(card.key) ?? card;
  const quiet = isQuiet(event.kind) && collapsed.length === 0;
  const Icon = typeIcon[card.type];
  const danger = event.kind === 'escalated' || (event.kind === 'created' && card.type === 'handoff' && card.handoff.severity === 'breaking');
  const titleId = `tl-${row.id}`;
  const actor = authorOf(card, event);
  const moreId = `${titleId}-more`;

  const expander =
    collapsed.length > 0 ? (
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={moreId}
        aria-describedby={titleId}
        onClick={onToggle}
        className={cn('hit-44 relative z-10 inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 text-caption font-medium text-foreground tabular-nums hover:bg-accent', focusRing)}
      >
        {expanded ? t.row.less : <Ltr>{plural(collapsed.length, locale, t.row.more)}</Ltr>}
        <ChevronDown aria-hidden className={cn('size-3 transition-transform duration-120 motion-reduce:transition-none', expanded && 'rotate-180')} strokeWidth={2} />
      </button>
    ) : null;

  const when = (
    <time dateTime={event.at} title={absolute(event.at, locale)} className="tabular-nums">
      <Ltr>{time(event.at, locale)}</Ltr>
    </time>
  );

  const link = (
    <AppLink card={card.key} className={cn('underline-offset-4 outline-none after:absolute after:inset-0 after:rounded-lg hover:underline', stretchedFocus)}>
      <Bidi>{current.title[locale]}</Bidi>
    </AppLink>
  );

  return (
    <li className={cn('grid scroll-mt-28 grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 md:grid-cols-[3.25rem_1.25rem_minmax(0,1fr)]', fresh && 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150')}>
      <span className={cn('hidden pe-0.5 text-end text-body-sm text-muted-foreground md:block', quiet ? 'pt-1.5' : 'pt-3.5')}>{when}</span>
      <Spine>
        <span className={cn('relative size-2.5 rounded-full ring-4 ring-background', typeClass[card.type].dot, quiet ? 'mt-3' : 'mt-5')} />
      </Spine>
      <div className={cn('min-w-0', quiet ? 'pb-1' : 'pb-2')}>
        {quiet ? (
          <article {...rowProps} aria-labelledby={titleId} className="relative scroll-mt-28 rounded-md px-3 py-1.5 outline-none transition-colors duration-120 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-body-sm text-muted-foreground">
              <span className="text-muted-foreground md:hidden">{when}</span>
              <ActorChip kind={actor.kind} memberId={actor.memberId} adapter={actor.adapter} />
              <Verb event={event} />
              <span id={titleId} className="inline-flex min-w-0 items-baseline gap-1.5 font-medium text-foreground">
                <Icon aria-hidden className={cn('size-3.5 shrink-0 translate-y-0.5', typeClass[card.type].fg)} strokeWidth={1.75} />
                {link}
              </span>
            </p>
            {wide && (
              <div className="mt-0.5 line-clamp-2 text-body-sm text-muted-foreground">
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
                  <span className="text-muted-foreground md:hidden">{when}</span>
                  <span className={cn('font-medium', typeClass[card.type].fg)}>{kit.types[card.type]}</span>
                  <Ltr mono className="text-caption">
                    {card.key}
                  </Ltr>
                  {(card.priority === 'P0' || card.priority === 'P1') && <PriorityBadge priority={card.priority} />}
                  {mine && <MineMark />}
                  <span className="inline-flex flex-wrap items-center gap-x-1.5">
                    <ActorChip kind={actor.kind} memberId={actor.memberId} adapter={actor.adapter} />
                    <Verb event={event} />
                  </span>
                  {wide && <Facts card={current} event={event} />}
                </div>
                {wide && (
                  <div className="mt-1 line-clamp-2 text-body text-muted-foreground empty:hidden">
                    <EventDetail card={current} event={event} />
                  </div>
                )}
                {expanded && (
                  <div id={moreId}>
                    <Collapsed card={card} events={collapsed} />
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
