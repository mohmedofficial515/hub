/**
 * @file model.ts
 * @description What the Planning page derives: its lanes, and its one focal card. Which action a card offers comes from the shared rules
 * (`actionsFor`). This file only says which of those the page puts first.
 */
import type { CardAction } from '@/lib/i18n';

import { actionsFor } from '../cards/rules';
import type { IdeaCard, PlanCard, Role } from '../cards/types';

export const ACTIVE_IDEAS = ['exploring', 'open'] as const;
export const CLOSED_IDEAS = ['accepted', 'parked', 'rejected'] as const;
/** The order a reader asks about them: waiting for a yes, ready to start, moving, still being written. */
export const ACTIVE_PLANS = ['in_review', 'approved', 'in_progress', 'draft'] as const;
export const CLOSED_PLANS = ['done', 'abandoned'] as const;

const PRIO = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;

export interface StepProgress {
  done: number;
  total: number;
  /** Steps with no task yet: what "Create tasks from steps" would make. */
  withoutTask: number;
}

export function progressOf(plan: PlanCard): StepProgress {
  const { steps } = plan.plan;
  return {
    done: steps.filter((s) => s.done).length,
    total: steps.length,
    withoutTask: steps.filter((s) => !s.taskKey).length,
  };
}

/** The action a row offers: the first one this member can run that is not a way of ending the card. */
export function nextActionOf(card: IdeaCard | PlanCard, roles: readonly Role[], memberId: string) {
  return actionsFor(card, roles, memberId).find((a) => a.enabled && !a.destructive);
}

/** Lower comes first. A card with no rank has nothing for this member to do. */
function rankOf(card: IdeaCard | PlanCard, action: CardAction | undefined): number | null {
  if (!action) return card.type === 'plan' && card.status === 'in_progress' ? 7 : null;
  if (card.type === 'plan') {
    if (action === 'approve') return 0;
    if (action === 'finish') return 1;
    if (card.status === 'approved') return 2;
    if (card.status === 'in_progress') return 3;
    if (card.status === 'in_review') return 7;
    return 4;
  }
  if (action === 'to_plan') return 5;
  return action === 'explore' ? 6 : null;
}

export interface Focal {
  card: IdeaCard | PlanCard;
  /** Absent when the focal card is only the plan that is moving, with nothing for this member to do. */
  action?: CardAction | undefined;
}

/**
 * The page's one focal card: the next thing it wants from this member. A plan waiting for approval comes first, then work that can
 * start, then an idea ready to become a plan. With nothing to do, it is the plan that is moving, with no filled button.
 */
export function pickFocal(
  cards: readonly (IdeaCard | PlanCard)[],
  roles: readonly Role[],
  memberId: string,
): Focal | null {
  const ranked = cards.flatMap((card) => {
    const action = nextActionOf(card, roles, memberId)?.action;
    const rank = rankOf(card, action);
    return rank === null ? [] : [{ card, action, rank }];
  });
  ranked.sort(
    (a, b) =>
      a.rank - b.rank ||
      PRIO[a.card.priority] - PRIO[b.card.priority] ||
      Date.parse(b.card.lastEventAt) - Date.parse(a.card.lastEventAt),
  );
  const first = ranked[0];
  return first ? { card: first.card, action: first.rank === 7 ? undefined : first.action } : null;
}

/** Mine on this page: what I wrote, and what is routed to my roles. */
export function isMineHere(card: IdeaCard | PlanCard, memberId: string, roles: readonly Role[]) {
  if (card.createdById === memberId) return true;
  if (card.ownerRole && roles.includes(card.ownerRole)) return true;
  if (card.type === 'idea') return !!card.idea.role && roles.includes(card.idea.role);
  return card.plan.steps.some((s) => !!s.role && roles.includes(s.role));
}

/** The first paragraph of Markdown as one plain line, for a row or the focal card. */
export function excerptOf(markdown: string | undefined, length = 220) {
  const text = (markdown ?? '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .find((block) => block && !block.startsWith('#'));
  if (!text) return '';
  const plain = text
    .replace(/^[-*>]\s+/gm, '')
    .replace(/[`*_]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > length ? `${plain.slice(0, length).trimEnd()}…` : plain;
}
