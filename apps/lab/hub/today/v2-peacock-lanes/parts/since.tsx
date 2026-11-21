import { Bot, Cpu, History, TriangleAlert, Waves } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { memberById, type Today, type TimelineRow } from '@lab/mocks/hub-today';
import { messages } from '../i18n';
import { Avatar, CardChip, EmptyState, fmt, HubLink, Pill, SectionHead, TypeDot } from './atoms';
import { plural, rel, when } from './format';
import { useMedia } from './hooks';

type Group = { repo: string; events: TimelineRow[]; commits: number };

function groupByRepo(events: TimelineRow[]): Group[] {
  const map = new Map<string, Group>();
  for (const e of events) {
    const repo = e.repo ?? 'cards';
    const g = map.get(repo) ?? { repo, events: [], commits: 0 };
    g.events.push(e);
    if (e.kind === 'commits') g.commits += e.count ?? 0;
    map.set(repo, g);
  }
  // Groups keep the order of their newest event (the API sends events newest first).
  return [...map.values()];
}

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

function ContractDiff({ event }: { event: TimelineRow }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <article aria-labelledby={`pin-${event.id}`} className="rounded-xl border border-border bg-background p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="danger" icon={TriangleAlert}>
          {t.stack.breaking}
        </Pill>
        <span className="text-caption text-muted-foreground">{t.since.pinned}</span>
        <time dateTime={event.at} className="ms-auto text-caption text-muted-foreground">
          {rel(event.at, locale)}
        </time>
      </div>
      <p id={`pin-${event.id}`} className="mt-2 flex flex-wrap items-center gap-2 text-body font-medium text-foreground">
        <CardChip k={event.card.key} type={event.card.type} />
        <span className="min-w-0">{event.card.title[locale]}</span>
      </p>
      <dl className="mt-3 flex flex-col gap-3">
        {event.diff?.map((d) => (
          <div key={d.endpoint} className="flex flex-col gap-1.5">
            <dt className="flex flex-wrap items-baseline gap-x-2">
              <code dir="ltr" className="key text-caption font-medium text-foreground">
                {d.endpoint}
              </code>
              <span className="text-caption text-muted-foreground">{d.label[locale]}</span>
            </dt>
            <dd className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 text-caption">
              <span className="text-muted-foreground">{t.since.before}</span>
              <code dir="ltr" className="key truncate rounded-sm bg-destructive-soft px-2 py-1 text-start text-destructive-soft-foreground line-through decoration-1">
                {d.before}
              </code>
              <span className="text-muted-foreground">{t.since.after}</span>
              <code dir="ltr" className="key truncate rounded-sm bg-success-soft px-2 py-1 text-start text-success-soft-foreground">
                {d.after}
              </code>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-caption text-muted-foreground">{event.detail[locale]}</p>
    </article>
  );
}

function EventRow({ e }: { e: TimelineRow }) {
  const t = useT(messages);
  const locale = useLocale();
  const actor = e.actorId === 'system' ? undefined : memberById(e.actorId);
  return (
    <li className="relative flex gap-3 py-2.5">
      <span className="mt-0.5">
        {actor ? (
          <Avatar member={actor} agent={e.viaAgent} />
        ) : (
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted">
            <Cpu aria-hidden className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-start gap-2 text-body text-foreground">
          <TypeDot type={e.card.type} className="mt-2" />
          <HubLink to={`/cards/${e.card.key}`} className="min-w-0 font-medium underline-offset-4 after:absolute after:inset-0 hover:underline">
            {e.card.title[locale]}
          </HubLink>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-caption text-muted-foreground">
          <span className="font-medium text-foreground">{actor ? actor.name[locale] : t.since.system}</span>
          {e.viaAgent && (
            <span className="inline-flex items-center gap-0.5">
              <Bot aria-hidden className="size-3" strokeWidth={2} />
              {t.since.viaAgent}
            </span>
          )}
          <span>{t.since.kinds[e.kind]}</span>
          <span aria-hidden>·</span>
          <time dateTime={e.at}>{rel(e.at, locale)}</time>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
          <span>{e.detail[locale]}</span>
          {e.branch && (
            <code dir="ltr" className="key truncate">
              {e.branch}
            </code>
          )}
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
  const rest = events.filter((e) => !pinned.includes(e));
  const groups = groupByRepo(rest);

  return (
    <section aria-labelledby="since-title" className="flex flex-col gap-4">
      <SectionHead
        id="since-title"
        icon={History}
        title={t.since.title}
        count={total}
        aside={
          total > events.length ? (
            <span className="text-caption text-muted-foreground">
              {fmt(t.since.showing, { shown: events.length, total })}
            </span>
          ) : null
        }
      />
      {events.length === 0 ? (
        <EmptyState icon={Waves} title={fmt(t.since.empty, { when: when(since, locale) })} />
      ) : (
        <>
          {pinned.map((e) => (
            <ContractDiff key={e.id} event={e} />
          ))}
          <div className="flex flex-col gap-4">
            {groups.map((g) => (
              <section key={g.repo} aria-labelledby={`repo-${g.repo}`}>
                <h3 id={`repo-${g.repo}`} className="flex items-center gap-2 border-b border-border pb-1.5 text-body-sm">
                  {g.repo === 'cards' ? (
                    <span className="font-medium text-foreground">{t.since.cards}</span>
                  ) : (
                    <code dir="ltr" className="key font-medium text-foreground">
                      {g.repo}
                    </code>
                  )}
                  {g.commits > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
                      <CommitTicks n={g.commits} />
                      {plural(g.commits, locale, t.since.commits)}
                    </span>
                  )}
                  <span className="ms-auto text-caption text-muted-foreground">{plural(g.events.length, locale, t.since.events)}</span>
                </h3>
                <ul>
                  {g.events.map((e) => (
                    <EventRow key={e.id} e={e} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {total > events.length && (
            <HubLink
              to={`/timeline?from=${encodeURIComponent(since)}`}
              className="self-start text-body-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {fmt(t.since.seeAll, { total })}
            </HubLink>
          )}
        </>
      )}
      {/* The tide line: everything above it arrived after your last visit. */}
      <div role="separator" aria-label={fmt(t.since.tide, { when: when(since, locale) })} className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-caption font-medium text-primary">
          <Waves aria-hidden className="size-3.5" strokeWidth={2} />
          {fmt(t.since.tide, { when: when(since, locale) })}
        </span>
        <span aria-hidden className="h-0.5 flex-1 rounded-full bg-primary/60" />
      </div>
    </section>
  );
}
