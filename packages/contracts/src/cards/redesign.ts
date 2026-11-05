/**
 * @file Redesign: status machine, mirrors the lab front-matter (docs/01 §4.1, docs/10 §4).
 * @description `reference` is the v1-baseline: it has no moves. request_changes stays in `review`
 * (docs/01 and docs/10), and docs/04 §3.14 is corrected to match.
 */
import { z } from 'zod';

import { titleSchema } from './card';
import { defineMachine } from './machine';

export const REDESIGN_STATUSES = ['draft', 'review', 'approved', 'rejected', 'ported', 'reference'] as const;
export type RedesignStatus = (typeof REDESIGN_STATUSES)[number];

export const REDESIGN_MACHINE = defineMachine<RedesignStatus>({
  statuses: REDESIGN_STATUSES,
  initial: 'draft',
  terminal: ['rejected', 'ported', 'reference'],
  transitions: {
    send_to_review: { from: ['draft'], to: 'review' },
    approve: { from: ['review'], to: 'approved' },
    reject: { from: ['review'], to: 'rejected' },
    request_changes: { from: ['review'], to: 'review' },
    mark_ported: { from: ['approved'], to: 'ported' },
  },
});

/** System only: the lab scanner creates redesign cards (docs/06 §5). */
export const createRedesignSchema = z.object({
  title: titleSchema,
  body: z.string().max(20_000).optional(),
  status: z.enum(REDESIGN_STATUSES).optional(),
  externalKey: z.string().max(300).optional(),
  detail: z.object({
    app: z.string().min(1).max(40),
    page: z.string().min(1).max(100),
    version: z.string().min(1).max(100),
    labPath: z.string().min(1).max(300),
    labUrl: z.string().min(1).max(500),
    base: z.string().max(100).optional(),
    touchesComponents: z.array(z.string().max(200)).max(200).optional(),
    reviewScore: z.number().int().optional(),
    reviewSummary: z.string().max(2000).optional(),
    frontMatter: z.record(z.string(), z.unknown()).optional(),
    readmeHash: z.string().min(1).max(128),
  }),
});
export type CreateRedesignInput = z.infer<typeof createRedesignSchema>;

export const approveRedesignSchema = z.object({
  note: z.string().max(2000).optional(),
  createPortTask: z.boolean().default(true),
});
export type ApproveRedesignInput = z.infer<typeof approveRedesignSchema>;

export const redesignNoteSchema = z.object({ note: z.string().trim().min(1).max(2000) });
export type RedesignNoteInput = z.infer<typeof redesignNoteSchema>;

export const markPortedSchema = z.object({ ref: z.string().trim().min(1).max(300) });
export type MarkPortedInput = z.infer<typeof markPortedSchema>;
