/**
 * @file model.ts
 * @description What the Planning page derives: its lanes, and its one focal card. Which action a card offers comes from the shared rules
 * (`actionsFor`). This file only says which of those the page puts first.
 */
import type { CardAction } from '@/lib/i18n';

import { actionsFor } from '../cards/rules';
import type { CardEvent, IdeaCard, PlanCard, PlanStep, Role } from '../cards/types';

export const ACTIVE_IDEAS = ['exploring', 'open'] as const;
export const CLOSED_IDEAS = ['accepted', 'parked', 'rejected'] as const;
/** The order a reader asks about them: waiting for a yes, ready to start, moving, still being written. */
export const ACTIVE_PLANS = ['in_review', 'approved', 'in_progress', 'draft'] as const;
export const CLOSED_PLANS = ['done', 'abandoned'] as const;

const PRIO = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;

/** The road a card travels, for the stage track on its page. A status off the road (abandoned, parked, rejected) has no place on it. */
export const PLAN_ROAD = ['draft', 'in_review', 'approved', 'in_progress', 'done'] as const;
export const IDEA_ROAD = ['open', 'exploring', 'accepted'] as const;

export function roadOf(card: IdeaCard | PlanCard): { road: readonly string[]; at: number; off: boolean } {
  const road: readonly string[] = card.type === 'plan' ? PLAN_ROAD : IDEA_ROAD;
  const at = road.indexOf(card.status);
  return { road, at, off: at < 0 };
}

/** The step to work on next: the first one not done. Its task, when it has one, is what "Run the next step" works on. */
export function nextStepOf(plan: PlanCard) {
  const { steps } = plan.plan;
  const step = steps.find((s) => !s.done);
  return step ? { index: steps.indexOf(step), step } : null;
}

/**
 * The steps a save will leave, predicted the way the API writes them (`plan-steps.ts`): a step that names a step already there keeps its task, and keeps
 * that task's done when it has one, else takes the done it was sent; a new step gets an id for now, until the API answers with its own. In the order sent.
 */
export function mergeSteps(
  existing: readonly PlanStep[],
  input: readonly {
    id?: string | undefined;
    title: string;
    role?: Role | undefined;
    taskKey?: string | undefined;
    done?: boolean | undefined;
    why?: string | undefined;
    size?: PlanStep['size'];
    after?: string[] | undefined;
    acceptance?: string | undefined;
  }[],
): PlanStep[] {
  const byId = new Map(existing.map((s) => [s.id, s]));
  const byTask = new Map(existing.flatMap((s) => (s.taskKey ? [[s.taskKey, s] as const] : [])));
  return input.map((step, index) => {
    const before =
      (step.taskKey ? byTask.get(step.taskKey) : undefined) ?? (step.id ? byId.get(step.id) : undefined);
    const taskKey = before?.taskKey ?? step.taskKey;
    return {
      id: before?.id ?? step.id ?? `tmp-${index}`,
      title: step.title,
      ...(step.role ? { role: step.role } : {}),
      ...(taskKey ? { taskKey } : {}),
      done: before?.taskKey ? before.done : (step.done ?? false),
      ...(step.why ? { why: step.why } : {}),
      ...(step.size ? { size: step.size } : {}),
      ...(step.after?.length ? { after: step.after } : {}),
      ...(step.acceptance ? { acceptance: step.acceptance } : {}),
    };
  });
}

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

/**
 * What the page says comes next, worked out from the plan itself: which step, whose move, what is missing. An idea, and a plan that has ended, keep their
 * status's own sentence (`status`).
 */
export type Guide =
  | { kind: 'status' }
  | { kind: 'noSteps' }
  | { kind: 'review' }
  | { kind: 'approve' }
  | { kind: 'waitApproval' }
  | { kind: 'createTasks'; n: number }
  | { kind: 'start' }
  | { kind: 'step'; index: number; total: number; title: string; taskKey: string }
  | { kind: 'stepNoTask'; index: number; total: number }
  | { kind: 'finish' };

export function guideOf(card: IdeaCard | PlanCard, roles: readonly Role[], memberId: string): Guide {
  if (card.type !== 'plan') return { kind: 'status' };
  const { steps } = card.plan;
  const { withoutTask } = progressOf(card);
  switch (card.status) {
    case 'draft':
      return steps.length === 0 ? { kind: 'noSteps' } : { kind: 'review' };
    case 'in_review':
      return actionsFor(card, roles, memberId).some((a) => a.action === 'approve' && a.enabled)
        ? { kind: 'approve' }
        : { kind: 'waitApproval' };
    case 'approved':
      if (steps.length === 0) return { kind: 'noSteps' };
      return withoutTask > 0 ? { kind: 'createTasks', n: withoutTask } : { kind: 'start' };
    case 'in_progress': {
      const next = nextStepOf(card);
      if (!next) return { kind: 'finish' };
      if (!next.step.taskKey) return { kind: 'stepNoTask', index: next.index, total: steps.length };
      return {
        kind: 'step',
        index: next.index,
        total: steps.length,
        title: next.step.title,
        taskKey: next.step.taskKey,
      };
    }
    default:
      return { kind: 'status' };
  }
}

const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

/** What the API keeps on a plan beyond its steps: who approved it and when, and its text's revision. Read as it came, without widening the card's type. */
export function planFacts(card: PlanCard): { approvedById?: string; approvedAt?: string; revision?: number } {
  const detail = card.plan as unknown as Record<string, unknown>;
  const approvedById = text(detail['approvedById']);
  const approvedAt = text(detail['approvedAt']);
  const revision = typeof detail['revision'] === 'number' ? detail['revision'] : undefined;
  return {
    ...(approvedById ? { approvedById } : {}),
    ...(approvedAt ? { approvedAt } : {}),
    ...(revision ? { revision } : {}),
  };
}

/** The plan an idea became, by id, as a list row carries it (`planCardId`). */
export const planIdOfIdea = (card: IdeaCard) =>
  text((card.idea as unknown as Record<string, unknown>)['planCardId']);

/** The idea a plan came from, by id, as a list row carries it (`sourceIdeaId`). */
export const ideaIdOfPlan = (card: PlanCard) =>
  text((card.plan as unknown as Record<string, unknown>)['sourceIdeaId']);

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

/** Why a draft plan is back: the reason of the Request changes that sent it there (owner decision 9b). */
export interface ChangeRequest {
  reason: string;
  actorKind: CardEvent['actorKind'];
  actorId?: string | undefined;
  at: string;
}

/** The change request a draft plan is waiting on: its latest status move was Request changes. Anything since (a new submit) clears it. */
export function changeRequestOf(status: string, events: readonly CardEvent[]): ChangeRequest | null {
  if (status !== 'draft') return null;
  let last: CardEvent | undefined;
  for (const event of events) {
    if (event.data['to'] === undefined && event.kind !== 'changes_requested') continue;
    if (!last || event.seq > last.seq) last = event;
  }
  const reason = last?.kind === 'changes_requested' ? last.data['reason'] : undefined;
  if (!last || typeof reason !== 'string' || !reason.trim()) return null;
  return { reason, actorKind: last.actorKind, actorId: last.actorId, at: last.at };
}
