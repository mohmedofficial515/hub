/**
 * @file What reads return, and what list endpoints accept (docs/04 §1.8, §3.8, §3.9). Web and MCP share these.
 */
import { z } from 'zod';

import { roleSchema } from '../roles';
import { CARD_TYPES, cardTypeSchema, prioritySchema } from './card';

/** Accepts `?a=1&a=2`, `?a[]=1` and `?a=1,2`. */
export const queryList = <T extends z.ZodType>(item: T) =>
  z.preprocess((value) => {
    if (value === undefined) return undefined;
    return (Array.isArray(value) ? value : [value]).flatMap((entry) => String(entry).split(','));
  }, z.array(item).optional());

export const queryFlag = z.preprocess(
  (value) => (value === undefined ? undefined : value === true || value === 'true' || value === '1'),
  z.boolean().optional(),
);

export const CARD_FLAGS = ['blocked', 'overdue', 'escalated', 'stale', 'noSummary'] as const;
export type CardFlag = (typeof CARD_FLAGS)[number];
export const CARD_SORTS = ['lastEvent', 'created', 'due', 'priority'] as const;
export type CardSort = (typeof CARD_SORTS)[number];

const pageQuery = {
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

export const cardQuerySchema = z.object({
  type: queryList(cardTypeSchema),
  status: queryList(z.string().max(40)),
  role: queryList(roleSchema),
  /** A user id, or `me`. */
  assignee: z.string().max(40).optional(),
  createdBy: z.string().max(40).optional(),
  repo: queryList(z.string().max(80)),
  module: queryList(z.string().max(40)),
  tag: queryList(z.string().max(40)),
  q: z.string().trim().min(1).max(200).optional(),
  dueBefore: z.iso.datetime().optional(),
  flags: queryList(z.enum(CARD_FLAGS)),
  /** `me`: only cards waiting on the member (review B2). */
  awaiting: z.literal('me').optional(),
  sort: z.enum(CARD_SORTS).optional(),
  ...pageQuery,
});
export type CardQueryInput = z.infer<typeof cardQuerySchema>;

export const timelineQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  types: queryList(cardTypeSchema),
  roles: queryList(roleSchema),
  repos: queryList(z.string().max(80)),
  modules: queryList(z.string().max(40)),
  actors: queryList(z.uuid()),
  kinds: queryList(z.string().max(40)),
  q: z.string().trim().min(1).max(200).optional(),
  mine: queryFlag,
  ...pageQuery,
});
export type TimelineQueryInput = z.infer<typeof timelineQuerySchema>;

export const pageQuerySchema = z.object(pageQuery);
export type PageQueryInput = z.infer<typeof pageQuerySchema>;

export const actorRefSchema = z.object({
  kind: z.enum(['user', 'agent', 'system']),
  userId: z.string().nullable(),
  displayName: z.string().nullable(),
  via: z.string(),
});
export type ActorRef = z.infer<typeof actorRefSchema>;

export const userRefSchema = z.object({ id: z.string(), displayName: z.string() });
export type UserRef = z.infer<typeof userRefSchema>;

export const cardFlagsSchema = z.object({
  blocked: z.boolean(),
  overdue: z.boolean(),
  escalated: z.boolean(),
  stale: z.boolean(),
  noSummary: z.boolean(),
});
export type CardFlags = z.infer<typeof cardFlagsSchema>;

export const cardSummarySchema = z.object({
  id: z.string(),
  key: z.string(),
  type: z.enum(CARD_TYPES),
  title: z.string(),
  status: z.string(),
  priority: prioritySchema,
  ownerRole: z.string().nullable(),
  assignee: z.object({ id: z.string(), displayName: z.string(), avatarColor: z.string() }).nullable(),
  module: z.string().nullable(),
  repo: z.string().nullable(),
  branch: z.string().nullable(),
  tags: z.array(z.string()),
  dueAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  commentCount: z.number().int(),
  lastEventAt: z.string(),
  createdAt: z.string(),
  createdBy: actorRefSchema,
  source: z.string(),
  flags: cardFlagsSchema,
  /** How many open cards wait on this one (docs/09 §6). */
  blocksCount: z.number().int(),
  /** The verb waiting on the current member, or null (review B2). */
  awaiting: z.string().nullable(),
});
export type CardSummary = z.infer<typeof cardSummarySchema>;

export const availableActionSchema = z.object({
  action: z.string(),
  permission: z.string(),
  enabled: z.boolean(),
  needsRole: roleSchema.optional(),
  mode: z.enum(['form', 'confirm', 'now']),
  destructive: z.boolean().optional(),
  reason: z.boolean().optional(),
  selfVerify: z.boolean().optional(),
  targetKey: z.string().optional(),
});

const detailBase = { cardId: z.string() };
const nullableDate = z.string().nullable();
const userRef = userRefSchema.nullable();

export const taskDetailSchema = z.object({
  ...detailBase,
  specialty: z.string(),
  effort: z.string().nullable(),
  acceptance: z.string().nullable(),
  prompt: z.string().nullable(),
  origin: z.string(),
  claimedBy: userRef,
  claimedAt: nullableDate,
  branch: z.string().nullable(),
  prUrl: z.string().nullable(),
  startedAt: nullableDate,
  doneAt: nullableDate,
});

export const decisionOptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  cost: z.string().nullable(),
  recommended: z.boolean(),
});
export type DecisionOption = z.infer<typeof decisionOptionSchema>;

export const decisionDetailSchema = z.object({
  ...detailBase,
  kind: z.string(),
  question: z.string(),
  options: z.array(decisionOptionSchema),
  deciderRole: z.string(),
  chosenOptionId: z.string().nullable(),
  rationale: z.string().nullable(),
  decidedBy: userRef,
  decidedAt: nullableDate,
  remindersSent: z.array(z.number()),
  escalatedAt: nullableDate,
  escalatedToRole: z.string().nullable(),
  adrRepoSourceId: z.string().nullable(),
  adrPath: z.string().nullable(),
  adrPrUrl: z.string().nullable(),
  adrStatus: z.string(),
  adrBody: z.string().nullable(),
});

export const needDetailSchema = z.object({
  ...detailBase,
  kind: z.string(),
  responsibleRole: z.string(),
  location: z.string().nullable(),
  deliveredBy: userRef,
  deliveredAt: nullableDate,
  verifiedBy: userRef,
  verifiedAt: nullableDate,
  verificationNote: z.string().nullable(),
});

export const handoffDetailSchema = z.object({
  ...detailBase,
  fromRole: z.string(),
  toRole: z.string(),
  kind: z.string(),
  severity: z.string(),
  summary: z.string(),
  prompt: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  sourceCardId: z.string().nullable(),
  acknowledgedBy: userRef,
  acknowledgedAt: nullableDate,
  appliedBy: userRef,
  appliedAt: nullableDate,
  appliedTaskId: z.string().nullable(),
});

export const redesignDetailSchema = z.object({
  ...detailBase,
  app: z.string(),
  page: z.string(),
  version: z.string(),
  labPath: z.string(),
  labUrl: z.string(),
  base: z.string().nullable(),
  touchesComponents: z.array(z.string()),
  reviewScore: z.number().nullable(),
  reviewSummary: z.string().nullable(),
  frontMatter: z.record(z.string(), z.unknown()),
  approvedBy: userRef,
  approvedAt: nullableDate,
  rejectedBy: userRef,
  rejectedAt: nullableDate,
  decisionNote: z.string().nullable(),
  portTaskId: z.string().nullable(),
  portedRef: z.string().nullable(),
});

export const docDetailSchema = z.object({
  ...detailBase,
  sourceId: z.string(),
  path: z.string(),
  kind: z.string(),
  lang: z.string(),
  headings: z.array(z.object({ level: z.number(), text: z.string(), anchor: z.string() })),
  wordCount: z.number(),
  lastCommitSha: z.string().nullable(),
  contentHash: z.string().nullable(),
  lastIndexedAt: z.string(),
});

export const releaseDetailSchema = z.object({
  ...detailBase,
  version: z.string(),
  repo: z.string().nullable(),
  tag: z.string().nullable(),
  releasedAt: nullableDate,
  includedIds: z.array(z.string()),
  /** The included cards themselves (docs/04 §3.20), older ones and all. A deleted one drops out. */
  included: z.array(cardSummarySchema).optional(),
  notes: z.object({
    team: z.string().nullable().optional(),
    owner: z.string().nullable().optional(),
    accountant: z.string().nullable().optional(),
  }),
});

export const ideaDetailSchema = z.object({
  ...detailBase,
  problem: z.string().nullable(),
  notes: z.string().nullable(),
  role: z.string().nullable(),
  planCardId: z.string().nullable(),
  /** The Idea Studio chat whose report this idea is, and that report's message (owner decision 9c). */
  sourceChatId: z.string().nullable(),
  sourceMessageId: z.string().nullable(),
});

export const planDetailSchema = z.object({
  ...detailBase,
  steps: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      role: z.string().optional(),
      taskKey: z.string().optional(),
      done: z.boolean(),
      why: z.string().optional(),
      size: z.enum(['S', 'M', 'L']).optional(),
      after: z.array(z.string()).optional(),
      acceptance: z.string().optional(),
      /** One of `phases` by id; absent on a step outside any phase. */
      phaseId: z.string().optional(),
      /** When the step last became done, set by Hub. */
      doneAt: z.string().optional(),
    }),
  ),
  /** The plan's phases in order (v5-live-plan). Empty on a plan saved before phases: its steps read as one list. */
  phases: z.array(z.object({ id: z.string(), title: z.string(), note: z.string().optional() })),
  revision: z.number(),
  sourceIdeaId: z.string().nullable(),
  /** The Plan Studio chat this plan was saved from, and the reply it holds (owner decision 9c). */
  sourceChatId: z.string().nullable(),
  sourceMessageId: z.string().nullable(),
  approvedBy: userRef,
  approvedAt: nullableDate,
});

export const changeDetailSchema = z.object({
  ...detailBase,
  kind: z.string(),
  authorLogin: z.string().nullable(),
  commitCount: z.number(),
  filesChanged: z.number(),
  additions: z.number(),
  deletions: z.number(),
  prNumber: z.number().nullable(),
  prState: z.string().nullable(),
  prUrl: z.string().nullable(),
  session: z.record(z.string(), z.unknown()).nullable(),
});

export const cardDetailSchema = z.union([
  taskDetailSchema,
  decisionDetailSchema,
  needDetailSchema,
  changeDetailSchema,
  handoffDetailSchema,
  redesignDetailSchema,
  docDetailSchema,
  releaseDetailSchema,
  ideaDetailSchema,
  planDetailSchema,
]);

export const cardWithDetailSchema = cardSummarySchema.extend({ detail: cardDetailSchema.nullable() });
/** A list row of a type page. Detail is the row of the type's table, with `*ById` expanded to `{ id, displayName }`. */
export type CardWithDetail = CardSummary & { readonly detail: Readonly<Record<string, unknown>> | null };

export const cardFullSchema = cardWithDetailSchema.extend({
  body: z.string().nullable(),
  links: z.array(
    z.object({
      kind: z.enum(['blocks', 'blocked_by', 'relates', 'parent', 'child', 'duplicates']),
      card: cardSummarySchema,
    }),
  ),
  watchers: z.array(z.object({ userId: z.string(), displayName: z.string(), reason: z.string() })),
  attachments: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      name: z.string(),
      url: z.string(),
      width: z.number().nullable(),
      height: z.number().nullable(),
    }),
  ),
  watching: z.boolean(),
  /** The matrix rows this member holds on this card, whatever its status. */
  allowedActions: z.array(z.string()),
  /** What the card offers now, in display order. From `actionsFor` in `@hub/contracts`. */
  actions: z.array(availableActionSchema),
  /** The action that keeps the card waiting on this member, or null (review B2). */
  awaitedAction: availableActionSchema.nullable(),
});
export type CardFullDto = CardWithDetail & {
  readonly body: string | null;
  readonly links: readonly {
    readonly kind: 'blocks' | 'blocked_by' | 'relates' | 'parent' | 'child' | 'duplicates';
    readonly card: CardSummary;
  }[];
  readonly watchers: readonly {
    readonly userId: string;
    readonly displayName: string;
    readonly reason: string;
  }[];
  readonly attachments: z.infer<typeof cardFullSchema>['attachments'];
  readonly watching: boolean;
  readonly allowedActions: readonly string[];
  readonly actions: z.infer<typeof cardFullSchema>['actions'];
  readonly awaitedAction: z.infer<typeof cardFullSchema>['awaitedAction'];
};

/** A write answers with the card as it now stands, and the event it produced. */
export const cardWrittenSchema = cardFullSchema.extend({
  event: z.object({ id: z.string(), seq: z.number().int(), kind: z.string() }),
});
export type CardWrittenDto = CardFullDto & {
  readonly event: { readonly id: string; readonly seq: number; readonly kind: string };
};

export const eventSchema = z.object({
  id: z.string(),
  seq: z.number().int(),
  kind: z.string(),
  actor: actorRefSchema,
  via: z.string(),
  data: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});
export type CardEventDto = z.infer<typeof eventSchema>;

export const commentSchema = z.object({
  id: z.string(),
  author: actorRefSchema,
  via: z.string(),
  body: z.string().nullable(),
  redacted: z.boolean(),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
});
export type CommentDto = z.infer<typeof commentSchema>;

export const timelineRowSchema = z.object({
  event: eventSchema,
  /** With its detail, so a row can say its facts and inline action without a request per row (docs/08 §5.2). */
  card: cardWithDetailSchema,
  /** How many more events of this card the row folds, the "+n" of docs/03 §5.2: 0 when it is alone. */
  collapsed: z.number().int(),
  collapsedKinds: z.array(z.string()),
});
export type TimelineRow = Omit<z.infer<typeof timelineRowSchema>, 'card'> & { readonly card: CardWithDetail };

export const auditQuerySchema = z.object({
  actor: z.uuid().optional(),
  /** Prefix match, such as `cards.task`. */
  action: z.string().max(100).optional(),
  targetType: z.string().max(40).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  ...pageQuery,
});
export type AuditQueryInput = z.infer<typeof auditQuerySchema>;

export const auditRowSchema = z.object({
  id: z.string(),
  actor: actorRefSchema,
  via: z.string(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  summary: z.string(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string(),
});
export type AuditRow = z.infer<typeof auditRowSchema>;

export const planRevisionSchema = z.object({
  revision: z.number().int(),
  body: z.string().nullable(),
  savedAt: z.string().nullable(),
  actor: actorRefSchema.nullable(),
  current: z.boolean(),
});
export type PlanRevision = z.infer<typeof planRevisionSchema>;
