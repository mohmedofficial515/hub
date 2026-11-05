'use client';

/**
 * @file docket.tsx
 * @description Ported from v5 `pages/decisions/parts/docket.tsx`. D31: the rule beside a band's heading is neutral. The icon and the words carry the urgency.
 */
import { CalendarClock, Check, Clock, Link2, MessageSquare, TriangleAlert } from 'lucide-react';
import type { ReactNode, Ref } from 'react';

import {
  ActorChip,
  Bidi,
  CardRow,
  cn,
  type DecisionCard,
  duration,
  fmt,
  hoursFromNow,
  isOverdue,
  kitMessages,
  Ltr,
  MineMark,
  nowMs,
  num,
  Pill,
  plural,
  rel,
  RoleBadge,
  RowAction,
  shortDate,
  StatusBadge,
  type useKeyboardList,
  useLocale,
  useMedia,
  useSession,
  useT,
  when,
} from '@/components/kit';
import { type Band, bandOf, closedAt, routedToMe } from '@/features/decisions/model';

import type { DecisionMessages } from './messages';

const orList = (items: string[], locale: 'ar' | 'en') =>
  new Intl.ListFormat(locale, { style: 'long', type: 'disjunction' }).format(items);

const bandDot: Record<Band, string> = { overdue: 'bg-destructive', soon: 'bg-warning', later: 'bg-border' };

/**
 * The docket's gutter: the deadline is the structure of this page, so from 768 px each question hangs off a time rail,
 * earliest at the top. Phones have no gutter, and the same fact moves into the row's meta line.
 */
export function DocketLine({
  time,
  sub,
  subTone,
  dot,
  last,
  children,
}: {
  time: ReactNode;
  sub?: ReactNode;
  subTone?: 'danger' | 'warning' | undefined;
  dot: string;
  last?: boolean;
  children: ReactNode;
}) {
  const wide = useMedia('(min-width: 768px)');
  if (!wide) return <>{children}</>;
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-5">
      <div className="relative pe-4 pt-3 text-end">
        <p className="text-body-sm font-semibold text-foreground tabular-nums">{time}</p>
        {sub && (
          <p
            className={cn(
              'text-body-sm',
              subTone === 'danger'
                ? 'font-medium text-destructive-soft-foreground'
                : subTone === 'warning'
                  ? 'font-medium text-warning-soft-foreground'
                  : 'text-muted-foreground',
            )}
          >
            {sub}
          </p>
        )}
        <span
          aria-hidden
          className={cn('absolute end-0 top-0 w-px bg-border', last ? 'h-full' : '-bottom-2')}
        />
        <span
          aria-hidden
          style={{ insetInlineEnd: '-3.5px' }}
          className={cn('absolute top-4.5 size-2 rounded-full', dot)}
        />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** The gutter for an open decision: the date, then how far away it is in words. */
export function OpenDocketLine({
  card,
  last,
  children,
}: {
  card: DecisionCard;
  last?: boolean;
  children: ReactNode;
}) {
  const t = useT<DecisionMessages>('decisions');
  const locale = useLocale();
  const band = bandOf(card);
  const late = card.dueAt && isOverdue(card);
  return (
    <DocketLine
      time={card.dueAt ? when(card.dueAt, locale) : t.row.noDue}
      sub={
        card.dueAt
          ? late
            ? fmt(t.row.overdue, { d: duration(Date.parse(card.dueAt) - nowMs(), locale) })
            : rel(card.dueAt, locale)
          : undefined
      }
      subTone={band === 'overdue' ? 'danger' : band === 'soon' ? 'warning' : undefined}
      dot={bandDot[band]}
      {...(last === undefined ? {} : { last })}
    >
      {children}
    </DocketLine>
  );
}

/** What a question's second line says. The date is left out when the gutter already shows it. */
export function OpenFacts({ card, gutter }: { card: DecisionCard; gutter: boolean }) {
  const t = useT<DecisionMessages>('decisions');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { roles } = useSession();
  const d = card.decision;
  const h = card.dueAt ? hoursFromNow(card.dueAt) : null;
  const late = isOverdue(card);
  const blocks = card.links.filter((l) => l.kind === 'blocks').length;
  return (
    <>
      {!gutter && late && card.dueAt && (
        <Pill tone="danger" icon={Clock}>
          {fmt(t.row.overdue, { d: duration(Date.parse(card.dueAt) - nowMs(), locale) })}
        </Pill>
      )}
      {!gutter && !late && h !== null && h <= 24 && card.dueAt && (
        <Pill tone="warning" icon={Clock}>
          {fmt(t.row.dueSoon, { rel: rel(card.dueAt, locale) })}
        </Pill>
      )}
      {!gutter && !late && h !== null && h > 24 && card.dueAt && (
        <span className="inline-flex items-center gap-1">
          <CalendarClock aria-hidden className="size-3.5" strokeWidth={1.75} />
          {fmt(t.row.due, { when: when(card.dueAt, locale) })}
        </span>
      )}
      {d.escalatedToRole && (
        <Pill tone="danger" icon={TriangleAlert}>
          {fmt(t.row.escalated, { role: kit.roles[d.escalatedToRole] })}
        </Pill>
      )}
      {routedToMe(card, roles) && <MineMark />}
      <RoleBadge role={d.deciderRole} outline={false} className="text-body-sm" />
      <span>{t.kinds[d.kind]}</span>
      {blocks > 0 && (
        <span className="inline-flex items-center gap-1">
          <Link2 aria-hidden className="size-3.5" strokeWidth={1.75} />
          {plural(blocks, locale, kit.blocksCount)}
        </span>
      )}
      {card.commentCount > 0 && (
        <span className="inline-flex items-center gap-1">
          <MessageSquare aria-hidden className="size-3.5" strokeWidth={1.75} />
          {plural(card.commentCount, locale, t.row.comments)}
        </span>
      )}
    </>
  );
}

export type RowProps = ReturnType<typeof useKeyboardList>['rowProps'];

/** An open question: its options read as a sentence under the title, so the choice is visible before opening it. */
export function OpenRow({ card, rowProps }: { card: DecisionCard; rowProps: RowProps }) {
  const t = useT<DecisionMessages>('decisions');
  const locale = useLocale();
  const gutter = useMedia('(min-width: 768px)');
  const d = card.decision;
  return (
    <CardRow
      {...rowProps(card.key)}
      cardKey={card.key}
      type="decision"
      title={card.title}
      priority={card.priority === 'P0' || card.priority === 'P1' ? card.priority : undefined}
      tone={bandOf(card) === 'overdue' ? 'danger' : 'type'}
      titleId={`dec-${card.key}`}
      meta={
        <>
          <OpenFacts card={card} gutter={gutter} />
          <p className="basis-full truncate text-body-sm text-muted-foreground">
            {d.options.length ? (
              <Bidi>
                {orList(
                  d.options.map((o) => o.title),
                  locale,
                )}
              </Bidi>
            ) : (
              t.row.noOptions
            )}
          </p>
          {!gutter && (
            <div className="relative z-10 mt-1 flex basis-full *:flex-1">
              <RowAction
                card={card}
                action="decide"
                denied={t.row.denied}
                aria-describedby={`dec-${card.key}`}
                size="sm"
              />
            </div>
          )}
        </>
      }
      action={
        gutter ? (
          <RowAction
            card={card}
            action="decide"
            denied={t.row.denied}
            aria-describedby={`dec-${card.key}`}
            aria-keyshortcuts="d"
            className="min-w-18"
          />
        ) : undefined
      }
    />
  );
}

/** A recorded outcome: what was chosen and why, then the ADR's state. */
export function RecordedRow({ card, rowProps }: { card: DecisionCard; rowProps: RowProps }) {
  const t = useT<DecisionMessages>('decisions');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const gutter = useMedia('(min-width: 768px)');
  const d = card.decision;
  const chosen = d.options.find((o) => o.id === d.chosenOptionId);
  return (
    <CardRow
      {...rowProps(card.key)}
      cardKey={card.key}
      type="decision"
      title={card.title}
      titleId={`dec-${card.key}`}
      meta={
        <>
          {card.status === 'decided' && chosen ? (
            <Pill tone="success" icon={Check} className="h-auto min-h-5.5 whitespace-normal">
              <Bidi>{fmt(t.row.chosen, { option: chosen.title })}</Bidi>
            </Pill>
          ) : (
            <StatusBadge status={card.status} />
          )}
          {d.decidedById && card.status === 'decided' && (
            <ActorChip memberId={d.decidedById} className="text-muted-foreground" />
          )}
          {!gutter && <span>{shortDate(closedAt(card), locale)}</span>}
          {d.adrStatus !== 'none' && (
            <Pill tone={d.adrStatus === 'merged' ? 'success' : d.adrStatus === 'failed' ? 'danger' : 'info'}>
              <Ltr mono>ADR</Ltr> {kit.sheet.decision.adrStatus[d.adrStatus]}
            </Pill>
          )}
          {d.rationale && card.status === 'decided' && (
            <p className="basis-full text-body-sm text-pretty text-muted-foreground">
              <Bidi>{d.rationale}</Bidi>
            </p>
          )}
        </>
      }
    />
  );
}

/** A band's heading: an icon and words carry the urgency, and a neutral rule runs on to the end of the column (D31). */
export function BandHeading({
  id,
  tone = 'muted',
  icon: Icon,
  title,
  count,
  headingRef,
}: {
  id: string;
  tone?: 'danger' | 'warning' | 'muted';
  icon: typeof Clock;
  title: string;
  count: number;
  headingRef?: Ref<HTMLHeadingElement> | undefined;
}) {
  const locale = useLocale();
  const colour =
    tone === 'danger'
      ? 'text-destructive-soft-foreground'
      : tone === 'warning'
        ? 'text-warning-soft-foreground'
        : 'text-muted-foreground';
  return (
    <div className="flex items-center gap-2">
      <Icon aria-hidden className={cn('size-4', colour)} strokeWidth={1.75} />
      <h2
        ref={headingRef}
        id={id}
        tabIndex={-1}
        className={cn('text-body font-semibold outline-none', tone === 'muted' ? 'text-foreground' : colour)}
      >
        {title}
      </h2>
      <span className="rounded-full bg-muted px-2 text-caption font-medium text-muted-foreground tabular-nums">
        {num(count, locale)}
      </span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}
