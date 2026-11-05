/**
 * @file Idea: something worth thinking about (D29, docs/15 §4).
 * @description `open → exploring → accepted | parked | rejected`; parked and rejected may reopen.
 * "Turn into a plan" moves an idea to accepted from open or exploring.
 */
import { z } from 'zod';

import { roleSchema } from '../roles';
import { bodySchema, createLinksSchema, prioritySchema, tagsSchema, titleSchema } from './card';
import { defineMachine } from './machine';
import { planBodySchema } from './plan';

export const IDEA_STATUSES = ['open', 'exploring', 'accepted', 'parked', 'rejected'] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const IDEA_MACHINE = defineMachine<IdeaStatus>({
  statuses: IDEA_STATUSES,
  initial: 'open',
  terminal: ['accepted', 'rejected'],
  transitions: {
    explore: { from: ['open'], to: 'exploring' },
    accept: { from: ['open', 'exploring'], to: 'accepted' },
    to_plan: { from: ['open', 'exploring'], to: 'accepted' },
    park: { from: ['open', 'exploring'], to: 'parked' },
    reject: { from: ['open', 'exploring'], to: 'rejected' },
    reopen: { from: ['parked', 'rejected'], to: 'open' },
  },
});

export const createIdeaSchema = z.object({
  title: titleSchema,
  body: bodySchema.optional(),
  priority: prioritySchema.optional(),
  tags: tagsSchema.optional(),
  links: createLinksSchema.optional(),
  detail: z.object({
    problem: bodySchema.optional(),
    notes: bodySchema.optional(),
    role: roleSchema.optional(),
  }),
});
export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;

export const updateIdeaSchema = z.object({
  title: titleSchema.optional(),
  body: bodySchema.nullable().optional(),
  priority: prioritySchema.optional(),
  tags: tagsSchema.optional(),
  problem: bodySchema.nullable().optional(),
  notes: bodySchema.nullable().optional(),
  role: roleSchema.nullable().optional(),
});
export type UpdateIdeaInput = z.infer<typeof updateIdeaSchema>;

/** "Turn into a plan". The plan's title defaults to the idea's, its body to the idea's problem and notes. */
export const ideaToPlanSchema = z.object({
  title: titleSchema.optional(),
  body: planBodySchema.optional(),
});
export type IdeaToPlanInput = z.infer<typeof ideaToPlanSchema>;
