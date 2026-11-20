/**
 * @file Plan: a written approach that becomes work (D29, docs/15 §4).
 * @description `draft → in_review → approved → in_progress → done`, and `abandoned` from any state.
 * The body lives on `cards.body`; every save adds a `plan_revised` event that keeps the previous text.
 * "Create tasks from steps" moves the plan to in_progress from any open status, because docs/15 §4 says the plan
 * moves on the first task and the demo there runs it straight after drafting. Request changes sends a plan in review
 * back to draft with a reason (owner decision 9b, 2026-11-19).
 */
import { z } from 'zod';

import { roleSchema, specialtySchema } from '../roles';
import {
  CARD_LIMITS,
  cardKeySchema,
  createLinksSchema,
  prioritySchema,
  tagsSchema,
  titleSchema,
} from './card';
import { defineMachine } from './machine';

export const PLAN_STATUSES = ['draft', 'in_review', 'approved', 'in_progress', 'done', 'abandoned'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_MACHINE = defineMachine<PlanStatus>({
  statuses: PLAN_STATUSES,
  initial: 'draft',
  terminal: ['done', 'abandoned'],
  transitions: {
    submit_review: { from: ['draft'], to: 'in_review' },
    approve: { from: ['in_review'], to: 'approved' },
    request_changes: { from: ['in_review'], to: 'draft' },
    start: { from: ['approved'], to: 'in_progress' },
    to_tasks: { from: ['draft', 'in_review', 'approved', 'in_progress'], to: 'in_progress' },
    finish: { from: ['in_progress'], to: 'done' },
    abandon: { from: ['draft', 'in_review', 'approved', 'in_progress', 'done'], to: 'abandoned' },
  },
});

/** A step's size: S is about an hour, M about a day, L more (the Plan Studio's weights are 1, 3 and 8). */
export const PLAN_STEP_SIZE_VALUES = ['S', 'M', 'L'] as const;
const stepIdSchema = z.string().min(1).max(64);
const stepTextSchema = z.string().trim().min(1).max(2_000);

/** The most phases a plan holds: the plan page's journey map is drawn for up to 20 stops. */
export const PLAN_PHASES_MAX = 20;

/**
 * A phase of a plan: a named part of its steps, in the order of `phases` (the plan page's journey, owner approval of v5-live-plan, 2026-11-19).
 * A step names its phase by `phaseId`. A plan saved before phases has none, and its steps read as one unnamed list.
 */
export const planPhaseSchema = z.object({
  id: stepIdSchema,
  title: titleSchema,
  /** One line after the title, such as who carries it or a rule for it. */
  note: z.string().trim().min(1).max(300).optional(),
});
export type PlanPhase = z.infer<typeof planPhaseSchema>;

/** The phases in order, each id once. */
export const planPhasesSchema = z
  .array(planPhaseSchema)
  .max(PLAN_PHASES_MAX)
  .refine((phases) => new Set(phases.map((phase) => phase.id)).size === phases.length, {
    message: 'Each phase id is used once',
  });

/** What a file of a step's evidence shows: the step's screen before, after, or a clip of it (v5-live-plan, batch 3). */
export const PLAN_EVIDENCE_KINDS = ['before', 'after', 'video'] as const;
export type PlanEvidenceKind = (typeof PLAN_EVIDENCE_KINDS)[number];
/** The most files one step keeps. */
export const PLAN_STEP_EVIDENCE_MAX = 10;
/** The largest picture and clip Hub takes, in bytes. A picture is drawn again (at most 2560 wide and 16000 high) before it is kept. */
export const PLAN_EVIDENCE_LIMITS = { imageBytes: 8 * 1024 * 1024, videoBytes: 40 * 1024 * 1024 } as const;

/**
 * One file of a step's evidence: an attachment of the plan card, served at `GET /cards/{key}/attachments/{attachmentId}/file`. Hub's own: written by
 * `POST /plans/{key}/steps/{stepId}/evidence` and the MCP `add_step_evidence`, never by a plan save. `via` is `mcp` when Claude attached it.
 */
export const planStepEvidenceSchema = z.object({
  attachmentId: z.string(),
  kind: z.enum(PLAN_EVIDENCE_KINDS),
  caption: z.string().trim().min(1).max(200).optional(),
  mime: z.string(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  addedAt: z.iso.datetime({ offset: true }),
  via: z.enum(['web', 'mcp']),
  /** Who added it: they may remove it again, as may the plan's owner, a pm and its creator. */
  addedBy: z.string().nullable().optional(),
  /** A picture has a small WebP at `…/file?size=thumb`. */
  thumb: z.boolean().optional(),
});
export type PlanStepEvidence = z.infer<typeof planStepEvidenceSchema>;

// ── The explainer video (v5-live-plan, batch 4) ───────────────────────────────────────────────────

/** How Hams explains the plan. `whiteboard` is Hams' hand-drawn board; the rest are its explainer types. */
export const EXPLAINER_STYLES = ['whiteboard', 'slides', 'motion', 'kinetic', 'data', 'mixed'] as const;
/** Gemini TTS voices offered; Charon is the default (owner's choice, 2026-11-19). */
export const EXPLAINER_GOOGLE_VOICES = [
  'Charon',
  'Fenrir',
  'Puck',
  'Orus',
  'Kore',
  'Aoede',
  'Leda',
  'Zephyr',
] as const;
/** The largest explainer files Hub takes, in bytes: a film up to 120 MB (owner, 2026-11-20; a step's clip stays at 40 MB). */
export const PLAN_EXPLAINER_LIMITS = {
  videoBytes: 120 * 1024 * 1024,
  posterBytes: 8 * 1024 * 1024,
  captionsBytes: 512 * 1024,
} as const;

/** What the owner asks Hams for. `voice` google sends the script's text to Google for the voice, and nothing else; `hams` stays on the machine. */
export const explainerRequestSchema = z.object({
  style: z.enum(EXPLAINER_STYLES).default('whiteboard'),
  voice: z.enum(['google', 'hams', 'none']).default('google'),
  googleVoice: z.enum(EXPLAINER_GOOGLE_VOICES).default('Charon'),
  dialect: z.enum(['egyptian', 'msa']).default('egyptian'),
  aspect: z.enum(['landscape', 'portrait', 'square']).default('landscape'),
  length: z.enum(['chapters', 'short']).default('chapters'),
  captions: z.boolean().default(true),
});
export type ExplainerRequest = z.infer<typeof explainerRequestSchema>;

/** A chapter of the film: the plan's phase it explains (null for the intro and the close), and where it starts in seconds. */
export const explainerChapterSchema = z.object({
  phaseId: z.string().nullable(),
  title: z.string().trim().min(1).max(200).optional(),
  start: z.number().min(0).max(36_000),
});

/**
 * A plan's explainer, Hub's own: `requested` from the page (the agent queue then runs it with Claude on the owner's machine, through Hams'
 * plan-film), `ready` once the run attached the film. `revision` is the plan revision it explains: a newer one makes it outdated. Its files are
 * attachments of the plan card. `hamsProject` is set when the run named Hams' project, for "Open in Hams".
 */
export const planExplainerSchema = z.object({
  status: z.enum(['requested', 'ready']),
  request: explainerRequestSchema,
  revision: z.number().int().min(1),
  requestedAt: z.iso.datetime({ offset: true }),
  attachmentId: z.string().optional(),
  posterId: z.string().optional(),
  captionsId: z.string().optional(),
  chapters: z.array(explainerChapterSchema).max(60).optional(),
  hamsProject: z.object({ id: z.string().min(1).max(200), url: z.url() }).optional(),
  madeAt: z.iso.datetime({ offset: true }).optional(),
  /** The film last attached, kept while a new one is made, so the page still plays it. */
  previous: z
    .object({
      attachmentId: z.string(),
      posterId: z.string().optional(),
      captionsId: z.string().optional(),
      chapters: z.array(explainerChapterSchema).max(60).optional(),
      revision: z.number().int(),
      request: explainerRequestSchema,
    })
    .optional(),
});
export type PlanExplainer = z.infer<typeof planExplainerSchema>;

/** The fields sent beside the file. */
export const addStepEvidenceSchema = z.object({
  kind: z.enum(PLAN_EVIDENCE_KINDS),
  caption: z.string().trim().min(1).max(200).optional(),
});
export type AddStepEvidenceInput = z.infer<typeof addStepEvidenceSchema>;

/**
 * One step. `why`, `size`, `after` and `acceptance` are what the Plan Studio proposed for it (owner decision 9a, 2026-11-19), so a page reads them
 * as data. `after` names earlier steps of the same plan by id; Hub drops any that is not an earlier step. `phaseId` names one of the plan's
 * `phases`; Hub refuses an id that is not one. `doneAt` is Hub's: when the step last became done, for the plan page's finish estimate.
 */
export const planStepSchema = z.object({
  id: stepIdSchema,
  title: titleSchema,
  role: roleSchema.optional(),
  taskKey: cardKeySchema.optional(),
  done: z.boolean().default(false),
  why: stepTextSchema.optional(),
  size: z.enum(PLAN_STEP_SIZE_VALUES).optional(),
  after: z.array(stepIdSchema).max(50).optional(),
  acceptance: stepTextSchema.optional(),
  phaseId: stepIdSchema.optional(),
  doneAt: z.iso.datetime({ offset: true }).optional(),
  evidence: z.array(planStepEvidenceSchema).max(PLAN_STEP_EVIDENCE_MAX).optional(),
});
export type PlanStep = z.infer<typeof planStepSchema>;

/** A step as a client writes it: Hub gives it an id when it has none. `taskKey` and `done` follow its task, and Hub sets `doneAt` and keeps `evidence`. */
export const planStepInputSchema = planStepSchema
  .omit({ doneAt: true, evidence: true })
  .extend({ id: planStepSchema.shape.id.optional() });
export type PlanStepInput = z.infer<typeof planStepInputSchema>;

export const planBodySchema = z.string().max(CARD_LIMITS.planBody);

/** The studio chat a card was saved from, and the reply it holds (owner decision 9c): every member's browser finds the session from the card. */
export const sourceChatFields = {
  sourceChatId: z.uuid().optional(),
  sourceMessageId: z.uuid().optional(),
};

export const createPlanSchema = z.object({
  title: titleSchema,
  body: planBodySchema.optional(),
  priority: prioritySchema.optional(),
  tags: tagsSchema.optional(),
  links: createLinksSchema.optional(),
  detail: z.object({
    steps: z.array(planStepInputSchema).max(200).default([]),
    phases: planPhasesSchema.optional(),
    sourceIdeaKey: cardKeySchema.optional(),
    ...sourceChatFields,
  }),
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = z.object({
  title: titleSchema.optional(),
  body: planBodySchema.optional(),
  priority: prioritySchema.optional(),
  tags: tagsSchema.optional(),
  steps: z.array(planStepInputSchema).max(200).optional(),
  /** The whole list, in order. Absent keeps the phases as they are. */
  phases: planPhasesSchema.optional(),
  ...sourceChatFields,
});
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const restorePlanRevisionSchema = z.object({ revision: z.number().int().min(1) });

export const planToTasksSchema = z.object({
  /** Specialty of a step with no role. Default `ops`. */
  defaultSpecialty: specialtySchema.optional(),
});
export type PlanToTasksInput = z.infer<typeof planToTasksSchema>;
