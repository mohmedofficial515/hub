import { useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { useLocale, useT } from '@lab/i18n';
import { memberById, scenarioFromHash, todayFor, type CardRow, type HubScenario, type Role } from '@lab/mocks/hub-today';
import './tokens.css';
import { messages } from './i18n';
import { fill, Ltr } from './parts/atoms';
import { CardFlow } from './parts/flow';
import { Elsewhere, type ElsewhereItem } from './parts/elsewhere';
import { useShortcutsPref } from './parts/hooks';
import { MorningLetter } from './parts/letter';
import { Masthead } from './parts/masthead';
import { buildStack, NeedsYou, type StackCard } from './parts/needs-you';
import { blockerOf, ReadyTasks } from './parts/ready';
import { SessionsWithoutSummary } from './parts/sessions';
import { SinceLastVisit } from './parts/since';
import { CaptureSources } from './parts/sources';
import { ErrorTile, LoadingBento } from './parts/states';
import { TeamWeek } from './parts/team';
import { ToastRegion, type ToastData } from './parts/toast';
import { hoursFromNow } from './parts/format';

/** Roles a ready-task specialty maps to (09 §4). The block hides for a member with none of them. */
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
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [letterOpen, setLetterOpen] = useState(false);
  const [keysOn, setKeysOn] = useShortcutsPref();
  const [helpOpen, setHelpOpen] = useState(false);
  // The toolbar has no error scenario (`?scenario=error` in the URL shows it); Retry recovers.
  const [failed, setFailed] = useState((scenario as string) === 'error');
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const toastId = useRef(0);
  const refreshTimer = useRef<number | undefined>(undefined);

  const loading = scenario === 'loading';
  const fullStack = useMemo(() => buildStack(data, roles), [data, roles]);
  const stack = fullStack.filter((c) => !resolved.includes(c.key));
  const ready = data.readyTasks.filter((task) => !claimed.some((c) => c.key === task.key));
  const lastClaim = claimed[claimed.length - 1];
  const myFocus = lastClaim ? { key: lastClaim.key, title: lastClaim.title[locale] } : null;
  const showReady = roles.some((r) => BUILDER_ROLES.includes(r));

  // Due info lives in the Needs-you rows. Only a deadline outside that list may show on its own,
  // so no card ever appears twice (v2 finding M6).
  const deadlines = data.deadlines.filter((c) => c.dueAt && hoursFromNow(c.dueAt) <= 72);
  const outside = deadlines.filter((c) => !fullStack.some((s) => s.key === c.key));

  const show = (next: Omit<ToastData, 'id'>) => setToast({ ...next, id: ++toastId.current });

  // Keyboard focus lands on the next row after an action, or on the tile heading when the list empties.
  useEffect(() => {
    if (!focusTarget) return;
    document.getElementById(focusTarget)?.focus();
    setFocusTarget(null);
  }, [focusTarget]);

  /** The row that should receive focus once `key` leaves a list. */
  const nextOf = (keys: string[], key: string, emptyTarget: string) => {
    const i = keys.indexOf(key);
    const next = keys[i + 1] ?? keys[i - 1];
    return next ? `t-${next}` : emptyTarget;
  };

  // In Hub, Decide / Deliver / Verify / Approve open the CardSheet on that action and the card leaves
  // when the sheet saves. The lab resolves it at once, to show how the list and the numeral move.
  const onAction = (card: StackCard) => {
    setFocusTarget(nextOf(stack.map((c) => c.key), card.key, 'needs-title'));
    setResolved((r) => [...r, card.key]);
    setExpanded((s) => {
      const n = new Set(s);
      n.delete(card.key);
      return n;
    });
    show({
      message: fill(t.done[card.action], { key: <Ltr mono>{card.key}</Ltr> }),
      onUndo: () => {
        setResolved((r) => r.filter((k) => k !== card.key));
        setToast(null);
        setFocusTarget(`t-${card.key}`);
      },
    });
  };

  const onClaim = (task: CardRow) => {
    setFocusTarget(nextOf(ready.map((c) => c.key), task.key, 'ready-title'));
    setClaimed((c) => [...c, task]);
    show({
      message: fill(t.ready.toast, { key: <Ltr mono>{task.key}</Ltr> }),
      cmd: `/hub:next ${task.key}`,
      onUndo: () => {
        setClaimed((c) => c.filter((x) => x.key !== task.key));
        setToast(null);
        setFocusTarget(`t-${task.key}`);
      },
    });
  };

  const refresh = () => {
    if (failed) {
      setFailed(false);
      return;
    }
    if (refreshing || loading) return;
    setRefreshing(true);
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => setRefreshing(false), 900);
  };
  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  const toggle = (key: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  // Shortcuts (09 §4, 08 §12). One-key shortcuts never fire inside a field and can be turned off;
  // Ctrl/Cmd+Z is not a one-key shortcut, so Undo survives the switch.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return;
      const undo = toast?.onUndo;

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && undo) {
        e.preventDefault();
        undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || !keysOn) return;

      if (e.key === 'r') {
        e.preventDefault();
        refresh();
      } else if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((v) => !v);
      } else if (e.key === 'u' && undo) {
        e.preventDefault();
        undo();
      } else if (e.key === 'j' || e.key === 'k') {
        const titles = [...document.querySelectorAll<HTMLElement>('[data-row-title]')].filter((r) => r.offsetParent !== null);
        const row = el.closest<HTMLElement>('[data-row]');
        const current = row?.querySelector<HTMLElement>('[data-row-title]') ?? null;
        const i = current ? titles.indexOf(current) : -1;
        const next = titles[i < 0 ? 0 : Math.max(0, Math.min(titles.length - 1, i + (e.key === 'j' ? 1 : -1)))];
        if (next) {
          e.preventDefault();
          next.focus();
          next.scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'o') {
        const title = el.closest<HTMLElement>('[data-row]')?.querySelector<HTMLElement>('[data-row-title]');
        if (title) {
          e.preventDefault();
          title.click();
        }
      } else if (e.key === 'c') {
        const key = el.closest<HTMLElement>('[data-claim]')?.dataset.claim;
        const task = ready.find((r) => r.key === key);
        if (!task) return;
        e.preventDefault();
        if (task.flags?.blocked) {
          // `c` on a blocked row answers instead of doing nothing silently.
          show({
            plain: true,
            message: fill(t.ready.blockedToast, { key: <Ltr mono>{task.key}</Ltr>, blocker: <Ltr mono>{blockerOf(task) ?? ''}</Ltr> }),
          });
        } else onClaim(task);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Resolved cards leave the workspace counters too, so no number disagrees with the page.
  const goneOf = (type: StackCard['type']) => fullStack.filter((c) => resolved.includes(c.key) && c.type === type).length;
  const c = data.counters;
  const elsewhere: ElsewhereItem[] = [
    { key: 'inbox', value: c.inboxUnread, to: '/inbox' },
    { key: 'decisions', value: Math.max(0, c.decisionsOpen - goneOf('decision')), to: '/decisions' },
    { key: 'needs', value: Math.max(0, c.needsOpen - goneOf('need')), to: '/needs' },
    { key: 'handoffs', value: Math.max(0, c.handoffsPending - goneOf('handoff')), to: '/handoffs' },
    ...(roles.includes('owner') ? [{ key: 'redesigns', value: Math.max(0, c.redesignInReview - goneOf('redesign')), to: '/redesign?status=review' } satisfies ElsewhereItem] : []),
  ];

  const sourcesToCheck = data.sources.filter((s) => s.status !== 'ok').length;

  return (
    <MotionConfig reducedMotion="user">
      <div className="mandarin min-h-dvh bg-background text-foreground">
        <a
          href="#needs-title"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('needs-title')?.focus();
          }}
          className="sr-only rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50"
        >
          {t.skip}
        </a>
        <main className="mx-auto w-full max-w-7xl px-4 pt-3 pb-28 md:px-6 md:pt-6 lg:pt-8" aria-busy={refreshing}>
          <Masthead
            me={me}
            ready={showReady ? ready.length : 0}
            since={data.changesSince.total}
            sinceWhen={data.changesSince.since}
            sources={sourcesToCheck}
            refreshing={refreshing}
            loading={loading}
            failed={failed}
            onRefresh={refresh}
            keysOn={keysOn}
            onKeysChange={setKeysOn}
            helpOpen={helpOpen}
            onHelpChange={setHelpOpen}
          />

          {failed ? (
            <ErrorTile onRetry={() => setFailed(false)} />
          ) : loading ? (
            <LoadingBento />
          ) : (
            <>
              {/* DOM order is the phone order and the visual order, at every width: focus never jumps. */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-5 lg:grid-cols-12 lg:gap-6">
                <NeedsYou
                  stack={stack}
                  cleared={resolved.length}
                  outside={outside}
                  dueCount={deadlines.length}
                  expanded={expanded}
                  onToggle={toggle}
                  onAction={onAction}
                  className="md:col-span-6 lg:col-span-7"
                />
                <div className="flex min-w-0 flex-col gap-4 md:col-span-6 md:grid md:grid-cols-2 md:gap-5 lg:col-span-5 lg:flex lg:gap-6">
                  <MorningLetter narrative={data.narrative} expanded={letterOpen} onToggle={() => setLetterOpen((v) => !v)} />
                  {showReady && <ReadyTasks tasks={ready} expanded={expanded} onToggle={toggle} onClaim={onClaim} />}
                  <SessionsWithoutSummary sessions={data.noSummarySessions} className="md:col-span-2 lg:col-span-1" />
                </div>
                <SinceLastVisit data={data} expanded={expanded} onToggle={toggle} className="md:col-span-6 lg:col-span-12" />
                <TeamWeek team={data.team} me={data.me} myFocus={myFocus} className="md:col-span-6 lg:col-span-8" />
                <CardFlow flow={data.team.flow} className="md:col-span-6 lg:col-span-4" />
                <CaptureSources sources={data.sources} className="md:col-span-6 lg:col-span-12" />
              </div>
              <Elsewhere items={elsewhere} className="mt-6 md:mt-8" />
            </>
          )}
        </main>
        <ToastRegion toast={toast} onClose={() => setToast(null)} keysOn={keysOn} />
      </div>
    </MotionConfig>
  );
}
