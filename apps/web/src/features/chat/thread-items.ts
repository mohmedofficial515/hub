/**
 * @file thread-items.ts
 * @description What the panel draws, from what the engine reported (docs/16 §7.1, §7.2). A chat's messages become one ordered list of items, so the thread reads top to bottom as it happened.
 * Pure, so every placement rule has a test. Nothing is invented: a value the engine did not report stays absent, and the words are the panel's, by code.
 */
import type {
  ChangedFile,
  ChatApprovalDto,
  ChatContext,
  ChatDocDraftDto,
  ChatFullDto,
  ChatMessageDto,
  ChatProtocol,
  ChatQuestionDto,
  ChatStepDto,
  ChatSuggestionsDto,
  EngineStatus,
  ProposedPlan,
  StartReason,
  TurnFailure,
  TurnUsage,
  WorkReport,
} from '@hub/contracts';
import { applyClaimAnswers, CHAT_PROTOCOLS, lineDiff } from '@hub/contracts';

import type { TurnStatusNow } from './live';
import type { HonestStateKind } from './live';

export type ToolState = 'running' | 'ok' | 'denied' | 'stopped' | 'failed';

export interface ToolCall {
  id: string;
  name: string;
  /** One line: the command, or the tool's main input. */
  detail: string;
  state: ToolState;
  ms?: number;
  input?: string;
  output?: string;
  error?: string;
  decision?: string;
  startedAt: string;
}

export interface DiffLine {
  t: 'ctx' | 'add' | 'del' | 'hunk';
  text: string;
  /** The claim this line holds, so the owner's answer shows on it. */
  flag?: string;
}

export type StageState = 'pending' | 'running' | 'done' | 'failed' | 'skipped';
export interface Stage {
  id: string;
  state: StageState;
  note?: string;
}

export type StoppedBy = 'turn' | 'bridge' | 'engine';

export interface TurnMeta {
  state: 'done' | 'failed' | 'stopped' | 'interrupted';
  failure?: TurnFailure;
  failureMessage?: string;
  ms?: number;
  model?: string;
  steps: number;
  usage?: TurnUsage;
  files: ChangedFile[];
}

export type Item =
  | { kind: 'user'; id: string; messageId: string; text: string; context: ChatContext | null }
  | { kind: 'text'; id: string; text: string }
  | { kind: 'tools'; id: string; calls: ToolCall[] }
  | { kind: 'approval'; id: string; request: ChatApprovalDto; stoppedBy: StoppedBy }
  | { kind: 'question'; id: string; question: ChatQuestionDto; stoppedBy: StoppedBy }
  | { kind: 'card'; id: string; cardKey: string }
  | { kind: 'turn'; id: string; messageId: string; meta: TurnMeta }
  | { kind: 'protocol'; id: string; protocol: ChatProtocol; target: string; stages: Stage[] }
  | { kind: 'plan'; id: string; text: string; structured: ProposedPlan | null }
  | { kind: 'suggestions'; id: string; messageId: string; suggestions: ChatSuggestionsDto }
  | { kind: 'report'; id: string; report: WorkReport }
  | { kind: 'refused'; id: string; cardKey: string; checks: { name: string; stepId: string }[] }
  | { kind: 'draft'; id: string; draft: ChatDocDraftDto; save: ChatApprovalDto | null }
  | { kind: 'saved'; id: string; draft: ChatDocDraftDto }
  | { kind: 'blocked'; id: string; name: string; command: string; mode: 'ask' | 'plan' };

const CARD_KEY = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/;
const CREATES_A_CARD = /^mcp__hub__create_/;

const pretty = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
};

function detailOf(step: ChatStepDto): string {
  if (step.command) return step.command;
  const input = step.input as Record<string, unknown> | null;
  if (!input || typeof input !== 'object') return '';
  const main =
    input['file_path'] ??
    input['path'] ??
    input['pattern'] ??
    input['query'] ??
    input['card'] ??
    input['key'];
  return typeof main === 'string' ? main : '';
}

function toolStateOf(step: ChatStepDto): ToolState {
  if (step.status === 'running' || step.status === 'waiting') return 'running';
  if (step.status === 'cut_off') return 'stopped';
  if (step.status === 'done') return 'ok';
  return step.decision === 'user_reject' ? 'denied' : 'failed';
}

export function toolCallOf(step: ChatStepDto): ToolCall {
  const failed = step.status === 'error';
  const input = pretty(step.input);
  const output = step.output ?? undefined;
  return {
    id: step.toolUseId,
    name: step.name,
    detail: detailOf(step),
    state: toolStateOf(step),
    startedAt: step.startedAt,
    ...(step.endedAt ? { ms: Date.parse(step.endedAt) - Date.parse(step.startedAt) } : {}),
    ...(input ? { input } : {}),
    ...(output && !failed ? { output } : {}),
    ...(output && failed ? { error: output } : {}),
    ...(step.decision ? { decision: step.decision } : {}),
  };
}

function stoppedByOf(message: ChatMessageDto): StoppedBy {
  if (message.failure === 'device_offline' || message.status === 'interrupted') return 'bridge';
  return message.status === 'failed' ? 'engine' : 'turn';
}

/** The card a `create_*` step made, from what Hub answered. */
function createdCard(step: ChatStepDto): string | null {
  if (step.status !== 'done' || !CREATES_A_CARD.test(step.name)) return null;
  return CARD_KEY.exec(step.output ?? '')?.[0] ?? null;
}

function protocolItem(message: ChatMessageDto, before: ChatMessageDto | undefined): Item | null {
  const last = message.stages.at(-1);
  if (!last) return null;
  const { protocol } = last;
  const running = message.status === 'running';
  const stages = CHAT_PROTOCOLS[protocol].map((id): Stage => {
    const latest = message.stages.filter((s) => s.protocol === protocol && s.stage === id).at(-1);
    const state: StageState = !latest
      ? 'pending'
      : latest.state === 'done'
        ? 'done'
        : latest.state === 'failed'
          ? 'failed'
          : running
            ? 'running'
            : 'pending';
    return { id, state, ...(latest?.note ? { note: latest.note } : {}) };
  });
  const target = before?.context?.card ?? CARD_KEY.exec(before?.content ?? '')?.[0] ?? '';
  return { kind: 'protocol', id: `${message.id}:protocol`, protocol, target, stages };
}

function metaOf(message: ChatMessageDto): TurnMeta | null {
  if (message.status === null || message.status === 'running') return null;
  return {
    state: message.status,
    steps: message.steps.length,
    files: message.changedFiles,
    ...(message.failure ? { failure: message.failure } : {}),
    ...(message.failureMessage ? { failureMessage: message.failureMessage } : {}),
    ...(message.durationMs !== null ? { ms: message.durationMs } : {}),
    ...(message.model ? { model: message.model } : {}),
    ...(message.usage ? { usage: message.usage } : {}),
  };
}

/**
 * One assistant message. Steps fall where their `textOffset` says, and a pause closes the steps before it, so an approval stands right after the step it holds. A `save_doc` pause is the draft's Save rather than an approval of its own, and a report, a plan or a draft comes after the words that led to it.
 */
function assistantItems(message: ChatMessageDto, before: ChatMessageDto | undefined): Item[] {
  const items: Item[] = [];
  const stoppedBy = stoppedByOf(message);
  const protocol = protocolItem(message, before);
  if (protocol) items.push(protocol);

  const saves = new Set(message.approvals.filter((a) => a.draftId).map((a) => a.id));
  let offset = 0;
  let calls: ToolCall[] = [];
  let part = 0;
  const flushCalls = () => {
    if (calls.length === 0) return;
    items.push({ kind: 'tools', id: `${message.id}:tools:${part}`, calls });
    part += 1;
    calls = [];
  };
  const flushText = (to: number) => {
    const text = message.content.slice(offset, to);
    offset = Math.max(offset, to);
    if (!text.trim()) return;
    flushCalls();
    items.push({ kind: 'text', id: `${message.id}:text:${part}`, text });
    part += 1;
  };

  for (const step of message.steps) {
    flushText(step.textOffset);
    calls.push(toolCallOf(step));
    const approval = message.approvals.find((a) => a.toolUseId === step.toolUseId && !saves.has(a.id));
    const question = message.questions.find((q) => q.toolUseId === step.toolUseId);
    const made = createdCard(step);
    if (approval) {
      flushCalls();
      items.push({ kind: 'approval', id: approval.id, request: approval, stoppedBy });
    }
    if (question) {
      flushCalls();
      items.push({ kind: 'question', id: question.id, question, stoppedBy });
    }
    if (made) {
      flushCalls();
      items.push({ kind: 'card', id: `${message.id}:card:${step.toolUseId}`, cardKey: made });
    }
  }
  flushText(message.content.length);
  flushCalls();

  for (const notice of message.notices) {
    if (notice.kind === 'tool.blocked') {
      items.push({
        kind: 'blocked',
        id: `${message.id}:blocked:${notice.toolUseId}`,
        name: notice.name,
        command: notice.command,
        mode: notice.mode,
      });
    } else if (notice.kind === 'report.refused') {
      items.push({
        kind: 'refused',
        id: `${message.id}:refused:${notice.at}`,
        cardKey: notice.cardKey,
        checks: notice.checks,
      });
    }
  }
  if (message.plan) {
    items.push({
      kind: 'plan',
      id: `${message.id}:plan`,
      text: message.plan,
      structured: message.structuredPlan,
    });
  }
  if (message.suggestions && message.suggestions.items.length > 0) {
    items.push({
      kind: 'suggestions',
      id: `${message.id}:suggestions`,
      messageId: message.id,
      suggestions: message.suggestions,
    });
  }
  for (const draft of message.docDrafts) {
    const save = message.approvals.find((a) => a.draftId === draft.id && a.status === 'pending') ?? null;
    items.push({ kind: 'draft', id: `draft:${draft.id}`, draft, save });
    if (draft.status === 'saved' && draft.docKey) {
      items.push({ kind: 'saved', id: `saved:${draft.id}`, draft });
    }
  }
  for (const report of message.reports) {
    items.push({ kind: 'report', id: `report:${report.id}`, report });
  }
  const meta = metaOf(message);
  if (meta) items.push({ kind: 'turn', id: `${message.id}:turn`, messageId: message.id, meta });
  return items;
}

/** The thread, in order. */
export function itemsOf(chat: Pick<ChatFullDto, 'messages'>): Item[] {
  return chat.messages.flatMap((message, index) =>
    message.role === 'user'
      ? [
          {
            kind: 'user' as const,
            id: message.id,
            messageId: message.id,
            text: message.content,
            context: message.context,
          },
        ]
      : assistantItems(message, chat.messages[index - 1]),
  );
}

export type ChatStatus =
  'idle' | 'starting' | 'thinking' | 'retrying' | 'streaming' | 'tool' | 'waiting' | 'stopped';

/** What a chat is doing now, in the panel's words. `turn.status` is not stored, so `now` comes from the live stream, and a chat read later still gets a truthful word from what it holds. */
export function chatStatusOf(chat: Pick<ChatFullDto, 'messages'>, now: TurnStatusNow | null): ChatStatus {
  const last = chat.messages.at(-1);
  if (!last || last.role !== 'assistant') return 'idle';
  if (last.status === 'stopped') return 'stopped';
  if (last.status !== 'running') return 'idle';
  if (last.approvals.some((a) => a.status === 'pending')) return 'waiting';
  if (last.questions.some((q) => q.status === 'pending')) return 'waiting';
  if (now?.state === 'retrying') return 'retrying';
  if (last.steps.some((s) => s.status === 'running')) return 'tool';
  if (!last.claudeVersion && !last.content && last.steps.length === 0) return 'starting';
  if (now?.state === 'thinking' || now?.state === 'requesting') return 'thinking';
  return last.content ? 'streaming' : 'thinking';
}

/** Why this turn's process is starting, from its own notice. */
export function startingReasonOf(chat: Pick<ChatFullDto, 'messages'>): StartReason | null {
  for (const notice of [...(chat.messages.at(-1)?.notices ?? [])].reverse()) {
    if (notice.kind === 'turn.starting') return notice.reason;
  }
  return null;
}

export type EngineState =
  | 'ok'
  | 'no_device'
  | 'no_folder'
  | 'offline'
  | 'revoked'
  | 'signed_out'
  | 'limit'
  | 'limit_open'
  | 'unknown'
  | 'version_new'
  | 'version_old'
  | 'claude_missing'
  | 'billing'
  | 'overloaded'
  | 'session_missing'
  | 'folder_not_allowed'
  | 'folder_missing'
  | 'unreadable';

const LAST_TURN: Partial<Record<TurnFailure, EngineState>> = {
  billing: 'billing',
  overloaded: 'overloaded',
  session_missing: 'session_missing',
  folder_not_allowed: 'folder_not_allowed',
  folder_missing: 'folder_missing',
  unknown: 'unknown',
};

/** The notice to show, from `honestStateOf`, the one rule, and the last turn's failure. A last-turn failure leaves the composer open: it says what happened, and the next message may try. */
export function engineStateOf(
  honest: { kind: HonestStateKind; composer: boolean; warning: EngineStatus['warning'] },
  failure: TurnFailure | null,
): EngineState {
  switch (honest.kind) {
    case 'offline':
    case 'revoked':
    case 'claude_missing':
    case 'signed_out':
    case 'unreadable':
      return honest.kind;
    case 'too_old':
      return 'version_old';
    case 'limit':
      return honest.composer ? 'limit_open' : 'limit';
    default:
      break;
  }
  const last = failure ? LAST_TURN[failure] : undefined;
  if (last) return last;
  return honest.warning ? 'version_new' : 'ok';
}

const BLOCKING = new Set<EngineState>([
  'no_device',
  'no_folder',
  'offline',
  'revoked',
  'signed_out',
  'limit',
  'version_old',
  'claude_missing',
]);
export const engineBlocks = (engine: EngineState) => BLOCKING.has(engine);

/** The card the running turn is on, for Follow the chat: the last Hub step that named one. */
export function followTargetOf(message: ChatMessageDto | null): string | null {
  if (!message) return null;
  for (const step of [...message.steps].reverse()) {
    if (!step.name.startsWith('mcp__hub__')) continue;
    const input = step.input as Record<string, unknown> | null;
    const named = input?.['card'] ?? input?.['key'];
    if (typeof named === 'string' && CARD_KEY.test(named)) return named;
  }
  return null;
}

/** A unified diff, as `git diff` writes it, into the lines the panel draws. The file's own header goes, and a hunk header stays. */
export function parseUnifiedDiff(diff: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let inHunk = false;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('@@')) {
      inHunk = true;
      lines.push({ t: 'hunk', text: raw });
    } else if (!inHunk) {
      continue;
    } else if (raw.startsWith('+')) {
      lines.push({ t: 'add', text: raw.slice(1) });
    } else if (raw.startsWith('-')) {
      lines.push({ t: 'del', text: raw.slice(1) });
    } else if (raw.startsWith(' ')) {
      lines.push({ t: 'ctx', text: raw.slice(1) });
    }
  }
  return lines;
}

type Answers = Readonly<Record<string, 'confirm' | 'remove' | 'keep_flagged'>>;

/** The draft's claims with the owner's answers on them. A server's answer stands until the owner changes it. */
export function claimsWith(draft: Pick<ChatDocDraftDto, 'claims'>, answers: Answers) {
  return draft.claims.map((claim) => ({ ...claim, answer: answers[claim.id] ?? claim.answer }));
}

/** The diff against the current text, from `lineDiff`, with each unverified claim's line marked. The owner's answers are drawn by the view, so an answer can be changed. */
export function draftLines(draft: Pick<ChatDocDraftDto, 'baseText' | 'draft' | 'claims'>): DiffLine[] {
  const unverified = draft.claims.filter((claim) => claim.status === 'unverified');
  return lineDiff(draft.baseText, draft.draft).map((line): DiffLine => {
    const claim = unverified.find((item) => line.kind !== 'removed' && line.text.includes(item.text));
    return {
      t: line.kind === 'same' ? 'ctx' : line.kind === 'added' ? 'add' : 'del',
      text: line.text,
      ...(claim ? { flag: claim.id } : {}),
    };
  });
}

/** What Save writes: the same function the API saves with. */
export const draftPreview = (draft: Pick<ChatDocDraftDto, 'draft' | 'claims'>, answers: Answers) =>
  applyClaimAnswers(draft.draft, claimsWith(draft, answers));

/** What moved under a stale draft: its base against the file as it is now. */
export function conflictLines(draft: Pick<ChatDocDraftDto, 'baseText' | 'conflict'>): DiffLine[] {
  if (!draft.conflict) return [];
  return lineDiff(draft.baseText, draft.conflict.text).map((line): DiffLine => ({
    t: line.kind === 'same' ? 'ctx' : line.kind === 'added' ? 'add' : 'del',
    text: line.text,
  }));
}

/** The last time an Edit or Write ran, so a report can say a check came before later edits. Client-side: not a server field. */
export function lastEditAt(chat: Pick<ChatFullDto, 'messages'>): string | null {
  let last: string | null = null;
  for (const message of chat.messages) {
    for (const step of message.steps) {
      if ((step.name === 'Edit' || step.name === 'Write') && (!last || step.startedAt > last)) {
        last = step.startedAt;
      }
    }
  }
  return last;
}
