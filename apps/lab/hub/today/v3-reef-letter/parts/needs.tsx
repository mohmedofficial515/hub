import { useId, type MouseEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, ChevronDown, CircleCheck, Clock, Link2, TriangleAlert } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { memberById, type CardRow } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { Button, EmptyState, fmt, HubLink, Ltr, PriorityMark, rich, SectionHead, TypeIcon } from './atoms';
import { duration, firstName, nowMs, plural, rel, when } from './format';
import { dueState, rowIdOf, type NeedCard } from './model';
import { roleIcon } from './type-meta';

const ease = [0.2, 0.8, 0.2, 1] as const;

/** Due is said in words, with an icon. Overdue is danger; "due < 24 h" is warning; later is quiet. */
export function DueChip({ card }: { card: CardRow }) {
  const t = useT(messages);
  const locale = useLocale();
  const state = dueState(card);
  if (!card.dueAt || !state) return null;
  if (state === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-destructive">
        <Clock aria-hidden className="size-3.5" strokeWidth={2} />
        {fmt(t.needs.overdueBy, { d: duration(Date.parse(card.dueAt) - nowMs(), locale) })}
      </span>
    );
  }
  if (state === 'soon') {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-warning-strong">
        <Clock aria-hidden className="size-3.5" strokeWidth={2} />
        {fmt(t.needs.dueSoon, { rel: rel(card.dueAt, locale) })}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-medium text-foreground">
      <CalendarClock aria-hidden className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
      {fmt(t.needs.due, { when: when(card.dueAt, locale) })}
    </span>
  );
}

function Details({ card, panelId }: { card: NeedCard; panelId: string }) {
  const t = useT(messages);
  const locale = useLocale();
  const d = t.needs.details;
  const RoleIcon = card.ownerRole ? roleIcon[card.ownerRole] : null;
  const creator = card.createdBy?.memberId ? memberById(card.createdBy.memberId) : undefined;
  const creatorName = creator ? firstName(creator.name[locale]) : '';
  const items: { label: string; value: React.ReactNode }[] = [
    { label: d.status, value: t.needs.status[card.status] ?? card.status },
    {
      label: d.routedTo,
      value: card.ownerRole && RoleIcon ? (
        <span className="inline-flex items-center gap-1.5">
          <RoleIcon aria-hidden className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
          {t.roles[card.ownerRole]}
        </span>
      ) : (
        d.none
      ),
    },
    { label: d.priority, value: <PriorityMark p={card.priority} always /> },
    { label: d.due, value: card.dueAt ? when(card.dueAt, locale) : d.none },
    ...(creator ? [{ label: d.openedBy, value: card.createdBy?.kind === 'agent' ? fmt(d.agentOf, { name: creatorName }) : creatorName }] : []),
    ...(card.module ? [{ label: d.module, value: <Ltr mono>{card.module}</Ltr> }] : []),
  ];
  return (
    <div id={panelId} className="ps-16 pe-3 pt-1 pb-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 md:ps-18 md:pe-4">
      {card.meta && !card.promoted && <p className="mb-2.5 text-body-sm text-muted-foreground md:hidden">{card.meta[locale]}</p>}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-caption text-muted-foreground">{item.label}</dt>
            <dd className="text-body-sm font-medium text-foreground">{item.value}</dd>
          </div>
        ))}
      </dl>
      <HubLink to={`/cards/${card.key}`} className="mt-3 inline-flex min-h-11 items-center text-body-sm font-medium text-primary underline-offset-4 hover:underline md:min-h-0">
        {d.open}
      </HubLink>
    </div>
  );
}

function NeedRow({
  card,
  lead,
  expanded,
  onToggle,
  onAction,
}: {
  card: NeedCard;
  lead: boolean;
  expanded: boolean;
  onToggle: (key: string) => void;
  onAction: (card: NeedCard, row: HTMLElement | null) => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const panelId = useId();
  const titleId = `need-${card.key}`;
  const urgent = card.rank === 0;
  return (
    <motion.li
      layout="position"
      initial={false}
      exit={{ opacity: 0, transition: { duration: 0.16, ease: 'easeOut' } }}
      transition={{ duration: 0.24, ease }}
      id={rowIdOf(card.key)}
      data-row
      tabIndex={-1}
      aria-labelledby={titleId}
      className="relative scroll-my-24 outline-none first:rounded-t-2xl last:rounded-b-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      {urgent && <span aria-hidden className="absolute inset-y-3 start-0 w-0.75 rounded-full bg-destructive" />}
      <div
        className={cn(
          'relative grid gap-x-3 px-3 py-3 md:gap-x-4 md:px-4 md:py-3.5',
          // Phone: only the lead row gets a full-width button; the others keep theirs beside the text.
          lead ? 'grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center' : 'grid-cols-[auto_minmax(0,1fr)_auto] items-center',
        )}
      >
        <TypeIcon type={card.type} className="self-start" />
        <div className="min-w-0">
          <h3 id={titleId} className={cn('text-pretty text-foreground', lead ? 'text-title font-bold' : 'text-title-sm font-semibold')}>
            {/* The whole row toggles its details. The button stretches over the row; the action sits above it. */}
            <button
              type="button"
              data-row-open
              aria-expanded={expanded}
              aria-controls={expanded ? panelId : undefined}
              onClick={() => onToggle(card.key)}
              className="group/open text-start outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
            >
              <span className="underline-offset-4 group-hover/open:underline">{rich(card.title[locale])}</span>
              <ChevronDown
                aria-hidden
                className={cn('ms-1 inline-block size-4 align-[-0.15em] text-muted-foreground transition-transform duration-200 motion-reduce:transition-none', expanded && 'rotate-180')}
                strokeWidth={1.75}
              />
            </button>
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-body-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="sr-only md:not-sr-only">{t.types[card.type]}</span>
              <Ltr mono className="text-caption">
                {card.key}
              </Ltr>
              <PriorityMark p={card.priority} className="text-caption" />
            </span>
            <DueChip card={card} />
            {card.flags?.escalated && (
              <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                <TriangleAlert aria-hidden className="size-3.5" strokeWidth={2} />
                {t.needs.escalated}
              </span>
            )}
            {card.severity === 'breaking' && (
              <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                <TriangleAlert aria-hidden className="size-3.5" strokeWidth={2} />
                {t.needs.breaking}
              </span>
            )}
            {card.blocks ? (
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Link2 aria-hidden className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
                {plural(card.blocks, locale, t.needs.blocks)}
              </span>
            ) : null}
            {/* A promoted deadline's meta only repeats the due words above. */}
            {card.meta && !card.promoted && <span className="hidden md:inline">{card.meta[locale]}</span>}
          </p>
        </div>
        <Button
          variant={lead ? 'primary' : 'outline'}
          data-action={card.action}
          aria-describedby={titleId}
          aria-keyshortcuts={card.action === 'acknowledge' ? 'a' : undefined}
          onClick={(e: MouseEvent<HTMLButtonElement>) => onAction(card, e.currentTarget.closest<HTMLElement>('[data-row]'))}
          className={cn('relative z-10', lead ? 'col-span-2 mt-3 w-full md:col-span-1 md:mt-0 md:w-auto md:min-w-28' : 'min-w-18')}
        >
          {t.actions[card.action]}
        </Button>
      </div>
      {expanded && <Details card={card} panelId={panelId} />}
    </motion.li>
  );
}

export function NeedsSection({
  needs,
  everHadNeeds,
  extraDue,
  expanded,
  onToggle,
  onAction,
}: {
  needs: NeedCard[];
  everHadNeeds: boolean;
  extraDue: CardRow[];
  expanded: string | null;
  onToggle: (key: string) => void;
  onAction: (card: NeedCard, row: HTMLElement | null) => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const shown = needs.slice(0, 10);
  return (
    <section aria-labelledby="needs-title" className="flex flex-col gap-3 md:gap-4">
      <SectionHead
        id="needs-title"
        title={t.needs.title}
        sub={<span className="hidden md:inline">{needs.length > 1 ? t.needs.order : null}</span>}
        aside={
          needs.length > 10 ? (
            <HubLink to="/inbox?awaiting=me" className="text-body-sm font-medium text-primary underline-offset-4 hover:underline">
              {fmt(t.needs.seeAll, { total: needs.length })}
            </HubLink>
          ) : null
        }
      />
      {needs.length === 0 ? (
        everHadNeeds ? (
          <EmptyState icon={CircleCheck} title={t.needs.clearedTitle}>
            {t.needs.clearedBody}
          </EmptyState>
        ) : (
          <EmptyState icon={CircleCheck} title={t.needs.emptyTitle}>
            {t.needs.emptyBody}
          </EmptyState>
        )
      ) : (
        <ol data-list="needs" data-keep-toast className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((card, i) => (
              <NeedRow key={card.key} card={card} lead={i === 0} expanded={expanded === card.key} onToggle={onToggle} onAction={onAction} />
            ))}
          </AnimatePresence>
        </ol>
      )}
      {extraDue.length > 0 && (
        <div className="mt-2">
          <h3 className="reef-h3 text-foreground">{t.needs.alsoDue}</h3>
          <ul className="mt-2 divide-y divide-border">
            {extraDue.map((c) => (
              <li key={c.key} data-row tabIndex={-1} className="relative flex items-center gap-3 rounded-lg py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <TypeIcon type={c.type} size="md" />
                <div className="min-w-0 flex-1">
                  <HubLink data-row-open to={`/cards/${c.key}`} className="text-body font-medium text-foreground underline-offset-4 after:absolute after:inset-0 hover:underline">
                    {rich(c.title[locale])}
                  </HubLink>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-body-sm text-muted-foreground">
                    <Ltr mono className="text-caption">
                      {c.key}
                    </Ltr>
                    <DueChip card={c} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
