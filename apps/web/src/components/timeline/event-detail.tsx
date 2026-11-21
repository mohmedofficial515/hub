'use client';

/**
 * @file event-detail.tsx
 * @description One line on what an event did, from the event's own data (docs/03 §5.2). Timeline and Today's "Since your last visit" share it. An
 * event with nothing to add renders nothing.
 */
import type { CardType } from '@hub/contracts';
import type { ReactNode } from 'react';

import {
  Bidi,
  fmt,
  type HubCard,
  kitMessages,
  type Locale,
  Ltr,
  StatusBadge,
  useLocale,
  useMembers,
  useT,
  when,
} from '@/components/kit';
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

type FieldName = keyof TimelineMessages['row']['fields'];

/** Fields whose values are not for reading (a hash of the text, a list of ids): the sentence alone says what changed. */
const SENTENCE_ONLY = new Set<FieldName>(['body', 'options', 'content']);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The first change with a name this page knows; a field it cannot name says nothing rather than print the API's key. */
export function firstNamedChange(
  data: Record<string, unknown>,
  fields: Record<string, string>,
): (FieldChange & { field: FieldName }) | undefined {
  const changes = (Array.isArray(data.changes) ? data.changes : [data]) as FieldChange[];
  return changes.find(
    (c): c is FieldChange & { field: FieldName } =>
      !!c && typeof c === 'object' && typeof c.field === 'string' && Object.hasOwn(fields, c.field),
  );
}

interface ValueContext {
  none: string;
  roles: Record<string, string | undefined>;
  locale: Locale;
  memberName: (id: string) => string | undefined;
}

/** A value as a reader says it, or `undefined` when it cannot be said (an id nobody knows, an object, a hash). */
function readValue(field: FieldName, value: unknown, ctx: ValueContext): ReactNode | undefined {
  if (value === null || value === undefined || value === '') return ctx.none;
  if (field === 'tags') {
    if (!Array.isArray(value)) return undefined;
    const tags = value.filter((v): v is string => typeof v === 'string');
    return tags.length ? <Bidi>{tags.join(ctx.locale === 'ar' ? '، ' : ', ')}</Bidi> : ctx.none;
  }
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = String(value);
  switch (field) {
    case 'ownerRole':
      return ctx.roles[text];
    case 'dueAt':
      return Number.isNaN(Date.parse(text)) ? undefined : <Ltr>{when(text, ctx.locale)}</Ltr>;
    case 'assigneeId': {
      const name = ctx.memberName(text);
      return name ? <Bidi>{name}</Bidi> : undefined;
    }
    case 'priority':
      return <Ltr>{text}</Ltr>;
    case 'module':
    case 'repo':
    case 'branch':
      return UUID.test(text) ? undefined : (
        <Ltr mono className="text-caption">
          {text}
        </Ltr>
      );
    default:
      return UUID.test(text) ? undefined : <Bidi>{text}</Bidi>;
  }
}

/**
 * "Due: None → tomorrow 15:42", "Owner role: Backend → Frontend". A field whose values mean nothing to a reader (the text's hash, a list of
 * option ids), or whose value cannot be named, reads "Edited the text" alone.
 */
function FieldChangeDetail({ data }: { data: Record<string, unknown> }) {
  const t = useT<TimelineMessages>(NS);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const members = useMembers().data;
  const change = firstNamedChange(data, t.row.fields);
  if (!change) return null;
  const label = t.row.fields[change.field];
  const ctx: ValueContext = {
    none: kit.sheet.history.values.none ?? '—',
    roles: kit.roles,
    locale,
    memberName: (id) => members?.find((m) => m.id === id)?.name,
  };
  const hasFrom = 'from' in change;
  const from = hasFrom ? readValue(change.field, change.from, ctx) : null;
  const to = readValue(change.field, change.to, ctx);
  if (SENTENCE_ONLY.has(change.field) || to === undefined || from === undefined) {
    return <span>{fmt(t.row.fieldEdited, { field: label })}</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span>{label}:</span>
      {hasFrom && (
        <>
          <span>{from}</span>
          <span aria-hidden className="inline-block rtl:-scale-x-100">
            →
          </span>
        </>
      )}
      <span className="text-foreground">{to}</span>
    </span>
  );
}

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
    case 'field_changed':
      return <FieldChangeDetail data={d} />;
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
