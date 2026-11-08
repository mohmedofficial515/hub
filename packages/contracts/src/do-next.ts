/**
 * @file Do next (docs/16 §11): a ranked list of what to start, from real state, with no AI. Pure, so Today, the panel and the API rank the same way.
 * @description Open means a task someone could start now (`ready`, or `claimed` and not yet started), a decision still `open`, or the next step of an approved or running plan
 * that has not become a task yet. A task in progress or in review is already moving, and a backlog task was not marked ready. Words live in the web: an item carries reason codes only.
 * The API feeds it what a card list has no room for (a task's effort and each plan's next step) and answers `GET /workspaces/:ws/next`, so the one rule is this function.
 */
import { z } from 'zod';

import { CARD_TYPES, type CardSummary, type Effort, type Priority } from './cards';
import { type Role, roleSchema } from './roles';

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
> & {
  readonly flags: Pick<CardSummary['flags'], 'blocked' | 'overdue'>;
  /** A task's size, when someone gave one. `S` is "ready and small". */
  readonly effort?: Effort | null | undefined;
};

/** The first step not done of an approved or running plan: the step next in line. */
export interface DoNextPlanStep {
  readonly planKey: string;
  readonly planTitle: string;
  readonly planPriority: Priority;
  /** From 0, as a queue run takes it. */
  readonly index: number;
  readonly title: string;
  readonly role: Role | null;
  /** The step's task, once it became one. */
  readonly taskKey: string | null;
}

export const DO_NEXT_REASONS = ['overdue', 'blocks', 'plan_next', 'small', 'ready', 'decision'] as const;
export type DoNextReason = (typeof DO_NEXT_REASONS)[number];

export interface DoNextItem {
  /** The card's key. For a plan step with no task yet, the plan's key. */
  readonly key: string;
  readonly type: CardSummary['type'];
  readonly title: string;
  readonly reasons: readonly DoNextReason[];
  readonly blocks: number;
  /** A task or a plan step can be run. A decision waits for someone to decide it. */
  readonly runnable: boolean;
  readonly score: number;
  /** A task that is its plan's next step. */
  readonly plan?: { readonly key: string; readonly title: string; readonly index: number };
  /** A plan step that is not a task yet: it runs as "Carry out step N of plan KEY". */
  readonly step?: { readonly index: number };
}

export interface DoNextOptions {
  /** Filters on `ownerRole`, and a step on its role. `owner`, null or nothing sees all. */
  readonly role?: Role | null;
  readonly limit?: number;
  /** With a time, a past `dueAt` counts as overdue too. Without one, only the server's flag does. */
  readonly nowMs?: number;
  /** Each plan's next step, from the API. Without them, no plan step is offered. */
  readonly planSteps?: readonly DoNextPlanStep[];
}

const SCORE = { overdue: 100, perBlocked: 30, P0: 25, P1: 12, planNext: 15, small: 8 } as const;
const OPEN_TASK = new Set(['ready', 'claimed']);

const isOpen = (card: DoNextCard): boolean =>
  (card.type === 'task' && OPEN_TASK.has(card.status)) ||
  (card.type === 'decision' && card.status === 'open');

function isOverdue(card: DoNextCard, nowMs: number | undefined): boolean {
  if (card.flags.overdue) return true;
  return nowMs !== undefined && card.dueAt !== null && Date.parse(card.dueAt) < nowMs;
}

function priorityScore(priority: Priority): number {
  if (priority === 'P0') return SCORE.P0;
  return priority === 'P1' ? SCORE.P1 : 0;
}

const seesRole = (role: Role | null | undefined, owned: string | null): boolean =>
  !role || role === 'owner' || owned === role;

/** A stable id for a list: a card's key, or the plan's key and the step. */
export const doNextId = (item: Pick<DoNextItem, 'key' | 'step'>): string =>
  item.step ? `${item.key}#${item.step.index}` : item.key;

export function doNext(cards: readonly DoNextCard[], options: DoNextOptions): DoNextItem[] {
  const { role, limit, nowMs, planSteps = [] } = options;
  const nextOfPlan = new Map(
    planSteps.flatMap((step) => (step.taskKey ? [[step.taskKey, step] as const] : [])),
  );
  const tasks = cards
    .filter((card) => isOpen(card) && !card.flags.blocked && !card.archivedAt && !card.closedAt)
    .filter((card) => seesRole(role, card.ownerRole))
    .map((card): DoNextItem => {
      const overdue = isOverdue(card, nowMs);
      const isTask = card.type === 'task';
      const step = isTask ? nextOfPlan.get(card.key) : undefined;
      const small = isTask && card.effort === 'S';
      const reasons: DoNextReason[] = [];
      if (overdue) reasons.push('overdue');
      if (card.blocksCount > 0) reasons.push('blocks');
      if (step) reasons.push('plan_next');
      if (small) reasons.push('small');
      reasons.push(isTask ? 'ready' : 'decision');
      return {
        key: card.key,
        type: card.type,
        title: card.title,
        reasons,
        blocks: card.blocksCount,
        runnable: isTask,
        score:
          (overdue ? SCORE.overdue : 0) +
          card.blocksCount * SCORE.perBlocked +
          priorityScore(card.priority) +
          (step ? SCORE.planNext : 0) +
          (small ? SCORE.small : 0),
        ...(step ? { plan: { key: step.planKey, title: step.planTitle, index: step.index } } : {}),
      };
    });
  // A step that already became a task is offered as that task, above, and only while the task waits to start.
  const steps = planSteps
    .filter((step) => step.taskKey === null && seesRole(role, step.role))
    .map((step): DoNextItem => ({
      key: step.planKey,
      type: 'plan',
      title: step.title,
      reasons: ['plan_next'],
      blocks: 0,
      runnable: true,
      score: SCORE.planNext + priorityScore(step.planPriority),
      plan: { key: step.planKey, title: step.planTitle, index: step.index },
      step: { index: step.index },
    }));
  const items = [...tasks, ...steps].sort(
    (a, b) => b.score - a.score || doNextId(a).localeCompare(doNextId(b), 'en', { numeric: true }),
  );
  return limit === undefined ? items : items.slice(0, limit);
}

/** The first step not done, of each plan that is approved or running. A plan with every step done has none. */
export function nextPlanSteps(
  plans: readonly {
    readonly key: string;
    readonly title: string;
    readonly status: string;
    readonly priority: Priority;
    readonly archivedAt: string | null;
    readonly steps: readonly {
      readonly title: string;
      readonly role?: string | null | undefined;
      readonly taskKey?: string | null | undefined;
      readonly done: boolean;
    }[];
  }[],
): DoNextPlanStep[] {
  return plans.flatMap((plan) => {
    if (plan.archivedAt || (plan.status !== 'approved' && plan.status !== 'in_progress')) return [];
    const index = plan.steps.findIndex((step) => !step.done);
    const step = plan.steps[index];
    if (!step) return [];
    const role = roleSchema.safeParse(step.role);
    return [
      {
        planKey: plan.key,
        planTitle: plan.title,
        planPriority: plan.priority,
        index,
        title: step.title,
        role: role.success ? role.data : null,
        taskKey: step.taskKey ?? null,
      },
    ];
  });
}

// ── The API's answer ─────────────────────────────────────────────────────────────────────────────

export const doNextQuerySchema = z.object({
  role: roleSchema.optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});
export type DoNextQuery = z.infer<typeof doNextQuerySchema>;

export const doNextItemSchema = z.object({
  key: z.string(),
  type: z.enum(CARD_TYPES),
  title: z.string(),
  reasons: z.array(z.enum(DO_NEXT_REASONS)),
  blocks: z.number().int(),
  runnable: z.boolean(),
  score: z.number(),
  plan: z.object({ key: z.string(), title: z.string(), index: z.number().int() }).optional(),
  step: z.object({ index: z.number().int() }).optional(),
});

export const doNextListSchema = z.object({ items: z.array(doNextItemSchema) });
export type DoNextList = z.infer<typeof doNextListSchema>;
