'use client';

/**
 * @file today-page.tsx
 * @description My start page (docs/09 §4), on `GET /today`: two lanes, what I act on and what I read. The stack, Ready and the band read the same lists
 * the sidebar does, so a number and its rows cannot disagree, and the stream keeps all of it current.
 */
import { seesAllReadyWork } from '@hub/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { Inbox, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  cn,
  ErrorState,
  fill,
  firstName,
  fmt,
  IconButton,
  isOverdue,
  longDate,
  Ltr,
  matchKey,
  nowMs,
  PageContainer,
  PageHeader,
  plural,
  type Role,
  shortcutsEnabled,
  Skeleton,
  time,
  TZ,
  useLocale,
  useMyCounts,
  usePageWide,
  useReadyTasks,
  useRoute,
  useSession,
  useT,
} from '@/components/kit';
import { PageDoNext } from '@/components/workbench/panels';
import { qk } from '@/features/cards/keys';
import { type CardSummaryDto, toListItem } from '@/features/cards/map';
import { buildAwaiting, useAwaitingQuery } from '@/features/session/session';
import { byPriority } from '@/features/tasks/model';
import { toStreamRow } from '@/features/timeline/use-timeline';
import { enrich, useDetailed, useSeenOnLeave, useTodayQuery } from '@/features/today/use-today';
import { isHubError } from '@/lib/api/errors';

import { AwaitingStack, type StackCard } from './awaiting';
import { CountersBand, type CounterTile } from './counters';
import { MorningLetter } from './letter';
import { LoadingView } from './loading';
import { NS, type TodayMessages } from './messages';
import { ReadyTasks } from './ready';
import { DeadlineRunway } from './runway';
import { SessionsWithoutSummary } from './sessions';
import { SinceLastVisit } from './since';
import { CaptureSources } from './sources';
import { TeamWeek } from './team';

/** Roles a ready-task specialty maps to (09 §4: backend, frontend, designer, qa; ops and docs go to pm or backend). */
const BUILDER_ROLES: Role[] = ['backend', 'frontend', 'designer', 'qa', 'pm'];

const hourNow = () =>
  Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: TZ }).format(nowMs()),
  );

/** A real clock means the greeting has to follow the time of day. */
const greetingOf = (t: TodayMessages['greeting']) => {
  const hour = hourNow();
  return hour < 12 ? t.morning : hour < 18 ? t.afternoon : t.evening;
};

export function TodayPage() {
  const t = useT<TodayMessages>(NS);
  const locale = useLocale();
  const { me, roles, isOwner } = useSession();
  const query = useTodayQuery();
  const data = query.data;
  const counts = useMyCounts();
  const { ws } = useRoute();
  const client = useQueryClient();
  const awaitingQuery = useAwaitingQuery();
  const readyQuery = useReadyTasks();
  // The lists win while they answer, since writes patch them at once; until then (or when one fails) `/today` carries the same rows.
  const rows = useMemo(
    () =>
      buildAwaiting(
        awaitingQuery.data ??
          (data?.awaitingMe ?? []).map((dto) => toListItem(dto as unknown as CardSummaryDto)),
      ),
    [awaitingQuery.data, data?.awaitingMe],
  );
  const readyRows = useMemo(
    () =>
      readyQuery.data ?? (data?.readyTasks ?? []).map((dto) => toListItem(dto as unknown as CardSummaryDto)),
    [readyQuery.data, data?.readyTasks],
  );
  const stackHeading = useRef<HTMLHeadingElement>(null);
  useSeenOnLeave(!!data);

  const wide = usePageWide(768);
  const lanes = usePageWide(1024);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(0);
  // Clamped on phones by default, so the first action is on the first screen (review B2).
  const [letterCollapsed, setLetterCollapsed] = useState(!wide);

  const stackDetail = useDetailed(data?.awaitingMe);
  const readyDetail = useDetailed(data?.readyTasks);
  const stack = useMemo(() => rows.map((row): StackCard => enrich(row, stackDetail)), [rows, stackDetail]);
  const ready = useMemo(
    // The Tasks list's own order, so that the first row here is the first ready row there (review R9).
    () =>
      readyRows
        .map((row) => enrich(row, readyDetail))
        .sort(byPriority(me.id, roles) as (a: { key: string }, b: { key: string }) => number),
    [readyRows, readyDetail, me.id, roles],
  );
  const deadlines = useMemo(
    () => (data?.deadlines ?? []).map((dto) => toListItem(dto as unknown as CardSummaryDto)),
    [data?.deadlines],
  );
  const since = useMemo(
    () => (data?.changesSince.events ?? []).map(toStreamRow),
    [data?.changesSince.events],
  );
  const stackKeys = useMemo(() => new Set(stack.map((c) => c.key)), [stack]);
  // The three lists never repeat a card (owner decision 4): Do next leaves out the stack, Ready leaves out Do next.
  const [nextKeys, setNextKeys] = useState<ReadonlySet<string>>(() => new Set());
  const onNextShown = useCallback((keys: readonly string[]) => setNextKeys(new Set(keys)), []);
  const readyRest = useMemo(() => ready.filter((task) => !nextKeys.has(task.key)), [ready, nextKeys]);
  const showReady = seesAllReadyWork(roles) || roles.some((r) => BUILDER_ROLES.includes(r));
  const overdue = stack.filter(isOverdue).length;

  // A refresh keeps the page where it is: the icon spins, the content stays (review M7, 08 §3.4).
  const refresh = () => {
    if (refreshing || query.isPending) return;
    setRefreshing(true);
    // Everything the page reads, not only `/today`: the stack, Ready, the band, the inbox count and Do next (under the today key).
    void Promise.all([
      client.invalidateQueries({ queryKey: qk.today(ws) }),
      client.invalidateQueries({ queryKey: qk.cardList(ws, { awaiting: 'me' }) }),
      client.invalidateQueries({ queryKey: qk.cardList(ws, { ready: true }) }),
      client.invalidateQueries({ queryKey: qk.counters(ws) }),
      client.invalidateQueries({ queryKey: [...qk.inbox(ws), 'count'] }),
    ]).finally(() => {
      setRefreshing(false);
      setRefreshed((n) => n + 1);
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!matchKey(e, 'r') || e.metaKey || e.ctrlKey || e.altKey || !shortcutsEnabled()) return;
      if (
        (e.target as HTMLElement).closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]',
        )
      )
        return;
      e.preventDefault();
      refresh();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const tiles: CounterTile[] = [
    { key: 'inbox', value: counts.inbox, view: 'inbox', icon: Inbox },
    {
      key: 'decisions',
      value: counts.decisions.mine,
      all: counts.decisions.all,
      overdue: counts.decisions.overdue,
      view: 'decisions',
      query: { awaiting: 'me' },
      type: 'decision',
    },
    {
      key: 'needs',
      value: counts.needs.mine,
      all: counts.needs.all,
      view: 'needs',
      query: { awaiting: 'me' },
      type: 'need',
    },
    {
      key: 'handoffs',
      value: counts.handoffs.mine,
      all: counts.handoffs.all,
      view: 'handoffs',
      query: { awaiting: 'me' },
      type: 'handoff',
    },
    ...(isOwner
      ? [
          {
            key: 'redesigns',
            value: counts.redesigns.all,
            view: 'redesign',
            query: { status: 'review' },
            type: 'redesign',
          } satisfies CounterTile,
        ]
      : []),
  ];

  const summary =
    stack.length === 0
      ? plural(0, locale, t.greeting.summary)
      : plural(stack.length, locale, t.greeting.summary) + plural(overdue, locale, t.greeting.overdue);

  const loading = query.isPending;
  const failed = query.isError && !data;

  const header = (
    <PageHeader
      title={fmt(greetingOf(t.greeting), { name: firstName(me.name) ?? '' })}
      meta={loading ? <Skeleton className="mt-1.5 h-4 w-56 max-w-full" /> : failed ? undefined : summary}
      actions={
        <>
          {data && (
            <span className="hidden flex-col items-end text-body-sm text-muted-foreground sm:@page-sm:flex">
              <time dateTime={data.date}>{longDate(data.now, locale)}</time>
              <span>
                {fill(t.updated, {
                  when: (
                    <Ltr className="tabular-nums">
                      {time(new Date(query.dataUpdatedAt).toISOString(), locale)}
                    </Ltr>
                  ),
                })}
              </span>
            </span>
          )}
          <IconButton
            label={t.refresh}
            variant="outline"
            onClick={refresh}
            disabled={refreshing || loading}
            aria-busy={refreshing}
            aria-keyshortcuts="r"
          >
            <RefreshCw
              aria-hidden
              className={cn('size-4', refreshing && 'motion-safe:animate-spin')}
              strokeWidth={1.75}
            />
          </IconButton>
        </>
      }
    />
  );

  if (failed) {
    const error = query.error;
    return (
      <PageContainer>
        {header}
        <ErrorState
          thing={t.errorThing}
          code={isHubError(error) ? error.code : undefined}
          requestId={isHubError(error) ? error.requestId : undefined}
          onRetry={() => void query.refetch()}
        />
      </PageContainer>
    );
  }

  if (!data) {
    return (
      <PageContainer>
        {header}
        <LoadingView />
      </PageContainer>
    );
  }

  const { brief } = data;
  const letter = (framed: boolean) => (
    <MorningLetter
      narrative={
        brief.narrative ? { markdown: brief.narrative, at: brief.narrativeAt, date: data.date } : null
      }
      collapsed={letterCollapsed}
      onToggle={() => setLetterCollapsed((v) => !v)}
      framed={framed}
    />
  );

  return (
    <PageContainer>
      {header}
      <p role="status" className="sr-only">
        {refreshed > 0 && !refreshing ? t.refreshed : ''}
      </p>

      {/* Tablet and up: the band sits under the title. Phone: it moves below the lanes, so nothing delays the stack. */}
      {wide && <CountersBand tiles={tiles} />}

      {/* Phone order (09 §4): the letter first, clamped. From 768 px it sits atop the reading lane. */}
      {!wide && letter(true)}

      {/* Two lanes only where the end lane gets its five columns too (`lanes`, 1024 px of page): between the CSS step and that,
          the end lane fell to one column of twelve beside the panel, a word per line. */}
      <div className={cn('grid gap-8', lanes && 'lg:@page-lg:grid-cols-12 lg:@page-lg:items-start')}>
        {/* Start lane, "Needs me": act on these. */}
        <div className={cn('flex min-w-0 flex-col gap-8', lanes && 'lg:@page-lg:col-span-7')}>
          <AwaitingStack stack={stack} headingRef={stackHeading} />
          <DeadlineRunway cards={deadlines} stackKeys={stackKeys} />
          {/* Do next (docs/16 §11): the panel's own list, ranked by the server, with Run now and Schedule. */}
          <PageDoNext limit={5} exclude={stackKeys} subtitle={t.next.subtitle} onShown={onNextShown} />
          {showReady && (
            <ReadyTasks
              tasks={readyRest}
              inNext={ready.length - readyRest.length}
              fillFirst={seesAllReadyWork(roles) && stack.length === 0}
            />
          )}
        </div>

        {/* End lane, "What happened": read these. One quiet reading column. */}
        <div
          className={cn(
            'flex min-w-0 flex-col gap-8',
            wide && 'gap-5 rounded-lg border border-border bg-card p-5',
            lanes && 'lg:@page-lg:col-span-5',
          )}
        >
          {wide && letter(false)}
          {/* Only when there is one to write: "all your sessions have a summary" asks nothing of me (flow-13). */}
          {data.noSummarySessions.length > 0 && (
            <div className={cn(wide && 'border-t border-border pt-5')}>
              <SessionsWithoutSummary sessions={data.noSummarySessions} />
            </div>
          )}
          <div className={cn(wide && 'border-t border-border pt-5')}>
            <SinceLastVisit
              since={data.changesSince.since}
              rows={since}
              total={counts.newEvents || data.changesSince.total}
            />
          </div>
        </div>
      </div>

      {!wide && <CountersBand tiles={tiles} />}

      <div className="border-t border-border pt-6">
        <TeamWeek team={data.team} />
      </div>
      <CaptureSources sources={data.sources} />
    </PageContainer>
  );
}
