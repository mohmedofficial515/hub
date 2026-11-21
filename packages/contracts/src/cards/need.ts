/**
 * @file Need: status machine (docs/01 §4.1, docs/04 §3.12). Self-verification is allowed with a note (D24).
 */
import { z } from 'zod';

import { roleSchema } from '../roles';
import { cardCreateBaseSchema } from './card';
import { defineMachine } from './machine';

export const NEED_STATUSES = ['requested', 'in_progress', 'delivered', 'verified', 'cancelled'] as const;
export type NeedStatus = (typeof NEED_STATUSES)[number];

export const NEED_KINDS = ['token', 'account', 'contract', 'value_check', 'file', 'access', 'other'] as const;

export const NEED_MACHINE = defineMachine<NeedStatus>({
  statuses: NEED_STATUSES,
  initial: 'requested',
  terminal: ['verified', 'cancelled'],
  transitions: {
    start: { from: ['requested'], to: 'in_progress' },
    deliver: { from: ['requested', 'in_progress'], to: 'delivered' },
    verify: { from: ['delivered'], to: 'verified' },
    reject_delivery: { from: ['delivered'], to: 'in_progress' },
    cancel: { from: ['requested', 'in_progress', 'delivered'], to: 'cancelled' },
  },
});

export const createNeedSchema = cardCreateBaseSchema.extend({
  detail: z.object({ kind: z.enum(NEED_KINDS), responsibleRole: roleSchema }),
});
export type CreateNeedInput = z.infer<typeof createNeedSchema>;

/** A missing location answers `hub.needs.location_required`, from the action. */
export const deliverNeedSchema = z.object({
  location: z.string().trim().max(500).optional(),
  note: z.string().max(2000).optional(),
});
export type DeliverNeedInput = z.infer<typeof deliverNeedSchema>;

/** Verifying your own delivery requires the note (D24), from the action. */
export const verifyNeedSchema = z.object({ note: z.string().trim().max(2000).optional() });
export type VerifyNeedInput = z.infer<typeof verifyNeedSchema>;
