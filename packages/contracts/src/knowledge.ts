/**
 * @file Docs, search and the lab's read models (docs/04 §3.9, §3.14, §3.15, §3.23). Web and MCP share these.
 */
import { z } from 'zod';

import {
  cardSummarySchema,
  cardTypeSchema,
  type CardWithDetail,
  cardWithDetailSchema,
  queryFlag,
  queryList,
} from './cards';
import { DOC_KINDS } from './cards/doc';

export const docsTreeQuerySchema = z.object({ source: z.uuid().optional() });

/** A folder of a source. `docs` are cards with their detail; `folders` nest the same way. */
export interface DocFolder {
  readonly name: string;
  readonly path: string;
  readonly docs: readonly CardWithDetail[];
  readonly folders: readonly DocFolder[];
}

export const docFolderSchema: z.ZodType<DocFolder> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    docs: z.array(cardWithDetailSchema),
    folders: z.array(docFolderSchema),
  }),
);

export const docsTreeSchema = z.array(
  z.object({
    source: z.object({ id: z.string(), name: z.string() }),
    root: docFolderSchema,
    total: z.number().int(),
  }),
);

export const docMentionsSchema = z.array(
  z.object({
    /** As the card's text wrote it. */
    mention: z.string(),
    key: z.string(),
    path: z.string(),
    source: z.string(),
    title: z.string(),
  }),
);
export type DocMentions = z.infer<typeof docMentionsSchema>;

export const docContentSchema = z.object({
  /** The file as it is now, front-matter removed. Null when the file is gone or holds something like a secret. */
  content: z.string().nullable(),
  /** Why `content` is null. */
  unavailable: z.enum(['missing', 'secret']).nullable(),
  /** The source's name and id. `source` on the card is where it came from: `docs`. */
  docSource: z.object({ id: z.string(), name: z.string() }),
  toc: z.array(z.object({ level: z.number().int(), text: z.string(), anchor: z.string() })),
  /** Cards whose text mentions this document's path (H5-03). */
  mentionedBy: z.array(cardSummarySchema),
});
export type DocContent = z.infer<typeof docContentSchema>;

export const docByPathQuerySchema = z.object({
  source: z.string().min(1).max(100),
  path: z.string().min(1).max(500),
});

export const docSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(200),
  kinds: queryList(z.enum(DOC_KINDS)),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const docHitSchema = z.object({
  card: cardSummarySchema,
  path: z.string(),
  source: z.string(),
  chunks: z.array(
    z.object({
      heading: z.string().nullable(),
      anchor: z.string().nullable(),
      /** HTML-escaped text with `<mark>` around each match: the one tag it can hold. */
      excerpt: z.string(),
      rank: z.number(),
    }),
  ),
});
export type DocHit = z.infer<typeof docHitSchema>;

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(200),
  types: queryList(cardTypeSchema),
  includeDocs: queryFlag,
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;

export const searchResultSchema = z.object({
  cards: z.array(cardSummarySchema.extend({ rank: z.number(), highlight: z.string() })),
  docs: z.array(docHitSchema),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const runAcceptedSchema = z.object({ runId: z.string() });

export const reindexSchema = z.object({ source: z.uuid().optional() });

// ── Lab ──────────────────────────────────────────────────────────────────────────────────────────

export const labPageSchema = z.object({
  app: z.string(),
  page: z.string(),
  route: z.string().nullable(),
  liveUrl: z.string().nullable(),
  /** The page brief's own status. */
  status: z.string().nullable(),
  /** The page brief as Markdown. */
  brief: z.string().nullable(),
  /** Oldest version first. */
  versions: z.array(cardWithDetailSchema),
});
export type LabPage = Omit<z.infer<typeof labPageSchema>, 'versions'> & {
  readonly versions: readonly CardWithDetail[];
};

export const labReadmeSchema = z.object({
  markdown: z.string().nullable(),
  review: z.string().nullable(),
});

export const compareQuerySchema = z.object({
  a: z.string().min(1).max(30),
  b: z.string().min(1).max(30),
});

const compareSideSchema = z.object({
  card: cardWithDetailSchema,
  /** Screenshots served by the API, grouped by file name, so the two sides pair up. */
  shots: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      width: z.number().nullable(),
      height: z.number().nullable(),
    }),
  ),
  /** The running lab, or null when `LAB_URL` is not set. */
  frameUrl: z.string().nullable(),
});

export const compareSchema = z.object({
  a: compareSideSchema,
  b: compareSideSchema,
  /** Shot names both sides have. */
  commonShots: z.array(z.string()),
});

export const SYSTEM_QUEUE_SCHEMA = z.object({
  name: z.string(),
  waiting: z.number().int(),
  active: z.number().int(),
  failed: z.number().int(),
  delayed: z.number().int(),
});

export const systemSchema = z.object({
  version: z.object({ api: z.string(), web: z.string().nullable(), lab: z.string().nullable() }),
  sources: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.string(),
      enabled: z.boolean(),
      lagSec: z.number().int().nullable(),
      lastError: z.string().nullable(),
      lastSuccessAt: z.string().nullable(),
      consecutiveFailures: z.number().int(),
    }),
  ),
  /** Empty when Redis cannot answer. */
  queues: z.array(SYSTEM_QUEUE_SCHEMA),
  outbox: z.object({
    pending: z.number().int(),
    failed: z.number().int(),
    oldestPendingAgeSec: z.number().int().nullable(),
  }),
  sse: z.object({ connections: z.number().int() }),
  /** No backup job runs in this release, so both are null: an honest "not connected" (docs/15 §3). */
  backup: z.object({ lastAt: z.string().nullable(), sizeBytes: z.number().int().nullable() }),
  db: z.object({ sizeBytes: z.number().int(), cards: z.number().int(), events: z.number().int() }),
  worker: z.object({ alive: z.boolean(), lastHeartbeatAt: z.string().nullable() }),
});
export type SystemData = z.infer<typeof systemSchema>;
