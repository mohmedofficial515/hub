import { useEffect, useMemo, useRef, useState } from 'react';
import { Inbox, RefreshCw } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { NOW, type Role } from '@lab/mocks/hub-today';
import {
  cardsActedWith,
  cn,
  ErrorState,
  firstName,
  fmt,
  IconButton,
  isOverdue,
  longDate,
  Ltr,
  matchKey,
  PageContainer,
  PageHeader,
  plural,
  setQuery,
  shortcutsEnabled,
  Skeleton,
  time,
  useAdmin,
  useAwaiting,
  useCardStoreVersion,
  useClearedCount,
  useDeadlines,
  useMedia,
  useMyCounts,
  useReadyTasks,
  useSession,
} from '../../kit';
import { messages } from './i18n';
import { AwaitingStack } from './parts/awaiting';
import { CountersBand, type CounterTile } from './parts/counters';
import { MorningLetter } from './parts/letter';
import { LoadingView } from './parts/loading';
import { ReadyTasks } from './parts/ready';
import { DeadlineRunway } from './parts/runway';
import { SessionsWithoutSummary } from './parts/sessions';
import { SinceLastVisit } from './parts/since';
import { CaptureSources } from './parts/sources';
import { TeamWeek } from './parts/team';

/** Roles a ready-task specialty maps to (09 §4: backend, frontend, designer, qa; ops and docs go to pm or backend). */
const BUILDER_ROLES: Role[] = ['backend', 'frontend', 'designer', 'qa', 'pm'];

export default function Page() {
  const { scenario } = useSession();
  // A new scenario starts from fresh state.
  return <Today key={scenario} />;
}

function Today() {
  const t = useT(messages);
  const locale = useLocale();
  const session = useSession();
  const { today: data, me, roles, isOwner, loading, error } = session;
  const counts = useMyCounts();
  const stack = useAwaiting();
  const deadlines = useDeadlines();
  useCardStoreVersion();
  const stackHeading = useRef<HTMLHeadingElement>(null);

  const wide = useMedia('(min-width: 768px)');
  const lanes = useMedia('(min-width: 1024px)');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(0);
  // Clamped on phones by default, so the first action is on the first screen (review B2).
  const [letterCollapsed, setLetterCollapsed] = useState(!wide);

  const ready = useReadyTasks();
  const cleared = useClearedCount();
  const { sources } = useAdmin(session.scenario);
  const stackKeys = useMemo(() => new Set(stack.map((c) => c.key)), [stack]);
  const claimed = cardsActedWith('claim').find((c) => c.assigneeId === me.id);
  const myFocus = claimed ? { key: claimed.key, title: claimed.title[locale] } : null;
  const showReady = roles.some((r) => BUILDER_ROLES.includes(r));
  const overdue = stack.filter(isOverdue).length;

  // A refresh keeps the page where it is: the icon spins, the content stays (review M7, 08 §3.4).
  const refresh = () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    window.setTimeout(() => {
      setRefreshing(false);
      setRefreshed((n) => n + 1);
    }, 900);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!matchKey(e, 'r') || e.metaKey || e.ctrlKey || e.altKey || !shortcutsEnabled()) return;
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
      e.preventDefault();
      refresh();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const tiles: CounterTile[] = [
    { key: 'inbox', value: counts.inbox, view: 'inbox', icon: Inbox },
    { key: 'decisions', value: counts.decisions.mine, all: counts.decisions.all, overdue: counts.decisions.overdue, view: 'decisions', query: { awaiting: 'me' }, type: 'decision' },
    { key: 'needs', value: counts.needs.mine, all: counts.needs.all, view: 'needs', query: { awaiting: 'me' }, type: 'need' },
    { key: 'handoffs', value: counts.handoffs.mine, all: counts.handoffs.all, view: 'handoffs', query: { awaiting: 'me' }, type: 'handoff' },
    ...(isOwner ? [{ key: 'redesigns', value: counts.redesigns.all, view: 'redesign', query: { status: 'review' }, type: 'redesign' } satisfies CounterTile] : []),
  ];

  const summary = stack.length === 0 ? plural(0, locale, t.greeting.summary) : plural(stack.length, locale, t.greeting.summary) + plural(overdue, locale, t.greeting.overdue);

  const title = fmt(t.greeting.morning, { name: firstName(me.name[locale]) });

  const header = (
    <PageHeader
      title={title}
      meta={loading ? <Skeleton className="mt-1.5 h-4 w-56 max-w-full" /> : error ? undefined : summary}
      actions={
        <>
          {!loading && !error && (
            <span className="hidden flex-col items-end text-body-sm text-muted-foreground sm:flex">
              <time dateTime={NOW.slice(0, 10)}>{longDate(NOW, locale)}</time>
              <span>
                {fmt(t.updated, { when: '' })}
                <Ltr className="tabular-nums">{time(NOW, locale)}</Ltr>
              </span>
            </span>
          )}
          <IconButton label={t.refresh} variant="outline" onClick={refresh} disabled={refreshing || loading} aria-busy={refreshing} aria-keyshortcuts="r">
            <RefreshCw aria-hidden className={cn('size-4', refreshing && 'motion-safe:animate-spin')} strokeWidth={1.75} />
          </IconButton>
        </>
      }
    />
  );

  if (error) {
    return (
      <PageContainer>
        {header}
        <ErrorState thing={t.errorThing} code="hub.today.unavailable" requestId="req_7f3ac21" onRetry={() => setQuery({ scenario: null })} />
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer>
        {header}
        <LoadingView />
      </PageContainer>
    );
  }

  const letter = (framed: boolean) => <MorningLetter narrative={data.narrative} collapsed={letterCollapsed} onToggle={() => setLetterCollapsed((v) => !v)} framed={framed} />;

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
          <AwaitingStack stack={stack} cleared={cleared} headingRef={stackHeading} />
          <DeadlineRunway cards={deadlines} stackKeys={stackKeys} />
          {showReady && <ReadyTasks tasks={ready} />}
        </div>

        {/* End lane, "What happened": read these. One quiet reading column. */}
        <div className={cn('flex min-w-0 flex-col gap-8', wide && 'gap-5 rounded-lg border border-border bg-card p-5', lanes && 'lg:col-span-5')}>
          {wide && letter(false)}
          <div className={cn(wide && 'border-t border-border pt-5')}>
            <SessionsWithoutSummary sessions={data.noSummarySessions} />
          </div>
          <div className={cn(wide && 'border-t border-border pt-5')}>
            <SinceLastVisit data={data} />
          </div>
        </div>
      </div>

      {!wide && <CountersBand tiles={tiles} />}

      <div className="border-t border-border pt-6">
        <TeamWeek team={data.team} me={data.me} myFocus={myFocus} />
      </div>
      <CaptureSources sources={sources.filter((s) => s.enabled)} />
    </PageContainer>
  );
}
