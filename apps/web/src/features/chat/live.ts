/**
 * @file live.ts
 * @description What `chat.event` does to a chat's cached copy (docs/16 §7). Events carry a number per chat, and the API writes each one in the same statement as what it describes, so a copy read at `lastSeq` holds exactly the events up to it.
 * An older event is dropped, the next one is applied, and a gap means something was missed, so the chat is read again. That read is also the catch-up on reconnect: `LiveProvider` rereads everything then. Pure, except `applyChatLive`.
 */
import type {
  ChatApprovalDto,
  ChatDocDraftDto,
  ChatDto,
  ChatFullDto,
  ChatLiveEvent,
  ChatMessageDto,
  ChatQuestionDto,
  ChatStage,
  ChatStepDto,
  EngineStatus,
  TurnEvent,
} from '@hub/contracts';
import { CHAT_PROTOCOLS, type ChatProtocol } from '@hub/contracts';
import type { QueryClient } from '@tanstack/react-query';

import { qk } from '@/features/cards/keys';

export const chatKeys = {
  all: (ws: string) => ['chat', ws] as const,
  list: (ws: string, deleted = false) => ['chat', ws, 'list', deleted] as const,
  one: (ws: string, id: string) => ['chat', ws, 'one', id] as const,
  engine: (ws: string, device: string) => ['chat', ws, 'engine', device] as const,
  diff: (ws: string, id: string, path: string) => ['chat', ws, 'diff', id, path] as const,
  templates: (ws: string) => ['chat', ws, 'templates'] as const,
  reports: (ws: string, key: string) => ['chat', ws, 'reports', key] as const,
  status: (ws: string, id: string) => ['chat', ws, 'status', id] as const,
};

/** What the engine is doing right now, from `turn.status`. It is on no message, because it stops being true at the next event. */
export interface TurnStatusNow {
  readonly state: Extract<TurnEvent, { kind: 'turn.status' }>['state'];
  readonly attempt?: number;
  readonly retryInMs?: number;
  readonly at: string;
}

function draftIdOf(input: unknown): string | null {
  const draft = (input as { draft?: unknown } | null)?.draft;
  return typeof draft === 'string' ? draft : null;
}

function reduceMessage(message: ChatMessageDto, live: ChatLiveEvent): ChatMessageDto {
  const { event } = live;
  const at = new Date().toISOString();
  const step = (id: string, change: (step: ChatStepDto) => ChatStepDto) => ({
    ...message,
    steps: message.steps.map((item) => (item.toolUseId === id ? change(item) : item)),
  });
  const approval = (id: string, change: (item: ChatApprovalDto) => ChatApprovalDto) =>
    message.approvals.map((item) => (item.id === id ? change(item) : item));
  const notice = (event: ChatMessageDto['notices'][number]) => ({
    ...message,
    notices: [...message.notices, event],
  });
  const upsertDraft = (draft: ChatDocDraftDto) => ({
    ...message,
    docDrafts: message.docDrafts.some((item) => item.id === draft.id)
      ? message.docDrafts.map((item) => (item.id === draft.id ? draft : item))
      : [...message.docDrafts, draft],
  });
  switch (event.kind) {
    case 'text.delta':
      return { ...message, content: message.content + event.text };
    case 'turn.session':
      return {
        ...message,
        model: event.model ?? message.model,
        claudeVersion: event.claudeVersion ?? message.claudeVersion,
        engineFacts:
          event.skills || event.mcpServers
            ? { skills: event.skills ?? [], mcpServers: event.mcpServers ?? [] }
            : message.engineFacts,
      };
    case 'tool.started':
      if (message.steps.some((item) => item.toolUseId === event.toolUseId)) return message;
      return {
        ...message,
        steps: [
          ...message.steps,
          {
            id: event.toolUseId,
            toolUseId: event.toolUseId,
            parentToolUseId: event.parentToolUseId ?? null,
            name: event.name,
            status: 'running',
            input: null,
            command: null,
            output: null,
            decision: null,
            textOffset: message.content.length,
            startedAt: at,
            endedAt: null,
          },
        ],
      };
    case 'tool.input':
      return step(event.toolUseId, (item) => ({
        ...item,
        input: event.input,
        command: event.command ?? item.command,
      }));
    case 'tool.result':
      return step(event.toolUseId, (item) => ({
        ...item,
        status: event.isError ? 'error' : 'done',
        output: event.output,
        decision: event.decision ?? null,
        endedAt: at,
      }));
    case 'approval.requested':
      return {
        ...step(event.toolUseId, (item) => ({ ...item, status: 'waiting' })),
        approvals: [
          ...message.approvals,
          {
            id: event.approvalId,
            messageId: message.id,
            toolUseId: event.toolUseId,
            toolName: event.toolName,
            command: event.command,
            category: event.category,
            input: event.input,
            effect: event.effect,
            draftId: draftIdOf(event.input),
            status: 'pending',
            expiresAt: event.expiresAt,
            answeredAt: null,
            createdAt: at,
          },
        ],
      };
    case 'approval.resolved':
      return {
        ...message,
        steps: message.steps.map((item) => {
          const paused = message.approvals.some(
            (row) => row.id === event.approvalId && row.toolUseId === item.toolUseId,
          );
          return paused && item.status === 'waiting' ? { ...item, status: 'running' } : item;
        }),
        approvals: approval(event.approvalId, (item) => ({
          ...item,
          status: event.status,
          answeredAt: at,
        })),
      };
    case 'stage':
      return {
        ...message,
        stages: [
          ...message.stages,
          {
            protocol: event.protocol,
            stage: event.stage,
            state: event.state,
            at,
            ...(event.note ? { note: event.note } : {}),
          },
        ],
      };
    case 'plan.proposed':
      return { ...message, plan: event.plan, structuredPlan: event.structured ?? message.structuredPlan };
    case 'turn.starting':
    case 'engine.warning':
    case 'tool.blocked':
    case 'report.refused':
      return notice({ ...event, at });
    case 'question.asked':
      return {
        ...step(event.toolUseId, (item) => ({ ...item, status: 'waiting' })),
        questions: [
          ...message.questions,
          {
            id: event.questionId,
            messageId: message.id,
            toolUseId: event.toolUseId,
            questions: event.questions,
            status: 'pending',
            answers: null,
            expiresAt: event.expiresAt,
            answeredAt: null,
            createdAt: at,
          },
        ],
      };
    case 'question.resolved':
      return {
        ...message,
        steps: message.steps.map((item) => {
          const paused = message.questions.some(
            (row) => row.id === event.questionId && row.toolUseId === item.toolUseId,
          );
          return paused && item.status === 'waiting' ? { ...item, status: 'running' } : item;
        }),
        questions: message.questions.map((item) =>
          item.id === event.questionId
            ? {
                ...item,
                status: item.status === 'pending' ? event.status : item.status,
                answeredAt: item.answeredAt ?? at,
              }
            : item,
        ),
      };
    case 'work.reported':
      return { ...message, reports: [...message.reports, event.report] };
    case 'doc.draft':
    case 'doc.draft.updated':
      return upsertDraft(event.draft);
    case 'limit':
      return { ...message, limit: event.limit };
    case 'turn.ended':
      return {
        ...message,
        status: event.status,
        failure: event.failure ?? null,
        failureMessage: event.message ?? null,
        model: event.model ?? message.model,
        durationMs: event.durationMs ?? message.durationMs,
        usage: event.usage ?? message.usage,
        changedFiles: event.changedFiles ?? message.changedFiles,
        endedAt: at,
        steps: message.steps.map((item) =>
          item.status === 'running' || item.status === 'waiting'
            ? { ...item, status: 'cut_off', endedAt: at }
            : item,
        ),
        approvals: message.approvals.map((item) =>
          item.status === 'pending' ? { ...item, status: 'stopped', answeredAt: at } : item,
        ),
        questions: message.questions.map((item) =>
          item.status === 'pending' ? { ...item, status: 'stopped', answeredAt: at } : item,
        ),
      };
    default:
      return message;
  }
}

/** The next copy of the chat, the same copy for an old event, or null when something was missed. */
export function reduceChat(chat: ChatFullDto, live: ChatLiveEvent): ChatFullDto | null {
  if (live.seq <= chat.lastSeq) return chat;
  if (live.seq !== chat.lastSeq + 1) return null;
  if (!chat.messages.some((message) => message.id === live.messageId)) return null;
  const session = live.event.kind === 'turn.session' ? live.event : null;
  return {
    ...chat,
    lastSeq: live.seq,
    running: live.event.kind === 'turn.ended' ? false : chat.running,
    sessionId: session?.sessionId ?? chat.sessionId,
    branch: session?.branch ?? chat.branch,
    messages: chat.messages.map((message) =>
      message.id === live.messageId ? reduceMessage(message, live) : message,
    ),
  };
}

function clearTurnStatus(client: QueryClient, ws: string, chatId: string): void {
  const key = chatKeys.status(ws, chatId);
  if (client.getQueryData(key)) client.setQueryData(key, null);
}

/** What an event means outside the chat's own copy. These hold with or without that chat open. */
function applySideEffects(client: QueryClient, ws: string, { chatId, event }: ChatLiveEvent): void {
  switch (event.kind) {
    case 'turn.status': {
      const now: TurnStatusNow = {
        state: event.state,
        ...(event.attempt === undefined ? {} : { attempt: event.attempt }),
        ...(event.retryInMs === undefined ? {} : { retryInMs: event.retryInMs }),
        at: new Date().toISOString(),
      };
      client.setQueryData(chatKeys.status(ws, chatId), now);
      return;
    }
    case 'text.delta':
    case 'tool.started':
    case 'turn.ended':
      clearTurnStatus(client, ws, chatId);
      return;
    case 'work.reported':
      void client.invalidateQueries({ queryKey: chatKeys.reports(ws, event.report.cardKey) });
      void client.invalidateQueries({ queryKey: qk.card(ws, event.report.cardKey) });
      return;
    case 'doc.draft.updated':
      if (event.draft.status === 'saved' && event.draft.docKey) {
        void client.invalidateQueries({ queryKey: qk.card(ws, event.draft.docKey) });
      }
      return;
    default:
  }
}

/** One `chat.event`. A chat nobody has open costs nothing. */
export function applyChatLive(client: QueryClient, ws: string, live: ChatLiveEvent): void {
  applySideEffects(client, ws, live);
  const key = chatKeys.one(ws, live.chatId);
  const current = client.getQueryData<ChatFullDto>(key);
  if (!current) return;
  const next = reduceChat(current, live);
  if (next) client.setQueryData(key, next);
  else void client.invalidateQueries({ queryKey: key });
}

/** One `chat.changed`: the durable nudge, which also carries a chat to devices that were away. */
export function applyChatChanged(client: QueryClient, ws: string, chatId: string): void {
  // Sent events can be missed and this one cannot, so a turn's end is never left reading "thinking".
  clearTurnStatus(client, ws, chatId);
  void client.invalidateQueries({ queryKey: chatKeys.one(ws, chatId) });
  void client.invalidateQueries({ queryKey: chatKeys.list(ws) });
  void client.invalidateQueries({ queryKey: chatKeys.list(ws, true) });
  void client.invalidateQueries({ queryKey: qk.counters(ws) });
}

export const pendingApprovals = (chat: ChatFullDto): ChatApprovalDto[] =>
  chat.messages.flatMap((message) => message.approvals.filter((item) => item.status === 'pending'));

export const pendingQuestions = (chat: ChatFullDto): ChatQuestionDto[] =>
  chat.messages.flatMap((message) => message.questions.filter((item) => item.status === 'pending'));

/** The draft a paused `save_doc` would save, so the approval reads as Save. */
export const draftOfApproval = (message: ChatMessageDto, approval: ChatApprovalDto): ChatDocDraftDto | null =>
  message.docDrafts.find((draft) => draft.id === approval.draftId) ?? null;

export type HonestStateKind =
  'ok' | 'offline' | 'revoked' | 'claude_missing' | 'too_old' | 'signed_out' | 'limit' | 'unreadable';

/**
 * The panel's honest state (§7, D53, review M9), one rule so no state is a dead end. `recheck` is an action that can clear it: `useRecheckEngine`. `openInVsCode` is the fallback. `composer` says whether a new turn could start. `warning` is D53's newer-version line, which stops nothing.
 * Signed out only clears through a re-check made after the failure, since `init` cannot show it (S1 Q8). A limit clears by itself at `resetsAt`; with no `resetsAt`, nothing says when, so a send is allowed and may fail again.
 */
export function honestStateOf(
  chat: Pick<ChatDto, 'deviceOnline' | 'deviceRevoked'>,
  last: Pick<ChatMessageDto, 'failure' | 'endedAt' | 'limit'> | null,
  engine: EngineStatus | null,
  nowMs: number,
): {
  kind: HonestStateKind;
  recheck: boolean;
  openInVsCode: boolean;
  composer: boolean;
  approvalsAnswerable: boolean;
  resetsAt: number | null;
  warning: EngineStatus['warning'];
} {
  const warning = engine?.warning ?? null;
  const state = (
    kind: HonestStateKind,
    extra: { recheck?: boolean; openInVsCode?: boolean; composer?: boolean; resetsAt?: number | null } = {},
  ) => ({
    kind,
    recheck: extra.recheck ?? false,
    openInVsCode: extra.openInVsCode ?? false,
    composer: extra.composer ?? false,
    approvalsAnswerable: chat.deviceOnline && !chat.deviceRevoked,
    resetsAt: extra.resetsAt ?? null,
    warning,
  });
  if (chat.deviceRevoked) return state('revoked');
  if (!chat.deviceOnline) return state('offline');
  if (engine && !engine.found) return state('claude_missing', { recheck: true });
  if (engine && !engine.canRun) return state('too_old', { recheck: true, openInVsCode: true });
  if (engine?.signedIn === false) return state('signed_out', { recheck: true });
  const checkedAfter =
    engine && last?.endedAt ? Date.parse(engine.checkedAt) >= Date.parse(last.endedAt) : false;
  if (last?.failure === 'signed_out' && !(checkedAfter && engine?.signedIn === true)) {
    return state('signed_out', { recheck: true });
  }
  if (last?.failure === 'unreadable_event') {
    return state('unreadable', { openInVsCode: true, composer: true });
  }
  if (last?.failure === 'rate_limited') {
    const resetsAtSeconds = last.limit?.resetsAt ?? null;
    const resetsAt = resetsAtSeconds === null ? null : resetsAtSeconds * 1000;
    if (resetsAt === null || nowMs < resetsAt) {
      return state('limit', { recheck: true, composer: resetsAt === null, resetsAt });
    }
  }
  return state('ok', { composer: true });
}

export const runningMessage = (chat: ChatFullDto): ChatMessageDto | null =>
  chat.messages.find((message) => message.status === 'running') ?? null;

export interface ChecklistRow {
  readonly stage: string;
  readonly state: 'waiting' | ChatStage['state'];
  readonly note?: string;
}

/** The live checklist of `/hub:work` or `/hub:doc` on one turn: every stage in order, each in its latest state. Null when the turn used no protocol. */
export function checklistOf(
  message: ChatMessageDto,
): { protocol: ChatProtocol; rows: ChecklistRow[] } | null {
  const last = message.stages.at(-1);
  if (!last) return null;
  const { protocol } = last;
  const rows = CHAT_PROTOCOLS[protocol].map((stage): ChecklistRow => {
    const latest = message.stages.filter((item) => item.protocol === protocol && item.stage === stage).at(-1);
    if (!latest) return { stage, state: 'waiting' };
    return { stage, state: latest.state, ...(latest.note ? { note: latest.note } : {}) };
  });
  return { protocol, rows };
}
