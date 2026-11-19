'use client';

/**
 * @file since.tsx
 * @description What changed while I was away, others' events only (docs/09 §4). Grouped by repo, because the commit ticks read as a story by repo, and
 * inside a repo by card, so seven events on one card read as one entry with its events under it (owner decision 4). A breaking contract change is the
 * news of the morning, so it is pinned as a before and after. The sidebar shows this same number (review M4).
 */
import { Bot, Cpu, History, TriangleAlert, Waves } from 'lucide-react';

import {
  AppLink,
  Avatar,
  Bidi,
  CardChip,
  cn,
  ContractChange,
  EmptyState,
  eventLabel,
  fmt,
  focusRing,
  kitMessages,
  openCard,
  Pill,
  plural,
  rel,
  SectionHeader,
  stretchedFocus,
  TypeIcon,
  useKeyboardList,
  useLocale,
  useMember,
  usePageWide,
  useT,
  when,
} from '@/components/kit';
import { type StreamRow } from '@/features/timeline/stream';

import { authorOf, EventDetail } from '../timeline/event-detail';
import { NS, type TodayMessages } from './messages';

/** One card's events, newest first. */
export interface CardGroup {
  key: string;
  card: StreamRow['card'];
  rows: StreamRow[];
}

interface Group {
  repo: string;
  events: StreamRow[];
  cards: CardGroup[];
  commits: number;
}

/** Every event of a card under one entry, at the place of its newest event (the API sends events newest first). */
export function groupByCard(rows: readonly StreamRow[]): CardGroup[] {
  const map = new Map<string, CardGroup>();
  for (const row of rows) {
    const group = map.get(row.card.key) ?? { key: row.card.key, card: row.card, rows: [] };
    group.rows.push(row);
    map.set(row.card.key, group);
  }
  return [...map.values()];
}

export function groupByRepo(events: readonly StreamRow[]): Group[] {
  const map = new Map<string, Omit<Group, 'cards'>>();
  for (const e of events) {
    const repo = e.card.repo ?? 'cards';
    const g = map.get(repo) ?? { repo, events: [], commits: 0 };
    g.events.push(e);
    if (e.event.kind === 'commit') g.commits += 1;
    if (e.collapsedKinds.includes('commit')) g.commits += e.collapsed;
    map.set(repo, g);
  }
  // Groups keep the order of their newest event (the API sends events newest first).
  return [...map.values()].map((g) => ({ ...g, cards: groupByCard(g.events) }));
}

/** Events shown under a card before "n more events on this card". */
const EVENTS_PER_CARD = 3;

/** The rows the page pins: a handoff with a breaking contract diff in its detail. */
const diffOf = (row: StreamRow) => {
  if (row.card.type !== 'handoff') return [];
  const { handoff } = row.card;
  return handoff.severity === 'breaking' ? (handoff.payload?.oasdiff ?? []) : [];
};

/** One tick per commit, capped: "how much happened" at a glance, the number beside it. */
function CommitTicks({ n }: { n: number }) {
  return (
    <span aria-hidden className="flex items-end gap-0.5">
      {Array.from({ length: Math.min(n, 12) }, (_, i) => (
        <span key={i} className="h-2.5 w-1 rounded-full bg-type-change" />
      ))}
    </span>
  );
}

function ContractDiff({ row }: { row: StreamRow }) {
  const t = useT<TodayMessages>(NS);
  const locale = useLocale();
  const { event, card } = row;
  return (
    <article
      aria-labelledby={`pin-${event.id}`}
      className="rounded-lg border border-border bg-background p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="danger" icon={TriangleAlert}>
          {t.stack.breaking}
        </Pill>
        <span className="text-body-sm text-muted-foreground">{t.since.pinned}</span>
        <time dateTime={event.at} className="ms-auto text-body-sm text-muted-foreground">
          {rel(event.at, locale)}
        </time>
      </div>
      <p
        id={`pin-${event.id}`}
        className="mt-2 flex flex-wrap items-center gap-2 text-body font-medium text-foreground"
      >
        <CardChip k={card.key} type={card.type} />
        <span className="min-w-0">
          <Bidi>{card.title}</Bidi>
        </span>
      </p>
      <ul className="-mx-3 mt-1">
        {diffOf(row).map((change, i) => (
          <ContractChange key={`${change.endpoint}:${i}`} change={change} />
        ))}
      </ul>
    </article>
  );
}

/** Who did what, and when: one line under the card's title. */
function EventLine({ row }: { row: StreamRow }) {
  const t = useT<TodayMessages>(NS);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { event, card } = row;
  const author = authorOf(card, event);
  const member = useMember(author.kind === 'system' ? undefined : author.memberId);
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-body-sm text-muted-foreground">
      <span className="font-medium text-foreground">{member?.name ?? t.since.system}</span>
      {author.kind === 'agent' && (
        <span className="inline-flex items-center gap-0.5">
          <Bot aria-hidden className="size-3" strokeWidth={2} />
          {t.since.viaAgent}
        </span>
      )}
      <span>{eventLabel(kit, event)}</span>
      <time dateTime={event.at}>{rel(event.at, locale)}</time>
    </p>
  );
}

function EventRow({ group, rowProps }: { group: CardGroup; rowProps: Record<string, unknown> }) {
  const t = useT<TodayMessages>(NS);
  const locale = useLocale();
  const { card } = group;
  const row = group.rows[0]!;
  const { event } = row;
  const author = authorOf(card, event);
  const member = useMember(author.kind === 'system' ? undefined : author.memberId);
  const lines = group.rows.slice(0, EVENTS_PER_CARD);
  const more = group.rows.length - lines.length;
  return (
    <li
      {...rowProps}
      className="relative flex gap-3 rounded-md py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="mt-0.5">
        {author.kind === 'system' ? (
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted">
            <Cpu aria-hidden className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
          </span>
        ) : (
          <Avatar member={member} agent={author.kind === 'agent'} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-start gap-1.5 text-body text-foreground">
          <TypeIcon type={card.type} className="mt-0.5" />
          <AppLink
            card={card.key}
            className={cn(
              'min-w-0 font-medium underline-offset-4 outline-none after:absolute after:inset-0 after:rounded-md hover:underline',
              stretchedFocus,
            )}
          >
            <Bidi>{card.title}</Bidi>
          </AppLink>
        </p>
        {lines.length === 1 ? (
          <div className="mt-0.5">
            <EventLine row={row} />
          </div>
        ) : (
          <ul
            aria-label={plural(group.rows.length, locale, t.since.eventCount)}
            className="mt-1 flex flex-col gap-0.5"
          >
            {lines.map((line) => (
              <li key={line.id}>
                <EventLine row={line} />
              </li>
            ))}
          </ul>
        )}
        {more > 0 && (
          <p className="mt-0.5 text-body-sm text-muted-foreground">{plural(more, locale, t.since.more)}</p>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-body-sm text-muted-foreground empty:hidden">
          <span className="line-clamp-2 min-w-0 empty:hidden">
            <EventDetail card={card} event={event} />
          </span>
          {card.branch && (
            <code dir="ltr" translate="no" className="key truncate text-caption">
              {card.branch}
            </code>
          )}
        </div>
      </div>
    </li>
  );
}

export function SinceLastVisit({
  since,
  rows,
  total,
}: {
  since: string;
  rows: readonly StreamRow[];
  /** Events, the sidebar's number. */
  total: number;
}) {
  const t = useT<TodayMessages>(NS);
  const locale = useLocale();
  // Phone shows the first 5 rows, then "see all" (09 §4). Wider screens show what the API sent.
  const wide = usePageWide(768);
  const shown = wide ? rows : rows.slice(0, 5);
  const pinned = shown.filter((row) => diffOf(row).length > 0);
  const rest = shown.filter((row) => !pinned.includes(row));
  const groups = groupByRepo(rest);
  // One stop per card: Enter opens it.
  const list = useKeyboardList({
    ids: groups.flatMap((g) => g.cards.map((c) => c.key)),
    onOpen: (key) => openCard(key),
  });
  const listed = shown.reduce((sum, row) => sum + 1 + row.collapsed, 0);

  return (
    <section aria-labelledby="since-title" className="flex flex-col gap-3">
      <SectionHeader id="since-title" icon={History} title={t.since.title} count={total} />
      {shown.length === 0 ? (
        <EmptyState icon={Waves} title={fmt(t.since.empty, { when: when(since, locale) })} />
      ) : (
        <>
          {pinned.map((row) => (
            <ContractDiff key={row.id} row={row} />
          ))}
          <div className="flex flex-col gap-4">
            {groups.map((g) => (
              <section key={g.repo} aria-labelledby={`repo-${g.repo}`}>
                <div className="flex items-center gap-2 border-b border-border pb-1.5">
                  <h3 id={`repo-${g.repo}`} className="text-body-sm font-medium text-foreground">
                    {g.repo === 'cards' ? (
                      t.since.cards
                    ) : (
                      <code dir="ltr" translate="no" className="key">
                        {g.repo}
                      </code>
                    )}
                  </h3>
                  {g.commits > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground">
                      <CommitTicks n={g.commits} />
                      {plural(g.commits, locale, t.since.commits)}
                    </span>
                  )}
                </div>
                <ul data-hub-list>
                  {g.cards.map((group) => (
                    <EventRow key={group.key} group={group} rowProps={list.rowProps(group.key)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {total > listed && (
            <AppLink
              view="timeline"
              query={{ from: since }}
              className={cn(
                'hit-44 self-start rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline',
                focusRing,
              )}
            >
              {fmt(t.since.seeAll, { total })}
            </AppLink>
          )}
        </>
      )}
      {/* The tide line: everything above it arrived after your last visit. */}
      <div
        role="separator"
        aria-label={fmt(t.since.tide, { when: when(since, locale) })}
        className="flex items-center gap-2"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-(--tide-soft) px-2.5 py-1 text-body-sm font-medium text-(--tide)">
          <Waves aria-hidden className="size-3.5" strokeWidth={2} />
          {fmt(t.since.tide, { when: when(since, locale) })}
        </span>
        <span aria-hidden className="h-0.5 flex-1 rounded-full bg-(--tide)" />
      </div>
    </section>
  );
}
