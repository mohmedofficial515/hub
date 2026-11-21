import { Bot, ChevronDown, Cpu, TriangleAlert, Waves } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { memberById, type Today, type TimelineRow } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { CardKey, Chip, CopyButton, EmptyNote, fill, fmt, HubLink, Ltr, Monogram, RowDetails, rowTitle, Tile, TileHead, Title } from './atoms';
import { dayKey, dayTitle, plural, rel, when } from './format';
import { useMedia } from './hooks';
import { eventIcon } from './type-meta';

/** 09 §4: grouped per card. The newest event stands for the card; the rest are counted. */
type CardGroup = { head: TimelineRow; more: number };
function perCard(events: TimelineRow[]): CardGroup[] {
  const map = new Map<string, CardGroup>();
  for (const e of events) {
    const hit = map.get(e.card.key);
    if (hit) hit.more += 1;
    else map.set(e.card.key, { head: e, more: 0 });
  }
  return [...map.values()];
}

function perDay(groups: CardGroup[]) {
  const days = new Map<string, CardGroup[]>();
  for (const g of groups) {
    const k = dayKey(g.head.at);
    days.set(k, [...(days.get(k) ?? []), g]);
  }
  return [...days.entries()];
}

function ContractDiff({ event }: { event: TimelineRow }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <article aria-labelledby={`pin-${event.id}`} className="rounded-xl border-2 border-(--fish-cyan) p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Chip tone="alarm" icon={TriangleAlert}>
          {t.needs.breaking}
        </Chip>
        <span className="text-body-sm text-(--t-muted)">{t.since.pinned}</span>
        <time dateTime={event.at} className="ms-auto text-body-sm text-(--t-muted)">
          {rel(event.at, locale)}
        </time>
      </div>
      <h4 id={`pin-${event.id}`} className="mt-2 text-title-sm font-bold">
        <HubLink to={`/cards/${event.card.key}`} className="underline-offset-4 hover:underline">
          <Title text={event.card.title[locale]} />
        </HubLink>
      </h4>
      <dl className="mt-3 flex flex-col gap-3">
        {event.diff?.map((d) => (
          <div key={d.endpoint} className="flex flex-col gap-1">
            <dt className="flex flex-col gap-0.5">
              <code dir="ltr" translate="no" className="key text-start text-body-sm font-medium wrap-anywhere">
                {d.endpoint}
              </code>
              <span className="text-body-sm text-(--t-muted)">{d.label[locale]}</span>
            </dt>
            {/* Before and after are said in words and struck through, never red against green. */}
            <dd className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 text-body-sm">
              <span className="text-(--t-muted)">{t.since.before}</span>
              <code dir="ltr" translate="no" className="key text-start text-(--t-muted) line-through wrap-anywhere">
                {d.before}
              </code>
              <span className="font-semibold">{t.since.after}</span>
              <code dir="ltr" translate="no" className="key text-start font-medium wrap-anywhere">
                {d.after}
              </code>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-body-sm text-(--t-muted)">{event.detail[locale]}</p>
    </article>
  );
}

function EventRow({ group, open, onToggle, divided }: { group: CardGroup; open: boolean; onToggle: () => void; divided: boolean }) {
  const t = useT(messages);
  const locale = useLocale();
  const e = group.head;
  const actor = e.actorId === 'system' ? undefined : memberById(e.actorId);
  const Icon = eventIcon[e.kind];
  const titleId = `t-${e.card.key}`;
  const panelId = `d-${e.card.key}`;
  return (
    <li className={cn(divided && 'border-t border-t-(--t-line)')}>
      <article data-row aria-labelledby={titleId} className="group relative flex gap-3 rounded-lg px-2 py-2.5 hover:bg-(--t-hover) md:-mx-2">
        {actor ? (
          <Monogram member={actor} className="mt-0.5" />
        ) : (
          <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-(--t-chip)">
            <Cpu aria-hidden className="size-4 text-(--t-fg)" strokeWidth={1.75} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h4 className="text-body font-semibold text-pretty">
            <button
              id={titleId}
              data-row-title
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={onToggle}
              className={rowTitle}
            >
              <Title text={e.card.title[locale]} />
            </button>
          </h4>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-body-sm text-(--t-muted)">
            <span className="inline-flex items-center gap-1">
              <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
              <span className="font-semibold text-(--t-fg)">{actor ? actor.name[locale] : t.since.system}</span>
            </span>
            <span>{t.since.kinds[e.kind]}</span>
            {e.viaAgent && (
              <span className="inline-flex items-center gap-1">
                <Bot aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
                {t.since.viaAgent}
              </span>
            )}
            <time dateTime={e.at}>{rel(e.at, locale)}</time>
          </p>
          <p className="mt-0.5 text-body-sm text-(--t-muted)">
            {e.detail[locale]}
            {group.more > 0 && <> {plural(group.more, locale, t.since.more)}</>}
          </p>
          {open && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.14 }}>
              <RowDetails
                id={panelId}
                rows={[
                  { label: t.since.fieldCard, value: <CardKey k={e.card.key} className="text-(--t-fg)" /> },
                  ...(e.repo ? [{ label: t.since.fieldRepo, value: <Ltr mono>{e.repo}</Ltr> }] : []),
                  ...(e.branch ? [{ label: t.since.fieldBranch, value: <Ltr mono>{e.branch}</Ltr> }] : []),
                ]}
                actions={
                  <>
                    <HubLink to={`/cards/${e.card.key}`} className="text-body-sm font-semibold text-(--t-accent) underline underline-offset-4">
                      {t.row.openCard}
                    </HubLink>
                    <CopyButton text={e.card.key} />
                  </>
                }
              />
            </motion.div>
          )}
        </div>
        <ChevronDown
          aria-hidden
          strokeWidth={1.75}
          className={cn(
            'mt-1 size-4 shrink-0 text-(--t-muted) opacity-0 transition-[opacity,transform] duration-150 group-hover:opacity-100 motion-reduce:transition-none',
            open && 'rotate-180 opacity-100',
          )}
        />
      </article>
    </li>
  );
}

export function SinceLastVisit({
  data,
  expanded,
  onToggle,
  className,
}: {
  data: Today;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  className?: string;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const { total, since } = data.changesSince;
  // 09 §4: excluding my own events. The API should filter them; the mock still sends them.
  const others = data.changesSince.events.filter((e) => e.actorId !== data.me);
  // Phone shows the first 5 events, then "see all" (09 §4); wider screens show what the API sent.
  const wide = useMedia('(min-width: 768px)');
  const events = wide ? others : others.slice(0, 5);
  const pinned = events.filter((e) => e.kind === 'handoff' && e.diff?.length);
  const days = perDay(perCard(events.filter((e) => !pinned.includes(e))));
  const pinnedDay = pinned[0] ? dayKey(pinned[0].at) : null;
  // A pinned handoff opens the story of its own day even when no other event shares that day.
  const columns = pinnedDay && !days.some(([k]) => k === pinnedDay) ? ([[pinnedDay, []], ...days] as typeof days) : days;

  return (
    <Tile rule="cyan" labelledBy="since-title" className={className}>
      <TileHead id="since-title" title={t.since.title} count={total > 0 ? total : undefined} />
      {others.length === 0 ? (
        <EmptyNote icon={Waves} title={fmt(t.since.empty, { when: when(since, locale) })} className="mt-3" />
      ) : (
        <div className={cn('mt-4 grid gap-x-8 gap-y-5', columns.length > 1 && 'lg:grid-cols-2')}>
          {columns.map(([day, groups]) => (
            <section key={day} aria-labelledby={`day-${day}`} className="flex min-w-0 flex-col gap-3">
              <h3 id={`day-${day}`} className="text-title-sm font-bold text-(--fish-cyan-text)">
                {dayTitle(day + 'T12:00:00+03:00', locale)}
              </h3>
              {day === pinnedDay && pinned.map((e) => <ContractDiff key={e.id} event={e} />)}
              {groups.length > 0 && (
                <ul className="flex flex-col">
                  {groups.map((g, i) => (
                    <EventRow key={g.head.id} group={g} divided={i > 0} open={expanded.has(g.head.card.key)} onToggle={() => onToggle(g.head.card.key)} />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
      {/* The tide line: everything above it arrived after your last visit. */}
      {others.length > 0 && <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div role="separator" aria-label={fmt(t.since.tide, { when: when(since, locale) })} className="flex min-w-full flex-1 items-center gap-3 sm:min-w-0">
          <span className="inline-flex shrink-0 items-center gap-1.5 text-body-sm font-bold text-(--fish-cyan-text)">
            <Waves aria-hidden className="size-4" strokeWidth={2} />
            {fmt(t.since.tide, { when: when(since, locale) })}
          </span>
          <span aria-hidden className="h-0.5 flex-1 rounded-full bg-(--fish-cyan)" />
        </div>
        {total > events.length && (
          <HubLink
            to={`/timeline?from=${encodeURIComponent(since)}`}
            className="inline-flex min-h-11 items-center text-body-sm font-semibold text-(--t-accent) underline underline-offset-4 md:min-h-0"
          >
            <span>{fill(t.since.seeAll, { total: <Ltr>{total}</Ltr> })}</span>
          </HubLink>
        )}
      </div>}
    </Tile>
  );
}
