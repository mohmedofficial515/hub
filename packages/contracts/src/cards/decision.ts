/**
 * @file Decision: status machine (docs/01 §4.1, docs/04 §3.11). Flags `overdue` and `escalated` are derived.
 */
import { z } from 'zod';

import { roleSchema } from '../roles';
import { bodySchema, cardCreateBaseSchema, cardKeySchema } from './card';
import { defineMachine } from './machine';

export const DECISION_STATUSES = ['open', 'decided', 'withdrawn', 'superseded'] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const DECISION_KINDS = ['product', 'technical', 'financial', 'design'] as const;

export const DECISION_MACHINE = defineMachine<DecisionStatus>({
  statuses: DECISION_STATUSES,
  initial: 'open',
  terminal: ['decided', 'withdrawn', 'superseded'],
  transitions: {
    decide: { from: ['open'], to: 'decided' },
    withdraw: { from: ['open'], to: 'withdrawn' },
    // docs/01 lists open, docs/04 lists decided; both are real situations.
    supersede: { from: ['open', 'decided'], to: 'superseded' },
  },
});

export const decisionOptionInputSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]{1,64}$/)
    .optional(),
  title: z.string().trim().min(1).max(200),
  pros: z.array(z.string().max(500)).max(20).optional(),
  cons: z.array(z.string().max(500)).max(20).optional(),
  cost: z.string().max(200).optional(),
  recommended: z.boolean().optional(),
});
export type DecisionOptionInput = z.infer<typeof decisionOptionInputSchema>;

/** Fewer than 2 options answers `hub.decisions.options_min`, from the action. */
export const decisionOptionsSchema = z.array(decisionOptionInputSchema).max(8);

export const createDecisionSchema = cardCreateBaseSchema.extend({
  detail: z.object({
    kind: z.enum(DECISION_KINDS),
    question: z.string().trim().min(1).max(2000),
    options: decisionOptionsSchema,
    deciderRole: roleSchema,
    adrRepoSourceId: z.uuid().optional(),
  }),
});
export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;

export const editDecisionOptionsSchema = z.object({ options: decisionOptionsSchema });
export type EditDecisionOptionsInput = z.infer<typeof editDecisionOptionsSchema>;

export const decideSchema = z.object({
  optionId: z.string().min(1).max(64),
  rationale: z.string().trim().min(1).max(2000),
});
export type DecideInput = z.infer<typeof decideSchema>;

export const supersedeDecisionSchema = z.object({ byKey: cardKeySchema });
export type SupersedeDecisionInput = z.infer<typeof supersedeDecisionSchema>;

export const draftAdrSchema = z.object({ body: bodySchema.min(1), path: z.string().max(300).optional() });
export type DraftAdrInput = z.infer<typeof draftAdrSchema>;
