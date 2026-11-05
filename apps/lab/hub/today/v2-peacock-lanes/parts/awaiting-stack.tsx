import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, CircleCheck, Clock, Link2, TriangleAlert, UserRoundCheck } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import type { Action, CardRow, CardType, Role, Today } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { Button, EmptyState, fmt, HubLink, Ltr, Pill, PriorityBadge, RoleBadge, SectionHead, TypeLabel } from './atoms';
import { duration, hoursFromNow, nowMs, num, plural, rel, when } from './format';
import { typeClass } from './type-meta';

export type GroupKey = 'urgent' | 'soon' | 'decision' | 'need' | 'handoff' | 'redesign' | 'review' | 'other';
export type StackCard = CardRow & { group: GroupKey; action: Action; promoted?: boolean };

/** Focus order (research §1 #2, Linear "My issues"): urgent first, then by type. Empty groups hide. */
const ORDER: GroupKey[] = ['urgent', 'soon', 'decision', 'need', 'handoff', 'redesign', 'review', 'other'];
const PRIO = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;
const DEFAULT_ACTION: Record<CardType, Action> = {
  decision: 'decide',
  need: 'deliver',
  handoff: 'acknowledge',
  redesign: 'approve',
  task: 'verify',
  change: 'review',
  doc: 'review',
  release: 'review',
};

const isLate = (c: CardRow) => !!(c.flags?.overdue || c.flags?.escalated || (c.dueAt && hoursFromNow(c.dueAt) < 0));

function groupOf(c: CardRow): GroupKey {
  if (isLate(c)) return 'urgent';
  if (c.dueAt && hoursFromNow(c.dueAt) <= 24) return 'soon';
  if (c.type === 'decision' || c.type === 'need' || c.type === 'handoff' || c.type === 'redesign') return c.type;
  if (c.type === 'task') return 'review';
  return 'other';
}

/**
 * 09 §4: Awaiting me = cards routed to one of my roles with an actionable status. The mocked
 * `awaitingMe` omits the escalated decision that `deadlines` carries (GTV-219, routed to `pm`), so
 * an escalated or overdue deadline routed to my roles is promoted into the stack here.
 */
export function buildStack(today: Today, roles: Role[]): StackCard[] {
  const seen = new Set(today.awaitingMe.map((c) => c.key));
  const promoted = today.deadlines.filter(
    (c) => !seen.has(c.key) && isLate(c) && c.ownerRole !== null && roles.includes(c.ownerRole),
  );
  return [...promoted.map((c) => ({ ...c, promoted: true })), ...today.awaitingMe]
    .map((c) => ({ ...c, group: groupOf(c), action: c.action ?? DEFAULT_ACTION[c.type] }))
    .sort(
      (a, b) =>
        ORDER.indexOf(a.group) - ORDER.indexOf(b.group) ||
        (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity) ||
        PRIO[a.priority] - PRIO[b.priority],
    );
}

export const overdueCount = (stack: StackCard[]) =>
  stack.filter((c) => c.flags?.overdue || (c.dueAt && hoursFromNow(c.dueAt) < 0)).length;

const ease = [0.2, 0.8, 0.2, 1] as const;

function Signals({ card }: { card: StackCard }) {
  const t = useT(messages);
  const locale = useLocale();
  const h = card.dueAt ? hoursFromNow(card.dueAt) : null;
  const late = card.flags?.overdue || (h !== null && h < 0);
  return (
    <>
      {late && card.dueAt && (
        <Pill tone="warning" icon={Clock}>
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
        <Pill tone="muted" icon={Link2}>
          {plural(card.blocks, locale, t.stack.blocks)}
        </Pill>
      ) : null}
    </>
  );
}

function StackItem({ card, lead, onAction }: { card: StackCard; lead: boolean; onAction: (c: StackCard) => void }) {
  const t = useT(messages);
  const locale = useLocale();
  const urgent = card.group === 'urgent';
  const titleId = `aw-${card.key}`;
  return (
    <article
      data-row
      tabIndex={-1}
      aria-labelledby={titleId}
      className={cn(
        'relative grid gap-3 rounded-lg border-s-[3px] py-3 ps-4 pe-3 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center',
        // Phone: only the lead card gets a full-width button; the others keep theirs beside the text.
        !lead && 'grid-cols-[minmax(0,1fr)_auto] items-start',
        typeClass[card.type].soft,
        urgent ? 'border-destructive' : typeClass[card.type].stripe,
        lead && 'py-4 sm:pe-4',
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <TypeLabel type={card.type} />
          <Ltr mono className="text-caption text-muted-foreground">
            {card.key}
          </Ltr>
          <PriorityBadge p={card.priority} />
          {card.ownerRole && <RoleBadge role={card.ownerRole} routed />}
        </div>
        <p id={titleId} className={cn('mt-1.5 font-semibold text-pretty text-foreground', lead ? 'text-title' : 'text-title-sm')}>
          {/* Stretched link: the whole card opens it (a 44 px+ target on phones); the button sits above. */}
          <HubLink to={`/cards/${card.key}`} className="underline-offset-4 after:absolute after:inset-0 after:rounded-lg hover:underline">
            {card.title[locale]}
          </HubLink>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-caption text-muted-foreground">
          <Signals card={card} />
          {/* A promoted deadline's meta only repeats its due words, which the pills already say. */}
          {card.meta && !card.promoted && <span>{card.meta[locale]}</span>}
        </div>
      </div>
      <Button
        variant={lead ? 'primary' : 'outline'}
        onClick={() => onAction(card)}
        aria-describedby={titleId}
        className={cn('relative z-10', lead ? 'w-full sm:w-auto sm:min-w-28' : 'min-w-20')}
      >
        {t.actions[card.action]}
      </Button>
    </article>
  );
}

type Row = { kind: 'group'; group: GroupKey; count: number } | { kind: 'card'; card: StackCard; index: number };

export function AwaitingStack({
  stack,
  cleared,
  onAction,
}: {
  stack: StackCard[];
  cleared: number;
  onAction: (c: StackCard) => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const shown = stack.slice(0, 10);
  const rows: Row[] = [];
  shown.forEach((card, index) => {
    if (index === 0 || shown[index - 1].group !== card.group) {
      rows.push({ kind: 'group', group: card.group, count: shown.filter((c) => c.group === card.group).length });
    }
    rows.push({ kind: 'card', card, index });
  });

  return (
    <section aria-labelledby="awaiting-title" className="flex flex-col gap-4">
      <SectionHead
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
        <ul className="flex flex-col gap-2">
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
                  className="flex items-center gap-2 pt-2 first:pt-0"
                >
                  <h3 className="text-body-sm font-medium text-muted-foreground">{t.stack.groups[row.group]}</h3>
                  <span aria-hidden className="h-px flex-1 bg-border" />
                  <Ltr className="text-caption text-muted-foreground tabular-nums">{row.count}</Ltr>
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
                  <StackItem card={row.card} lead={row.index === 0} onAction={onAction} />
                </motion.li>
              ),
            )}
          </AnimatePresence>
        </ul>
      )}
      {stack.length > 10 && (
        <HubLink to="/inbox?awaiting=me" className="self-start text-body-sm font-medium text-primary underline-offset-4 hover:underline">
          {fmt(t.stack.seeAll, { total: stack.length })}
        </HubLink>
      )}
    </section>
  );
}
