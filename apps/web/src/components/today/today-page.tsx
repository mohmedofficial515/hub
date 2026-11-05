'use client';

/**
 * @file today-page.tsx
 * @description My start page (docs/09 §4), on `GET /today`: two lanes, what I act on and what I read. The stack, Ready and the band read the same lists
 * the sidebar does, so a number and its rows cannot disagree, and the stream keeps all of it current.
 */
import { seesAllReadyWork } from '@hub/contracts';
import { Inbox, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  cn,
  ErrorState,
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
  useAwaiting,
  useLocale,
  useMedia,
  useMyCounts,
  useReadyTasks,
  useSession,
  useT,
} from '@/components/kit';
import { type CardSummaryDto, toListItem } from '@/features/cards/map';
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
  const rows = useAwaiting();
  const readyRows = useReadyTasks().data;
  const stackHeading = useRef<HTMLHeadingElement>(null);
  useSeenOnLeave(!!data);

  const wide = useMedia('(min-width: 768px)');
  const lanes = useMedia('(min-width: 1024px)');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(0);
  // Clamped on phones by default, so the first action is on the first screen (review B2).
  const [letterCollapsed, setLetterCollapsed] = useState(!wide);

  const stackDetail = useDetailed(data?.awaitingMe);
  const readyDetail = useDetailed(data?.readyTasks);
  const stack = useMemo(() => rows.map((row): StackCard => enrich(row, stackDetail)), [rows, stackDetail]);
  const ready = useMemo(
    () => (readyRows ?? []).map((row) => enrich(row, readyDetail)),
    [readyRows, readyDetail],
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
  const showReady = seesAllReadyWork(roles) || roles.some((r) => BUILDER_ROLES.includes(r));
  const overdue = stack.filter(isOverdue).length;

  // A refresh keeps the page where it is: the icon spins, the content stays (review M7, 08 §3.4).
  const refresh = () => {
    if (refreshing || query.isPending) return;
    setRefreshing(true);
    void query.refetch().finally(() => {
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
            <span className="hidden flex-col items-end text-body-sm text-muted-foreground sm:flex">
              <time dateTime={data.date}>{longDate(data.now, locale)}</time>
              <span>
                {fmt(t.updated, { when: '' })}
                <Ltr className="tabular-nums">
                  {time(new Date(query.dataUpdatedAt).toISOString(), locale)}
                </Ltr>
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

      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* Start lane, "Needs me": act on these. */}
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-7">
          <AwaitingStack stack={stack} headingRef={stackHeading} />
          <DeadlineRunway cards={deadlines} stackKeys={stackKeys} />
          {showReady && (
            <ReadyTasks tasks={ready} fillFirst={seesAllReadyWork(roles) && stack.length === 0} />
          )}
        </div>

        {/* End lane, "What happened": read these. One quiet reading column. */}
        <div
          className={cn(
            'flex min-w-0 flex-col gap-8',
            wide && 'gap-5 rounded-lg border border-border bg-card p-5',
            lanes && 'lg:col-span-5',
          )}
        >
          {wide && letter(false)}
          <div className={cn(wide && 'border-t border-border pt-5')}>
            <SessionsWithoutSummary sessions={data.noSummarySessions} />
          </div>
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
