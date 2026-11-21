import type { Action, CardRow, CardType, L, Role, SessionRow, Today } from '@lab/mocks/hub-today';
import { hoursFromNow } from './format';

/** 0 = escalated or overdue, 1 = due within 24 h, 2 = everything else. The list's one ordering rule. */
export type Rank = 0 | 1 | 2;
export type NeedCard = CardRow & { action: Action; rank: Rank; promoted?: boolean };
export type DueState = 'overdue' | 'soon' | 'later' | null;

const PRIO = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;
const DEFAULT_ACTION: Record<CardType, Action> = {
  decision: 'decide',
  need: 'deliver',
  handoff: 'acknowledge',
  redesign: 'approve',
  task: 'verify',
  change: 'review',
  doc: 'review',
  release: 'review',
};

export function dueState(c: CardRow): DueState {
  if (c.flags?.overdue) return 'overdue';
  if (!c.dueAt) return null;
  const h = hoursFromNow(c.dueAt);
  return h < 0 ? 'overdue' : h <= 24 ? 'soon' : 'later';
}

const isLate = (c: CardRow) => !!c.flags?.escalated || dueState(c) === 'overdue';
const rankOf = (c: CardRow): Rank => (isLate(c) ? 0 : dueState(c) === 'soon' ? 1 : 2);

/**
 * 09 §4: Awaiting me = cards routed to one of my roles with an actionable status. The mocked
 * `awaitingMe` omits the escalated decision that `deadlines` carries (GTV-219, routed to `pm`), so an
 * escalated or overdue deadline routed to my roles is promoted into the list here.
 */
export function buildNeeds(today: Today, roles: Role[]): NeedCard[] {
  const seen = new Set(today.awaitingMe.map((c) => c.key));
  const promoted = today.deadlines.filter((c) => !seen.has(c.key) && isLate(c) && c.ownerRole !== null && roles.includes(c.ownerRole));
  return [...promoted.map((c) => ({ ...c, promoted: true })), ...today.awaitingMe]
    .map((c) => ({ ...c, rank: rankOf(c), action: c.action ?? DEFAULT_ACTION[c.type] }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity) ||
        PRIO[a.priority] - PRIO[b.priority],
    );
}

/** Deadlines that are not already a row in Needs you. Empty in every mock scenario; the API may send some. */
export const alsoDue = (today: Today, needs: NeedCard[]) => today.deadlines.filter((c) => !needs.some((n) => n.key === c.key));

// ── The atoll ──────────────────────────────────────────────────────────────────────────────────

export type SegmentGroup = 'needs' | 'ready' | 'sessions';

export interface Segment {
  id: string;
  /** The row this polyp jumps to. */
  rowId: string;
  key: string | null;
  type: CardType;
  group: SegmentGroup;
  flag: 'overdue' | 'soon' | null;
  title: L | null;
}

/**
 * Fixed hue order, never reassigned per scenario: colour follows the type. This order is the one that
 * passes the palette validator: no adjacent pair under ΔE 10 for deutan or under 15 for normal vision.
 */
export const RING_ORDER: CardType[] = ['decision', 'redesign', 'need', 'handoff', 'task', 'change', 'doc', 'release'];

export const rowIdOf = (key: string) => `row-${key}`;

export function buildSegments(needs: NeedCard[], ready: CardRow[], sessions: SessionRow[]): Segment[] {
  const byType = [...needs].sort((a, b) => RING_ORDER.indexOf(a.type) - RING_ORDER.indexOf(b.type) || a.rank - b.rank);
  return [
    ...byType.map(
      (c): Segment => ({
        id: c.key,
        rowId: rowIdOf(c.key),
        key: c.key,
        type: c.type,
        group: 'needs',
        flag: dueState(c) === 'overdue' || c.flags?.escalated ? 'overdue' : dueState(c) === 'soon' ? 'soon' : null,
        title: c.title,
      }),
    ),
    ...ready.map((c): Segment => ({ id: c.key, rowId: rowIdOf(c.key), key: c.key, type: c.type, group: 'ready', flag: null, title: c.title })),
    ...sessions.map(
      (s): Segment => ({ id: s.sessionId, rowId: `row-session-${s.sessionId}`, key: null, type: 'change', group: 'sessions', flag: null, title: null }),
    ),
  ];
}

/** Per-type counts of the still-open needs, in ring order, for the legend. */
export function composition(needs: NeedCard[]) {
  return RING_ORDER.map((type) => ({ type, n: needs.filter((c) => c.type === type).length })).filter((row) => row.n > 0);
}

// ── Since your last visit: grouped per card (09 §4), then by day ───────────────────────────────

export function groupPerCard<E extends { card: { key: string }; at: string }>(events: E[]) {
  const map = new Map<string, { latest: E; events: E[] }>();
  for (const e of events) {
    const hit = map.get(e.card.key);
    if (hit) hit.events.push(e);
    else map.set(e.card.key, { latest: e, events: [e] });
  }
  return [...map.values()];
}
