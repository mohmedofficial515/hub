/**
 * @file Handoff: status machine (docs/01 §4.1, docs/04 §3.13, D25).
 */
import { z } from 'zod';

import { roleSchema, specialtySchema } from '../roles';
import { bodySchema, cardCreateBaseSchema, cardKeySchema, titleSchema } from './card';
import { defineMachine } from './machine';

export const HANDOFF_STATUSES = ['pending', 'acknowledged', 'applied', 'dismissed'] as const;
export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

export const HANDOFF_KINDS = ['contract', 'component', 'design', 'data', 'other'] as const;
export const HANDOFF_SEVERITIES = ['breaking', 'notable', 'info'] as const;

export const HANDOFF_MACHINE = defineMachine<HandoffStatus>({
  statuses: HANDOFF_STATUSES,
  initial: 'pending',
  terminal: ['applied', 'dismissed'],
  transitions: {
    acknowledge: { from: ['pending'], to: 'acknowledged' },
    apply: { from: ['pending', 'acknowledged'], to: 'applied' },
    dismiss: { from: ['pending', 'acknowledged'], to: 'dismissed' },
  },
});

export const createHandoffSchema = cardCreateBaseSchema.extend({
  detail: z.object({
    kind: z.enum(HANDOFF_KINDS),
    fromRole: roleSchema,
    toRole: roleSchema,
    severity: z.enum(HANDOFF_SEVERITIES).optional(),
    summary: z.string().trim().min(1).max(2000),
    prompt: bodySchema.optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
    sourceKey: cardKeySchema.optional(),
  }),
});
export type CreateHandoffInput = z.infer<typeof createHandoffSchema>;

export const acknowledgeHandoffSchema = z.object({ note: z.string().max(2000).optional() });
export type AcknowledgeHandoffInput = z.infer<typeof acknowledgeHandoffSchema>;

export const applyHandoffSchema = z.object({
  /** An existing task that carries the work. */
  taskKey: cardKeySchema.optional(),
  /** Or create one: linked `relates`, its prompt is the handoff's, assigned to the actor. */
  createTask: z.object({ title: titleSchema.optional(), specialty: specialtySchema.optional() }).optional(),
  note: z.string().max(2000).optional(),
});
export type ApplyHandoffInput = z.infer<typeof applyHandoffSchema>;
