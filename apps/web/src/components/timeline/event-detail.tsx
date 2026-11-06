'use client';

/**
 * @file event-detail.tsx
 * @description One line on what an event did, from the event's own data (docs/03 §5.2). Timeline and Today's "Since your last visit" share it. An
 * event with nothing to add renders nothing.
 */
import type { CardType } from '@hub/contracts';

import { Bidi, fmt, type HubCard, kitMessages, Ltr, StatusBadge, useT } from '@/components/kit';
import type { CardEvent } from '@/features/cards/types';
import { markdownExcerpt } from '@/lib/markdown-text';

import { NS, type TimelineMessages } from './messages';

const str = (v: unknown) =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '';

interface FieldChange {
  field?: unknown;
  from?: unknown;
  to?: unknown;
}

/** Who to show: commits arrive through an adapter, but a person wrote them (09 §5). */
export const authorOf = (card: HubCard, event: CardEvent) => {
  if (card.type === 'change' && event.actorKind === 'system' && card.change.authorUserId) {
    return { kind: 'user' as const, memberId: card.change.authorUserId, adapter: undefined };
  }
  return { kind: event.actorKind, memberId: event.actorId, adapter: event.adapter };
};

export function EventDetail({ card, event }: { card: HubCard & { type: CardType }; event: CardEvent }) {
  const t = useT<TimelineMessages>(NS);
  const kit = useT(kitMessages);
  const d = event.data as Record<string, unknown>;
  switch (event.kind) {
    case 'commented':
      return d.excerpt ? <Bidi>{str(d.excerpt)}</Bidi> : null;
    case 'work_reported':
      return d.summary ? <Bidi>{str(d.summary)}</Bidi> : null;
    case 'decided':
      return (
        <>
          {d.optionTitle ? (
            <span className="font-medium text-foreground">
              <Bidi>{str(d.optionTitle)}</Bidi>
            </span>
          ) : null}
          {d.rationale ? (
            <>
              {' '}
              <Bidi>{str(d.rationale)}</Bidi>
            </>
          ) : null}
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
    case 'field_changed': {
      const changes = (Array.isArray(d.changes) ? d.changes : [d]) as FieldChange[];
      const change = changes.find((c) => c.field !== undefined && c.to !== undefined);
      if (!change) return null;
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span>{str(change.field)}:</span>
          <Ltr mono className="text-caption">
            {str(change.from) || '—'}
          </Ltr>
          <span aria-hidden className="inline-block rtl:-scale-x-100">
            →
          </span>
          <Ltr mono className="text-caption text-foreground">
            {str(change.to)}
          </Ltr>
        </span>
      );
    }
    case 'delivered':
      return d.location ? (
        <code dir="ltr" translate="no" className="key break-all">
          {str(d.location)}
        </code>
      ) : null;
    case 'commit':
      return (
        <code
          dir="ltr"
          translate="no"
          className="key inline-block max-w-full truncate align-bottom text-start"
        >
          <span className="text-muted-foreground">{str(d.sha).slice(0, 7)}</span>{' '}
          <span className="text-foreground">{str(d.message)}</span>
        </code>
      );
    case 'pr_opened':
    case 'pr_merged':
    case 'pr_closed':
      return d.head && d.base ? (
        <code dir="ltr" translate="no" className="key">
          {str(d.head)} → {str(d.base)}
        </code>
      ) : null;
    case 'escalated':
      return d.toRole ? (
        <>
          {fmt(t.row.escalatedTo, {
            role: kit.roles[str(d.toRole) as keyof typeof kit.roles] ?? str(d.toRole),
          })}
        </>
      ) : null;
    case 'session_logged':
      return card.type === 'change' && card.change.session?.changed ? (
        <Bidi>{card.change.session.changed}</Bidi>
      ) : null;
    case 'acknowledged':
    case 'verified':
    case 'dismissed':
    case 'approved':
    case 'rejected':
    case 'changes_requested':
      return d.note || d.reason ? <Bidi>{str(d.note ?? d.reason)}</Bidi> : null;
    case 'created':
      return card.body ? <Bidi>{markdownExcerpt(card.body)}</Bidi> : null;
    case 'linked':
      return d.otherCardKey ? <Ltr mono>{str(d.otherCardKey)}</Ltr> : null;
    default:
      return null;
  }
}
