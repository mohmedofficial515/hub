/**
 * @file Doc: a read-only mirror of a Markdown file (docs/01 §4.1). The indexer moves the status.
 */
import { z } from 'zod';

import { titleSchema } from './card';
import { defineMachine } from './machine';

export const DOC_STATUSES = ['current', 'stale', 'removed'] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export const DOC_KINDS = ['doc', 'adr', 'status', 'readme', 'other'] as const;

export const DOC_MACHINE = defineMachine<DocStatus>({
  statuses: DOC_STATUSES,
  initial: 'current',
  terminal: [],
  transitions: {
    mark_stale: { from: ['current'], to: 'stale' },
    mark_current: { from: ['stale', 'removed'], to: 'current' },
    mark_removed: { from: ['current', 'stale'], to: 'removed' },
  },
});

/** System only: the docs indexer creates doc cards (docs/15 §3). Docs live in Git, so members only read them. */
export const createDocSchema = z.object({
  title: titleSchema,
  repo: z.string().max(80).optional(),
  externalKey: z.string().max(500).optional(),
  detail: z.object({
    sourceId: z.uuid(),
    path: z.string().min(1).max(500),
    kind: z.enum(DOC_KINDS),
    lang: z.enum(['en', 'ar']).optional(),
    headings: z
      .array(z.object({ level: z.number().int(), text: z.string(), anchor: z.string() }))
      .max(1000)
      .optional(),
    wordCount: z.number().int().min(0).optional(),
    lastCommitSha: z.string().max(64).optional(),
    contentHash: z.string().max(128).optional(),
  }),
});
export type CreateDocInput = z.infer<typeof createDocSchema>;
