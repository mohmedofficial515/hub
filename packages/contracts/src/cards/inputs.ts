/**
 * @file Payloads of the actions any card type shares (docs/04 §3.8). REST and MCP read the same schemas.
 */
import { z } from 'zod';

import { roleSchema } from '../roles';
import { CARD_LIMITS, prioritySchema, tagsSchema, titleSchema } from './card';

/** `body` allows a plan's limit here; the update action holds other types to `CARD_LIMITS.body`. */
export const updateCardSchema = z.object({
  title: titleSchema.optional(),
  body: z.string().max(CARD_LIMITS.planBody).nullable().optional(),
  priority: prioritySchema.optional(),
  ownerRole: roleSchema.nullable().optional(),
  dueAt: z.iso.datetime().nullable().optional(),
  tags: tagsSchema.optional(),
  module: z.string().max(CARD_LIMITS.module).nullable().optional(),
  assignee: z.uuid().nullable().optional(),
  repo: z.string().max(80).nullable().optional(),
  branch: z.string().max(200).nullable().optional(),
});
export type UpdateCardInput = z.infer<typeof updateCardSchema>;

export const commentBodySchema = z.object({ body: z.string().trim().min(1).max(CARD_LIMITS.comment) });
export type CommentBodyInput = z.infer<typeof commentBodySchema>;

export const reasonSchema = z.object({ reason: z.string().trim().min(1).max(2000) });
export type ReasonInput = z.infer<typeof reasonSchema>;

export const optionalReasonSchema = z.object({ reason: z.string().trim().max(2000).optional() });
export type OptionalReasonInput = z.infer<typeof optionalReasonSchema>;

export const transitionSchema = z.object({
  to: z.string().min(1).max(40),
  reason: z.string().trim().max(2000).optional(),
});
export type TransitionInput = z.infer<typeof transitionSchema>;
