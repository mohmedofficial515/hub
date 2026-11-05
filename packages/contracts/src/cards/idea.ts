/**
 * @file Idea: something worth thinking about (D29, docs/15 §4).
 * @description `open → exploring → accepted | parked | rejected`; parked and rejected may reopen.
 * "Turn into a plan" moves an idea to accepted from open or exploring.
 */
import { z } from 'zod';

import { roleSchema } from '../roles';
import { bodySchema, prioritySchema, tagsSchema, titleSchema } from './card';
import { defineMachine } from './machine';

export const IDEA_STATUSES = ['open', 'exploring', 'accepted', 'parked', 'rejected'] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const IDEA_MACHINE = defineMachine<IdeaStatus>({
  statuses: IDEA_STATUSES,
  initial: 'open',
  terminal: ['accepted', 'rejected'],
  transitions: {
    explore: { from: ['open'], to: 'exploring' },
    accept: { from: ['open', 'exploring'], to: 'accepted' },
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
  detail: z.object({
    problem: bodySchema.optional(),
    notes: bodySchema.optional(),
    role: roleSchema.optional(),
  }),
});
export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;
