'use client';

/**
 * @file timeline-page.tsx
 * @description The page reads as time, so the layout is an axis: a spine with the hour beside each node, labelled pauses, your last visit as a line
 * between the rows it separates, and from 1280 px a rail with one bar per day. Live (docs/09 §5): at the top of the page a new event prepends and fades
 * in; scrolled down, the rows hold still and a pill counts what arrived.
 */
import { ArrowUp, ExternalLink, GitCommitHorizontal, RefreshCw, SearchX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  actionsFor,
  AppLink,
  Button,
  type CardAction,
  cn,
  CopyButton,
  dayKey,
  duration,
  EmptyState,
  ErrorState,
  fmt,
  focusRing,
  hrefFor,
  type HubCard,
  IconButton,
  kitMessages,
  LoadingRegion,
  longDate,
  Ltr,
  matchKey,
  nowMs,
  openCard,
  PageContainer,
  PageHeader,
  plural,
  shortcutsEnabled,
  shortDate,
  Skeleton,
  useCards,
  useFilter,
  useFilterList,
  useKeyboardList,
  useLocale,
  useMedia,
  useRoute,
  useSession,
  useT,
  when as whenLabel,
} from '@/components/kit';
import { versionQuery } from '@/features/redesign/gallery';
import { useRunAction } from '@/features/timeline/run-action';
import { buildDays, buildRail, countEvents, newestOfCard } from '@/features/timeline/stream';
import {
  type TimelineFilters as Filters,
  useLastVisit,
  useSeenWhileHere,
  useTimeline,
} from '@/features/timeline/use-timeline';
import { isHubError } from '@/lib/api/errors';

import { clearFilters, TimelineFilters, useActiveFilters } from './filters';
import { Spine, TimelineItem } from './item';
import { NS, type TimelineMessages } from './messages';

/** Actions a row offers in place (08 §5.2). Everything else lives in the sheet. */
const INLINE = new Set<CardAction>([
  'claim',
  'decide',
  'deliver',
  'verify',
  'acknowledge',
  'apply',
  'approve',
]);

/** The URL's filters as the API's (09 §5 names `members`, 04 §3.9 `actors`). */
function useApiFilters(): Filters {
  const roles = useFilterList('roles');
  const types = useFilterList('types');
  const repo = useFilter('repos');
  const mod = useFilter('modules');
  const member = useFilter('members');
  const from = useFilter('from');
  const to = useFilter('to');
  const mine = useFilter('mine');
  return {
    ...(roles.length ? { roles } : {}),
    ...(types.length ? { types } : {}),
    ...(repo ? { repos: [repo] } : {}),
    ...(mod ? { modules: [mod] } : {}),
    ...(member ? { actors: [member] } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(mine ? { mine: true } : {}),
  };
}

export function TimelinePage() {
  const t = useT<TimelineMessages>(NS);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const route = useRoute();
  const { me, roles, isManager } = useSession();
  const run = useRunAction();
  const wide = useMedia('(min-width: 768px)');
  const rail = useMedia('(min-width: 1280px)');
  const since = useLastVisit();
  const stream = useTimeline(useApiFilters());
  const { rows, pending, fresh } = stream;
  useSeenWhileHere(fresh, !!since);
  const known = useCards();
  const activeFilters = useActiveFilters();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [said, setSaid] = useState('');
  const [spin, setSpin] = useState(false);
  const openFilters = useRef<(() => void) | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusAfterLoad = useRef<string | null>(null);

  const showNew = () => {
    void stream.showNew().then(() => setSaid(t.refreshed));
  };
  const refresh = () => {
    if (spin) return;
    setSpin(true);
    void stream.showNew().finally(() => setSpin(false));
  };

  // Deep link: the sheet opens over the timeline, positioned at the card's latest event (09 §5).
  const deepLink = useRef(route.cardKey);
  useEffect(() => {
    if (!deepLink.current || rows.length === 0) return;
    const target = rows.find((r) => r.card.key === deepLink.current);
    if (target)
      document.querySelector(`[data-row="${CSS.escape(target.id)}"]`)?.scrollIntoView({ block: 'center' });
    deepLink.current = null;
  }, [rows]);

  const newest = useMemo(() => newestOfCard(rows), [rows]);

  const inlineAction = (card: HubCard) => {
    const first = actionsFor(card, roles, me.id)[0];
    return first?.enabled && INLINE.has(first.action) ? first : undefined;
  };

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const keyed = (action: CardAction) => (id: string) => {
    const row = byId.get(id);
    if (row && inlineAction(row.card)?.action === action) run(row.card, action);
  };

  const list = useKeyboardList({
    ids: rows.map((r) => r.id),
    emptyFocusRef: heading,
    onOpen: (id) => {
      const row = byId.get(id);
      if (row) openCard(row.card.key);
    },
    actions: { c: keyed('claim'), a: keyed('acknowledge'), d: keyed('decide') },
  });

  useEffect(() => {
    if (focusAfterLoad.current && byId.has(focusAfterLoad.current)) {
      list.focusRow(focusAfterLoad.current);
      focusAfterLoad.current = null;
    }
  });

  const loadOlder = () => {
    const before = rows.length;
    void stream.loadOlder().then((done) => {
      const added = (done.data?.pages.flatMap((p) => p.items) ?? []).slice(before);
      const first = added[0];
      if (first) focusAfterLoad.current = first.event.id;
      setSaid(plural(added.length, locale, t.olderLoaded));
    });
  };

  // `r` shows new events and `f` goes to the filters (09 §5).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !shortcutsEnabled()) return;
      if (
        (e.target as HTMLElement).closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]',
        )
      )
        return;
      if (matchKey(e, 'r')) {
        e.preventDefault();
        refresh();
      } else if (matchKey(e, 'f')) {
        e.preventDefault();
        openFilters.current?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const days = useMemo(() => buildDays(rows, since ?? null, dayKey), [rows, since]);
  const railDays = useMemo(() => buildRail(rows, dayKey), [rows]);
  const maxDay = Math.max(1, ...railDays.map((d) => d.count));
  const todayKey = dayKey(nowMs());
  const yesterdayKey = dayKey(nowMs() - 86_400_000);
  const dayLabel = (key: string, iso: string) =>
    key === todayKey ? t.today : key === yesterdayKey ? t.yesterday : longDate(iso, locale);

  // Which day the reader is in, for the rail.
  const [currentDay, setCurrentDay] = useState<string | null>(null);
  useEffect(() => {
    if (!rail) return;
    const onScroll = () => {
      const sections = [...document.querySelectorAll<HTMLElement>('[data-day]')];
      const at = sections.filter((s) => s.getBoundingClientRect().top <= 140).pop() ?? sections[0];
      setCurrentDay(at?.dataset.day ?? null);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [rail, days.length]);

  const repos = useMemo(
    () =>
      [...new Set([...known, ...rows.map((r) => r.card)].flatMap((c) => (c.repo ? [c.repo] : [])))].sort(),
    [known, rows],
  );
  const modules = useMemo(
    () =>
      [
        ...new Set([...known, ...rows.map((r) => r.card)].flatMap((c) => (c.module ? [c.module] : []))),
      ].sort(),
    [known, rows],
  );

  const loading = stream.isPending;
  const empty = !loading && !stream.isError && rows.length === 0 && activeFilters === 0;
  const eventsInView = countEvents(rows);

  const header = (
    <PageHeader
      title={t.title}
      meta={
        loading ? (
          <Skeleton className="mt-1.5 h-4 w-40" />
        ) : stream.isError || empty ? undefined : stream.hasOlder ? (
          fmt(t.metaMore, { n: eventsInView })
        ) : (
          plural(eventsInView, locale, t.meta)
        )
      }
      actions={
        !loading && !stream.isError && !empty ? (
          <IconButton
            label={t.refresh}
            variant="outline"
            onClick={refresh}
            aria-keyshortcuts="r"
            aria-busy={spin}
          >
            <RefreshCw
              aria-hidden
              className={cn('size-4', spin && 'motion-safe:animate-spin')}
              strokeWidth={1.75}
            />
          </IconButton>
        ) : undefined
      }
    />
  );

  if (stream.isError) {
    const { error } = stream;
    return (
      <PageContainer>
        {header}
        <ErrorState
          thing={t.errorThing}
          code={isHubError(error) ? error.code : undefined}
          requestId={isHubError(error) ? error.requestId : undefined}
          onRetry={stream.retry}
        />
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer>
        {header}
        <LoadingRegion label={t.title}>
          <div className="flex gap-2">
            <Skeleton className="h-11 w-24 rounded-full md:h-8" />
            <Skeleton className="h-11 w-28 md:h-8" />
          </div>
          <div className="flex flex-col">
            <Skeleton className="mb-3 h-5 w-36" />
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 md:grid-cols-[3.25rem_1.25rem_minmax(0,1fr)]"
              >
                <Skeleton className="mt-4 hidden h-4 w-10 md:block" />
                <Spine>
                  <span className="relative mt-5 size-2.5 rounded-full bg-muted ring-4 ring-background" />
                </Spine>
                <div className="pb-2">
                  {i % 3 === 2 ? (
                    <Skeleton className="my-2 h-4 w-2/3" />
                  ) : (
                    <div className="rounded-lg border border-border bg-card px-4 py-3">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="mt-2 h-3 w-1/2" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </LoadingRegion>
      </PageContainer>
    );
  }

  if (empty) {
    return (
      <PageContainer>
        {header}
        <EmptyState
          size="page"
          icon={GitCommitHorizontal}
          title={t.empty.firstTitle}
          action={
            isManager ? (
              <AppLink
                view="settings"
                query={{ tab: 'sources' }}
                className={cn(
                  'inline-flex h-11 items-center rounded-md bg-primary px-4 text-body font-medium text-primary-foreground hover:bg-primary-hover md:h-9',
                  focusRing,
                )}
              >
                {t.empty.firstLink}
              </AppLink>
            ) : undefined
          }
        >
          {t.empty.firstBody}
        </EmptyState>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {header}
      <p role="status" className="sr-only">
        {said}
      </p>
      <TimelineFilters repos={repos} modules={modules} since={since} openRef={openFilters} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_10.5rem]">
        <div className="relative min-w-0">
          {/* 08 §5.2 `NewEventsPill`. Floats at the top of the stream, in the viewport, while there is anything to show. */}
          <div className="pointer-events-none sticky top-17 z-25 flex h-0 justify-center">
            {pending > 0 && (
              <button
                type="button"
                onClick={showNew}
                aria-keyshortcuts="r"
                className={cn(
                  'pointer-events-auto inline-flex h-11 items-center gap-1.5 rounded-full bg-foreground px-4 text-body-sm font-medium text-background shadow-md transition-colors md:h-9',
                  focusRing,
                )}
              >
                <ArrowUp aria-hidden className="size-4" strokeWidth={2} />
                {/* 08 §6: the pill's text is the page's one live region. */}
                <span aria-live="polite">{plural(pending, locale, t.newEvents)}</span>
              </button>
            )}
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={t.empty.noMatch}
              action={
                activeFilters ? (
                  <Button onClick={() => clearFilters(me.id)}>{t.filters.clear}</Button>
                ) : undefined
              }
            >
              {t.empty.noMatchBody}
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-4">
              {days.map((day, dayIndex) => (
                <section
                  key={day.key}
                  data-day={day.key}
                  id={`day-${day.key}`}
                  aria-labelledby={`day-title-${day.key}`}
                  className="scroll-mt-16"
                >
                  {/* Sticky under the app header, so the day is always on screen (09 §5). */}
                  <div className="sticky top-14 z-20 flex items-center gap-3 bg-background py-2">
                    <h2
                      ref={dayIndex === 0 ? heading : undefined}
                      id={`day-title-${day.key}`}
                      tabIndex={-1}
                      className="text-title-sm font-semibold text-foreground outline-none"
                    >
                      {dayLabel(day.key, day.iso)}
                    </h2>
                    {day.key === todayKey || day.key === yesterdayKey ? (
                      <span className="text-body-sm text-muted-foreground">{shortDate(day.iso, locale)}</span>
                    ) : null}
                    <span aria-hidden className="h-px flex-1 bg-border" />
                    <span className="text-body-sm text-muted-foreground">
                      {plural(day.count, locale, t.dayEvents)}
                    </span>
                  </div>
                  <ol data-hub-list className="flex flex-col">
                    {day.slots.map((slot) => {
                      if (slot.kind === 'gap') {
                        return (
                          <li
                            key={slot.id}
                            className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 md:grid-cols-[3.25rem_1.25rem_minmax(0,1fr)]"
                          >
                            <span className="hidden md:block" />
                            <Spine dashed />
                            <p
                              className={cn(
                                'px-3 text-body-sm text-muted-foreground',
                                slot.ms >= 6 * 3_600_000 ? 'py-4' : 'py-1.5',
                              )}
                            >
                              {fmt(t.quiet, { d: duration(slot.ms, locale) })}
                            </p>
                          </li>
                        );
                      }
                      if (slot.kind === 'tide') {
                        const words = fmt(t.tide, { when: whenLabel(since ?? '', locale) });
                        return (
                          <li
                            key={slot.id}
                            role="separator"
                            aria-label={words}
                            className="my-2 flex items-center gap-2"
                          >
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-(--tide-soft) px-2.5 py-1 text-body-sm font-medium text-(--tide)">
                              {words}
                            </span>
                            <span aria-hidden className="h-0.5 flex-1 rounded-full bg-(--tide)" />
                          </li>
                        );
                      }
                      const { row } = slot;
                      const isNew = newest.has(row.id);
                      const card = row.card;
                      const action = isNew ? inlineAction(card) : undefined;
                      const prompt =
                        card.type === 'task'
                          ? card.task.prompt
                          : card.type === 'handoff'
                            ? card.handoff.prompt
                            : undefined;
                      const closed = ['done', 'cancelled', 'applied', 'dismissed'].includes(card.status);
                      return (
                        <TimelineItem
                          key={row.id}
                          row={row}
                          wide={wide}
                          fresh={fresh.has(row.id)}
                          rowProps={list.rowProps(row.id)}
                          mine={isNew && !!card.awaiting}
                          expanded={expanded.has(row.id)}
                          onToggle={() =>
                            setExpanded((set) => {
                              const next = new Set(set);
                              if (next.has(row.id)) next.delete(row.id);
                              else next.add(row.id);
                              return next;
                            })
                          }
                          actions={
                            isNew ? (
                              <>
                                {action && (
                                  <Button
                                    size="sm"
                                    aria-describedby={`tl-${row.id}`}
                                    aria-keyshortcuts={
                                      action.action === 'claim'
                                        ? 'c'
                                        : action.action === 'acknowledge'
                                          ? 'a'
                                          : action.action === 'decide'
                                            ? 'd'
                                            : undefined
                                    }
                                    onClick={() => run(card, action.action)}
                                  >
                                    {kit.actions[action.action]}
                                  </Button>
                                )}
                                {prompt && !closed && (
                                  <CopyButton
                                    compact
                                    text={prompt.startsWith('/hub:') ? prompt : `/hub:next ${card.key}`}
                                    label={`${t.row.copyPrompt} ${card.key}`}
                                  />
                                )}
                                {card.type === 'change' && card.change.prUrl && (
                                  <a
                                    href={card.change.prUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={cn(
                                      'relative z-10 inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-body-sm font-medium text-foreground hover:bg-accent',
                                      focusRing,
                                    )}
                                  >
                                    {t.row.openPr}
                                    <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
                                  </a>
                                )}
                                {card.type === 'redesign' && (
                                  <a
                                    href={hrefFor('gallery', {
                                      card: null,
                                      query: versionQuery(card.redesign),
                                    })}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={cn(
                                      'relative z-10 inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-body-sm font-medium text-foreground hover:bg-accent',
                                      focusRing,
                                    )}
                                  >
                                    {t.row.openLab}
                                    <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
                                  </a>
                                )}
                              </>
                            ) : undefined
                          }
                        />
                      );
                    })}
                  </ol>
                </section>
              ))}
              {stream.hasOlder ? (
                <Button className="self-center" busy={stream.loadingOlder} onClick={loadOlder}>
                  {t.older}
                </Button>
              ) : (
                <p className="text-center text-body-sm text-muted-foreground">{t.start}</p>
              )}
            </div>
          )}
        </div>

        {/* Where the time went: one bar per day, and a way to get there. Only with room to spare (≥ 1280 px). */}
        {rail && railDays.length > 1 && (
          <nav aria-label={t.rail.label} className="sticky top-20 self-start">
            <ol className="flex flex-col gap-0.5">
              {railDays.map((day) => {
                const current = (currentDay ?? railDays[0]?.key) === day.key;
                return (
                  <li key={day.key}>
                    <a
                      href={`#day-${day.key}`}
                      aria-current={current ? 'location' : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(`day-${day.key}`)?.scrollIntoView();
                      }}
                      className={cn(
                        'block rounded-md px-2 py-1.5 text-body-sm transition-colors duration-120 hover:bg-accent',
                        current ? 'font-medium text-foreground' : 'text-muted-foreground',
                        focusRing,
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate">
                          {day.key === todayKey
                            ? t.today
                            : day.key === yesterdayKey
                              ? t.yesterday
                              : shortDate(day.iso, locale)}
                        </span>
                        <Ltr className="text-caption tabular-nums">{day.count}</Ltr>
                      </span>
                      <span aria-hidden className="mt-1 block h-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn(
                            'block h-full rounded-full',
                            current ? 'bg-foreground' : 'bg-(--heat-3)',
                          )}
                          style={{ inlineSize: `${Math.max(6, (day.count / maxDay) * 100)}%` }}
                        />
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
      </div>
    </PageContainer>
  );
}
