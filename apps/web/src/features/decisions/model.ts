/**
 * @file model.ts
 * @description Ported from v5 `pages/decisions/model.ts`. Bands come from `dueAt` and `escalatedAt` (09 §7).
 */
import { hoursFromNow } from '@/lib/format';

import type { DecisionCard, Role } from '../cards/types';

export type Band = 'overdue' | 'soon' | 'later';
export const BANDS: Band[] = ['overdue', 'soon', 'later'];

const PRIO = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;

const pastDue = (card: Pick<DecisionCard, 'dueAt' | 'flags'>) =>
  !!(card.flags?.overdue || (card.dueAt && hoursFromNow(card.dueAt) < 0));

/** An escalated decision is already past due. */
export function bandOf(card: DecisionCard): Band {
  if (pastDue(card) || card.decision.escalatedAt) return 'overdue';
  if (card.dueAt && hoursFromNow(card.dueAt) <= 24) return 'soon';
  return 'later';
}

/** Earliest deadline first, nulls last (04 §3.11). */
export const byDeadline = (a: DecisionCard, b: DecisionCard) =>
  (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity) ||
  PRIO[a.priority] - PRIO[b.priority];

/** Most recent outcome first. */
export const closedAt = (card: DecisionCard) => card.decision.decidedAt ?? card.closedAt ?? card.lastEventAt;
export const byOutcome = (a: DecisionCard, b: DecisionCard) =>
  Date.parse(closedAt(b)) - Date.parse(closedAt(a));

/** Routed to one of my roles: this is what "mine" counts, and it matches the sidebar's badge. */
export const routedToMe = (card: DecisionCard, roles: readonly Role[]) =>
  roles.includes(card.decision.deciderRole) ||
  (!!card.decision.escalatedToRole && roles.includes(card.decision.escalatedToRole));

/** How many options the laid-open question shows before the rest fold (review M4). */
export const TABLE_OPTIONS = 3;

/**
 * Recommended options first, at most three showing, the rest folded. The one filled Choose is the recommended option, or the first when none is.
 * With two or more recommended, Hub does not guess which the owner means: none is filled (owner decision 2026-11-05).
 */
export function tableOptions<T extends { id: string; recommended?: boolean | undefined }>(
  options: readonly T[],
) {
  const recommended = options.filter((option) => option.recommended);
  const ordered = [...recommended, ...options.filter((option) => !option.recommended)];
  const filledId = recommended.length >= 2 ? null : (ordered[0]?.id ?? null);
  return { visible: ordered.slice(0, TABLE_OPTIONS), folded: ordered.slice(TABLE_OPTIONS), filledId };
}
