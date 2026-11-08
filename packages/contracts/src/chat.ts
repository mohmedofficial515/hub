/**
 * @file The chat panel's contract (docs/16 §7, §7.1, S1 "Event mapping"): modes, the stable turn events, and what the API answers.
 * @description `TurnEvent` is the only shape that leaves the bridge. Raw Claude Code events stop at `packages/bridge/lib/claude-events.mjs`, so one Claude Code update changes one mapper. A value the
 * engine does not report is absent, never guessed. Text is capped per message with `CHAT_LIMITS`, and everything stored passes `redactDeep` first (`secret-patterns.ts`).
 */
import { z } from 'zod';

import { cardKeySchema } from './cards';
import { saveDocSchema } from './knowledge';
import { absolutePath } from './projects';
import { chatSuggestionSchema, chatSuggestionsSchema } from './suggestions';

export const CHAT_MODES = ['ask', 'plan', 'execute'] as const;
export type ChatMode = (typeof CHAT_MODES)[number];

export const CHAT_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ChatEffort = (typeof CHAT_EFFORTS)[number];

/** An alias or a full name. It reaches a program as one argument, so it may not start with a dash. */
export const chatModelSchema = z.string().regex(/^[a-z0-9][a-z0-9.\-[\]]{0,63}$/i);

/** Bounds on what one chat can store (the owner's disk filled once from an unbounded log). */
export const CHAT_LIMITS = {
  messageChars: 200_000,
  promptChars: 50_000,
  toolInputChars: 20_000,
  toolOutputChars: 40_000,
  commandChars: 4_000,
  stepsPerTurn: 400,
  changedFiles: 300,
  diffBytes: 200_000,
  contextChars: 20_000,
  draftChars: 200_000,
  reportChecks: 50,
  reportText: 2_000,
  questionsPerCall: 8,
} as const;

/** The stored text ends with this when the rest was cut. */
export const CHAT_TRUNCATED_MARK = '\n[… truncated by Hub: the rest is not stored]';

export function capText(text: string, limit: number): { text: string; truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false };
  return { text: `${text.slice(0, limit)}${CHAT_TRUNCATED_MARK}`, truncated: true };
}

// ── Protocol stages (docs/16 §7.1) ─────────────────────────────────────────────────────────────────

export const WORK_STAGES = ['understand', 'plan', 'execute', 'verify', 'report'] as const;
export const DOC_STAGES = ['search', 'propose', 'draft', 'save', 'link'] as const;
export const CHAT_PROTOCOLS = { work: WORK_STAGES, doc: DOC_STAGES } as const;
export type ChatProtocol = keyof typeof CHAT_PROTOCOLS;
export const STAGE_STATES = ['started', 'done', 'failed'] as const;
export type StageState = (typeof STAGE_STATES)[number];

export const stageReportSchema = z.object({
  protocol: z.enum(['work', 'doc']),
  stage: z.enum([...WORK_STAGES, ...DOC_STAGES]),
  state: z.enum(STAGE_STATES),
  note: z.string().max(500).optional(),
});
export type StageReport = z.infer<typeof stageReportSchema>;

/** A stage must belong to the protocol it names. Kept apart from the schema so the MCP table can extend the object. */
export function stageFitsProtocol(report: Pick<StageReport, 'protocol' | 'stage'>): boolean {
  return (CHAT_PROTOCOLS[report.protocol] as readonly string[]).includes(report.stage);
}

export const changedFileSchema = z.object({
  path: z.string().max(1000),
  /** `tool`: a Write or Edit step named it. `git`: the folder's Git state moved during the turn. `claimed`: only Claude said so, in a report, and no bridge fact backs it. */
  source: z.enum(['tool', 'git', 'claimed']),
  status: z.string().max(4).optional(),
  additions: z.number().int().optional(),
  deletions: z.number().int().optional(),
});
export type ChangedFile = z.infer<typeof changedFileSchema>;

// ── Structured results (§7.2, D50, D52) ─────────────────────────────────────────────────────────────
// Models are unreliable narrators, so the server keeps what it verified apart from what was claimed. The fields below are what the panel renders.

export const CHECK_OUTCOMES = ['passed', 'failed', 'skipped'] as const;
export type CheckOutcome = (typeof CHECK_OUTCOMES)[number];

/** `report_work`'s input. `verified`, `basis` and `runs` are the server's, so they are not here. A model usually cannot see a step's id, so a `command` alone is enough for the server to find its runs. */
export const reportWorkSchema = z.object({
  card: cardKeySchema,
  summary: z.string().trim().min(1).max(CHAT_LIMITS.reportText),
  checks: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        command: z.string().max(CHAT_LIMITS.commandChars).optional(),
        stepId: z.string().max(100).optional(),
        outcome: z.enum(CHECK_OUTCOMES),
        note: z.string().max(CHAT_LIMITS.reportText).optional(),
      }),
    )
    .max(CHAT_LIMITS.reportChecks),
  changedFiles: z.array(z.string().max(1000)).max(CHAT_LIMITS.changedFiles).optional(),
  notChecked: z.array(z.string().max(CHAT_LIMITS.reportText)).max(CHAT_LIMITS.reportChecks),
});
export type ReportWorkInput = z.infer<typeof reportWorkSchema>;

/**
 * What a check's claim rests on. `matched`: the claim agrees with the last real run of this exact command. `outside_panel`: no steps exist to check against, so it stays claimed. `no_command`: nothing to match. `no_matching_step`: no step ran this command.
 * `step_mismatch`: the named step ran something else. `not_finished`: its run has no result. `outcome_differs`: reported failed or skipped while its last real run succeeded. Only `passed` with `matched` is `verified`.
 */
export const CHECK_BASES = [
  'matched',
  'outside_panel',
  'no_command',
  'no_matching_step',
  'step_mismatch',
  'not_finished',
  'outcome_differs',
] as const;
export type CheckBasis = (typeof CHECK_BASES)[number];

/** One real run of a check's command, oldest first. A failure stays here after a later pass (review M3). `excerpt` is the end of its real output, filtered. */
export const checkRunSchema = z.object({
  stepId: z.string(),
  status: z.enum(['passed', 'failed', 'cut_off', 'running']),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  excerpt: z.string().optional(),
});
export type CheckRun = z.infer<typeof checkRunSchema>;

export const reportedCheckSchema = z.object({
  name: z.string(),
  command: z.string().nullable(),
  /** The real step the verdict rests on, set by the server: the last run, or the one named. */
  stepId: z.string().nullable(),
  outcome: z.enum(CHECK_OUTCOMES),
  note: z.string().nullable(),
  verified: z.boolean(),
  basis: z.enum(CHECK_BASES),
  runs: z.array(checkRunSchema),
});
export type ReportedCheck = z.infer<typeof reportedCheckSchema>;

/** Why a task did or did not move (D52). Only `all_verified` moves it. */
export const REPORT_MOVE_REASONS = [
  'all_verified',
  'no_checks',
  'check_not_passed',
  'check_not_verified',
  'check_dropped',
  'outside_panel',
  'not_a_task',
  'wrong_status',
  'not_permitted',
] as const;
export type ReportMoveReason = (typeof REPORT_MOVE_REASONS)[number];

export const workReportSchema = z.object({
  id: z.string(),
  cardKey: z.string(),
  origin: z.enum(['panel', 'outside_panel']),
  chatId: z.string().nullable(),
  messageId: z.string().nullable(),
  summary: z.string(),
  checks: z.array(reportedCheckSchema),
  changedFiles: z.array(changedFileSchema),
  /** `bridge`: the device's own facts. `claimed`: the bridge had none, so these are Claude's words. */
  filesFrom: z.enum(['bridge', 'claimed', 'none']),
  notChecked: z.array(z.string()),
  /** Checks an earlier report in this chat named and this one left out. Any of them stops the move. */
  droppedChecks: z.array(z.string()),
  counts: z.object({
    total: z.number().int(),
    passed: z.number().int(),
    failed: z.number().int(),
    skipped: z.number().int(),
    verified: z.number().int(),
    /** Real runs that failed, across every check, including ones a later run fixed. */
    failedRuns: z.number().int(),
  }),
  move: z.object({
    moved: z.boolean(),
    reason: z.enum(REPORT_MOVE_REASONS),
    from: z.string().nullable(),
    to: z.string().nullable(),
  }),
  reportedAt: z.string(),
});
export type WorkReport = z.infer<typeof workReportSchema>;

export const proposedPlanSchema = z.object({
  title: z.string().trim().min(1).max(200),
  steps: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(500),
        role: z.string().max(40).optional(),
        why: z.string().max(CHAT_LIMITS.reportText).optional(),
      }),
    )
    .min(1)
    .max(50),
  checks: z.array(z.string().max(CHAT_LIMITS.reportText)).max(CHAT_LIMITS.reportChecks).optional(),
  risks: z.array(z.string().max(CHAT_LIMITS.reportText)).max(CHAT_LIMITS.reportChecks).optional(),
});
export type ProposedPlan = z.infer<typeof proposedPlanSchema>;

/** One question of `AskUserQuestion`, in Hub's own shape: the mapper is what knows the engine's. */
export const chatQuestionItemSchema = z.object({
  text: z.string().max(2_000),
  header: z.string().max(100).optional(),
  multiSelect: z.boolean(),
  options: z
    .array(z.object({ label: z.string().max(200), description: z.string().max(1_000).optional() }))
    .max(20),
});
export type ChatQuestionItem = z.infer<typeof chatQuestionItemSchema>;
/** `auto_answered`: an automatic queue run (D58) took the recommended option on the owner's behalf. */
export const QUESTION_STATUSES = [
  'pending',
  'answered',
  'declined',
  'timed_out',
  'stopped',
  'auto_answered',
] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const CLAIM_STATUSES = ['verified', 'unverified'] as const;
/** The owner's answer to a flag. `confirm`: true, keep it as fact. `remove`: take it out. `keep_flagged`: save it, marked as not verified in the text. */
export const CLAIM_ANSWERS = ['confirm', 'remove', 'keep_flagged'] as const;
export type ClaimAnswer = (typeof CLAIM_ANSWERS)[number];
/** The line an unverified claim wears in a saved document (`keep_flagged`). */
export const UNVERIFIED_MARK = '> Unverified: ';

/** `propose_doc`'s input. Duplicates are the server's, so Claude cannot pass any. An unverified claim's `text` must appear in `draft` word for word, so the owner's answer can act on it. */
export const proposeDocSchema = z.object({
  doc: cardKeySchema.optional(),
  /** A new file: the docs source and path it would go to. */
  source: z.string().max(100).optional(),
  path: z.string().max(500).optional(),
  title: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(CHAT_LIMITS.reportText),
  /** The `Version:` of the text this draft was written from. */
  baseVersion: z.string().max(100).optional(),
  draft: z.string().min(1).max(CHAT_LIMITS.draftChars),
  claims: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(CHAT_LIMITS.reportText),
        status: z.enum(CLAIM_STATUSES),
        source: z.string().max(500).optional(),
      }),
    )
    .max(100),
});
export type ProposeDocInput = z.infer<typeof proposeDocSchema>;

/**
 * `save_doc` as Claude calls it. With `draft`, the text and version are the draft's, and `content` is not needed. `answers` holds the owner's words about each flag, and counts only outside a panel chat: in one, the owner answers through the panel.
 */
export const saveDocToolSchema = saveDocSchema.partial({ content: true }).extend({
  draft: z.uuid().optional(),
  answers: z
    .array(z.object({ id: z.string().max(40), answer: z.enum(CLAIM_ANSWERS) }))
    .max(100)
    .optional(),
});

export const docClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  status: z.enum(CLAIM_STATUSES),
  source: z.string().nullable(),
  /** Null while unanswered. A verified claim needs no answer. */
  answer: z.enum(CLAIM_ANSWERS).nullable(),
});
export type DocClaim = z.infer<typeof docClaimSchema>;

/** A real document that looks like this draft, found by the server. `url` opens it in Hub. */
export const docDuplicateSchema = z.object({
  key: z.string(),
  title: z.string(),
  source: z.string(),
  path: z.string(),
  url: z.string(),
  /** A line of what overlaps, from the search index. */
  overlap: z.string().nullable(),
});
export type DocDuplicate = z.infer<typeof docDuplicateSchema>;

export const DOC_DRAFT_STATUSES = ['open', 'saved', 'refused', 'dropped'] as const;
export type DocDraftStatus = (typeof DOC_DRAFT_STATUSES)[number];

export const chatDocDraftSchema = z.object({
  id: z.string(),
  /** Null when this is a new document. */
  docKey: z.string().nullable(),
  source: z.string().nullable(),
  path: z.string().nullable(),
  title: z.string(),
  reason: z.string(),
  baseVersion: z.string().nullable(),
  /** The current text the draft is compared with. Null for a new document. */
  baseText: z.string().nullable(),
  draft: z.string(),
  duplicates: z.array(docDuplicateSchema),
  claims: z.array(docClaimSchema),
  status: z.enum(DOC_DRAFT_STATUSES),
  /** A refusal's error code, such as `hub.docs.stale_base` or `hub.docs.draft_flags_open`. */
  refusedCode: z.string().nullable(),
  /**
   * The file as it stood when a stale save was refused, so the owner can see what moved under the draft. `version` is null when the file is gone. Filtered and capped. Null unless `refusedCode` is `hub.docs.stale_base`.
   */
  conflict: z.object({ version: z.string().nullable(), text: z.string() }).nullable(),
  savedVersion: z.string().nullable(),
  revisionId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ChatDocDraftDto = z.infer<typeof chatDocDraftSchema>;

/** Why a process started for this turn. `mode`, `model` and `effort` are restarts (§7.2), and all of these take about ten seconds (S1 Q2). */
export const START_REASONS = ['new', 'resume', 'mode', 'model', 'effort', 'folder'] as const;
export type StartReason = (typeof START_REASONS)[number];

const engineWarningFields = {
  code: z.literal('newer_than_tested'),
  version: z.string().max(40),
  testedMax: z.string().max(40),
};

const toolBlockedFields = {
  toolUseId: z.string().max(100),
  name: z.string().max(200),
  /** The exact command or the tool's main input, filtered. */
  command: z.string().max(CHAT_LIMITS.commandChars),
  mode: z.enum(['ask', 'plan']),
};

const reportRefusedFields = {
  cardKey: z.string().max(40),
  /** The checks reported as passed whose real step failed. */
  checks: z.array(z.object({ name: z.string(), stepId: z.string() })),
};

// ── The stable turn events ─────────────────────────────────────────────────────────────────────────

/** How a turn ended. */
export const TURN_STATUSES = ['running', 'done', 'failed', 'stopped', 'interrupted'] as const;
export type TurnStatus = (typeof TURN_STATUSES)[number];

/** Why a turn failed. The panel's honest states (§7) branch on these. */
export const TURN_FAILURES = [
  'signed_out',
  'rate_limited',
  'billing',
  'overloaded',
  'version_out_of_range',
  'claude_missing',
  'session_missing',
  'folder_not_allowed',
  'folder_missing',
  'device_offline',
  'cut_off',
  /** The engine sent something the bridge cannot read, so the turn was stopped (D53). The panel offers Open in VS Code. */
  'unreadable_event',
  'unknown',
] as const;
export type TurnFailure = (typeof TURN_FAILURES)[number];

export const APPROVAL_DECISIONS = ['allow', 'deny'] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];
/** `skipped`: an automatic queue run (D58) refused it at once, never ran it, and kept it for the owner to run later. */
export const APPROVAL_STATUSES = ['pending', 'allowed', 'denied', 'timed_out', 'stopped', 'skipped'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
/** The D41 class a paused call falls in, for the prompt's wording. `other` is any unnamed command, which also pauses. */
export const APPROVAL_CATEGORIES = [
  'delete',
  'move',
  'commit',
  'push',
  'deploy',
  'branch',
  'worktree',
  'docker',
  'hub_project',
  'hub_doc',
  'hub_sensitive',
  'other',
] as const;
export type ApprovalCategory = (typeof APPROVAL_CATEGORIES)[number];
/**
 * The approval's effect line (§7.2): one fixed sentence per D41 category, never model text. The bridge holds its own copy and a test holds the two together. The web shows `categories.<category>`, its translated twin.
 */
export const APPROVAL_EFFECTS: Readonly<Record<ApprovalCategory, string>> = {
  delete: 'Deletes files',
  move: 'Moves or overwrites files',
  commit: 'Changes Git history',
  push: 'Pushes to a remote',
  deploy: 'Deploys or reaches another machine',
  branch: 'Creates or switches a branch',
  worktree: 'Creates a worktree',
  docker: 'Runs Docker',
  hub_project: 'Changes the project, including its allowed folders',
  hub_doc: 'Writes a document',
  hub_sensitive: 'A sensitive Hub action',
  other: 'A command you have not allowed',
};

const anyJson = z.unknown();

const usageSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  cacheReadTokens: z.number().optional(),
  cacheWriteTokens: z.number().optional(),
});
export type TurnUsage = z.infer<typeof usageSchema>;

const limitSchema = z.object({
  status: z.string().max(40),
  limitType: z.string().max(40).optional(),
  resetsAt: z.number().optional(),
  utilization: z.number().optional(),
});
export type TurnLimit = z.infer<typeof limitSchema>;

/** The bridge restates these (`claude-events.mjs`): one name too long must never lose the whole `turn.session`. */
export const ENGINE_FACT_LIMITS = { skills: 500, mcpServers: 100, nameChars: 200 } as const;

/** What the engine loaded for a turn. Null when it did not say. */
export const engineFactsSchema = z.object({ skills: z.array(z.string()), mcpServers: z.array(z.string()) });
export type EngineFacts = z.infer<typeof engineFactsSchema>;

export const turnEventSchema = z.discriminatedUnion('kind', [
  /** First in a turn. Model and version come from the engine; `branch` from Git, when there is one. */
  z.object({
    kind: z.literal('turn.session'),
    sessionId: z.string().max(100),
    model: z.string().max(100).optional(),
    claudeVersion: z.string().max(40).optional(),
    resumed: z.boolean().optional(),
    branch: z.string().max(300).optional(),
    effortApplied: z.string().max(10).optional(),
    /** Names only, as `init` reports them, for the slash menu and the chat's facts. */
    skills: z.array(z.string().max(ENGINE_FACT_LIMITS.nameChars)).max(ENGINE_FACT_LIMITS.skills).optional(),
    mcpServers: z
      .array(z.string().max(ENGINE_FACT_LIMITS.nameChars))
      .max(ENGINE_FACT_LIMITS.mcpServers)
      .optional(),
  }),
  /** Waiting on the model, or thinking, or a retry. Thinking text is not reported, so only the state shows. */
  z.object({
    kind: z.literal('turn.status'),
    state: z.enum(['requesting', 'thinking', 'retrying']),
    attempt: z.number().optional(),
    retryInMs: z.number().optional(),
  }),
  z.object({ kind: z.literal('text.delta'), text: z.string() }),
  z.object({
    kind: z.literal('tool.started'),
    toolUseId: z.string().max(100),
    name: z.string().max(200),
    parentToolUseId: z.string().max(100).optional(),
  }),
  z.object({
    kind: z.literal('tool.input'),
    toolUseId: z.string().max(100),
    name: z.string().max(200),
    input: anyJson,
    /** The shell command this step runs, when it runs one. The mapper is the one place that knows which tools those are. */
    command: z.string().optional(),
    parentToolUseId: z.string().max(100).optional(),
  }),
  z.object({
    kind: z.literal('tool.result'),
    toolUseId: z.string().max(100),
    isError: z.boolean(),
    output: z.string(),
    /** Who let it run, when the engine says: `config` for rules, `user_temporary` or `user_reject` for an approval. */
    decision: z.string().max(40).optional(),
  }),
  z.object({
    kind: z.literal('approval.requested'),
    approvalId: z.string().max(100),
    toolUseId: z.string().max(100),
    toolName: z.string().max(200),
    command: z.string(),
    category: z.enum(APPROVAL_CATEGORIES),
    input: anyJson,
    /** The deterministic effect line (`APPROVAL_EFFECTS`), from the bridge. */
    effect: z.string().max(200),
    expiresAt: z.string().max(40),
  }),
  z.object({
    kind: z.literal('approval.resolved'),
    approvalId: z.string().max(100),
    status: z.enum(['allowed', 'denied', 'timed_out', 'stopped']),
  }),
  /** `/hub:work` and `/hub:doc` report their stages through the `report_stage` tool (§7.1). */
  z.object({
    kind: z.literal('stage'),
    protocol: z.enum(['work', 'doc']),
    stage: z.string().max(40),
    state: z.enum(STAGE_STATES),
    note: z.string().max(500).optional(),
  }),
  /** A proposed plan. `plan` is always there as text. `structured` is there when `propose_plan` was used; from the engine's `ExitPlanMode` or a reply, there is only the text. */
  z.object({
    kind: z.literal('plan.proposed'),
    plan: z.string(),
    structured: proposedPlanSchema.optional(),
  }),
  /** A process is starting for this turn, which takes about ten seconds. */
  z.object({ kind: z.literal('turn.starting'), reason: z.enum(START_REASONS) }),
  /** D53: this Claude Code is newer than the one Hub tested. It runs, and the rules stay active. */
  z.object({ kind: z.literal('engine.warning'), ...engineWarningFields }),
  /** Ask or Plan refused a tool. The panel offers to switch to Execute. */
  z.object({ kind: z.literal('tool.blocked'), ...toolBlockedFields }),
  /** `AskUserQuestion`. Answered through the approval route, with `answers`. `questionId` is that route's id. */
  z.object({
    kind: z.literal('question.asked'),
    questionId: z.string().max(100),
    toolUseId: z.string().max(100),
    questions: z.array(chatQuestionItemSchema).max(CHAT_LIMITS.questionsPerCall),
    expiresAt: z.string().max(40),
  }),
  z.object({
    kind: z.literal('question.resolved'),
    questionId: z.string().max(100),
    status: z.enum(['answered', 'declined', 'timed_out', 'stopped']),
    answers: z.record(z.string(), z.string()).optional(),
  }),
  /**
   * An automatic queue run (D58) decided on the owner's behalf, with nobody asked and nothing waiting: a call that needs approval was `skipped` (refused at once, never run), or a question was `answered` with its recommended option.
   */
  z.object({
    kind: z.literal('auto.decision'),
    decisionId: z.string().max(100),
    toolUseId: z.string().max(100),
    decision: z.enum(['skipped', 'answered']),
    toolName: z.string().max(200),
    /** The exact command for `skipped`; the first question for `answered`. */
    command: z.string(),
    category: z.enum(APPROVAL_CATEGORIES),
    input: anyJson,
    effect: z.string().max(200),
    questions: z.array(chatQuestionItemSchema).max(CHAT_LIMITS.questionsPerCall).optional(),
    answers: z.record(z.string(), z.string()).optional(),
  }),
  /** `report_work`'s evidence, as stored on the card. */
  z.object({ kind: z.literal('work.reported'), report: workReportSchema }),
  /** A report that said a failed step passed. Nothing was stored on the card. */
  z.object({ kind: z.literal('report.refused'), ...reportRefusedFields }),
  /** `propose_doc`: the draft, the server's duplicates and the flagged claims. */
  z.object({ kind: z.literal('doc.draft'), draft: chatDocDraftSchema }),
  /** The draft changed: flags answered, saved, or refused. A refused save never shows as sent. */
  z.object({ kind: z.literal('doc.draft.updated'), draft: chatDocDraftSchema }),
  z.object({ kind: z.literal('limit'), limit: limitSchema }),
  /** The last event of a turn: only what the engine reported. */
  /** `propose_suggestions` (D66): proposals the owner accepts or dismisses one by one. Nothing is created by the event. */
  z.object({
    kind: z.literal('suggestions.proposed'),
    summary: z.string().nullable(),
    items: z.array(chatSuggestionSchema),
  }),
  z.object({
    kind: z.literal('turn.ended'),
    status: z.enum(['done', 'failed', 'stopped', 'interrupted']),
    failure: z.enum(TURN_FAILURES).optional(),
    message: z.string().max(500).optional(),
    durationMs: z.number().optional(),
    apiDurationMs: z.number().optional(),
    model: z.string().max(100).optional(),
    usage: usageSchema.optional(),
    resetsAt: z.number().optional(),
    changedFiles: z.array(changedFileSchema).optional(),
  }),
]);
export type TurnEvent = z.infer<typeof turnEventSchema>;
export type TurnEventKind = TurnEvent['kind'];
export const TURN_EVENT_KINDS = turnEventSchema.options.map((option) => option.shape.kind.value);

/** What travels to the browser as `chat.event`: one event, in order per chat by `seq`. */
export interface ChatLiveEvent {
  readonly chatId: string;
  readonly messageId: string;
  readonly seq: number;
  readonly event: TurnEvent;
}

/** A durable nudge on the stream, with no text, so a device that was away rereads. */
export interface ChatChanged {
  readonly chatId: string;
  readonly reason: 'chat' | 'turn' | 'approval';
}

// ── The bridge's turn actions ──────────────────────────────────────────────────────────────────────

/** At most this many extra folders on one run (D59). */
export const QUEUE_EXTRA_FOLDERS = 8;

export const turnStartArgsSchema = z.object({
  chatId: z.uuid(),
  folder: absolutePath,
  prompt: z.string().min(1),
  mode: z.enum(CHAT_MODES),
  model: chatModelSchema.optional(),
  effort: z.enum(CHAT_EFFORTS).optional(),
  sessionId: z.string().max(100).optional(),
  /** More folders of the same project for this turn (D59), passed as `--add-dir`. The bridge checks each against its allowlist and the main folder's project. */
  addDirs: z.array(absolutePath).max(QUEUE_EXTRA_FOLDERS).optional(),
  /** A queued run's mode (D58). `automatic` never waits: approvals are skipped and questions take the recommended option. Absent is the panel's own behaviour. */
  runMode: z.enum(['approval', 'automatic']).optional(),
  /** A queued run waiting for approval waits with no time limit (D58). The panel's chats keep the bridge's window. */
  untimed: z.boolean().optional(),
});
export type TurnStartArgs = z.infer<typeof turnStartArgsSchema>;

/**
 * An approval with no time limit (D58) still carries an `expiresAt`, because the column and the event need one: the bridge sets it this far ahead. Anything further than `NO_TIME_LIMIT_AFTER_MS` away reads as "no time limit".
 */
export const APPROVAL_NO_TIME_LIMIT_MS = 20 * 24 * 60 * 60_000;
const NO_TIME_LIMIT_AFTER_MS = 2 * 24 * 60 * 60_000;
export const hasNoTimeLimit = (expiresAt: string, now: number = Date.now()): boolean =>
  Date.parse(expiresAt) - now > NO_TIME_LIMIT_AFTER_MS;

/** The engine on a device, for the panel's selectors and its honest states. */
export const engineStatusSchema = z.object({
  found: z.boolean(),
  version: z.string().nullable(),
  inRange: z.boolean(),
  testedRange: z.object({ min: z.string(), max: z.string() }),
  message: z.string().max(500).nullable(),
  /** False only when there is no copy, or every copy is below the minimum (D53). */
  canRun: z.boolean(),
  /** Set when the copy in use is newer than the tested one. It runs, and the panel shows this (D53). */
  warning: z.object(engineWarningFields).nullable(),
  /** When the device answered, for "checked at". */
  checkedAt: z.string().max(40),
  signedIn: z.boolean().nullable(),
  effortSupported: z.boolean(),
  modelSupported: z.boolean(),
  live: z.number().int(),
});
export type EngineStatus = z.infer<typeof engineStatusSchema>;

/**
 * Hub's own commands a person can type, for the slash menu. A spec holds this to the core skills of `packages/team-pack/plugin/skills` (`HUB_CORE_SKILLS`): `guide` is background reading and not listed, and a command with no skill behind it must not appear. Skills the owner adds through the Skills page reach the menu from the engine's own list.
 */
export const HUB_SKILLS = ['/hub:ask', '/hub:doc', '/hub:plan', '/hub:suggest', '/hub:work'] as const;
export type HubSkill = (typeof HUB_SKILLS)[number];

// ── Requests ───────────────────────────────────────────────────────────────────────────────────────

export const chatAttachmentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('card'), key: z.string().max(40) }),
  z.object({ kind: z.literal('doc'), key: z.string().max(40) }),
  z.object({ kind: z.literal('file'), path: z.string().min(1).max(500) }),
]);
export type ChatAttachment = z.infer<typeof chatAttachmentSchema>;

export const chatContextSchema = z.object({
  page: z.string().max(80).optional(),
  card: z.string().max(40).optional(),
  attachments: z.array(chatAttachmentSchema).max(20).optional(),
});
export type ChatContext = z.infer<typeof chatContextSchema>;

const turnOptions = {
  mode: z.enum(CHAT_MODES).optional(),
  model: chatModelSchema.optional(),
  effort: z.enum(CHAT_EFFORTS).optional(),
};

export const createChatSchema = z.object({
  device: z.uuid(),
  folder: absolutePath,
  title: z.string().trim().min(1).max(200).optional(),
  ...turnOptions,
});
export type CreateChatInput = z.infer<typeof createChatSchema>;

export const sendChatMessageSchema = z.object({
  text: z.string().trim().min(1).max(CHAT_LIMITS.promptChars),
  context: chatContextSchema.optional(),
  ...turnOptions,
});
export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;

/**
 * The answer to an approval or a question. `note` goes to Claude with a deny, such as what to redraft. `answers` answers a question, by its text; a multi-select joins its labels with commas, as the engine expects.
 * `doc` goes with Allow on a `save_doc` that names a draft: the owner's edited text and flag answers, which are what gets saved.
 */
export const answerApprovalSchema = z.object({
  decision: z.enum(APPROVAL_DECISIONS),
  note: z.string().trim().max(CHAT_LIMITS.reportText).optional(),
  answers: z.record(z.string().max(2_000), z.string().max(CHAT_LIMITS.reportText)).optional(),
  doc: z
    .object({
      content: z.string().max(CHAT_LIMITS.draftChars).optional(),
      claims: z
        .array(z.object({ id: z.string().max(40), answer: z.enum(CLAIM_ANSWERS) }))
        .max(100)
        .optional(),
    })
    .optional(),
});
export type AnswerApprovalInput = z.infer<typeof answerApprovalSchema>;
export const retryChatSchema = z.object(turnOptions);
export const updateChatSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  pinned: z.boolean().optional(),
  mode: z.enum(CHAT_MODES).optional(),
  model: chatModelSchema.nullable().optional(),
  effort: z.enum(CHAT_EFFORTS).nullable().optional(),
});
export type UpdateChatInput = z.infer<typeof updateChatSchema>;
export const branchChatSchema = z.object({
  message: z.uuid(),
  title: z.string().trim().min(1).max(200).optional(),
});
export const chatDiffQuerySchema = z.object({ path: z.string().min(1).max(1000) });
/** `fresh=true` is the re-check action (review M9): it asks the device again, past the bridge's cache. */
export const engineQuerySchema = z.object({ device: z.uuid(), fresh: z.enum(['true', 'false']).optional() });
export const chatListQuerySchema = z.object({
  deleted: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const promptTemplateInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(10_000),
});
export type PromptTemplateInput = z.infer<typeof promptTemplateInputSchema>;

/**
 * Open in VS Code (docs/16 §8). Session only, like `chat.run`. The answer's `sent` says the bridge handed it to VS Code, never that it opened (S1 Q10). The owner presses Enter: the link cannot auto-send.
 */
export const vscodeOpenSchema = z.object({
  device: z.uuid(),
  folder: absolutePath,
  cardKey: cardKeySchema.optional(),
  chatId: z.uuid().optional(),
});
export type VsCodeOpenInput = z.infer<typeof vscodeOpenSchema>;
export const vscodeOpenResultSchema = z.object({ sent: z.literal(true), prompt: z.string() });
export type VsCodeOpenResult = z.infer<typeof vscodeOpenResultSchema>;

/** The bridge restates both of these (`packages/bridge/lib/protocol.mjs`), and a test holds them together. */
export const VSCODE_PROMPT_CHARS = 500;
export const VSCODE_LINK_PREFIX = 'vscode://anthropic.claude-code/open?prompt=';

/** The short prompt the link carries. Claude reads the rest through Hub. The client shows this text, and the server builds the same one. */
export function vscodePrompt(input: {
  readonly cardKey?: string | undefined;
  readonly chatTitle?: string | undefined;
  readonly folder: string;
}): string {
  const title = input.chatTitle?.replace(/\s+/g, ' ').trim();
  let text = `Work in ${input.folder} with Hub. Read what you need through hub.`;
  if (input.cardKey) text = `Work on ${input.cardKey} in Hub. Read it with hub get_card first.`;
  else if (title) text = `Continue this Hub chat: ${title}. Read what you need through hub.`;
  if (text.length <= VSCODE_PROMPT_CHARS) return text;
  // Half a character cannot be encoded in a link.
  return text.slice(0, VSCODE_PROMPT_CHARS).replace(/[\uD800-\uDBFF]$/, '');
}

export function vscodeLink(prompt: string): string {
  return `${VSCODE_LINK_PREFIX}${encodeURIComponent(prompt)}`;
}

// ── Answers ────────────────────────────────────────────────────────────────────────────────────────

export const chatSchema = z.object({
  id: z.string(),
  deviceId: z.string(),
  deviceName: z.string(),
  deviceOnline: z.boolean(),
  deviceRevoked: z.boolean(),
  folder: z.string(),
  branch: z.string().nullable(),
  mode: z.enum(CHAT_MODES),
  model: z.string().nullable(),
  effort: z.string().nullable(),
  sessionId: z.string().nullable(),
  title: z.string(),
  pinned: z.boolean(),
  parentChatId: z.string().nullable(),
  parentMessageId: z.string().nullable(),
  running: z.boolean(),
  lastSeq: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});
export type ChatDto = z.infer<typeof chatSchema>;

export const chatStepSchema = z.object({
  id: z.string(),
  toolUseId: z.string(),
  parentToolUseId: z.string().nullable(),
  name: z.string(),
  status: z.enum(['running', 'waiting', 'done', 'error', 'cut_off']),
  input: anyJson,
  /** The shell command, when this step runs one. What a report's check is matched against. */
  command: z.string().nullable(),
  output: z.string().nullable(),
  decision: z.string().nullable(),
  /** Where this step falls in the reply's text, so the panel can place it. */
  textOffset: z.number().int(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
});
export type ChatStepDto = z.infer<typeof chatStepSchema>;

export const chatApprovalSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  toolUseId: z.string(),
  toolName: z.string(),
  command: z.string(),
  category: z.enum(APPROVAL_CATEGORIES),
  input: anyJson,
  effect: z.string(),
  status: z.enum(APPROVAL_STATUSES),
  /** The draft this `save_doc` would save, so the panel can show Save instead of Allow. */
  draftId: z.string().nullable(),
  expiresAt: z.string(),
  answeredAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ChatApprovalDto = z.infer<typeof chatApprovalSchema>;

export const chatQuestionSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  toolUseId: z.string(),
  questions: z.array(chatQuestionItemSchema),
  status: z.enum(QUESTION_STATUSES),
  answers: z.record(z.string(), z.string()).nullable(),
  expiresAt: z.string(),
  answeredAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ChatQuestionDto = z.infer<typeof chatQuestionSchema>;

/** Lines on the turn that are not steps: a restart, a version warning, a refused tool, a refused report. */
export const chatNoticeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('turn.starting'), reason: z.enum(START_REASONS), at: z.string() }),
  z.object({ kind: z.literal('engine.warning'), ...engineWarningFields, at: z.string() }),
  z.object({ kind: z.literal('tool.blocked'), ...toolBlockedFields, at: z.string() }),
  z.object({ kind: z.literal('report.refused'), ...reportRefusedFields, at: z.string() }),
]);
export type ChatNotice = z.infer<typeof chatNoticeSchema>;

export const chatStageSchema = z.object({
  protocol: z.enum(['work', 'doc']),
  stage: z.string(),
  state: z.enum(STAGE_STATES),
  note: z.string().optional(),
  at: z.string(),
});
export type ChatStage = z.infer<typeof chatStageSchema>;

export const chatMessageSchema = z.object({
  id: z.string(),
  ordinal: z.number().int(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  truncated: z.boolean(),
  /** The user's chips, as sent. The prefix built from them is what the engine read. */
  context: chatContextSchema.nullable(),
  status: z.enum(TURN_STATUSES).nullable(),
  failure: z.enum(TURN_FAILURES).nullable(),
  failureMessage: z.string().nullable(),
  model: z.string().nullable(),
  claudeVersion: z.string().nullable(),
  durationMs: z.number().nullable(),
  usage: usageSchema.nullable(),
  limit: limitSchema.nullable(),
  stages: z.array(chatStageSchema),
  plan: z.string().nullable(),
  /** `propose_plan`'s plan. Null when only the text exists. */
  structuredPlan: proposedPlanSchema.nullable(),
  /** `propose_suggestions`' proposals and what the owner did with each (D66). Null when none were made. */
  suggestions: chatSuggestionsSchema.nullable(),
  engineFacts: engineFactsSchema.nullable(),
  changedFiles: z.array(changedFileSchema),
  steps: z.array(chatStepSchema),
  approvals: z.array(chatApprovalSchema),
  questions: z.array(chatQuestionSchema),
  reports: z.array(workReportSchema),
  docDrafts: z.array(chatDocDraftSchema),
  notices: z.array(chatNoticeSchema),
  createdAt: z.string(),
  endedAt: z.string().nullable(),
});
export type ChatMessageDto = z.infer<typeof chatMessageSchema>;

export const chatFullSchema = chatSchema.extend({ messages: z.array(chatMessageSchema) });
export type ChatFullDto = z.infer<typeof chatFullSchema>;

export const chatTurnStartedSchema = z.object({
  chatId: z.string(),
  userMessageId: z.string(),
  messageId: z.string(),
});
export type ChatTurnStarted = z.infer<typeof chatTurnStartedSchema>;

export const chatDiffSchema = z.object({
  path: z.string(),
  diff: z.string(),
  truncated: z.boolean(),
  available: z.boolean(),
});
export type ChatDiff = z.infer<typeof chatDiffSchema>;

export const promptTemplateSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  updatedAt: z.string(),
});
export type PromptTemplateDto = z.infer<typeof promptTemplateSchema>;

// ── The prompt prefix (§7, §7.1) ───────────────────────────────────────────────────────────────────

/** One role a queued run carries (D60), as the engine reads it. */
export interface PromptRole {
  readonly role: string;
  readonly label: string;
  readonly brief: string;
  readonly specialties: readonly string[];
  readonly readFirst: readonly string[];
}

export interface PromptContext extends ChatContext {
  readonly project: string;
  /** A queued run's roles (D60). */
  readonly roles?: readonly PromptRole[] | undefined;
  /** A queued run's mode (D58), so the engine knows nobody will answer. */
  readonly runMode?: 'approval' | 'automatic' | undefined;
  /** A queued run's extra folders (D59). */
  readonly extraFolders?: readonly string[] | undefined;
}

/** What an automatic run is told (D58). The bridge enforces it either way; this saves the model asking. */
export const AUTOMATIC_RUN_NOTE =
  'Run mode: automatic. The owner is away and nobody will answer. Do not ask questions: take the recommended option and say which you took. Commands that need approval (delete, commit, push, deploy, branch, worktree, docker, and any command not allowed) will be refused and kept for the owner to run later: carry on without them, and list them in your report.';

/** An explicit prefix, so the turn shows what it was told. Claude reads the named things itself, through Hub and the folder. */
export function contextPrefix(context: PromptContext): string {
  const lines = [`Project: ${context.project}`];
  if (context.page) lines.push(`Page: ${context.page}`);
  if (context.card) lines.push(`Open card: ${context.card}`);
  for (const item of context.attachments ?? []) {
    if (item.kind === 'card') lines.push(`Attached card: ${item.key} (read it with hub get_card)`);
    if (item.kind === 'doc') lines.push(`Attached doc: ${item.key} (read it with hub get_doc)`);
    if (item.kind === 'file') lines.push(`Attached file: ${item.path} (read it from the folder)`);
  }
  if (context.extraFolders && context.extraFolders.length > 0) {
    lines.push(`Also work in: ${context.extraFolders.join(', ')} (same project, added with --add-dir)`);
  }
  for (const role of context.roles ?? []) {
    const parts = [`Role: ${role.label} (${role.role}). ${role.brief}`];
    if (role.specialties.length > 0) parts.push(`Specialties: ${role.specialties.join(', ')}.`);
    if (role.readFirst.length > 0) parts.push(`Read first: ${role.readFirst.join('; ')}.`);
    lines.push(parts.join(' '));
  }
  if (context.runMode === 'automatic') lines.push(AUTOMATIC_RUN_NOTE);
  return `[Hub context]\n${lines.join('\n')}\n[/Hub context]\n\n`;
}

/** What the engine reads. A slash command must come first or it is not a command, so the prefix follows it, and the skill reads it as part of its arguments. */
export function turnPrompt(prefix: string, history: string, text: string): string {
  return text.startsWith('/') ? `${text}\n\n${prefix}${history}`.trimEnd() : `${prefix}${history}${text}`;
}

/** A branched chat has no engine session of its own yet, so its first turn is told what came before, in plain words. */
export function historyPrefix(messages: readonly { role: string; content: string }[]): string {
  const lines = messages.map(
    (message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`,
  );
  const text = lines.join('\n\n');
  const tail = text.length > CHAT_LIMITS.contextChars ? text.slice(-CHAT_LIMITS.contextChars) : text;
  return `[Earlier in this conversation, copied by Hub]\n${tail}\n[/Earlier]\n\n`;
}

/** The chat as Markdown. Tool steps are one line each: exact input stays in the panel. */
export function chatToMarkdown(chat: ChatFullDto): string {
  const head = [
    `# ${chat.title}`,
    '',
    `- Folder: \`${chat.folder}\``,
    `- Device: ${chat.deviceName}`,
    `- Mode: ${chat.mode}`,
    ...(chat.branch ? [`- Branch: ${chat.branch}`] : []),
    ...(chat.sessionId ? [`- Session: \`${chat.sessionId}\``] : []),
    `- Started: ${chat.createdAt}`,
    '',
  ];
  const body = chat.messages.flatMap((message) => {
    const title =
      message.role === 'user' ? '## You' : `## Claude${message.model ? ` (${message.model})` : ''}`;
    const steps = message.steps.map((step) => `- \`${step.name}\`: ${step.status}`);
    const files = message.changedFiles.map(
      (file) =>
        `- \`${file.path}\`${file.additions === undefined ? '' : ` +${file.additions} -${file.deletions ?? 0}`}`,
    );
    return [
      title,
      '',
      message.content,
      '',
      ...(steps.length > 0 ? ['### Steps', '', ...steps, ''] : []),
      ...(files.length > 0 ? ['### Changed files', '', ...files, ''] : []),
      ...(message.failure ? [`> Ended: ${message.failure}`, ''] : []),
    ];
  });
  return [...head, ...body].join('\n');
}
