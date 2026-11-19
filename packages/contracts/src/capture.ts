/**
 * @file Claude Code sessions: the `log_session` input and the SessionEnd hook payload (docs/05 §3.5, docs/06 §4).
 * @description Both sides meet on `sessionId`, so a summary and Git facts arriving in either order end on one card.
 */
import { z } from 'zod';

import { cardKeySchema, HANDOFF_KINDS, HANDOFF_SEVERITIES, prioritySchema, titleSchema } from './cards';
import { roleSchema, specialtySchema } from './roles';

export const sessionIdSchema = z.string().min(8).max(128);

export const logSessionSchema = z.object({
  sessionId: sessionIdSchema,
  repo: z.string().max(80).optional(),
  branch: z.string().max(200).optional(),
  changed: z.string().trim().min(1).max(4000),
  remaining: z.string().max(4000).optional(),
  handoffs: z
    .array(
      z.object({
        toRole: roleSchema,
        kind: z.enum(HANDOFF_KINDS),
        severity: z.enum(HANDOFF_SEVERITIES).optional(),
        title: titleSchema,
        summary: z.string().trim().min(1).max(2000),
        prompt: z.string().max(4000).optional(),
      }),
    )
    .max(10)
    .optional(),
  followUps: z
    .array(
      z.object({
        title: titleSchema,
        specialty: specialtySchema,
        priority: prioritySchema.optional(),
        body: z.string().max(4000).optional(),
      }),
    )
    .max(10)
    .optional(),
  cardKeys: z.array(cardKeySchema).max(20).optional(),
  commits: z
    .array(z.string().regex(/^[0-9a-f]{7,40}$/))
    .max(100)
    .optional(),
  durationSec: z.number().int().min(0).max(604_800).optional(),
});
export type LogSessionInput = z.infer<typeof logSessionSchema>;

export const HOOK_REASONS = ['clear', 'resume', 'logout', 'prompt_input_exit', 'other', 'sigterm'] as const;

export const hookCommitSchema = z.object({
  sha: z.string().regex(/^[0-9a-f]{7,40}$/),
  message: z.string().max(500),
  at: z.iso.datetime({ offset: true }).optional(),
});

/** What the SessionEnd hook posts: Git facts only, never a summary. */
export const hookSessionPayloadSchema = z.object({
  sessionId: sessionIdSchema,
  reason: z.enum(HOOK_REASONS).optional(),
  cwd: z.string().max(500),
  remote: z.string().max(300).nullable().optional(),
  branch: z.string().max(200).nullable().optional(),
  startSha: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .nullable()
    .optional(),
  headSha: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .nullable()
    .optional(),
  commits: z.array(hookCommitSchema).max(200).default([]),
  filesChanged: z.number().int().min(0).default(0),
  additions: z.number().int().min(0).default(0),
  deletions: z.number().int().min(0).default(0),
  dirtyFiles: z.number().int().min(0).default(0),
  startedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  endedAt: z.iso.datetime({ offset: true }),
  durationSec: z.number().int().min(0).nullable().optional(),
  hasSummary: z.boolean().default(false),
  /** The first prompt the member typed, read from the local transcript. Gives the facts card a real title. */
  topic: z.string().max(300).nullable().optional(),
  /** The last thing Claude said, read from the local transcript. */
  outcome: z.string().max(800).nullable().optional(),
  client: z.object({ os: z.string().max(40), packVersion: z.string().max(20) }).optional(),
});
export type HookSessionPayload = z.infer<typeof hookSessionPayloadSchema>;

export const hookSessionResultSchema = z.object({
  sessionLogId: z.string(),
  cardKey: z.string().nullable(),
  project: z.string(),
});

export const sessionContextQuerySchema = z.object({ cwd: z.string().max(500).optional() });

/** `GET /me/context`. `project` is null only when the member belongs to no project. */
export const sessionContextSchema = z.object({
  project: z.string().nullable(),
  text: z.string(),
});

/** Creates the `change` card of a session. `sessionId` is its idempotency key. */
export const createSessionChangeSchema = z.object({
  title: titleSchema,
  body: z.string().max(20_000).nullable().optional(),
  repo: z.string().max(80).nullable().optional(),
  branch: z.string().max(200).nullable().optional(),
  sessionId: sessionIdSchema,
  remaining: z.string().max(4000).nullable().optional(),
  changed: z.string().max(4000).nullable().optional(),
  noSummary: z.boolean(),
  durationSec: z.number().int().min(0).nullable().optional(),
  facts: z
    .object({
      commits: z.array(z.unknown()).max(200),
      filesChanged: z.number().int().min(0),
      additions: z.number().int().min(0),
      deletions: z.number().int().min(0),
    })
    .optional(),
});
export type CreateSessionChangeInput = z.infer<typeof createSessionChangeSchema>;
