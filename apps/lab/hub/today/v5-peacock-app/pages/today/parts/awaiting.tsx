import { useRef, type RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, CircleCheck, Clock, Link2, TriangleAlert, UserRoundCheck } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import {
  AppLink,
  Bidi,
  Button,
  CardRow,
  cn,
  duration,
  EmptyState,
  fmt,
  focusRing,
  hoursFromNow,
  isOverdue,
  kitMessages,
  num,
  nowMs,
  openCard,
  Pill,
  plural,
  rel,
  RoleBadge,
  SectionHeader,
  useKeyboardList,
  usePerformAction,
  useSession,
  when,
  type AwaitingCard,
  type AwaitingGroup,
  type CardAction,
} from '../../../kit';
import { messages } from '../i18n';

const ease = [0.2, 0.8, 0.2, 1] as const;

function Signals({ card, showMeta }: { card: AwaitingCard; showMeta: boolean }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { roles } = useSession();
  const h = card.dueAt ? hoursFromNow(card.dueAt) : null;
  const late = isOverdue(card);
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
      {card.staleForMs !== undefined && (
        <Pill tone="warning" icon={Clock}>
          {fmt(t.stack.stale, { d: duration(card.staleForMs, locale) })}
        </Pill>
      )}
      {card.severity === 'breaking' && (
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
      {card.blocks ? (
        <span className="inline-flex items-center gap-1">
          <Link2 aria-hidden className="size-3.5" strokeWidth={1.75} />
          {plural(card.blocks, locale, kit.blocksCount)}
        </span>
      ) : null}
      {/* Everything here is routed to me, so no routed dot (review, redundant chrome). The role only tells apart the
          hats of a member who holds several; it is an icon to keep the row at two lines (review M3). */}
      {card.ownerRole && roles.length > 1 && <RoleBadge role={card.ownerRole} outline={false} iconOnly />}
      {showMeta && card.meta && (
        <span>
          <Bidi>{card.meta[locale]}</Bidi>
        </span>
      )}
    </>
  );
}

type Row = { kind: 'group'; group: AwaitingGroup; count: number } | { kind: 'card'; card: AwaitingCard; index: number };

/** Header only for groups with 2+ cards, plus the divider before "Everything else" (review M3). */
function rowsFor(shown: AwaitingCard[]): Row[] {
  const rows: Row[] = [];
  shown.forEach((card, index) => {
    const startsGroup = index === 0 || shown[index - 1].group !== card.group;
    const count = shown.filter((c) => c.group === card.group).length;
    if (startsGroup && (card.group === 'rest' ? index > 0 : count > 1)) rows.push({ kind: 'group', group: card.group, count });
    rows.push({ kind: 'card', card, index });
  });
  return rows;
}

export function AwaitingStack({ stack, cleared, headingRef }: { stack: AwaitingCard[]; cleared: number; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const perform = usePerformAction();
  const shown = stack.slice(0, 10);
  const rows = rowsFor(shown);
  const byKey = useRef(new Map<string, AwaitingCard>());
  byKey.current = new Map(shown.map((c) => [c.key, c]));

  /** 09 §4: Decide, Deliver, Acknowledge… open the sheet on the action. Claim has no form, so it runs here. */
  const act = (card: AwaitingCard) => {
    if (card.mode === 'now') perform(card.key, card.action);
    else openCard(card.key, { action: card.action });
  };
  // The one filled button: the first row that asks something of me. Verifying my own delivery is allowed, and never the next thing the page wants.
  const filled = shown.find((c) => !c.selfVerify)?.key;
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
        aside={
          cleared > 0 ? (
            <Pill tone="success" icon={CircleCheck}>
              {fmt(t.stack.cleared, { n: num(cleared, locale) })}
            </Pill>
          ) : null
        }
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
                  <h3 className="text-body-sm font-medium text-muted-foreground">{t.stack.groups[row.group]}</h3>
                  <span aria-hidden className="h-px flex-1 bg-border" />
                </motion.li>
              ) : (
                <motion.li
                  key={row.card.key}
                  layout="position"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.26, ease, delay: Math.min(row.index, 6) * 0.045 } }}
                  exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.16, ease: 'easeOut' } }}
                  transition={{ duration: 0.24, ease }}
                >
                  <CardRow
                    {...list.rowProps(row.card.key)}
                    cardKey={row.card.key}
                    type={row.card.type}
                    title={row.card.title[locale]}
                    // 08 §5.1: P2 and P3 stay out of dense lists.
                    priority={row.card.priority === 'P0' || row.card.priority === 'P1' ? row.card.priority : undefined}
                    tone={row.card.group === 'urgent' && row.card.staleForMs === undefined ? 'danger' : 'type'}
                    lead={row.index === 0}
                    titleId={`aw-${row.card.key}`}
                    // A row with no date has no other second-line fact, so it keeps its meta. So does the lead.
                    meta={<Signals card={row.card} showMeta={!row.card.promoted && (row.index === 0 || !row.card.dueAt)} />}
                    action={
                      <Button
                        variant={row.card.key === filled ? 'primary' : 'outline'}
                        onClick={() => act(row.card)}
                        aria-describedby={`aw-${row.card.key}`}
                        aria-keyshortcuts={row.card.action === 'decide' ? 'd' : row.card.action === 'acknowledge' ? 'a' : row.card.action === 'claim' ? 'c' : undefined}
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
        <AppLink view="inbox" query={{ awaiting: 'me' }} className={cn('self-start rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline', focusRing)}>
          {fmt(t.stack.seeAll, { total: stack.length })}
        </AppLink>
      )}
    </section>
  );
}
