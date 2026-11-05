import { useMemo, useRef, useState, useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { useLocale, useT } from '@lab/i18n';
import { memberById, scenarioFromHash, todayFor, type CardRow, type HubScenario, type Role } from '@lab/mocks/hub-today';
import './tokens.css';
import { messages } from './i18n';
import { fill, Ltr } from './parts/atoms';
import { AwaitingStack, buildStack, overdueCount, type StackCard } from './parts/awaiting-stack';
import { counterIcons, CountersBand, type CounterTile } from './parts/counters';
import { PageHeader } from './parts/header';
import { MorningLetter } from './parts/letter';
import { LoadingView } from './parts/loading';
import { ReadyTasks } from './parts/ready';
import { DeadlineRunway } from './parts/runway';
import { SessionsWithoutSummary } from './parts/sessions';
import { SinceLastVisit } from './parts/since';
import { CaptureSources } from './parts/sources';
import { TeamWeek } from './parts/team';
import { ToastRegion, type ToastData } from './parts/toast';

/** Roles that a ready-task specialty maps to (09 §4: backend, frontend, designer, qa; ops/docs → pm|backend). */
const BUILDER_ROLES: Role[] = ['backend', 'frontend', 'designer', 'qa', 'pm'];

export default function Page() {
  // The gallery toolbar changes `?scenario=` in the hash; a new scenario starts from fresh state.
  const scenario = scenarioFromHash();
  return <Today key={scenario} scenario={scenario} />;
}

function Today({ scenario }: { scenario: HubScenario }) {
  const t = useT(messages);
  const locale = useLocale();
  const data = useMemo(() => todayFor(scenario), [scenario]);
  const me = memberById(data.me);
  const roles = useMemo(() => me?.roles ?? [], [me]);

  const [resolved, setResolved] = useState<string[]>([]);
  const [claimed, setClaimed] = useState<CardRow[]>([]);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [letterCollapsed, setLetterCollapsed] = useState(false);
  const toastId = useRef(0);

  const loading = scenario === 'loading' || refreshing;
  const fullStack = useMemo(() => buildStack(data, roles), [data, roles]);
  const stack = fullStack.filter((c) => !resolved.includes(c.key));
  const ready = data.readyTasks.filter((task) => !claimed.some((c) => c.key === task.key));
  const lastClaim = claimed[claimed.length - 1];
  const myFocus = lastClaim ? { key: lastClaim.key, title: lastClaim.title[locale] } : null;
  const showReady = roles.some((r) => BUILDER_ROLES.includes(r));

  const show = (next: Omit<ToastData, 'id'>) => setToast({ ...next, id: ++toastId.current });

  // In Hub, Decide / Deliver / Verify / Approve open the CardSheet on that action and the card
  // leaves the stack when the sheet saves. The lab resolves it at once to show the stack's motion.
  const onAction = (card: StackCard) => {
    setResolved((r) => [...r, card.key]);
    show({
      message: fill(t.done[card.action], { key: <Ltr mono>{card.key}</Ltr> }),
      onUndo: () => {
        setResolved((r) => r.filter((k) => k !== card.key));
        setToast(null);
      },
    });
  };

  const onClaim = (task: CardRow) => {
    setClaimed((c) => [...c, task]);
    show({ message: fill(t.ready.toast, { key: <Ltr mono>{task.key}</Ltr> }), cmd: `/hub:next ${task.key}` });
  };

  const refresh = () => {
    if (refreshing || scenario === 'loading') return;
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 900);
  };

  // Shortcuts (09 §4): j / k move between rows, c claims the focused ready task, r refreshes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'r') {
        e.preventDefault();
        refresh();
      } else if (e.key === 'j' || e.key === 'k') {
        const rows = [...document.querySelectorAll<HTMLElement>('[data-row]')].filter((r) => r.offsetParent !== null);
        const i = rows.indexOf(el.closest<HTMLElement>('[data-row]')!);
        const next = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'j' ? 1 : -1)))];
        if (next) {
          e.preventDefault();
          next.focus();
          next.scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'c') {
        const key = el.closest<HTMLElement>('[data-claim]')?.dataset.claim;
        const task = ready.find((r) => r.key === key);
        if (task) {
          e.preventDefault();
          onClaim(task);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Cards resolved on this page leave their counters too, so every number agrees with the stack.
  const gone = fullStack.filter((card) => resolved.includes(card.key));
  const goneOf = (type: StackCard['type']) => gone.filter((card) => card.type === type).length;
  const goneOverdue = gone.filter((card) => card.type === 'decision' && card.group === 'urgent').length;
  const deadlines = data.deadlines.filter((card) => !resolved.includes(card.key));
  const c = data.counters;
  const tiles: CounterTile[] = [
    { key: 'inbox', value: c.inboxUnread, to: '/inbox', icon: counterIcons.inbox },
    // Counted from the stack itself so the tile, the header and the section never disagree.
    { key: 'awaiting', value: stack.length, to: '/inbox?awaiting=me', icon: counterIcons.awaiting },
    {
      key: 'decisions',
      value: c.decisionsOpen - goneOf('decision'),
      to: '/decisions?awaiting=me',
      type: 'decision',
      overdue: Math.max(0, c.decisionsOverdue - goneOverdue),
    },
    { key: 'needs', value: c.needsOpen - goneOf('need'), to: '/needs?awaiting=me', type: 'need' },
    { key: 'handoffs', value: c.handoffsPending - goneOf('handoff'), to: '/handoffs?awaiting=me', type: 'handoff' },
    { key: 'tasks', value: ready.length, to: '/tasks?status=ready&mine=1', type: 'task' },
    ...(roles.includes('owner')
      ? [{ key: 'redesigns', value: c.redesignInReview - goneOf('redesign'), to: '/redesign?status=review', type: 'redesign' } satisfies CounterTile]
      : []),
    { key: 'sessions', value: data.noSummarySessions.length, to: '/timeline?kind=session&noSummary=1', type: 'change' },
  ];

  const letter = (idSuffix: string, framed: boolean) => (
    <MorningLetter
      narrative={data.narrative}
      collapsed={letterCollapsed}
      onToggle={() => setLetterCollapsed((v) => !v)}
      framed={framed}
      idSuffix={idSuffix}
    />
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="peacock min-h-dvh bg-background text-foreground">
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 pb-28 md:gap-8 md:px-6 md:pt-8">
          <PageHeader
            me={me}
            waiting={stack.length}
            overdue={overdueCount(stack)}
            refreshing={refreshing}
            loading={loading}
            onRefresh={refresh}
          />

          {loading ? (
            <LoadingView />
          ) : (
            <>
              <CountersBand tiles={tiles} />

              {/* Phone order (09 §4): the letter comes first. From 768 px it sits atop the end lane. */}
              <div className="md:hidden">{letter('m', true)}</div>

              <div className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-8">
                {/* Start lane — "Needs me": act on these. */}
                <div className="flex min-w-0 flex-col gap-8 lg:col-span-7">
                  <AwaitingStack stack={stack} cleared={resolved.length} onAction={onAction} />
                  <DeadlineRunway cards={deadlines} />
                  {showReady && <ReadyTasks tasks={ready} onClaim={onClaim} />}
                </div>

                {/* End lane — "What happened": read these. One quiet reading column. */}
                <div className="flex min-w-0 flex-col gap-8 md:gap-6 md:rounded-2xl md:border md:border-border md:bg-card md:p-6 lg:col-span-5">
                  <div className="hidden md:block">{letter('d', false)}</div>
                  <div className="md:border-t md:border-border md:pt-6">
                    <SessionsWithoutSummary sessions={data.noSummarySessions} />
                  </div>
                  <div className="md:border-t md:border-border md:pt-6">
                    <SinceLastVisit data={data} />
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-8">
                <TeamWeek team={data.team} me={data.me} myFocus={myFocus} />
              </div>
              <CaptureSources sources={data.sources} />
              <p className="hidden text-caption text-muted-foreground md:block">{t.shortcuts}</p>
            </>
          )}
        </main>
        <ToastRegion toast={toast} onClose={() => setToast(null)} />
      </div>
    </MotionConfig>
  );
}
