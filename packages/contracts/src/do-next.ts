/**
 * @file Do next (docs/16 §11): a ranked list of what to start, from real state, with no AI. Pure, so Today and the panel rank the same way.
 * @description Open means a task someone could start now (`ready`, or `claimed` and not yet started) or a decision still `open`. A task in progress or in review is already moving, and a backlog task was not marked ready. Words live in the web: an item carries reason codes only.
 */
import type { CardSummary } from './cards';
import type { Role } from './roles';

export type DoNextCard = Pick<
  CardSummary,
  | 'key'
  | 'type'
  | 'title'
  | 'status'
  | 'priority'
  | 'ownerRole'
  | 'blocksCount'
  | 'awaiting'
  | 'archivedAt'
  | 'closedAt'
  | 'dueAt'
> & { readonly flags: Pick<CardSummary['flags'], 'blocked' | 'overdue'> };

export type DoNextReason = 'overdue' | 'blocks' | 'ready' | 'decision';

export interface DoNextItem {
  readonly key: string;
  readonly type: CardSummary['type'];
  readonly title: string;
  readonly reasons: readonly DoNextReason[];
  readonly blocks: number;
  /** A task can be run. A decision waits for someone to decide it. */
  readonly runnable: boolean;
  readonly score: number;
}

export interface DoNextOptions {
  /** Filters on `ownerRole`. `owner`, null or nothing sees all. */
  readonly role?: Role | null;
  readonly limit?: number;
  /** With a time, a past `dueAt` counts as overdue too. Without one, only the server's flag does. */
  readonly nowMs?: number;
}

const SCORE = { overdue: 100, perBlocked: 30, P0: 25, P1: 12 } as const;
const OPEN_TASK = new Set(['ready', 'claimed']);

const isOpen = (card: DoNextCard): boolean =>
  (card.type === 'task' && OPEN_TASK.has(card.status)) ||
  (card.type === 'decision' && card.status === 'open');

function isOverdue(card: DoNextCard, nowMs: number | undefined): boolean {
  if (card.flags.overdue) return true;
  return nowMs !== undefined && card.dueAt !== null && Date.parse(card.dueAt) < nowMs;
}

function priorityScore(priority: CardSummary['priority']): number {
  if (priority === 'P0') return SCORE.P0;
  return priority === 'P1' ? SCORE.P1 : 0;
}

export function doNext(cards: readonly DoNextCard[], options: DoNextOptions): DoNextItem[] {
  const { role, limit, nowMs } = options;
  const items = cards
    .filter((card) => isOpen(card) && !card.flags.blocked && !card.archivedAt && !card.closedAt)
    .filter((card) => !role || role === 'owner' || card.ownerRole === role)
    .map((card): DoNextItem => {
      const overdue = isOverdue(card, nowMs);
      const reasons: DoNextReason[] = [];
      if (overdue) reasons.push('overdue');
      if (card.blocksCount > 0) reasons.push('blocks');
      reasons.push(card.type === 'task' ? 'ready' : 'decision');
      return {
        key: card.key,
        type: card.type,
        title: card.title,
        reasons,
        blocks: card.blocksCount,
        runnable: card.type === 'task',
        score:
          (overdue ? SCORE.overdue : 0) + card.blocksCount * SCORE.perBlocked + priorityScore(card.priority),
      };
    })
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key, 'en', { numeric: true }));
  return limit === undefined ? items : items.slice(0, limit);
}
