/**
 * @file Today, counters, briefs and the timeline summary (docs/04 §3.9, §3.19, §3.23). Web and MCP share these.
 * @description Every number is derived from state on each read, so a badge cannot drift from its list. Nothing here is
 * a trend guess: sparklines and trend words stay out until a real counter history exists (docs/15 §8).
 */
import { z } from 'zod';

import { CARD_TYPES } from './cards/card';
import {
  actorRefSchema,
  cardSummarySchema,
  type CardWithDetail,
  cardWithDetailSchema,
  timelineRowSchema,
} from './cards/read-models';

const count = z.number().int();

export const countersSchema = z.object({
  inboxUnread: count,
  /** Every card waiting on me. The sum of what `GET /cards?awaiting=me` lists. */
  awaitingMe: count,
  /** All open decisions in the project. */
  decisionsOpen: count,
  /** Open decisions waiting on me. */
  decisionsMine: count,
  /** Of those, how many are overdue. */
  decisionsOverdue: count,
  /** Requested, in progress or delivered: still open or awaiting a check (review M4). */
  needsOpen: count,
  needsMine: count,
  /** Pending or acknowledged. */
  handoffsPending: count,
  handoffsMine: count,
  tasksReadyForMe: count,
  redesignInReview: count,
  noSummarySessions: count,
  /** The one "since last visit" count. `POST /today/seen` clears it (review M4). */
  newEvents: count,
  onboardingLeft: count,
  /** Owner and pm only; 0 for anyone else. */
  invitesPending: count,
  /** Owner and pm only; 0 for anyone else. Enabled sources failing or lagging. */
  sourceProblems: count,
  /** Ideas open or exploring, and plans not finished. */
  planningOpen: count,
});
export type Counters = z.infer<typeof countersSchema>;

// ── Brief ─────────────────────────────────────────────────────────────────────────────────────────

export const briefCardSchema = z.object({
  key: z.string(),
  type: z.enum(CARD_TYPES),
  title: z.string(),
  status: z.string(),
  priority: z.string(),
  dueAt: z.string().nullable(),
  overdue: z.boolean(),
  escalated: z.boolean(),
  /** The verb waiting on the member, if any. */
  action: z.string().nullable(),
});
export type BriefCard = z.infer<typeof briefCardSchema>;

export const briefSectionsSchema = z.object({
  awaitingMe: z.object({
    decisions: z.array(briefCardSchema),
    needs: z.array(briefCardSchema),
    handoffs: z.array(briefCardSchema),
    reviews: z.array(briefCardSchema),
  }),
  deadlines: z.array(briefCardSchema),
  changes: z.object({
    since: z.string(),
    repos: z.array(
      z.object({
        name: z.string(),
        commitCount: count,
        authors: z.array(z.string()),
        prs: z.array(z.object({ key: z.string(), kind: z.string() })),
      }),
    ),
    sessions: z.array(z.object({ key: z.string(), title: z.string(), author: z.string().nullable() })),
    handoffs: z.array(z.object({ key: z.string(), title: z.string() })),
  }),
  decided: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      option: z.string().nullable(),
      rationale: z.string().nullable(),
    }),
  ),
  readyTasks: z.array(briefCardSchema),
  mySessions: z.array(
    z.object({ sessionId: z.string(), repo: z.string().nullable(), branch: z.string().nullable() }),
  ),
  blocked: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      blockerKey: z.string().nullable(),
      blockerRole: z.string().nullable(),
    }),
  ),
  releases: z.array(z.object({ key: z.string(), version: z.string().nullable(), title: z.string() })),
});
export type BriefSections = z.infer<typeof briefSectionsSchema>;

export const weeklySectionsSchema = z.object({
  from: z.string(),
  to: z.string(),
  counts: z.object({
    byType: z.record(z.string(), count),
    byKind: z.record(z.string(), count),
    commits: count,
    prsMerged: count,
    sessions: count,
    sessionsNoSummary: count,
  }),
  decided: z.array(briefCardSchema),
  released: z.array(briefCardSchema),
  merged: z.array(briefCardSchema),
  handoffs: z.object({
    created: count,
    applied: count,
    pending: z.array(briefCardSchema.extend({ ageHours: count })),
  }),
  needs: z.object({ delivered: count, verified: count, open: count }),
  redesign: z.object({ approved: count, ported: count, inReview: count }),
  overdue: z.array(briefCardSchema),
  nextWeek: z.array(briefCardSchema),
  topRepos: z.array(z.object({ name: z.string(), commits: count })),
  contributors: z.array(z.object({ user: actorRefSchema, events: count })),
});
export type WeeklySections = z.infer<typeof weeklySectionsSchema>;

export const BRIEF_KINDS = ['morning', 'weekly'] as const;
export type BriefKind = (typeof BRIEF_KINDS)[number];

export const briefSchema = z.object({
  id: z.string().nullable(),
  kind: z.enum(BRIEF_KINDS),
  /** `2026-11-04`, or an ISO week `2026-W45`. */
  date: z.string(),
  sections: z.union([briefSectionsSchema, weeklySectionsSchema]),
  /** The sections as Markdown, in the member's language, for agents and copying. */
  markdown: z.string(),
  narrative: z.string().nullable(),
  narrativeBy: z.object({ id: z.string(), displayName: z.string() }).nullable(),
  /** When the narrative was last saved. */
  narrativeAt: z.string().nullable(),
  /** Computed for this read, not stored yet: the morning job has not run (docs/09 §4). */
  generatedNow: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type Brief = z.infer<typeof briefSchema>;

export const saveNarrativeSchema = z.object({ narrative: z.string().trim().min(1).max(6000) });
export type SaveNarrativeInput = z.infer<typeof saveNarrativeSchema>;

export const briefsQuerySchema = z.object({
  kind: z.enum(BRIEF_KINDS).optional(),
  date: z.string().max(10).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type BriefsQueryInput = z.infer<typeof briefsQuerySchema>;

// ── Team (the bottom of Today) ────────────────────────────────────────────────────────────────────

export const TEAM_TOTALS = ['sessions', 'commits', 'prsMerged', 'decided', 'handoffs', 'closed'] as const;

export const teamStatsSchema = z.object({
  /** Monday to Sunday of this ISO week, in the project's timezone. */
  week: z.object({ from: z.string(), to: z.string(), iso: z.string() }),
  /** `prev` is the whole previous ISO week. `available: false` means no source feeds it: show it empty, not 0. */
  totals: z.array(z.object({ key: z.enum(TEAM_TOTALS), value: count, prev: count, available: z.boolean() })),
  /** Cards created and closed this week, per type. Types with neither are left out. */
  flow: z.array(z.object({ type: z.enum(CARD_TYPES), created: count, closed: count })),
  /** The 14 local dates of `activity`, oldest first, ending today. */
  days: z.array(z.string()),
  members: z.array(
    z.object({
      userId: z.string(),
      displayName: z.string(),
      avatarColor: z.string(),
      roles: z.array(z.string()),
      /** Their newest event. There is no presence signal, so no "online" flag. */
      lastActiveAt: z.string().nullable(),
      sessions: count,
      commits: count,
      cardsClosed: count,
      handoffsSent: count,
      /** Events per day, parallel to `days`. */
      activity: z.array(count),
      focus: z.object({ key: z.string(), title: z.string(), type: z.enum(CARD_TYPES) }).nullable(),
    }),
  ),
});
export type TeamStats = z.infer<typeof teamStatsSchema>;

export const SOURCE_HEALTH = ['ok', 'lagging', 'failing', 'never_run'] as const;

export const sourceHealthSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  status: z.enum(SOURCE_HEALTH),
  lagSec: count.nullable(),
  lastSuccessAt: z.string().nullable(),
  lastError: z.string().nullable(),
  /** The folder or repository it reads. */
  target: z.string().nullable(),
  runs24h: count,
  cards24h: count,
});
export type SourceHealth = z.infer<typeof sourceHealthSchema>;

export const noSummarySessionSchema = z.object({
  sessionLogId: z.string(),
  sessionId: z.string(),
  repo: z.string().nullable(),
  branch: z.string().nullable(),
  at: z.string(),
  durationMin: count.nullable(),
  commits: count,
  files: count,
  cardKey: z.string().nullable(),
});
export type NoSummarySession = z.infer<typeof noSummarySessionSchema>;

export const todaySchema = z.object({
  /** The local date, and the project's timezone, so the page need not guess. */
  date: z.string(),
  timezone: z.string(),
  now: z.string(),
  brief: briefSchema,
  /** Same list as `GET /cards?awaiting=me`, so a row and the badge cannot disagree. */
  awaitingMe: z.array(cardWithDetailSchema),
  readyTasks: z.array(cardWithDetailSchema),
  deadlines: z.array(cardSummarySchema),
  noSummarySessions: z.array(noSummarySessionSchema),
  changesSince: z.object({
    since: z.string(),
    /** Newest first, my own left out, folded per card. At most 50 rows. */
    events: z.array(timelineRowSchema),
    /** Events, as in `counters.newEvents`. */
    total: count,
  }),
  counters: countersSchema,
  team: teamStatsSchema,
  /** Enabled sources, problems first. Empty when the project has none. */
  sources: z.array(sourceHealthSchema),
  /** This week's summary, once stored. */
  weekly: briefSchema.nullable(),
});
export type Today = Omit<z.infer<typeof todaySchema>, 'awaitingMe' | 'readyTasks'> & {
  readonly awaitingMe: readonly CardWithDetail[];
  readonly readyTasks: readonly CardWithDetail[];
};

// ── Timeline summary ─────────────────────────────────────────────────────────────────────────────

export const timelineSummaryQuerySchema = z.object({
  period: z.enum(['day', 'week']),
  /** A local date inside the period. Default today. */
  date: z.iso.date().optional(),
});
export type TimelineSummaryQueryInput = z.infer<typeof timelineSummaryQuerySchema>;

export const timelineSummarySchema = z.object({
  from: z.string(),
  to: z.string(),
  byType: z.record(z.string(), count),
  byKind: z.record(z.string(), count),
  decided: z.array(cardSummarySchema),
  released: z.array(cardSummarySchema),
  merged: z.array(cardSummarySchema),
  newHandoffs: z.array(cardSummarySchema),
  newNeeds: z.array(cardSummarySchema),
  topActors: z.array(z.object({ user: actorRefSchema, events: count })),
});
export type TimelineSummary = z.infer<typeof timelineSummarySchema>;
