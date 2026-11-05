/**
 * @file Inbox (docs/04 §3.17, docs/07 §1). Web and MCP share these.
 * @description `InboxItem.data.action` names the card action the item asks for. The button shows only while the
 * card still offers it (`card.awaiting`), so a stale item never offers work already done.
 */
import { z } from 'zod';

import { cardSummarySchema, queryFlag, queryList } from './cards/read-models';

export const NOTIFICATION_KINDS = [
  'routed_decision',
  'routed_need',
  'routed_handoff',
  'routed_review',
  'routed_idea',
  'mention',
  'watch_update',
  'deadline_reminder',
  'escalation',
  'unblocked',
  'task_ready',
  'review_requested',
  'brief',
  'system',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const inboxQuerySchema = z.object({
  unread: queryFlag,
  /** True for the archive; the default leaves archived items out. */
  archived: queryFlag,
  kinds: queryList(z.enum(NOTIFICATION_KINDS)),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type InboxQueryInput = z.infer<typeof inboxQuerySchema>;

export const inboxItemSchema = z.object({
  id: z.string(),
  kind: z.enum(NOTIFICATION_KINDS),
  title: z.string(),
  body: z.string().nullable(),
  card: cardSummarySchema.nullable(),
  data: z.object({
    cardKey: z.string().optional(),
    action: z.string().optional(),
    /** How many updates a merged `watch_update` holds (docs/07 §2). */
    count: z.number().int().optional(),
  }),
  groupKey: z.string().nullable(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
});
export type InboxItem = z.infer<typeof inboxItemSchema>;

export const inboxCountSchema = z.object({
  unread: z.number().int(),
  awaitingMe: z.object({
    decisions: z.number().int(),
    needs: z.number().int(),
    handoffs: z.number().int(),
    reviews: z.number().int(),
  }),
});
export type InboxCount = z.infer<typeof inboxCountSchema>;

export const readAllSchema = z.object({ before: z.iso.datetime().optional() });
export type ReadAllInput = z.infer<typeof readAllSchema>;
