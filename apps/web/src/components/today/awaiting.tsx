'use client';

/**
 * @file awaiting.tsx
 * @description My stack: urgent first, then the next 24 h, then the rest (review M3). The API says the verb on each row, so it swaps as the card
 * moves and the row leaves when nothing remains (review B2).
 */
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, CircleCheck, Clock, TriangleAlert, UserRoundCheck } from 'lucide-react';
import { type RefObject, useRef } from 'react';

import {
  actionsFor,
  AppLink,
  type AwaitingCard,
  type AwaitingGroup,
  Bidi,
  Button,
  type CardAction,
  CardRow,
  cn,
  duration,
  EmptyState,
  fmt,
  focusRing,
  type HandoffCard,
  hoursFromNow,
  type HubCard,
  isOverdue,
  kitMessages,
  type NeedCard,
  nowMs,
  openCard,
  Pill,
  type RedesignCard,
  rel,
  RoleBadge,
  SectionHeader,
  useKeyboardList,
  useLocale,
  useMembers,
  usePerformAction,
  useSession,
  useT,
  when,
} from '@/components/kit';
import { handoffAgeMs } from '@/features/cards/store';

import { NS, type TodayMessages } from './messages';

const ease = [0.2, 0.8, 0.2, 1] as const;

/** A row of the stack, with the detail `/today` adds. */
export type StackCard = AwaitingCard & Partial<HubCard>;

const asFull = <T,>(card: StackCard) => card as unknown as T;

/** The one fact a row without a date can still say, from the card's own detail. */
function useMetaOf() {
  const t = useT<TodayMessages>(NS);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const members = useMembers().data;
  return (card: StackCard): string | undefined => {
    if (card.type === 'handoff') {
      const from = asFull<Partial<HandoffCard>>(card).handoff?.fromRole;
      if (from) return fmt(t.stack.metaHandoff, { role: kit.roles[from], rel: rel(card.createdAt, locale) });
    }
    if (card.type === 'need') {
      const by = asFull<Partial<NeedCard>>(card).need?.deliveredById;
      const name = members?.find((m) => m.id === by)?.name;
      if (name) return fmt(t.stack.metaDelivered, { name });
    }
    if (card.type === 'redesign') {
      const score = asFull<Partial<RedesignCard>>(card).redesign?.reviewScore;
      if (score !== undefined) return fmt(t.stack.metaScore, { n: score });
    }
    return undefined;
  };
}

function Signals({ card, meta }: { card: StackCard; meta: string | undefined }) {
  const t = useT<TodayMessages>(NS);
  const locale = useLocale();
  const { roles } = useSession();
  const h = card.dueAt ? hoursFromNow(card.dueAt) : null;
  const late = isOverdue(card);
  const stale = card.flags?.stale === true;
  const breaking =
    card.type === 'handoff' && asFull<Partial<HandoffCard>>(card).handoff?.severity === 'breaking';
  return (
    <>
      {late && card.dueAt && (
        <Pill tone="danger" icon={Clock}>
          {fmt(t.stack.overdueBy, { d: duration(Date.parse(card.dueAt) - nowMs(), locale) })}
        </Pill>
      )}
      {card.flags?.escalated && (
        <Pill tone="danger" icon={TriangleAlert}>
          {t.stack.escalated}
        </Pill>
      )}
      {!late && h !== null && h <= 24 && card.dueAt && (
        <Pill tone="warning" icon={Clock}>
          {fmt(t.stack.dueSoon, { rel: rel(card.dueAt, locale) })}
        </Pill>
      )}
      {stale && (
        <Pill tone="warning" icon={Clock}>
          {fmt(t.stack.stale, { d: duration(handoffAgeMs(card), locale) })}
        </Pill>
      )}
      {breaking && (
        <Pill tone="danger" icon={TriangleAlert}>
          {t.stack.breaking}
        </Pill>
      )}
      {!late && h !== null && h > 24 && card.dueAt && (
        <span className="inline-flex items-center gap-1">
          <CalendarClock aria-hidden className="size-3.5" strokeWidth={1.75} />
          {fmt(t.stack.due, { when: when(card.dueAt, locale) })}
        </span>
      )}
      {/* Everything here is routed to me, so no routed dot. The role only tells apart the hats of a member who holds several. */}
      {card.ownerRole && roles.length > 1 && <RoleBadge role={card.ownerRole} outline={false} iconOnly />}
      {meta && (
        <span>
          <Bidi>{meta}</Bidi>
        </span>
      )}
    </>
  );
}

type Row =
  { kind: 'group'; group: AwaitingGroup; count: number } | { kind: 'card'; card: StackCard; index: number };

/** Header only for groups with 2+ cards, plus the divider before "Everything else" (review M3). */
function rowsFor(shown: StackCard[]): Row[] {
  const rows: Row[] = [];
  shown.forEach((card, index) => {
    const startsGroup = index === 0 || shown[index - 1]?.group !== card.group;
    const count = shown.filter((c) => c.group === card.group).length;
    if (startsGroup && (card.group === 'rest' ? index > 0 : count > 1)) {
      rows.push({ kind: 'group', group: card.group, count });
    }
    rows.push({ kind: 'card', card, index });
  });
  return rows;
}

export function AwaitingStack({
  stack,
  headingRef,
}: {
  stack: StackCard[];
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const t = useT<TodayMessages>(NS);
  const kit = useT(kitMessages);
  const { roles, me } = useSession();
  const perform = usePerformAction();
  const metaOf = useMetaOf();
  const shown = stack.slice(0, 10);
  const rows = rowsFor(shown);
  const byKey = useRef(new Map<string, StackCard>());
  byKey.current = new Map(shown.map((c) => [c.key, c]));

  const offer = (card: StackCard) =>
    actionsFor(card as HubCard, roles, me.id).find((a) => a.action === card.action);

  /** 09 §4: Decide, Deliver, Acknowledge open the sheet on the action. An action with no form runs here. */
  const act = (card: StackCard) => {
    if (offer(card)?.mode === 'now') perform(card.key, card.action);
    else openCard(card.key, { action: card.action });
  };
  // The one filled button: the first row that asks something of me. Verifying my own delivery is allowed, and never the next thing the page wants.
  const filled = shown.find((c) => !offer(c)?.selfVerify)?.key;
  const keyAction = (action: CardAction) => (id: string) => {
    const card = byKey.current.get(id);
    if (card?.action === action) act(card);
  };

  const list = useKeyboardList({
    ids: shown.map((c) => c.key),
    emptyFocusRef: headingRef,
    actions: { d: keyAction('decide'), a: keyAction('acknowledge'), c: keyAction('claim') },
  });

  return (
    <section aria-labelledby="awaiting-title" className="flex flex-col gap-3">
      <SectionHeader
        ref={headingRef}
        id="awaiting-title"
        icon={UserRoundCheck}
        title={t.stack.title}
        count={stack.length}
      />
      {stack.length === 0 ? (
        <EmptyState icon={CircleCheck} title={t.stack.emptyTitle}>
          {t.stack.emptyBody}
        </EmptyState>
      ) : (
        <ul data-hub-list className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {rows.map((row) =>
              row.kind === 'group' ? (
                <motion.li
                  key={`g-${row.group}`}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.2, ease }}
                  className="flex items-center gap-2 pt-1.5"
                >
                  <h3 className="text-body-sm font-medium text-muted-foreground">
                    {t.stack.groups[row.group]}
                  </h3>
                  <span aria-hidden className="h-px flex-1 bg-border" />
                </motion.li>
              ) : (
                <motion.li
                  key={row.card.key}
                  layout="position"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.26, ease, delay: Math.min(row.index, 6) * 0.045 },
                  }}
                  exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.16, ease: 'easeOut' } }}
                  transition={{ duration: 0.24, ease }}
                >
                  <CardRow
                    {...list.rowProps(row.card.key)}
                    cardKey={row.card.key}
                    type={row.card.type}
                    title={row.card.title}
                    // 08 §5.1: P2 and P3 stay out of dense lists.
                    priority={
                      row.card.priority === 'P0' || row.card.priority === 'P1' ? row.card.priority : undefined
                    }
                    tone={row.card.group === 'urgent' && !row.card.flags?.stale ? 'danger' : 'type'}
                    lead={row.index === 0}
                    titleId={`aw-${row.card.key}`}
                    // A row with no date has no other second-line fact, so it keeps its meta. So does the lead.
                    meta={
                      <Signals
                        card={row.card}
                        meta={row.index === 0 || !row.card.dueAt ? metaOf(row.card) : undefined}
                      />
                    }
                    action={
                      <Button
                        variant={row.card.key === filled ? 'primary' : 'outline'}
                        onClick={() => act(row.card)}
                        aria-describedby={`aw-${row.card.key}`}
                        aria-keyshortcuts={
                          row.card.action === 'decide'
                            ? 'd'
                            : row.card.action === 'acknowledge'
                              ? 'a'
                              : row.card.action === 'claim'
                                ? 'c'
                                : undefined
                        }
                        className={cn(row.index === 0 ? 'w-full sm:w-auto sm:min-w-24' : 'min-w-18')}
                      >
                        {kit.actions[row.card.action]}
                      </Button>
                    }
                  />
                </motion.li>
              ),
            )}
          </AnimatePresence>
        </ul>
      )}
      {stack.length > 10 && (
        <AppLink
          view="inbox"
          query={{ awaiting: 'me' }}
          className={cn(
            'self-start rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline',
            focusRing,
          )}
        >
          {fmt(t.stack.seeAll, { total: stack.length })}
        </AppLink>
      )}
    </section>
  );
}
