/**
 * @file model.ts
 * @description What the Tasks page derives from its rows: columns, Mine, order. Ported from v5 `pages/tasks/page.tsx`, kept apart so it can be tested.
 */
import { DAY, nowMs } from '@/lib/format';

import type { Priority, Role, TaskCard } from '../cards/types';

export type Column = 'backlog' | 'ready' | 'claimed' | 'in_progress' | 'in_review' | 'done';
export type SortKey = 'key' | 'priority' | 'status' | 'due' | 'updated';

export const COLUMNS: Column[] = ['backlog', 'ready', 'claimed', 'in_progress', 'in_review', 'done'];
export const STATUS_ORDER: string[] = [...COLUMNS, 'cancelled'];
export const SPECIALTIES = ['backend', 'frontend', 'design', 'qa', 'ops', 'docs'] as const;
export const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3'];

const PRIO: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

const dueOf = (card: Pick<TaskCard, 'dueAt'>) => (card.dueAt ? Date.parse(card.dueAt) : Infinity);
const doneAt = (card: TaskCard) => Date.parse(card.task.doneAt ?? card.lastEventAt);

export const inMyRole = (card: TaskCard, roles: readonly Role[]) =>
  card.ownerRole ? roles.includes(card.ownerRole) : false;

/** Mine: what I hold, and what is ready for my roles, so `Mine` still shows work to pick up (NOTES). */
export const isMine = (card: TaskCard, memberId: string, roles: readonly Role[]) =>
  card.assigneeId === memberId || (card.status === 'ready' && inMyRole(card, roles));

export function byPriority(memberId: string, roles: readonly Role[]) {
  return (a: TaskCard, b: TaskCard) =>
    Number(isMine(b, memberId, roles)) - Number(isMine(a, memberId, roles)) ||
    PRIO[a.priority] - PRIO[b.priority] ||
    dueOf(a) - dueOf(b) ||
    a.key.localeCompare(b.key);
}

export interface TaskFilters {
  specialties: string[];
  priority: string | null;
  module: string | null;
  q: string;
  review: boolean;
  mine: boolean;
}

export function matchesFilters(card: TaskCard, f: TaskFilters, memberId: string, roles: readonly Role[]) {
  if (f.specialties.length && !f.specialties.includes(card.task.specialty)) return false;
  if (f.priority && card.priority !== f.priority) return false;
  if (f.module && card.module !== f.module) return false;
  if (f.q && !card.key.toLowerCase().includes(f.q) && !card.title.toLowerCase().includes(f.q)) return false;
  if (f.review && card.status !== 'in_review') return false;
  if (f.mine && !isMine(card, memberId, roles)) return false;
  return true;
}

/** The board: Done keeps the last 14 days, newest first. Cancelled tasks leave the board (09 §6). */
export function columnsOf(cards: TaskCard[], memberId: string, roles: readonly Role[]) {
  const doneSince = nowMs() - 14 * DAY;
  const order = byPriority(memberId, roles);
  return Object.fromEntries(
    COLUMNS.map((column) => [
      column,
      cards
        .filter((c) => c.status === column && (column !== 'done' || doneAt(c) >= doneSince))
        .sort(column === 'done' ? (a, b) => doneAt(b) - doneAt(a) : order),
    ]),
  ) as Record<Column, TaskCard[]>;
}

export function sortList(
  cards: TaskCard[],
  { status, sort, desc }: { status: string | null; sort: SortKey; desc: boolean },
  memberId: string,
  roles: readonly Role[],
) {
  const order = byPriority(memberId, roles);
  const compare: Record<SortKey, (a: TaskCard, b: TaskCard) => number> = {
    key: (a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }),
    priority: order,
    status: (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || order(a, b),
    due: (a, b) => dueOf(a) - dueOf(b),
    updated: (a, b) => Date.parse(b.lastEventAt) - Date.parse(a.lastEventAt),
  };
  const dir = desc ? -1 : 1;
  return cards
    .filter((c) => (status ? c.status === status : c.status !== 'cancelled'))
    .sort((a, b) => dir * (compare[sort] ?? order)(a, b));
}
