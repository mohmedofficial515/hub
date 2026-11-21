import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, ExternalLink, GitCommitHorizontal, RefreshCw, SearchX } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { collapseStream, liveEvents, streamEvents, type StreamRow } from '@lab/mocks/hub-app/timeline';
import {
  actionsFor,
  AppLink,
  Button,
  cn,
  CopyButton,
  dayKey,
  duration,
  EmptyState,
  ErrorState,
  fill,
  fmt,
  focusRing,
  IconButton,
  kitMessages,
  LoadingRegion,
  longDate,
  Ltr,
  markTimelineSeen,
  matchKey,
  nowMs,
  openBlockers,
  openCard,
  PageContainer,
  PageHeader,
  plural,
  setQuery,
  shortDate,
  shortcutsEnabled,
  showToast,
  Skeleton,
  useAwaiting,
  useCards,
  useFilter,
  useFilterList,
  useKeyboardList,
  useMedia,
  usePerformAction,
  useRoute,
  useSession,
  when as whenLabel,
  type CardAction,
  type HubCard,
} from '../../kit';
import { messages } from './i18n';
import { clearFilters, TimelineFilters, useActiveFilters } from './parts/filters';
import { Spine, TimelineItem } from './parts/item';

const PAGE = 24;
/** Anything shorter reads as normal rhythm. A longer pause gets a label on the spine, so distance reads as time. */
const QUIET_AFTER_MS = 3 * 3_600_000;
/** Actions a row offers in place (08 §5.2). Everything else lives in the sheet. */
const INLINE = new Set<CardAction>(['claim', 'decide', 'deliver', 'verify', 'acknowledge', 'apply', 'approve']);

export default function Page() {
  const { scenario } = useSession();
  return <TimelinePage key={scenario} />;
}

function TimelinePage() {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const route = useRoute();
  const { scenario, today, me, roles, isManager, loading, error } = useSession();
  const all = useCards();
  const stack = useAwaiting();
  const perform = usePerformAction();
  const wide = useMedia('(min-width: 768px)');
  const rail = useMedia('(min-width: 1280px)');
  const empty = scenario === 'empty';

  const cards = useMemo(() => (empty ? [] : all), [all, empty]);

  // 09 §5 live rule. The mock has three events arrive just after the page opens, and one more later.
  const liveOff = route.query.get('live') === 'off';
  const [available, setAvailable] = useState(0);
  const [shownLive, setShownLive] = useState(0);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [said, setSaid] = useState('');
  const [spin, setSpin] = useState(false);
  const openFilters = useRef<(() => void) | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusAfterLoad = useRef<string | null>(null);

  const showLive = (upTo: number) => {
    const added = liveEvents.slice(shownLive, upTo).map((e) => e.event.id);
    setShownLive(upTo);
    setFresh(new Set(added));
    window.scrollTo({ top: 0 });
    setSaid(t.refreshed);
  };

  useEffect(() => {
    if (empty || loading || error || liveOff) return;
    const first = window.setTimeout(() => setAvailable(3), 1_200);
    const id = window.setTimeout(() => {
      setAvailable(4);
      // At the top of the list it prepends by itself; scrolled down it only adds to the pill.
      if (window.scrollY < 40) setShownLive((n) => (n === 3 ? 4 : n));
    }, 20_000);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(id);
    };
  }, [empty, loading, error, liveOff]);

  // A visit clears the one "since last visit" count (08 §2). The pill below is separate: what arrived while here.
  useEffect(() => {
    if (!loading && !error) markTimelineSeen();
  }, [loading, error]);

  const refresh = () => {
    if (spin) return;
    setSpin(true);
    window.setTimeout(() => setSpin(false), 500);
    if (available > shownLive) showLive(available);
  };

  // Filters (09 §5). `roles` filters `card.ownerRole`, `members` the actor or assignee.
  const fRoles = useFilterList('roles');
  const fTypes = useFilterList('types');
  const fRepo = useFilter('repos');
  const fModule = useFilter('modules');
  const fMember = useFilter('members');
  const fFrom = useFilter('from');
  const fTo = useFilter('to');
  const awaiting = useFilter('awaiting') === 'me';
  const activeFilters = useActiveFilters();
  const awaitingKeys = useMemo(() => new Set(stack.map((c) => c.key)), [stack]);

  const filter = (card: HubCard, at: string, actorId?: string) => {
    if (fRoles.length && !(card.ownerRole && fRoles.includes(card.ownerRole))) return false;
    if (fTypes.length && !fTypes.includes(card.type)) return false;
    if (fRepo && card.repo !== fRepo) return false;
    if (fModule && card.module !== fModule) return false;
    if (fMember && actorId !== fMember && card.assigneeId !== fMember && !(card.type === 'change' && card.change.authorUserId === fMember)) return false;
    if (fFrom && Date.parse(at) < Date.parse(fFrom)) return false;
    if (fTo && Date.parse(at) > Date.parse(fTo)) return false;
    if (awaiting && !awaitingKeys.has(card.key)) return false;
    return true;
  };

  const allRows = useMemo(() => {
    const events = streamEvents(cards, liveOff ? [] : liveEvents.slice(0, shownLive)).filter((e) => filter(e.card, e.event.at, e.event.actorId));
    return collapseStream(events);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, shownLive, liveOff, fRoles.join(), fTypes.join(), fRepo, fModule, fMember, fFrom, fTo, awaiting, awaitingKeys]);

  const pending = liveOff ? 0 : liveEvents.slice(shownLive, available).filter((e) => {
    const card = cards.find((c) => c.key === e.cardKey);
    return card && filter(card, e.event.at, e.event.actorId);
  }).length;

  // Deep link: the sheet opens over the timeline, positioned at the card's latest event (09 §5).
  const deepLink = useRef(route.cardKey);
  const deepIndex = deepLink.current ? allRows.findIndex((r) => r.card.key === deepLink.current) : -1;
  const shown = allRows.slice(0, Math.max(limit, deepIndex + 1));
  useEffect(() => {
    if (!deepLink.current) return;
    document.querySelector(`[data-row="${CSS.escape(allRows[deepIndex]?.id ?? '')}"]`)?.scrollIntoView({ block: 'center' });
    deepLink.current = null;
    // Runs once, after the rows exist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Only the newest row of a card offers its actions; older rows are history. */
  const newestOf = useMemo(() => {
    const seen = new Set<string>();
    const out = new Set<string>();
    for (const row of allRows) {
      if (!seen.has(row.card.key)) out.add(row.id);
      seen.add(row.card.key);
    }
    return out;
  }, [allRows]);

  const inlineAction = (card: HubCard) => {
    const first = actionsFor(card, roles, me.id)[0];
    return first?.enabled && INLINE.has(first.action) ? first : undefined;
  };

  const run = (card: HubCard, action: CardAction) => {
    const mode = actionsFor(card, roles, me.id).find((a) => a.action === action)?.mode;
    if (mode === 'now') perform(card.key, action);
    else openCard(card.key, { action });
  };

  const byId = useMemo(() => new Map(allRows.map((r) => [r.id, r])), [allRows]);
  const keyed = (action: CardAction) => (id: string) => {
    const row = byId.get(id);
    if (!row) return;
    if (inlineAction(row.card)?.action === action) return run(row.card, action);
    // `c` on a blocked task answers instead of doing nothing, as Today does.
    const blocker = action === 'claim' && row.card.type === 'task' ? openBlockers(row.card)[0] : undefined;
    if (blocker) showToast({ tone: 'error', message: fill(kit.toast.blocked, { key: <Ltr mono>{row.card.key}</Ltr>, blocker: <Ltr mono>{blocker}</Ltr> }) });
  };

  const list = useKeyboardList({
    ids: shown.map((r) => r.id),
    emptyFocusRef: heading,
    onOpen: (id) => {
      const row = byId.get(id);
      if (row) openCard(row.card.key);
    },
    actions: { c: keyed('claim'), a: keyed('acknowledge'), d: keyed('decide') },
  });

  useEffect(() => {
    if (focusAfterLoad.current) {
      list.focusRow(focusAfterLoad.current);
      focusAfterLoad.current = null;
    }
  });

  const loadOlder = () => {
    setLoadingOlder(true);
    const next = allRows[limit]?.id ?? null;
    window.setTimeout(() => {
      const added = Math.min(PAGE, allRows.length - limit);
      focusAfterLoad.current = next;
      setLimit((n) => n + PAGE);
      setLoadingOlder(false);
      setSaid(plural(added, locale, t.olderLoaded));
    }, 350);
  };

  // `r` shows new events and `f` goes to the filters (09 §5).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !shortcutsEnabled()) return;
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
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

  // Days, with the pauses and the tide line in their place between rows.
  type Slot = { kind: 'row'; row: StreamRow } | { kind: 'gap'; id: string; ms: number } | { kind: 'tide'; id: string };
  const days = useMemo(() => {
    const out: { key: string; iso: string; slots: Slot[]; count: number }[] = [];
    let tideDone = !shown.some((r) => Date.parse(r.event.at) < Date.parse(today.lastSeenAt)) || Date.parse(shown[0]?.event.at ?? '0') < Date.parse(today.lastSeenAt);
    let previous: StreamRow | null = null;
    for (const row of shown) {
      const key = dayKey(row.event.at);
      let day = out[out.length - 1];
      if (!day || day.key !== key) {
        day = { key, iso: row.event.at, slots: [], count: 0 };
        out.push(day);
        previous = null;
      }
      if (!tideDone && Date.parse(row.event.at) < Date.parse(today.lastSeenAt)) {
        day.slots.push({ kind: 'tide', id: 'tide' });
        tideDone = true;
      } else if (previous) {
        const edge = previous.collapsed[previous.collapsed.length - 1]?.at ?? previous.event.at;
        const ms = Date.parse(edge) - Date.parse(row.event.at);
        if (ms >= QUIET_AFTER_MS) day.slots.push({ kind: 'gap', id: `gap-${row.id}`, ms });
      }
      day.slots.push({ kind: 'row', row });
      day.count += 1 + row.collapsed.length;
      previous = row;
    }
    return out;
  }, [shown, today.lastSeenAt]);

  const dayLabel = (key: string, iso: string) => (key === dayKey(nowMs()) ? t.today : key === dayKey(nowMs() - 86_400_000) ? t.yesterday : longDate(iso, locale));

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

  const eventsInView = allRows.reduce((sum, r) => sum + 1 + r.collapsed.length, 0);
  const railDays = useMemo(() => {
    const out: { key: string; iso: string; count: number; firstIndex: number }[] = [];
    allRows.forEach((row, index) => {
      const key = dayKey(row.event.at);
      const last = out[out.length - 1];
      if (last?.key === key) last.count += 1 + row.collapsed.length;
      else out.push({ key, iso: row.event.at, count: 1 + row.collapsed.length, firstIndex: index });
    });
    return out;
  }, [allRows]);
  const maxDay = Math.max(1, ...railDays.map((d) => d.count));
  const jumpTo = useRef<string | null>(null);
  useEffect(() => {
    if (!jumpTo.current) return;
    document.getElementById(`day-${jumpTo.current}`)?.scrollIntoView();
    jumpTo.current = null;
  });

  const header = (
    <PageHeader
      title={t.title}
      meta={loading ? <Skeleton className="mt-1.5 h-4 w-40" /> : error || empty ? undefined : plural(eventsInView, locale, t.meta)}
      actions={
        !loading && !error && !empty ? (
          <IconButton label={t.refresh} variant="outline" onClick={refresh} aria-keyshortcuts="r" aria-busy={spin}>
            <RefreshCw aria-hidden className={cn('size-4', spin && 'motion-safe:animate-spin')} strokeWidth={1.75} />
          </IconButton>
        ) : undefined
      }
    />
  );

  if (error) {
    return (
      <PageContainer>
        {header}
        <ErrorState thing={t.errorThing} code="hub.timeline.unavailable" requestId="req_a904d1c" onRetry={() => setQuery({ scenario: null })} />
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
              <div key={i} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 md:grid-cols-[3.25rem_1.25rem_minmax(0,1fr)]">
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
              <AppLink view="settings" query={{ tab: 'sources' }} className={cn('inline-flex h-11 items-center rounded-md bg-primary px-4 text-body font-medium text-primary-foreground hover:bg-primary-hover md:h-9', focusRing)}>
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
      <TimelineFilters cards={cards} openRef={openFilters} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_10.5rem]">
        <div className="relative min-w-0">
          {/* 08 §5.2 `NewEventsPill`. Floats at the top of the stream, in the viewport, while there is anything to show. */}
          <div className="pointer-events-none sticky top-17 z-25 flex h-0 justify-center">
            {pending > 0 && (
              <button
                type="button"
                onClick={() => showLive(available)}
                aria-keyshortcuts="r"
                className={cn('pointer-events-auto inline-flex h-11 items-center gap-1.5 rounded-full bg-foreground px-4 text-body-sm font-medium text-background shadow-md transition-colors md:h-9', focusRing)}
              >
                <ArrowUp aria-hidden className="size-4" strokeWidth={2} />
                {/* 08 §6: the pill's text is the page's one live region. */}
                <span aria-live="polite">{plural(pending, locale, t.newEvents)}</span>
              </button>
            )}
          </div>

          {allRows.length === 0 ? (
            <EmptyState icon={SearchX} title={t.empty.noMatch} action={activeFilters ? <Button onClick={() => clearFilters(me.id)}>{t.filters.clear}</Button> : undefined}>
              {t.empty.noMatchBody}
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-4">
              {days.map((day, dayIndex) => (
                <section key={day.key} data-day={day.key} id={`day-${day.key}`} aria-labelledby={`day-title-${day.key}`} className="scroll-mt-16">
                  {/* Sticky under the app header, so the day is always on screen (09 §5). */}
                  <div className="sticky top-14 z-20 flex items-center gap-3 bg-background py-2">
                    <h2 ref={dayIndex === 0 ? heading : undefined} id={`day-title-${day.key}`} tabIndex={-1} className="text-title-sm font-semibold text-foreground outline-none">
                      {dayLabel(day.key, day.iso)}
                    </h2>
                    {day.key === dayKey(nowMs()) || day.key === dayKey(nowMs() - 86_400_000) ? <span className="text-body-sm text-muted-foreground">{shortDate(day.iso, locale)}</span> : null}
                    <span aria-hidden className="h-px flex-1 bg-border" />
                    <span className="text-body-sm text-muted-foreground">{plural(day.count, locale, t.dayEvents)}</span>
                  </div>
                  <ol data-hub-list className="flex flex-col">
                    {day.slots.map((slot) => {
                      if (slot.kind === 'gap') {
                        return (
                          <li key={slot.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 md:grid-cols-[3.25rem_1.25rem_minmax(0,1fr)]">
                            <span className="hidden md:block" />
                            <Spine dashed />
                            <p className={cn('px-3 text-body-sm text-muted-foreground', slot.ms >= 6 * 3_600_000 ? 'py-4' : 'py-1.5')}>{fmt(t.quiet, { d: duration(slot.ms, locale) })}</p>
                          </li>
                        );
                      }
                      if (slot.kind === 'tide') {
                        return (
                          <li key={slot.id} role="separator" aria-label={fmt(t.tide, { when: whenLabel(today.lastSeenAt, locale) })} className="my-2 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-(--tide-soft) px-2.5 py-1 text-body-sm font-medium text-(--tide)">{fmt(t.tide, { when: whenLabel(today.lastSeenAt, locale) })}</span>
                            <span aria-hidden className="h-0.5 flex-1 rounded-full bg-(--tide)" />
                          </li>
                        );
                      }
                      const { row } = slot;
                      const isNew = newestOf.has(row.id);
                      const action = isNew ? inlineAction(row.card) : undefined;
                      const card = row.card;
                      const prompt = card.type === 'task' ? card.task.prompt : card.type === 'handoff' ? card.handoff.prompt : undefined;
                      const closed = ['done', 'cancelled', 'applied', 'dismissed'].includes(card.status);
                      return (
                        <TimelineItem
                          key={row.id}
                          row={row}
                          wide={wide}
                          fresh={fresh.has(row.id)}
                          rowProps={list.rowProps(row.id)}
                          mine={isNew && awaitingKeys.has(card.key)}
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
                                  <Button size="sm" aria-describedby={`tl-${row.id}`} aria-keyshortcuts={action.action === 'claim' ? 'c' : action.action === 'acknowledge' ? 'a' : action.action === 'decide' ? 'd' : undefined} onClick={() => run(card, action.action)}>
                                    {kit.actions[action.action]}
                                  </Button>
                                )}
                                {prompt && !closed && <CopyButton compact text={prompt.startsWith('/hub:') ? prompt : `/hub:next ${card.key}`} label={`${t.row.copyPrompt} ${card.key}`} />}
                                {card.type === 'change' && card.change.prUrl && (
                                  <a href={card.change.prUrl} target="_blank" rel="noreferrer" className={cn('relative z-10 inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-body-sm font-medium text-foreground hover:bg-accent', focusRing)}>
                                    {t.row.openPr}
                                    <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
                                  </a>
                                )}
                                {card.type === 'redesign' && (
                                  <a href={card.redesign.labUrl} target="_blank" rel="noreferrer" className={cn('relative z-10 inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-body-sm font-medium text-foreground hover:bg-accent', focusRing)}>
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
              {allRows.length > shown.length ? (
                <Button className="self-center" busy={loadingOlder} onClick={loadOlder}>
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
                const current = (currentDay ?? railDays[0].key) === day.key;
                return (
                  <li key={day.key}>
                    <a
                      href={`#day-${day.key}`}
                      aria-current={current ? 'location' : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        // A day not loaded yet loads first, then the page moves there.
                        if (day.firstIndex >= limit) {
                          jumpTo.current = day.key;
                          setLimit(day.firstIndex + PAGE);
                        } else {
                          document.getElementById(`day-${day.key}`)?.scrollIntoView();
                        }
                      }}
                      className={cn('block rounded-md px-2 py-1.5 text-body-sm transition-colors duration-120 hover:bg-accent', current ? 'font-medium text-foreground' : 'text-muted-foreground', focusRing)}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate">{day.key === dayKey(nowMs()) ? t.today : day.key === dayKey(nowMs() - 86_400_000) ? t.yesterday : shortDate(day.iso, locale)}</span>
                        <Ltr className="text-caption tabular-nums">{day.count}</Ltr>
                      </span>
                      <span aria-hidden className="mt-1 block h-1 overflow-hidden rounded-full bg-muted">
                        <span className={cn('block h-full rounded-full', current ? 'bg-foreground' : 'bg-(--heat-3)')} style={{ inlineSize: `${Math.max(6, (day.count / maxDay) * 100)}%` }} />
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
