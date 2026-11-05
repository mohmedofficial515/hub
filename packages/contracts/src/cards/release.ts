/**
 * @file Release: status machine (docs/01 §4.1, docs/04 §3.20).
 */
import { z } from 'zod';

import { bodySchema, cardCreateBaseSchema, cardKeySchema } from './card';
import { defineMachine } from './machine';

export const RELEASE_STATUSES = ['planned', 'released'] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const RELEASE_MACHINE = defineMachine<ReleaseStatus>({
  statuses: RELEASE_STATUSES,
  initial: 'planned',
  terminal: ['released'],
  transitions: {
    release: { from: ['planned'], to: 'released' },
  },
});

export const RELEASE_AUDIENCES = ['team', 'owner', 'accountant'] as const;
export type ReleaseAudience = (typeof RELEASE_AUDIENCES)[number];

export const createReleaseSchema = cardCreateBaseSchema.extend({
  detail: z.object({
    version: z.string().trim().min(1).max(60),
    repo: z.string().max(80).optional(),
    tag: z.string().max(100).optional(),
    includedKeys: z.array(cardKeySchema).max(500).optional(),
  }),
});
export type CreateReleaseInput = z.infer<typeof createReleaseSchema>;

export const generatedNotesSchema = z.object({
  notes: z.object({
    team: z.string().optional(),
    owner: z.string().optional(),
    accountant: z.string().optional(),
  }),
});
export type GeneratedNotesInput = z.infer<typeof generatedNotesSchema>;

export const editReleaseSchema = z.object({
  version: z.string().trim().min(1).max(60).optional(),
  repo: z.string().max(80).nullable().optional(),
  tag: z.string().max(100).nullable().optional(),
  includedKeys: z.array(cardKeySchema).max(500).optional(),
  notes: z
    .object({
      team: bodySchema.nullable().optional(),
      owner: bodySchema.nullable().optional(),
      accountant: bodySchema.nullable().optional(),
    })
    .optional(),
});
export type EditReleaseInput = z.infer<typeof editReleaseSchema>;

export const releaseSchema = z.object({ releasedAt: z.iso.datetime().optional() });
export type ReleaseInput = z.infer<typeof releaseSchema>;
