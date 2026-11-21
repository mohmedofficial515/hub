import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, ChevronDown, CircleCheck, Clock, Link2, TriangleAlert } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { memberById, type Action, type CardRow, type CardType, type Role, type Today } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { Button, CardKey, Chip, CopyButton, EmptyNote, fill, fmt, HubLink, Ltr, PriorityTag, RowDetails, rowTitle, Tile, Title, TypeTag } from './atoms';
import { dayKey, dayWord, duration, firstName, hoursFromNow, nowMs, plural, rel, when } from './format';

export type Urgency = 'late' | 'soon' | 'rest';
export type StackCard = CardRow & { urgency: Urgency; action: Action; promoted?: boolean };

const ORDER: Urgency[] = ['late', 'soon', 'rest'];
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
const ease = [0.2, 0.8, 0.2, 1] as const;

const isLate = (c: CardRow) => !!(c.flags?.overdue || c.flags?.escalated || (c.dueAt && hoursFromNow(c.dueAt) < 0));

function urgencyOf(c: CardRow): Urgency {
  if (isLate(c)) return 'late';
  if (c.dueAt && hoursFromNow(c.dueAt) <= 24) return 'soon';
  return 'rest';
}

/**
 * One ordered list: overdue or escalated, then due within 24 h, then the rest by due date and priority.
 * 09 §4: Awaiting me = cards routed to my roles with an actionable status. The mocked `awaitingMe` omits
 * the escalated decision `deadlines` carries (GTV-219, routed to `pm`), so it is promoted here.
 */
export function buildStack(today: Today, roles: Role[]): StackCard[] {
  const seen = new Set(today.awaitingMe.map((c) => c.key));
  const promoted = today.deadlines.filter((c) => !seen.has(c.key) && isLate(c) && c.ownerRole !== null && roles.includes(c.ownerRole));
  return [...promoted.map((c) => ({ ...c, promoted: true })), ...today.awaitingMe]
    .map((c) => ({ ...c, urgency: urgencyOf(c), action: c.action ?? DEFAULT_ACTION[c.type] }))
    .sort(
      (a, b) =>
        ORDER.indexOf(a.urgency) - ORDER.indexOf(b.urgency) ||
        (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity) ||
        PRIO[a.priority] - PRIO[b.priority],
    );
}

/** The poster numeral. It rolls when the count changes, and rolls in once on load (the one page-load moment). */
function Numeral({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex overflow-hidden text-(length:--mandarin-hero) leading-(--mandarin-hero-lh) font-black tabular-nums', className)}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: '40%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-40%', opacity: 0 }}
          transition={{ duration: 0.32, ease }}
          className="inline-block"
        >
          <Ltr>{value}</Ltr>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** One mark per item waiting today. A cleared item leaves a hollow mark: the target is none left. */
function Tally({ waiting, cleared }: { waiting: number; cleared: number }) {
  const total = Math.min(waiting + cleared, 24);
  return (
    <span aria-hidden className="flex items-end gap-1">
      {Array.from({ length: total }, (_, i) => (
        <motion.span
          key={i}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.24, ease, delay: Math.min(i, 10) * 0.04 }}
          className={cn(
            'block h-5 w-1.5 origin-bottom rounded-full transition-colors duration-200 md:h-6',
            // Marks clear from the end, so what is left always reads from the start.
            i < waiting ? 'bg-(--t-fg)' : 'border border-(--t-btn)',
          )}
        />
      ))}
    </span>
  );
}

function DueChips({ card }: { card: StackCard }) {
  const t = useT(messages);
  const locale = useLocale();
  const h = card.dueAt ? hoursFromNow(card.dueAt) : null;
  const late = card.flags?.overdue || (h !== null && h < 0);
  return (
    <>
      {late && card.dueAt && (
        <Chip tone="alarm" icon={Clock}>
          {fmt(t.needs.overdueBy, { d: duration(Date.parse(card.dueAt) - nowMs(), locale) })}
        </Chip>
      )}
      {card.flags?.escalated && (
        <Chip tone="alarm" icon={TriangleAlert}>
          {t.needs.escalated}
        </Chip>
      )}
      {card.severity === 'breaking' && (
        <Chip tone="alarm" icon={TriangleAlert}>
          {t.needs.breaking}
        </Chip>
      )}
      {!late && h !== null && h <= 24 && card.dueAt && (
        <Chip tone="soon" icon={Clock}>
          {fmt(t.needs.dueSoon, { rel: rel(card.dueAt, locale), when: when(card.dueAt, locale) })}
        </Chip>
      )}
      {!late && h !== null && h > 24 && card.dueAt && (
        <Chip tone="plain" icon={CalendarClock}>
          {fmt(t.needs.dueLater, { when: when(card.dueAt, locale) })}
        </Chip>
      )}
      {card.blocks ? (
        <Chip tone="plain" icon={Link2}>
          {plural(card.blocks, locale, t.needs.blocks)}
        </Chip>
      ) : null}
    </>
  );
}

function DueCell({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex min-w-14 flex-col-reverse gap-0.5">
      <dt className="text-body-sm text-(--t-muted)">{children}</dt>
      <dd className="text-display font-extrabold tabular-nums">
        <Ltr>{n}</Ltr>
      </dd>
    </div>
  );
}

/**
 * "Due soon", folded into the tile that already holds those cards: not a second list of the same items
 * (v2 finding M6) but the one thing a sorted list cannot show, how the load falls across the days.
 * The cells always add up to the numeral above.
 */
function DueStrip({ stack, allHere }: { stack: StackCard[]; allHere: boolean }) {
  const t = useT(messages);
  const locale = useLocale();
  const dated = stack.filter((c) => c.dueAt && hoursFromNow(c.dueAt) >= 0).sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!));
  const late = stack.filter((c) => c.dueAt && hoursFromNow(c.dueAt) < 0).length;
  const undated = stack.filter((c) => !c.dueAt).length;
  const days = new Map<string, { label: string; n: number }>();
  for (const c of dated) {
    const k = dayKey(c.dueAt!);
    days.set(k, { label: days.get(k)?.label ?? dayWord(c.dueAt!, locale), n: (days.get(k)?.n ?? 0) + 1 });
  }
  if (late === 0 && days.size === 0) return null;

  return (
    <div className="hidden border-t border-t-(--t-line) pt-4 md:block">
      <h3 className="text-body font-bold">{t.needs.dueTitle}</h3>
      <dl className="mt-1.5 flex flex-wrap items-end gap-x-8 gap-y-2">
        {late > 0 && (
          <DueCell n={late}>
            <Chip tone="alarm" icon={Clock}>
              {t.needs.dueLate}
            </Chip>
          </DueCell>
        )}
        {[...days.entries()].map(([k, d]) => (
          <DueCell key={k} n={d.n}>
            {d.label}
          </DueCell>
        ))}
        {undated > 0 && <DueCell n={undated}>{t.needs.dueNone}</DueCell>}
      </dl>
      {allHere && <p className="mt-2 text-body-sm text-(--t-muted)">{t.needs.allDueHere}</p>}
    </div>
  );
}

function Opener({ card }: { card: StackCard }) {
  const t = useT(messages);
  const locale = useLocale();
  const by = card.createdBy;
  if (!by) return null;
  if (by.kind === 'system') return <>{t.needs.openedBySystem}</>;
  const who = by.memberId ? memberById(by.memberId)?.name[locale] ?? '' : '';
  return <>{fmt(by.kind === 'agent' ? t.needs.openedByAgent : t.needs.openedBy, { who })}</>;
}

function Row({
  card,
  lead,
  open,
  onToggle,
  onAction,
}: {
  card: StackCard;
  lead: boolean;
  open: boolean;
  onToggle: () => void;
  onAction: (c: StackCard) => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const titleId = `t-${card.key}`;
  const panelId = `d-${card.key}`;

  // The API's note often already names the opener; a person is then not said twice.
  const opener = card.createdBy?.memberId ? memberById(card.createdBy.memberId)?.name[locale] : undefined;
  const noteNamesOpener = !!opener && !!card.meta?.[locale].includes(firstName(opener));

  const details = [
    card.createdBy && !noteNamesOpener ? { label: t.needs.fieldOpened, value: <Opener card={card} /> } : null,
    card.ownerRole ? { label: t.needs.fieldFor, value: t.roles[card.ownerRole] } : null,
    card.module ? { label: t.needs.fieldModule, value: <Ltr mono>{card.module}</Ltr> } : null,
    card.dueAt ? { label: t.needs.fieldDue, value: when(card.dueAt, locale) } : null,
    // A promoted deadline's meta only repeats the due words its chips already say.
    card.meta && !card.promoted ? { label: t.needs.fieldNote, value: card.meta[locale] } : null,
  ].filter((r): r is NonNullable<typeof r> => r !== null);

  return (
    <article
      data-row
      aria-labelledby={titleId}
      className={cn(
        // The same element stays mounted when a row is promoted to lead, so keyboard focus survives.
        'group relative grid gap-x-4 gap-y-2 transition-colors duration-200',
        lead
          ? 'tile-paper grid-cols-1 rounded-xl bg-(--t-bg) p-4 text-(--t-fg) sm:grid-cols-[minmax(0,1fr)_auto] md:p-5'
          : 'grid-cols-[minmax(0,1fr)_auto] rounded-lg px-2 py-3 hover:bg-(--t-hover) md:-mx-2',
      )}
    >
      <h3 className={cn('min-w-0 text-pretty text-(--t-fg)', lead ? 'text-title font-bold' : 'text-title-sm font-semibold')}>
        {/* The whole row toggles its details: Enter, `o` or a click. Actions sit above the stretched target. */}
        <button
          id={titleId}
          data-row-title
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className={cn(rowTitle, lead && 'after:rounded-xl')}
        >
          <Title text={card.title[locale]} />
        </button>
      </h3>

      <div
        className={cn(
          'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5',
          lead ? 'sm:col-start-1 sm:row-start-2' : 'col-span-full row-start-2 md:col-span-1 md:col-start-1',
        )}
      >
        <TypeTag type={card.type} />
        <CardKey k={card.key} />
        <PriorityTag p={card.priority} />
        <DueChips card={card} />
        <ChevronDown
          aria-hidden
          strokeWidth={1.75}
          className={cn(
            'size-4 shrink-0 text-(--t-muted) opacity-0 transition-[opacity,transform] duration-150 group-hover:opacity-100 motion-reduce:transition-none',
            open && 'rotate-180 opacity-100',
          )}
        />
      </div>

      <Button
        variant={lead ? 'primary' : 'outline'}
        onClick={() => onAction(card)}
        aria-describedby={titleId}
        className={cn(
          'relative z-10',
          lead
            ? 'w-full sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:w-auto sm:min-w-32 sm:self-center md:h-11'
            : 'col-start-2 row-start-1 min-w-20 self-start md:row-span-2 md:self-center',
        )}
      >
        {t.actions[card.action]}
      </Button>

      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.14 }} className="col-span-full">
          <RowDetails
            id={panelId}
            rows={details}
            actions={
              <>
                <HubLink to={`/cards/${card.key}`} className="text-body-sm font-semibold text-(--t-accent) underline underline-offset-4">
                  {t.row.openCard}
                </HubLink>
                <CopyButton text={card.key} />
              </>
            }
          />
        </motion.div>
      )}
    </article>
  );
}

export function NeedsYou({
  stack,
  cleared,
  outside,
  dueCount,
  expanded,
  onToggle,
  onAction,
  className,
}: {
  stack: StackCard[];
  cleared: number;
  /** Deadlines in the next 72 h that are not in this list (the only ones that may show separately). */
  outside: CardRow[];
  dueCount: number;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onAction: (c: StackCard) => void;
  className?: string;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const shown = stack.slice(0, 10);
  const overdue = stack.filter((c) => c.flags?.overdue || (c.dueAt && hoursFromNow(c.dueAt) < 0)).length;
  const soon = stack.filter((c) => c.urgency === 'soon').length;

  if (stack.length === 0) {
    // Nothing to act on: the tile stands down from solid blue to paper with a blue rule.
    return (
      <Tile rule="blue" labelledBy="needs-title" className={cn('flex flex-col gap-4 md:gap-5', className)}>
        <h2 id="needs-title" tabIndex={-1} className="flex scroll-mt-4 items-end gap-3 rounded-sm outline-none">
          <Numeral value={0} className="text-(--fish-blue)" />
          <span className="text-title font-extrabold md:text-headline">{t.needs.emptyTitle}</span>
        </h2>
        {cleared > 0 && <Tally waiting={0} cleared={cleared} />}
        <EmptyNote icon={CircleCheck} title={cleared > 0 ? plural(cleared, locale, t.needs.cleared) : t.needs.emptyBody}>
          <HubLink to="/timeline" className="font-semibold text-(--t-accent) underline underline-offset-4">
            {t.needs.emptyLink}
          </HubLink>
        </EmptyNote>
      </Tile>
    );
  }

  return (
    <Tile tone="ink" labelledBy="needs-title" className={cn('flex flex-col gap-4 md:gap-5', className)}>
      <header className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <h2 id="needs-title" tabIndex={-1} className="flex scroll-mt-4 items-end gap-3 rounded-sm outline-none">
          <Numeral value={stack.length} />
          <span className="text-title font-extrabold md:text-headline">{t.needs.waiting}</span>
        </h2>
        <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 md:ms-auto md:w-auto md:flex-col md:items-end md:pb-1">
          <Tally waiting={stack.length} cleared={cleared} />
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm font-medium">
            {overdue > 0 && (
              <span className="md:hidden">
                <Chip tone="alarm" icon={Clock}>
                  {plural(overdue, locale, t.needs.overdue)}
                </Chip>
              </span>
            )}
            {soon > 0 && <span className="md:hidden">{plural(soon, locale, t.needs.soon)}</span>}
            {cleared > 0 && <span className="text-(--t-muted)">{plural(cleared, locale, t.needs.cleared)}</span>}
          </p>
        </div>
      </header>

      <ul className="flex flex-col">
        <AnimatePresence mode="popLayout" initial={false}>
          {shown.map((card, index) => (
            <motion.li
              key={card.key}
              layout="position"
              exit={{ opacity: 0, transition: { duration: 0.16, ease: 'easeOut' } }}
              transition={{ duration: 0.24, ease }}
              className={cn(index === 0 && 'mb-2', index > 1 && 'border-t border-t-(--t-line)')}
            >
              <Row
                card={card}
                lead={index === 0}
                open={expanded.has(card.key)}
                onToggle={() => onToggle(card.key)}
                onAction={onAction}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {outside.length > 0 && (
        <div className="border-t border-t-(--t-line) pt-3">
          <h3 className="text-body font-bold">{t.needs.alsoDue}</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {outside.map((c) => (
              <li key={c.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm">
                <TypeTag type={c.type} />
                <CardKey k={c.key} />
                <span className="min-w-0 font-medium">
                  <Title text={c.title[locale]} />
                </span>
                {c.dueAt && <span className="text-(--t-muted)">{fmt(t.needs.dueLater, { when: when(c.dueAt, locale) })}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {stack.length > 10 && (
        <HubLink to="/inbox?awaiting=me" className="self-start text-body-sm font-semibold underline underline-offset-4">
          {fill(t.needs.seeAll, { total: <Ltr>{stack.length}</Ltr> })}
        </HubLink>
      )}

      <div className="mt-auto">
        <DueStrip stack={stack} allHere={outside.length === 0 && dueCount > 0} />
      </div>
    </Tile>
  );
}
