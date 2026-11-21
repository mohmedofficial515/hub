'use client';

/**
 * @file docket.tsx
 * @description Ported from v5 `pages/decisions/parts/docket.tsx`. D31: the rule beside a band's heading is neutral. The icon and the words carry the urgency.
 * Every open question shows its options as compact chips, the recommended ones first and marked, and an overdue question is told by tone (the
 * gutter's time and dot, the band's heading), never by a red frame round the card (owner decision 7, 2026-11-19).
 */
import { CalendarClock, Check, Clock, Link2, MessageSquare, Star, TriangleAlert } from 'lucide-react';
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
  usePageWide,
  useSession,
  useT,
  when,
} from '@/components/kit';
import { type Band, bandOf, closedAt, routedToMe, tableOptions } from '@/features/decisions/model';
import { textDirection } from '@/lib/direction';

import type { DecisionMessages } from './messages';

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
  const wide = usePageWide(768);
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

/**
 * A question's options at a glance: one chip each, the recommended ones first with a star, three at most and the rest counted. They only read;
 * choosing happens in the sheet, from the row's Decide (owner decision 7).
 */
export function OptionChips({ card }: { card: DecisionCard }) {
  const t = useT<DecisionMessages>('decisions');
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { visible, folded } = tableOptions(card.decision.options);
  if (visible.length === 0) {
    return <p className="basis-full text-body-sm text-muted-foreground">{t.row.noOptions}</p>;
  }
  return (
    <ul
      data-decision-options={card.key}
      aria-label={plural(card.decision.options.length, locale, t.row.options)}
      className="flex basis-full flex-wrap items-center gap-1.5 pt-0.5"
    >
      {visible.map((option) => (
        <li
          key={option.id}
          data-recommended={option.recommended ? '' : undefined}
          className={cn(
            'inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border px-2 py-0.5 text-body-sm',
            option.recommended
              ? 'border-info-soft-foreground/30 bg-info-soft text-info-soft-foreground'
              : 'border-border bg-background text-foreground',
          )}
        >
          {option.recommended && (
            <>
              <Star aria-hidden className="size-3.5 shrink-0 fill-current" strokeWidth={1.75} />
              <span className="sr-only">{kit.sheet.decision.recommended}: </span>
            </>
          )}
          <span dir={textDirection(option.title)} className="min-w-0 truncate">
            <Bidi>{option.title}</Bidi>
          </span>
        </li>
      ))}
      {folded.length > 0 && (
        <li className="text-body-sm text-muted-foreground">
          {plural(folded.length, locale, t.table.moreOptions)}
        </li>
      )}
    </ul>
  );
}

/** An open question: its options as compact chips under the title, so the choice is visible before opening it. */
export function OpenRow({ card, rowProps }: { card: DecisionCard; rowProps: RowProps }) {
  const t = useT<DecisionMessages>('decisions');
  const gutter = usePageWide(768);
  return (
    <CardRow
      {...rowProps(card.key)}
      cardKey={card.key}
      type="decision"
      title={card.title}
      priority={card.priority === 'P0' || card.priority === 'P1' ? card.priority : undefined}
      titleId={`dec-${card.key}`}
      meta={
        <>
          <OpenFacts card={card} gutter={gutter} />
          <OptionChips card={card} />
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
  const gutter = usePageWide(768);
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
