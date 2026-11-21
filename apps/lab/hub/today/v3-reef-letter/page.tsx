import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { memberById, scenarioFromHash, todayFor, type CardRow, type HubScenario, type Role } from '@lab/mocks/hub-today';
import './tokens.css';
import { messages } from './i18n';
import { Atoll } from './parts/atoll';
import { fill, Kbd, Ltr } from './parts/atoms';
import { useShortcutsPref } from './parts/hooks';
import { MorningLetter } from './parts/letter';
import { Masthead } from './parts/masthead';
import { alsoDue, buildNeeds, buildSegments, rowIdOf, type NeedCard, type Segment } from './parts/model';
import { NeedsSection } from './parts/needs';
import { blockerOf, ReadyTasks } from './parts/ready';
import { SessionsWithoutSummary } from './parts/sessions';
import { ShortcutsDialog, ShortcutSwitch } from './parts/shortcuts';
import { SinceLastVisit } from './parts/since';
import { CaptureSources } from './parts/sources';
import { ErrorView, LoadingView } from './parts/states';
import { TeamWeek } from './parts/team';
import { ToastRegion, type ToastData } from './parts/toast';

/** Roles that a ready-task specialty maps to (09 §4: backend, frontend, designer, qa; ops/docs → pm|backend). */
const BUILDER_ROLES: Role[] = ['backend', 'frontend', 'designer', 'qa', 'pm'];

export default function Page() {
  // The gallery toolbar changes `?scenario=` in the hash; a new scenario starts from fresh state.
  const scenario = scenarioFromHash();
  return <Today key={scenario} scenario={scenario} />;
}

const liveRows = () => [...document.querySelectorAll<HTMLElement>('[data-row]:not([data-leaving])')].filter((r) => r.offsetParent !== null);

function Today({ scenario }: { scenario: HubScenario }) {
  const t = useT(messages);
  const locale = useLocale();
  const data = useMemo(() => todayFor(scenario), [scenario]);
  const me = memberById(data.me);
  const roles = useMemo(() => me?.roles ?? [], [me]);

  const [resolved, setResolved] = useState<string[]>([]);
  const [claimed, setClaimed] = useState<CardRow[]>([]);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [shortcutsOn, setShortcutsOn] = useShortcutsPref();
  // `error` is not in the lab toolbar's list; open it with `?scenario=error`.
  const [failed, setFailed] = useState((scenario as string) === 'error');

  const toastId = useRef(0);
  const undoRef = useRef<(() => void) | null>(null);
  const refreshTimer = useRef<number | undefined>(undefined);
  const pendingFocus = useRef<string | null>(null);
  const lastRow = useRef<string | null>(null);

  const loading = scenario === 'loading';
  const fullNeeds = useMemo(() => buildNeeds(data, roles), [data, roles]);
  const needs = useMemo(() => fullNeeds.filter((c) => !resolved.includes(c.key)), [fullNeeds, resolved]);
  const ready = useMemo(() => data.readyTasks.filter((task) => !claimed.some((c) => c.key === task.key)), [data, claimed]);
  const showReady = roles.some((r) => BUILDER_ROLES.includes(r));
  const segments = useMemo(() => buildSegments(fullNeeds, showReady ? data.readyTasks : [], data.noSummarySessions), [fullNeeds, showReady, data]);
  const done = useMemo(() => new Set([...resolved, ...claimed.map((c) => c.key)]), [resolved, claimed]);
  const extraDue = useMemo(() => alsoDue(data, fullNeeds), [data, fullNeeds]);
  const lastClaim = claimed[claimed.length - 1];
  const myFocus = lastClaim ? { key: lastClaim.key, title: lastClaim.title[locale] } : null;

  const show = useCallback((next: Omit<ToastData, 'id'>) => {
    undoRef.current = next.onUndo ?? null;
    setToast({ ...next, id: ++toastId.current });
  }, []);
  const closeToast = useCallback(() => {
    undoRef.current = null;
    setToast(null);
  }, []);

  // ── Focus after a mutation (critic B1): never drop to <body>; go to the next row of the same list ──
  const moveFocusOn = (row: HTMLElement | null, fallbackId: string) => {
    const list = row?.closest('[data-list]');
    const rows = list ? [...list.querySelectorAll<HTMLElement>('[data-row]:not([data-leaving])')] : [];
    const i = row ? rows.indexOf(row) : -1;
    const next = rows[i + 1] ?? rows[i - 1];
    row?.setAttribute('data-leaving', '');
    window.requestAnimationFrame(() => {
      const target = next ?? document.getElementById(fallbackId);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'nearest' });
    });
  };

  // The restored row exists only after React commits, so Undo focuses it from here.
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    const el = document.getElementById(pendingFocus.current);
    pendingFocus.current = null;
    el?.removeAttribute('data-leaving');
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'nearest' });
  });

  // In Hub, Decide / Deliver / Verify / Approve open the CardSheet on that action and the card leaves
  // the list when the sheet saves. The lab resolves it at once to show the list's motion.
  const onAction = (card: NeedCard, row: HTMLElement | null) => {
    moveFocusOn(row, 'needs-title');
    setExpanded((k) => (k === card.key ? null : k));
    setResolved((r) => [...r, card.key]);
    show({
      message: fill(t.done[card.action], { key: <Ltr mono>{card.key}</Ltr> }),
      onUndo: () => {
        pendingFocus.current = rowIdOf(card.key);
        setResolved((r) => r.filter((k) => k !== card.key));
        closeToast();
      },
    });
  };

  const onClaim = (task: CardRow, row: HTMLElement | null) => {
    moveFocusOn(row, 'ready-title');
    setClaimed((c) => [...c, task]);
    show({
      message: fill(t.ready.toast, { key: <Ltr mono>{task.key}</Ltr> }),
      cmd: `/hub:next ${task.key}`,
      onUndo: () => {
        pendingFocus.current = rowIdOf(task.key);
        setClaimed((c) => c.filter((x) => x.key !== task.key));
        closeToast();
      },
    });
  };

  const onBlocked = (task: CardRow) => {
    show({
      tone: 'info',
      message: fill(t.ready.blockedToast, { key: <Ltr mono>{task.key}</Ltr>, blocker: <Ltr mono>{blockerOf(task) ?? ''}</Ltr> }),
    });
  };

  // Refresh in place (critic M7): the content stays, only a thin line and the icon move.
  const refresh = useCallback(() => {
    if (loading) return;
    setRefreshing(true);
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => setRefreshing(false), 900);
  }, [loading]);
  useEffect(() => () => window.clearTimeout(refreshTimer.current), []);

  const jumpTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, []);

  const onPick = useCallback((seg: Segment) => {
    const el = document.getElementById(seg.rowId);
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, []);

  // ── Shortcuts (09 §4, 08 §12). Off-switchable, and they never fire inside a text field. ──────
  useEffect(() => {
    if (!shortcutsOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || helpOpen) return;
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return;
      const row = el.closest<HTMLElement>('[data-row]');
      if (e.key === 'r') {
        e.preventDefault();
        refresh();
      } else if (e.key === '?') {
        e.preventDefault();
        setHelpOpen(true);
      } else if (e.key === 'u') {
        if (undoRef.current) {
          e.preventDefault();
          undoRef.current();
        }
      } else if (e.key === 'j' || e.key === 'k') {
        const rows = liveRows();
        // Coming from outside a row (the toast, a link): pick up from the last row used.
        const from = row ? rows.indexOf(row) : rows.findIndex((r) => r.id && r.id === lastRow.current);
        const i = from < 0 ? (e.key === 'j' ? 0 : rows.length - 1) : from + (e.key === 'j' ? 1 : -1);
        const next = rows[Math.max(0, Math.min(rows.length - 1, i))];
        if (next) {
          e.preventDefault();
          lastRow.current = next.id || null;
          next.focus({ preventScroll: true });
          next.scrollIntoView({ block: 'nearest' });
        }
      } else if ((e.key === 'Enter' || e.key === 'o') && row && (e.key === 'o' || el === row)) {
        // On a focused row Enter opens it. On a button inside the row Enter stays that button's.
        e.preventDefault();
        row.querySelector<HTMLElement>('[data-row-open]')?.click();
      } else if (e.key === 'c' && row) {
        const claim = row.querySelector<HTMLElement>('[data-claim]');
        if (claim) {
          e.preventDefault();
          claim.click();
        }
      } else if (e.key === 'a' && row) {
        const ack = row.querySelector<HTMLElement>('[data-action="acknowledge"]');
        if (ack) {
          e.preventDefault();
          ack.click();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcutsOn, helpOpen, refresh]);

  const retry = () => {
    setRefreshing(true);
    window.setTimeout(() => {
      setRefreshing(false);
      setFailed(false);
    }, 900);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="reef min-h-dvh bg-background text-foreground">
        <a
          href="#needs-title"
          onClick={(e) => {
            e.preventDefault();
            jumpTo('needs-title');
          }}
          className="sr-only rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50"
        >
          {t.page.skip}
        </a>
        <main aria-busy={refreshing || loading} className="mx-auto w-full max-w-3xl px-4 pt-4 pb-28 md:px-6 md:pt-8 xl:max-w-304">
          <Masthead me={me} needs={needs} loading={loading} refreshing={refreshing} onRefresh={refresh} onShortcuts={() => setHelpOpen(true)} />

          {failed ? (
            <ErrorView onRetry={retry} />
          ) : loading ? (
            <div className="mt-4 md:mt-8">
              <LoadingView />
            </div>
          ) : (
            <div className="mt-4 md:mt-8 xl:grid xl:grid-cols-[minmax(0,47.5rem)_20rem] xl:justify-between">
              {/* The reading column: one flow, top to bottom, the same order at every width. */}
              <div className="flex min-w-0 flex-col gap-10 md:gap-14">
                <Atoll
                  segments={segments}
                  needs={needs}
                  needsTotal={fullNeeds.length}
                  done={done}
                  readyCount={ready.length}
                  sessionCount={data.noSummarySessions.length}
                  changedCount={data.changesSince.total}
                  showReady={showReady}
                  onJump={jumpTo}
                  onPick={onPick}
                />
                <NeedsSection
                  needs={needs}
                  everHadNeeds={fullNeeds.length > 0}
                  extraDue={extraDue}
                  expanded={expanded}
                  onToggle={(key) => setExpanded((k) => (k === key ? null : key))}
                  onAction={onAction}
                />
                <MorningLetter narrative={data.narrative} />
                {showReady && <ReadyTasks tasks={ready} onClaim={onClaim} onBlocked={onBlocked} />}
                <SessionsWithoutSummary sessions={data.noSummarySessions} />
                <SinceLastVisit data={data} />
                <footer className="hidden flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-4 md:flex">
                  <ShortcutSwitch on={shortcutsOn} onChange={setShortcutsOn} />
                  {shortcutsOn && (
                    <p className="flex items-center gap-1.5 text-body-sm text-muted-foreground">
                      <Kbd>?</Kbd>
                      <button
                        type="button"
                        onClick={() => setHelpOpen(true)}
                        className={cn('rounded-sm underline-offset-4 hover:text-foreground hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring')}
                      >
                        {t.page.shortcuts}
                      </button>
                    </p>
                  )}
                </footer>
              </div>

              {/* The margin rail: quiet team and pipeline notes beside the letter; below the flow under 1280 px. */}
              <aside className="mt-12 flex min-w-0 flex-col gap-10 border-t border-border pt-10 xl:mt-0 xl:border-t-0 xl:pt-0">
                <TeamWeek team={data.team} me={data.me} myFocus={myFocus} />
                <CaptureSources sources={data.sources} />
              </aside>
            </div>
          )}
        </main>
        <ToastRegion toast={toast} onClose={closeToast} showKeyHint={shortcutsOn} />
        <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} on={shortcutsOn} onChange={setShortcutsOn} />
      </div>
    </MotionConfig>
  );
}
