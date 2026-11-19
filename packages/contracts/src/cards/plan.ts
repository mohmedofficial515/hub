/**
 * @file Plan: a written approach that becomes work (D29, docs/15 §4).
 * @description `draft → in_review → approved → in_progress → done`, and `abandoned` from any state.
 * The body lives on `cards.body`; every save adds a `plan_revised` event that keeps the previous text.
 * "Create tasks from steps" moves the plan to in_progress from any open status, because docs/15 §4 says the plan
 * moves on the first task and the demo there runs it straight after drafting. Request changes sends a plan in review
 * back to draft with a reason (owner decision 9b, 2026-11-19).
 */
import { z } from 'zod';

import { roleSchema, specialtySchema } from '../roles';
import {
  CARD_LIMITS,
  cardKeySchema,
  createLinksSchema,
  prioritySchema,
  tagsSchema,
  titleSchema,
} from './card';
import { defineMachine } from './machine';

export const PLAN_STATUSES = ['draft', 'in_review', 'approved', 'in_progress', 'done', 'abandoned'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_MACHINE = defineMachine<PlanStatus>({
  statuses: PLAN_STATUSES,
  initial: 'draft',
  terminal: ['done', 'abandoned'],
  transitions: {
    submit_review: { from: ['draft'], to: 'in_review' },
    approve: { from: ['in_review'], to: 'approved' },
    request_changes: { from: ['in_review'], to: 'draft' },
    start: { from: ['approved'], to: 'in_progress' },
    to_tasks: { from: ['draft', 'in_review', 'approved', 'in_progress'], to: 'in_progress' },
    finish: { from: ['in_progress'], to: 'done' },
    abandon: { from: ['draft', 'in_review', 'approved', 'in_progress', 'done'], to: 'abandoned' },
  },
});

/** A step's size: S is about an hour, M about a day, L more (the Plan Studio's weights are 1, 3 and 8). */
export const PLAN_STEP_SIZE_VALUES = ['S', 'M', 'L'] as const;
const stepIdSchema = z.string().min(1).max(64);
const stepTextSchema = z.string().trim().min(1).max(2_000);

/**
 * One step. `why`, `size`, `after` and `acceptance` are what the Plan Studio proposed for it (owner decision 9a, 2026-11-19), so a page reads them
 * as data. `after` names earlier steps of the same plan by id; Hub drops any that is not an earlier step.
 */
export const planStepSchema = z.object({
  id: stepIdSchema,
  title: titleSchema,
  role: roleSchema.optional(),
  taskKey: cardKeySchema.optional(),
  done: z.boolean().default(false),
  why: stepTextSchema.optional(),
  size: z.enum(PLAN_STEP_SIZE_VALUES).optional(),
  after: z.array(stepIdSchema).max(50).optional(),
  acceptance: stepTextSchema.optional(),
});
export type PlanStep = z.infer<typeof planStepSchema>;

/** A step as a client writes it: Hub gives it an id when it has none. `taskKey` and `done` follow its task. */
export const planStepInputSchema = planStepSchema.extend({ id: planStepSchema.shape.id.optional() });
export type PlanStepInput = z.infer<typeof planStepInputSchema>;

export const planBodySchema = z.string().max(CARD_LIMITS.planBody);

/** The studio chat a card was saved from, and the reply it holds (owner decision 9c): every member's browser finds the session from the card. */
export const sourceChatFields = {
  sourceChatId: z.uuid().optional(),
  sourceMessageId: z.uuid().optional(),
};

export const createPlanSchema = z.object({
  title: titleSchema,
  body: planBodySchema.optional(),
  priority: prioritySchema.optional(),
  tags: tagsSchema.optional(),
  links: createLinksSchema.optional(),
  detail: z.object({
    steps: z.array(planStepInputSchema).max(200).default([]),
    sourceIdeaKey: cardKeySchema.optional(),
    ...sourceChatFields,
  }),
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = z.object({
  title: titleSchema.optional(),
  body: planBodySchema.optional(),
  priority: prioritySchema.optional(),
  tags: tagsSchema.optional(),
  steps: z.array(planStepInputSchema).max(200).optional(),
  ...sourceChatFields,
});
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const restorePlanRevisionSchema = z.object({ revision: z.number().int().min(1) });

export const planToTasksSchema = z.object({
  /** Specialty of a step with no role. Default `ops`. */
  defaultSpecialty: specialtySchema.optional(),
});
export type PlanToTasksInput = z.infer<typeof planToTasksSchema>;
