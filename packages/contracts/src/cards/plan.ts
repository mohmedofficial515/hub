/**
 * @file Plan: a written approach that becomes work (D29, docs/15 §4).
 * @description `draft → in_review → approved → in_progress → done`, and `abandoned` from any state.
 * The body lives on `cards.body`; every save adds a `plan_revised` event that keeps the previous text.
 * "Create tasks from steps" moves the plan to in_progress from any open status, because docs/15 §4 says the plan
 * moves on the first task and the demo there runs it straight after drafting.
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
    start: { from: ['approved'], to: 'in_progress' },
    to_tasks: { from: ['draft', 'in_review', 'approved', 'in_progress'], to: 'in_progress' },
    finish: { from: ['in_progress'], to: 'done' },
    abandon: { from: ['draft', 'in_review', 'approved', 'in_progress', 'done'], to: 'abandoned' },
  },
});

export const planStepSchema = z.object({
  id: z.string().min(1).max(64),
  title: titleSchema,
  role: roleSchema.optional(),
  taskKey: cardKeySchema.optional(),
  done: z.boolean().default(false),
});
export type PlanStep = z.infer<typeof planStepSchema>;

/** A step as a client writes it: Hub gives it an id when it has none. `taskKey` and `done` follow its task. */
export const planStepInputSchema = planStepSchema.extend({ id: planStepSchema.shape.id.optional() });
export type PlanStepInput = z.infer<typeof planStepInputSchema>;

export const planBodySchema = z.string().max(CARD_LIMITS.planBody);

export const createPlanSchema = z.object({
  title: titleSchema,
  body: planBodySchema.optional(),
  priority: prioritySchema.optional(),
  tags: tagsSchema.optional(),
  links: createLinksSchema.optional(),
  detail: z.object({
    steps: z.array(planStepInputSchema).max(200).default([]),
    sourceIdeaKey: cardKeySchema.optional(),
  }),
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = z.object({
  title: titleSchema.optional(),
  body: planBodySchema.optional(),
  priority: prioritySchema.optional(),
  tags: tagsSchema.optional(),
  steps: z.array(planStepInputSchema).max(200).optional(),
});
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const restorePlanRevisionSchema = z.object({ revision: z.number().int().min(1) });

export const planToTasksSchema = z.object({
  /** Specialty of a step with no role. Default `ops`. */
  defaultSpecialty: specialtySchema.optional(),
});
export type PlanToTasksInput = z.infer<typeof planToTasksSchema>;
