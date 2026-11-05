import { useMemo } from 'react';
import { cards as catalogue, deadlinesFor, members, navExtras, todayFor, type CardRow, type HubCard, type HubScenario, type Member, type Priority, type Role, type TaskCard, type Today } from '@lab/mocks/hub-app';
import { useRoute } from '../shell/router';
import { isSourceProblem, useAdmin } from './admin-store';
import { awaitedAction, type AvailableAction } from './card-actions';
import { allCards, getCard, handoffAgeMs, isHandoffStale, isTimelineSeen, portTaskOf, useCardStoreVersion } from './card-store';
import { unreadCount, useInboxVersion } from './inbox-store';
import { hoursFromNow } from './format';
import type { CardAction } from './i18n';

/** `error` is not in the lab toolbar's list; type it into the URL to see ErrorState. */
export type Scenario = HubScenario | 'error';

export interface Session {
  scenario: Scenario;
  me: Member;
  roles: Role[];
  isOwner: boolean;
  /** Owner or PM: Members and Settings counters are theirs (08 §2). */
  isManager: boolean;
  today: Today;
  loading: boolean;
  error: boolean;
}

/** Who is looking and with which data. The lab's `scenario` query param decides the persona. */
export function useSession(): Session {
  const { query } = useRoute();
  const scenario = (query.get('scenario') as Scenario | null) ?? 'default';
  return useMemo(() => {
    const today = todayFor(scenario === 'error' ? 'default' : scenario);
    const me = members.find((m) => m.id === today.me)!;
    return {
      scenario,
      me,
      roles: me.roles,
      isOwner: me.roles.includes('owner'),
      isManager: me.roles.includes('owner') || me.roles.includes('pm'),
      today,
      loading: scenario === 'loading',
      error: scenario === 'error',
    };
  }, [scenario]);
}

// ── Awaiting me (09 §4) ──────────────────────────────────────────────────────────────────────────

/** Urgent first, then the next 24 h, then everything else by date and priority (review M3). */
export type AwaitingGroup = 'urgent' | 'soon' | 'rest';
export type AwaitingCard = Omit<CardRow, 'action'> & {
  group: AwaitingGroup;
  action: CardAction;
  mode: AvailableAction['mode'];
  /** Verify on a need I delivered: still an action of mine, never the filled button. */
  selfVerify?: boolean;
  promoted?: boolean;
  /** A handoff past its stale limit: how long it has waited. */
  staleForMs?: number;
};

const ORDER: AwaitingGroup[] = ['urgent', 'soon', 'rest'];
const PRIO = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;
export const isLate = (c: Pick<CardRow, 'flags' | 'dueAt'>) => !!(c.flags?.overdue || c.flags?.escalated || (c.dueAt && hoursFromNow(c.dueAt) < 0));
export const isOverdue = (c: Pick<CardRow, 'flags' | 'dueAt'>) => !!(c.flags?.overdue || (c.dueAt && hoursFromNow(c.dueAt) < 0));

function groupOf(c: CardRow, stale: boolean): AwaitingGroup {
  if (isLate(c) || stale) return 'urgent';
  if (c.dueAt && hoursFromNow(c.dueAt) <= 24) return 'soon';
  return 'rest';
}

/** hub-today addresses Sara in the feminine on this row. The kit's strings avoid gender (review M14), and that file is not edited. */
const META_OVERRIDE: Record<string, CardRow['meta']> = {
  'GTV-255': { ar: 'تم الاستلام · التطبيق بعد api:sync', en: 'Acknowledged · apply after api:sync' },
};

/**
 * Who could be waiting on me, before looking at any card's state. 09 §4: cards routed to one of my roles. The mock's `awaitingMe`
 * omits the escalated decision that `deadlines` carries (GTV-219, routed to `pm`), so an escalated or overdue deadline routed to my
 * roles is promoted here.
 *
 * Owner decision 2026-11-04: owner and pm may acknowledge any handoff, but their stack does not fill up with every handoff in the
 * workspace. One routed to another role appears here only when it is overdue (past `handoffs.stale_hours`).
 */
function candidates(session: Pick<Session, 'today' | 'roles' | 'isManager' | 'scenario'>): (CardRow & { promoted?: boolean })[] {
  const { today, roles, isManager, scenario } = session;
  const seen = new Set(today.awaitingMe.map((c) => c.key));
  const promoted = today.deadlines.filter((c) => !seen.has(c.key) && isLate(c) && c.ownerRole !== null && roles.includes(c.ownerRole));
  const overdueElsewhere =
    isManager && scenario !== 'empty'
      ? catalogue.filter((c) => c.type === 'handoff' && isHandoffStale(c) && !roles.includes(c.handoff.toRole) && !seen.has(c.key)).map((c) => ({ key: c.key, type: c.type, status: c.status, priority: c.priority, ownerRole: c.ownerRole, title: c.title, severity: c.type === 'handoff' ? c.handoff.severity : undefined }) as CardRow)
      : [];
  return [...promoted.map((c) => ({ ...c, promoted: true })), ...overdueElsewhere, ...today.awaitingMe];
}

/**
 * Review B2: a row comes from the card's current state, not from whether I touched it. It stays while I have an awaited action,
 * and its verb follows the card, so Acknowledge becomes Apply and Deliver becomes Verify on the same row. It leaves when no action
 * remains. A fact from the row's old state (its deadline, its meta line) goes once the state has moved on.
 */
export function buildAwaiting(session: Pick<Session, 'today' | 'roles' | 'isManager' | 'scenario' | 'me'>): AwaitingCard[] {
  return candidates(session)
    .flatMap((row) => {
      const card = getCard(row.key);
      if (!card || card.archivedAt) return [];
      const action = awaitedAction(card, session.roles, session.me.id);
      if (!action) return [];
      const same = card.status === row.status;
      const stale = card.type === 'handoff' && isHandoffStale(card);
      const current = { ...row, status: card.status, flags: same ? row.flags : undefined, dueAt: same ? row.dueAt : undefined, meta: same ? (META_OVERRIDE[row.key] ?? row.meta) : undefined, priority: card.priority as Priority };
      return [{ ...current, group: groupOf(current, stale), action: action.action, mode: action.mode, selfVerify: action.selfVerify, staleForMs: stale ? handoffAgeMs(card) : undefined }];
    })
    .sort(
      (a, b) =>
        ORDER.indexOf(a.group) - ORDER.indexOf(b.group) ||
        (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity) ||
        PRIO[a.priority] - PRIO[b.priority],
    );
}

/** My stack. Today, the sidebar and Inbox share it. */
export function useAwaiting(): AwaitingCard[] {
  const session = useSession();
  useCardStoreVersion();
  return buildAwaiting(session);
}

/** How many rows left my stack this session: their cards no longer wait on me. */
export function useClearedCount(): number {
  const session = useSession();
  useCardStoreVersion();
  const left = new Set(buildAwaiting(session).map((c) => c.key));
  return candidates(session).filter((c) => !left.has(c.key)).length;
}

/** Deadlines for my roles. One leaves when its card has moved on, because the date belonged to the state it was in (09 §4). */
export function useDeadlines(): CardRow[] {
  const { scenario } = useSession();
  useCardStoreVersion();
  return deadlinesFor(scenario === 'error' ? 'default' : scenario).filter((c) => getCard(c.key)?.status === c.status);
}

const liveCards = (scenario: Scenario): HubCard[] => allCards().filter((c) => !c.archivedAt && (scenario !== 'empty' || c.events[0]?.id.startsWith('new-') || c.events[0]?.id.startsWith('local-')));

/**
 * Tasks ready for my roles, from the store (review M4). The one number the sidebar, Today and Tasks' subtitle all show. A port task
 * whose redesign already sits in my stack is told once, by that row, so Today does not offer the same Claim twice.
 */
export function useReadyTasks(): TaskCard[] {
  const { scenario, roles } = useSession();
  const stack = useAwaiting();
  const behind = new Set(
    stack.flatMap((row) => {
      const card = getCard(row.key);
      const port = row.action === 'claim' && card ? portTaskOf(card) : undefined;
      return port ? [port.key] : [];
    }),
  );
  return liveCards(scenario)
    .filter((c): c is TaskCard => c.type === 'task' && c.status === 'ready' && !!c.ownerRole && roles.includes(c.ownerRole) && !behind.has(c.key))
    .sort((a, b) => PRIO[a.priority] - PRIO[b.priority] || a.key.localeCompare(b.key));
}

/** 09 §4: excluding my own events. The mock's total includes them. */
export const sinceVisitCount = (today: Today) => Math.max(0, today.changesSince.total - today.changesSince.events.filter((e) => e.actorId === today.me).length);

// ── Counters scoped to me (review M9, 08 §2) ─────────────────────────────────────────────────────

export interface MyCounts {
  inbox: number;
  newEvents: number;
  tasksReady: number;
  decisions: { mine: number; all: number; overdue: number };
  needs: { mine: number; all: number };
  handoffs: { mine: number; all: number };
  redesigns: { mine: number; all: number };
  onboarding: number;
  invites: number;
  sourceProblems: number;
}

/** Numbers everyone reads: the sidebar badges and the Today band. "Mine" always matches the row counts. */
export function useMyCounts(): MyCounts {
  const session = useSession();
  const stack = useAwaiting();
  const ready = useReadyTasks();
  const of = (type: CardRow['type']) => stack.filter((row) => row.type === type);
  const decisions = of('decision');
  const workspace = liveCards(session.scenario);
  const count = (type: HubCard['type'], ...statuses: string[]) => workspace.filter((card) => card.type === type && statuses.includes(card.status)).length;
  const extras = navExtras(session.scenario === 'error' ? 'default' : session.scenario);
  // Members and Settings write these, so their sidebar badges move with the page's actions.
  const admin = useAdmin(session.scenario);
  useInboxVersion();
  return {
    inbox: unreadCount(session.scenario),
    newEvents: isTimelineSeen() ? 0 : sinceVisitCount(session.today),
    tasksReady: ready.length,
    decisions: { mine: decisions.length, all: count('decision', 'open'), overdue: decisions.filter(isOverdue).length },
    // Open or waiting for a check: a delivered need of mine is still mine, so the total has to hold it too (review M4).
    needs: { mine: of('need').length, all: count('need', 'requested', 'in_progress', 'delivered') },
    handoffs: { mine: of('handoff').length, all: count('handoff', 'pending', 'acknowledged') },
    redesigns: { mine: of('redesign').length, all: count('redesign', 'review') },
    onboarding: extras.onboardingLeft,
    invites: session.isManager ? admin.invites.length : 0,
    sourceProblems: session.isManager ? admin.sources.filter(isSourceProblem).length : 0,
  };
}
