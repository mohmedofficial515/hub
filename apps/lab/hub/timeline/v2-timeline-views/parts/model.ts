import { NOW, type Feed, type FeedAction, type FeedCard, type FeedItem } from '@lab/mocks/hub-app/feed';

export { NOW };
export type { Feed, FeedAction, FeedCard, FeedItem };
export type { CardType, L, Role } from '@lab/mocks/hub-app/feed';
export type Locale = 'ar' | 'en';
export type ViewId = 'needs' | 'new' | 'mentions' | 'all';
export const VIEWS: ViewId[] = ['needs', 'new', 'mentions', 'all'];

/** What changed on a card since the page opened: an action I took, or a live event someone else caused. */
export interface Overlay {
  status: string;
  action: FeedAction | null;
  from: string;
  /** Epoch ms of the change, so a row can re-run its highlight. */
  at: number;
  /** I did it (undoable, leaves "Needs me" after a short quiet state) or someone else did. */
  mine: boolean;
  /** Set a moment after `mine`: the row has left "Needs me". */
  settled?: boolean;
  /** The card's status and action before my action, for Undo. */
  prev?: { status: string; action: FeedAction | null };
}

export type Overlays = Record<string, Overlay>;
export type ReadMap = Record<string, boolean>;

export const cardOf = (item: FeedItem, overlays: Overlays): FeedCard | null => {
  if (!item.card) return null;
  const o = overlays[item.card.key];
  return o ? { ...item.card, status: o.status, awaiting: o.action ?? undefined } : item.card;
};

export const isUnread = (item: FeedItem, read: ReadMap) => read[item.id] === undefined ? item.unread : !read[item.id];

const nowMs = () => new Date(NOW).getTime();
const PRIO: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

/** Cards that wait on me (the counter and the ranking). */
export function needsOf(items: FeedItem[], overlays: Overlays): FeedItem[] {
  return items.filter((i) => i.card && cardOf(i, overlays)!.awaiting);
}

/** What "Needs me" draws: the waiting cards plus the ones I just settled, which stay as a quiet row for a moment. */
export function needsShown(items: FeedItem[], overlays: Overlays): FeedItem[] {
  return items.filter((i) => {
    if (!i.card) return false;
    const o = overlays[i.card.key];
    return Boolean(cardOf(i, overlays)!.awaiting) || Boolean(o?.mine && !o.settled);
  });
}

export type Band = 'urgent' | 'soon' | 'later';

export function bandOf(card: FeedCard): Band {
  if (card.overdue || card.escalated) return 'urgent';
  if (card.dueAt) {
    const diff = new Date(card.dueAt).getTime() - nowMs();
    if (diff < 0) return 'urgent';
    if (diff < 24 * 3_600_000) return 'soon';
  }
  return 'later';
}

/** Urgent first, then by due date, then by priority: the order of the shelf in concept B, used here for "Needs me". */
export function rankNeeds(list: FeedItem[], overlays: Overlays): FeedItem[] {
  const due = (c: FeedCard) => (c.dueAt ? new Date(c.dueAt).getTime() : Infinity);
  return [...list].sort((a, b) => {
    const ca = cardOf(a, overlays)!;
    const cb = cardOf(b, overlays)!;
    const ba = ['urgent', 'soon', 'later'].indexOf(bandOf(ca));
    const bb = ['urgent', 'soon', 'later'].indexOf(bandOf(cb));
    return ba - bb || due(ca) - due(cb) || (PRIO[ca.priority] ?? 9) - (PRIO[cb.priority] ?? 9);
  });
}

export const isMention = (i: FeedItem) => i.system === 'brief' || i.why?.kind === 'mention' || i.why?.kind === 'reminder' || i.why?.kind === 'escalation';

export interface Counts {
  needs: number;
  new: number;
  mentions: number;
  /** The one counter: distinct cards (or system items) that wait on me or have news for me. */
  attention: number;
  overdue: number;
}

export function countsOf(items: FeedItem[], overlays: Overlays, read: ReadMap): Counts {
  const needs = needsOf(items, overlays);
  const fresh = items.filter((i) => isUnread(i, read));
  const keys = new Set<string>();
  for (const i of needs) keys.add(i.card!.key);
  for (const i of fresh) keys.add(i.card?.key ?? i.id);
  return {
    needs: needs.length,
    new: fresh.length,
    mentions: items.filter((i) => isMention(i) && isUnread(i, read)).length,
    attention: keys.size,
    overdue: needs.filter((i) => bandOf(i.card!) === 'urgent').length,
  };
}

export function nextDeadline(items: FeedItem[], overlays: Overlays): FeedItem | null {
  const upcoming = needsOf(items, overlays).filter((i) => i.card!.dueAt && new Date(i.card!.dueAt).getTime() >= nowMs());
  upcoming.sort((a, b) => new Date(a.card!.dueAt!).getTime() - new Date(b.card!.dueAt!).getTime());
  return upcoming[0] ?? null;
}
