import { Bot, Cpu, TriangleAlert, Waves } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { memberById, type Today, type TimelineRow } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { Avatar, EmptyState, fmt, HubLink, Ltr, rich, SectionHead, TypeIcon } from './atoms';
import { dayKey, dayOffset, longDate, rel, when } from './format';
import { useMedia } from './hooks';
import { groupPerCard } from './model';

/** Before and after are labelled in words and the old value is struck through: not colour alone. */
function ContractDiff({ event }: { event: TimelineRow }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <article aria-labelledby={`pin-${event.id}`} className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-body-sm">
        <span className="inline-flex items-center gap-1 font-semibold text-destructive">
          <TriangleAlert aria-hidden className="size-3.5" strokeWidth={2} />
          {t.since.pinned}
        </span>
        <time dateTime={event.at} className="ms-auto text-muted-foreground">
          {rel(event.at, locale)}
        </time>
      </div>
      <p id={`pin-${event.id}`} className="mt-2 flex items-start gap-3 text-title-sm font-semibold text-foreground">
        <TypeIcon type={event.card.type} size="md" />
        <span className="min-w-0 pt-0.5 text-pretty">
          <HubLink to={`/cards/${event.card.key}`} className="underline-offset-4 hover:underline">
            {rich(event.card.title[locale])}
          </HubLink>
        </span>
      </p>
      <dl className="mt-3 flex flex-col gap-3 md:ps-11">
        {event.diff?.map((d) => (
          <div key={d.endpoint} className="flex flex-col gap-1.5">
            <dt className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <Ltr mono className="text-caption font-medium break-all text-foreground">
                {d.endpoint}
              </Ltr>
              <span className="text-body-sm text-muted-foreground">{d.label[locale]}</span>
            </dt>
            <dd className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-body-sm">
              <span className="text-muted-foreground">{t.since.before}</span>
              <code dir="ltr" translate="no" className="key rounded-sm bg-destructive-soft px-2 py-1 text-start text-caption break-all text-destructive-soft-foreground line-through decoration-1">
                {d.before}
              </code>
              <span className="text-muted-foreground">{t.since.after}</span>
              <code dir="ltr" translate="no" className="key rounded-sm bg-success-soft px-2 py-1 text-start text-caption break-all text-success-soft-foreground">
                {d.after}
              </code>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-body-sm text-muted-foreground md:ps-11">{event.detail[locale]}</p>
    </article>
  );
}

function CardEvents({ latest, count }: { latest: TimelineRow; count: number }) {
  const t = useT(messages);
  const locale = useLocale();
  const e = latest;
  const actor = e.actorId === 'system' ? undefined : memberById(e.actorId);
  return (
    <li data-row tabIndex={-1} className="relative grid scroll-my-24 grid-cols-[auto_minmax(0,1fr)] gap-x-3 py-2.5 outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:gap-x-4">
      <TypeIcon type={e.card.type} size="md" className="mt-0.5" />
      <div className="min-w-0">
        <p className="text-body font-medium text-pretty text-foreground">
          <HubLink data-row-open to={`/cards/${e.card.key}`} className="underline-offset-4 after:absolute after:inset-0 hover:underline">
            {rich(e.card.title[locale])}
          </HubLink>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-body-sm text-muted-foreground">
          {actor ? <Avatar member={actor} size="xs" agent={e.viaAgent} className="me-0.5" /> : <Cpu aria-hidden className="size-4" strokeWidth={1.75} />}
          <span className="font-medium text-foreground">{actor ? actor.name[locale] : t.since.system}</span>
          {e.viaAgent && (
            <span className="inline-flex items-center gap-0.5">
              <Bot aria-hidden className="size-3.5" strokeWidth={1.75} />
              {t.since.viaAgent}
            </span>
          )}
          <span>{t.since.kinds[e.kind]}</span>
          <time dateTime={e.at} className="ms-1">
            {rel(e.at, locale)}
          </time>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-body-sm text-muted-foreground">
          <span>{e.detail[locale]}</span>
          {e.branch && (
            <Ltr mono className="text-caption break-all">
              {e.branch}
            </Ltr>
          )}
          {count > 1 && <span>{fmt(t.since.moreEvents, { n: count - 1 })}</span>}
        </p>
      </div>
    </li>
  );
}

export function SinceLastVisit({ data }: { data: Today }) {
  const t = useT(messages);
  const locale = useLocale();
  const { total, since } = data.changesSince;
  // Phone shows the first 5 events, then "see all" (09 §4); wider screens show what the API sent.
  const wide = useMedia('(min-width: 768px)');
  const events = wide ? data.changesSince.events : data.changesSince.events.slice(0, 5);
  const pinned = events.filter((e) => e.kind === 'handoff' && e.diff?.length);
  const rest = groupPerCard(events.filter((e) => !pinned.includes(e)));
  const days = [...new Set(rest.map((g) => dayKey(g.latest.at)))];
  const dayLabel = (iso: string) => {
    const off = dayOffset(iso);
    return off === 0 ? t.since.today : off === -1 ? t.since.yesterday : longDate(iso, locale);
  };

  return (
    <section aria-labelledby="since-title" className="flex flex-col gap-3 md:gap-4">
      <SectionHead id="since-title" title={t.since.title} />
      {events.length === 0 ? (
        <EmptyState icon={Waves} title={fmt(t.since.empty, { when: when(since, locale) })} />
      ) : (
        <>
          {pinned.map((e) => (
            <ContractDiff key={e.id} event={e} />
          ))}
          {days.map((day) => {
            const groups = rest.filter((g) => dayKey(g.latest.at) === day);
            return (
              <div key={day}>
                <h3 className="reef-h3 text-muted-foreground">{dayLabel(groups[0].latest.at)}</h3>
                <ul className="mt-1 flex flex-col divide-y divide-border">
                  {groups.map((g) => (
                    <CardEvents key={g.latest.card.key} latest={g.latest} count={g.events.length} />
                  ))}
                </ul>
              </div>
            );
          })}
          {total > events.length && (
            <HubLink
              to={`/timeline?from=${encodeURIComponent(since)}`}
              className="inline-flex min-h-11 items-center self-start text-body-sm font-medium text-primary underline-offset-4 hover:underline md:min-h-0"
            >
              {fmt(t.since.seeAll, { total })}
            </HubLink>
          )}
        </>
      )}
      {/* The tide line: everything above it arrived after your last visit. */}
      <div role="separator" aria-label={fmt(t.since.tide, { when: when(since, locale) })} className="mt-2 flex items-center gap-3">
        <span aria-hidden className="reef-tide flex-1" />
        <span className="flex items-center gap-1.5 text-body-sm font-semibold text-foreground">
          <Waves aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.75} />
          {fmt(t.since.tide, { when: when(since, locale) })}
        </span>
        <span aria-hidden className="reef-tide flex-1" />
      </div>
    </section>
  );
}
