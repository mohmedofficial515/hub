/**
 * @file Fields common to every card, and validation limits (docs/04 §1.8).
 */
import { z } from 'zod';

export const CARD_TYPES = [
  'task',
  'decision',
  'need',
  'change',
  'handoff',
  'redesign',
  'doc',
  'release',
  'idea',
  'plan',
] as const;
export type CardType = (typeof CARD_TYPES)[number];
export const cardTypeSchema = z.enum(CARD_TYPES);

export const PRIORITIES = ['P0', 'P1', 'P2', 'P3'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const prioritySchema = z.enum(PRIORITIES);

export const EFFORTS = ['S', 'M', 'L', 'XL'] as const;
export type Effort = (typeof EFFORTS)[number];
export const effortSchema = z.enum(EFFORTS);

export const CARD_KEY_PATTERN = /^[A-Z]{2,6}-\d{1,7}$/;
export const cardKeySchema = z.string().regex(CARD_KEY_PATTERN);

export const CARD_LIMITS = {
  title: 200,
  body: 20_000,
  /** A plan's body is its whole written approach (docs/15 §4). */
  planBody: 100_000,
  comment: 10_000,
  tags: 20,
  tag: 40,
  module: 40,
} as const;

export const titleSchema = z.string().trim().min(1).max(CARD_LIMITS.title);
export const bodySchema = z.string().max(CARD_LIMITS.body);
export const tagsSchema = z
  .array(
    z
      .string()
      .min(1)
      .max(CARD_LIMITS.tag)
      .regex(/^[a-z0-9-]+$/),
  )
  .max(CARD_LIMITS.tags);

export const CARD_LINK_KINDS = ['blocks', 'relates', 'parent', 'duplicates'] as const;
export type CardLinkKind = (typeof CARD_LINK_KINDS)[number];

/** What a client may send: `blocked_by` and `child` are stored as the inverse row of `blocks` and `parent`. */
export const LINK_INPUT_KINDS = ['blocks', 'blocked_by', 'relates', 'parent', 'child', 'duplicates'] as const;
export type LinkInputKind = (typeof LINK_INPUT_KINDS)[number];
export const linkInputSchema = z.object({ kind: z.enum(LINK_INPUT_KINDS), key: cardKeySchema });
export type LinkInput = z.infer<typeof linkInputSchema>;
export const createLinksSchema = z.array(linkInputSchema).max(10);

/** Fields a create payload shares. */
export const cardCreateBaseSchema = z.object({
  title: titleSchema,
  body: bodySchema.optional(),
  priority: prioritySchema.optional(),
  dueAt: z.iso.datetime().optional(),
  tags: tagsSchema.optional(),
  module: z.string().max(CARD_LIMITS.module).optional(),
  repo: z.string().max(80).optional(),
  links: createLinksSchema.optional(),
});

export const CARD_SOURCES = ['manual', 'github', 'openapi', 'session', 'lab', 'docs', 'import'] as const;
export type CardSource = (typeof CARD_SOURCES)[number];
