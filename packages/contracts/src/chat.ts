/**
 * @file The chat panel's contract (docs/16 §7, §7.1, S1 "Event mapping"): modes, the stable turn events, and what the API answers.
 * @description `TurnEvent` is the only shape that leaves the bridge. Raw Claude Code events stop at `packages/bridge/lib/claude-events.mjs`, so one Claude Code update changes one mapper. A value the
 * engine does not report is absent, never guessed. Text is capped per message with `CHAT_LIMITS`, and everything stored passes `redactDeep` first (`secret-patterns.ts`).
 */
import { z } from 'zod';

import { absolutePath } from './projects';

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
  'unknown',
] as const;
export type TurnFailure = (typeof TURN_FAILURES)[number];

export const APPROVAL_DECISIONS = ['allow', 'deny'] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];
export const APPROVAL_STATUSES = ['pending', 'allowed', 'denied', 'timed_out', 'stopped'] as const;
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

const usageSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  cacheReadTokens: z.number().optional(),
  cacheWriteTokens: z.number().optional(),
});
export type TurnUsage = z.infer<typeof usageSchema>;

export const changedFileSchema = z.object({
  path: z.string().max(1000),
  /** `tool`: a Write or Edit step named it. `git`: the folder's Git state moved during the turn. */
  source: z.enum(['tool', 'git']),
  status: z.string().max(4).optional(),
  additions: z.number().int().optional(),
  deletions: z.number().int().optional(),
});
export type ChangedFile = z.infer<typeof changedFileSchema>;

const limitSchema = z.object({
  status: z.string().max(40),
  limitType: z.string().max(40).optional(),
  resetsAt: z.number().optional(),
  utilization: z.number().optional(),
});
export type TurnLimit = z.infer<typeof limitSchema>;

const anyJson = z.unknown();

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
  /** Plan mode's proposed plan, as the engine's `ExitPlanMode` carried it. */
  z.object({ kind: z.literal('plan.proposed'), plan: z.string() }),
  z.object({ kind: z.literal('limit'), limit: limitSchema }),
  /** The last event of a turn: only what the engine reported. */
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

export const turnStartArgsSchema = z.object({
  chatId: z.uuid(),
  folder: absolutePath,
  prompt: z.string().min(1),
  mode: z.enum(CHAT_MODES),
  model: chatModelSchema.optional(),
  effort: z.enum(CHAT_EFFORTS).optional(),
  sessionId: z.string().max(100).optional(),
});
export type TurnStartArgs = z.infer<typeof turnStartArgsSchema>;

/** The engine on a device, for the panel's selectors and its honest states. */
export const engineStatusSchema = z.object({
  found: z.boolean(),
  version: z.string().nullable(),
  inRange: z.boolean(),
  testedRange: z.object({ min: z.string(), max: z.string() }),
  message: z.string().max(500).nullable(),
  signedIn: z.boolean().nullable(),
  effortSupported: z.boolean(),
  modelSupported: z.boolean(),
  live: z.number().int(),
});
export type EngineStatus = z.infer<typeof engineStatusSchema>;

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

export const answerApprovalSchema = z.object({ decision: z.enum(APPROVAL_DECISIONS) });
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
export const engineQuerySchema = z.object({ device: z.uuid() });
export const chatListQuerySchema = z.object({
  deleted: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const promptTemplateInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(10_000),
});
export type PromptTemplateInput = z.infer<typeof promptTemplateInputSchema>;

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
  status: z.enum(APPROVAL_STATUSES),
  expiresAt: z.string(),
  answeredAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ChatApprovalDto = z.infer<typeof chatApprovalSchema>;

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
  changedFiles: z.array(changedFileSchema),
  steps: z.array(chatStepSchema),
  approvals: z.array(chatApprovalSchema),
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

export interface PromptContext extends ChatContext {
  readonly project: string;
}

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
  return `[Hub context]\n${lines.join('\n')}\n[/Hub context]\n\n`;
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
