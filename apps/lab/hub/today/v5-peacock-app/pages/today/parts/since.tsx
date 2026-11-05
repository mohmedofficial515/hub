import { Bot, Cpu, History, TriangleAlert, Waves } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { memberById, type Today, type TimelineRow } from '@lab/mocks/hub-today';
import { AppLink, Avatar, Bidi, CardChip, cn, ContractChange, EmptyState, fmt, focusRing, isTimelineSeen, openCard, Pill, plural, rel, SectionHeader, sinceVisitCount, stretchedFocus, TypeIcon, useCardStoreVersion, useKeyboardList, useMedia, when } from '../../../kit';
import { messages } from '../i18n';

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

/** The breaking contract change is the news of the morning, so it is pinned, as a before and after. */
function ContractDiff({ event }: { event: TimelineRow }) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <article aria-labelledby={`pin-${event.id}`} className="rounded-lg border border-border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="danger" icon={TriangleAlert}>
          {t.stack.breaking}
        </Pill>
        <span className="text-body-sm text-muted-foreground">{t.since.pinned}</span>
        <time dateTime={event.at} className="ms-auto text-body-sm text-muted-foreground">
          {rel(event.at, locale)}
        </time>
      </div>
      <p id={`pin-${event.id}`} className="mt-2 flex flex-wrap items-center gap-2 text-body font-medium text-foreground">
        <CardChip k={event.card.key} type={event.card.type} />
        <span className="min-w-0">
          <Bidi>{event.card.title[locale]}</Bidi>
        </span>
      </p>
      <ul className="-mx-3 mt-1">
        {event.diff?.map((d) => (
          <ContractChange key={d.endpoint} change={{ endpoint: d.endpoint, severity: 'breaking', change: d.label, before: d.before, after: d.after }} />
        ))}
      </ul>
      <p className="mt-1 text-body-sm text-muted-foreground">
        <Bidi>{event.detail[locale]}</Bidi>
      </p>
    </article>
  );
}

function EventRow({ e, rowProps }: { e: TimelineRow; rowProps: Record<string, unknown> }) {
  const t = useT(messages);
  const locale = useLocale();
  const actor = e.actorId === 'system' ? undefined : memberById(e.actorId);
  return (
    <li {...rowProps} className="relative flex gap-3 rounded-md py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
        <p className="flex items-start gap-1.5 text-body text-foreground">
          <TypeIcon type={e.card.type} className="mt-0.5" />
          <AppLink card={e.card.key} className={cn('min-w-0 font-medium underline-offset-4 outline-none after:absolute after:inset-0 after:rounded-md hover:underline', stretchedFocus)}>
            <Bidi>{e.card.title[locale]}</Bidi>
          </AppLink>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-body-sm text-muted-foreground">
          <span className="font-medium text-foreground">{actor ? actor.name[locale] : t.since.system}</span>
          {e.viaAgent && (
            <span className="inline-flex items-center gap-0.5">
              <Bot aria-hidden className="size-3" strokeWidth={2} />
              {t.since.viaAgent}
            </span>
          )}
          <span>{t.since.kinds[e.kind]}</span>
          <time dateTime={e.at}>{rel(e.at, locale)}</time>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-body-sm text-muted-foreground">
          <span>
            <Bidi>{e.detail[locale]}</Bidi>
          </span>
          {e.branch && (
            <code dir="ltr" translate="no" className="key truncate text-caption">
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
  const { since } = data.changesSince;
  // 09 §4: excluding my own. The sidebar shows this same number, and a visit to the Timeline clears both (review M4). The events stay listed.
  const total = sinceVisitCount(data);
  useCardStoreVersion();
  const others = data.changesSince.events.filter((e) => e.actorId !== data.me);
  // Phone shows the first 5 events, then "see all" (09 §4). Wider screens show what the API sent.
  const wide = useMedia('(min-width: 768px)');
  const events = wide ? others : others.slice(0, 5);
  const pinned = events.filter((e) => e.kind === 'handoff' && e.diff?.length);
  const rest = events.filter((e) => !pinned.includes(e));
  const groups = groupByRepo(rest);
  const byId = new Map(rest.map((e) => [e.id, e]));
  const list = useKeyboardList({ ids: rest.map((e) => e.id), onOpen: (id) => openCard(byId.get(id)!.card.key) });

  return (
    <section aria-labelledby="since-title" className="flex flex-col gap-3">
      <SectionHeader id="since-title" icon={History} title={t.since.title} count={isTimelineSeen() ? undefined : total} />
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
                <div className="flex items-center gap-2 border-b border-border pb-1.5">
                  <h3 id={`repo-${g.repo}`} className="text-body-sm font-medium text-foreground">
                    {g.repo === 'cards' ? (
                      t.since.cards
                    ) : (
                      <code dir="ltr" translate="no" className="key">
                        {g.repo}
                      </code>
                    )}
                  </h3>
                  {g.commits > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground">
                      <CommitTicks n={g.commits} />
                      {plural(g.commits, locale, t.since.commits)}
                    </span>
                  )}
                </div>
                <ul data-hub-list>
                  {g.events.map((e) => (
                    <EventRow key={e.id} e={e} rowProps={list.rowProps(e.id)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {total > events.length && (
            <AppLink view="timeline" query={{ from: since }} className={cn('hit-44 self-start rounded-sm text-body-sm font-medium text-primary underline-offset-4 hover:underline', focusRing)}>
              {fmt(t.since.seeAll, { total })}
            </AppLink>
          )}
        </>
      )}
      {/* The tide line: everything above it arrived after your last visit. */}
      <div role="separator" aria-label={fmt(t.since.tide, { when: when(since, locale) })} className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-(--tide-soft) px-2.5 py-1 text-body-sm font-medium text-(--tide)">
          <Waves aria-hidden className="size-3.5" strokeWidth={2} />
          {fmt(t.since.tide, { when: when(since, locale) })}
        </span>
        <span aria-hidden className="h-0.5 flex-1 rounded-full bg-(--tide)" />
      </div>
    </section>
  );
}
