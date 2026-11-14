/**
 * @file Chats (docs/16 §7, §7.1): one engine on one device in one folder, with Hub's own copy of everything.
 * @description The API never spawns anything: a turn is `BridgeHub.request(deviceId, 'turn.start', ...)`, and `TurnRecorder` writes what comes back. A chat belongs to the member who started it, and a folder or device that is no longer allowed is refused here and again on the
 * bridge. The partial unique index in `0003_chats` is what makes "one turn per chat" hold under two sends at once. An approval moves once from `pending`, in one statement, so the first answer wins however many devices have it open. A process restart marks what was running as interrupted, because no socket survives it.
 */
import {
  type AnswerApprovalInput,
  capText,
  CHAT_LIMITS,
  type ChatApprovalDto,
  type ChatChanged,
  chatContextSchema,
  type ChatDiff,
  type ChatDto,
  type ChatFullDto,
  type ChatMessageDto,
  type ChatMode,
  type ChatNotice,
  type ChatQuestionDto,
  type ChatStepDto,
  chatSuggestionsSchema,
  chatToMarkdown,
  type ChatTurnStarted,
  contextPrefix,
  type CreateChatInput,
  type EngineStatus,
  engineStatusSchema,
  historyPrefix,
  type MemberActor,
  type PromptRole,
  type PromptTemplateDto,
  type PromptTemplateInput,
  proposedIdeaSchema,
  redactSecrets,
  type SendChatMessageInput,
  turnPrompt,
  type UpdateChatInput,
  type VsCodeOpenInput,
  type VsCodeOpenResult,
  vscodePrompt,
  type WorkReport,
} from '@hub/contracts';
import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { z } from 'zod';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { RealtimePublisher } from '@/infra/redis/redis.module';
import { AuditService } from '@/modules/audit';
import { CardQueryService } from '@/modules/cards';
import { BridgeHub, DevicesService } from '@/modules/devices';
import { ProjectsService } from '@/modules/workspaces';
import { AppException } from '@/shared/errors';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import { folderIsRegistered, titleFrom } from '../domain/folders';
import { DocDraftsService } from './doc-drafts.service';
import { ChatTurnEvents } from './turn-events';
import { TurnRecorder } from './turn-recorder';
import { TurnRegistry } from './turn-registry';

const ANSWER_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 30_000;
const ENGINE_TIMEOUT_MS = 60_000;
const DIFF_TIMEOUT_MS = 40_000;
const VSCODE_TIMEOUT_MS = 30_000;
const LIST_LIMIT = 50;
const MESSAGE_LIMIT = 500;
const AUDIT_SUMMARY_CHARS = 1_000;

/** What a queued run adds to its turn (docs/16 D58 to D60). */
export interface QueueTurn {
  readonly mode: 'approval' | 'automatic';
  readonly extraFolders: readonly string[];
  readonly roles: readonly PromptRole[];
}

interface ChatRow {
  id: string;
  deviceId: string;
  folder: string;
  branch: string | null;
  mode: string;
  model: string | null;
  effort: string | null;
  sessionId: string | null;
  title: string;
  pinnedAt: Date | null;
  parentChatId: string | null;
  parentMessageId: string | null;
  lastSeq: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  device: { name: string; revokedAt: Date | null };
  messages?: { id: string }[];
}

const CHAT_INCLUDE = {
  device: { select: { name: true, revokedAt: true } },
  messages: { where: { status: 'running' }, select: { id: true } },
} as const;

const iso = (date: Date | null | undefined): string | null => date?.toISOString() ?? null;
const contextOf = (value: unknown) => {
  const parsed = chatContextSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

@Injectable()
export class ChatsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ChatsService.name);

  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly hub: BridgeHub,
    private readonly devices: DevicesService,
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimePublisher,
    private readonly turns: TurnRegistry,
    private readonly drafts: DocDraftsService,
    private readonly cards: CardQueryService,
    private readonly events: ChatTurnEvents,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Nothing survives a restart: the sockets went with the process, and each bridge stopped its turns when its socket closed. */
  async onApplicationBootstrap(): Promise<void> {
    if (this.config.PROCESS_ROLE === 'worker') return;
    await this.txHost.tx.$executeRaw`
      UPDATE chat_approvals SET status = 'stopped', answered_at = now() WHERE status = 'pending'`;
    await this.txHost.tx.$executeRaw`
      UPDATE chat_steps SET status = 'cut_off', ended_at = now() WHERE status IN ('running', 'waiting')`;
    const moved = await this.txHost.tx.$executeRaw`
      UPDATE chat_messages SET status = 'interrupted', failure = 'cut_off', ended_at = now() WHERE status = 'running'`;
    if (moved > 0) this.logger.warn(`${moved} chat turns were cut off by a restart`);
  }

  /** How many turns this process is recording. For a clean shutdown, and for tests that must not race one. */
  runningCount(): number {
    return this.turns.size();
  }

  // ── Reads ─────────────────────────────────────────────────────────────────────────────────────

  async list(actor: MemberActor, options: { deleted?: boolean; limit?: number } = {}): Promise<ChatDto[]> {
    const rows = await this.txHost.tx.chat.findMany({
      where: {
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        deletedAt: options.deleted ? { not: null } : null,
      },
      include: CHAT_INCLUDE,
      orderBy: [{ pinnedAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
      take: options.limit ?? LIST_LIMIT,
    });
    return rows.map((row) => this.toChat(row));
  }

  /** The whole chat: this is also how a device catches up. `lastSeq` says which events it already holds. */
  async get(actor: MemberActor, id: string): Promise<ChatFullDto> {
    const row = await this.owned(actor, id);
    const { workspaceId } = actor;
    const messages = await this.txHost.tx.chatMessage.findMany({
      where: { workspaceId, chatId: id },
      orderBy: { ordinal: 'desc' },
      take: MESSAGE_LIMIT,
    });
    const ids = messages.map((message) => message.id);
    const [steps, approvals, drafts] = await Promise.all([
      this.txHost.tx.chatStep.findMany({
        where: { workspaceId, messageId: { in: ids } },
        orderBy: { startedAt: 'asc' },
      }),
      this.txHost.tx.chatApproval.findMany({
        where: { workspaceId, messageId: { in: ids } },
        orderBy: { createdAt: 'asc' },
      }),
      this.drafts.ofMessages(actor, ids),
    ]);
    return {
      ...this.toChat(row),
      messages: [...messages].reverse().map((message): ChatMessageDto => ({
        id: message.id,
        ordinal: message.ordinal,
        role: message.role as ChatMessageDto['role'],
        content: message.content,
        truncated: message.truncated,
        context: contextOf(message.context),
        status: message.status as ChatMessageDto['status'],
        failure: message.failure as ChatMessageDto['failure'],
        failureMessage: message.failureMessage,
        model: message.model,
        claudeVersion: message.claudeVersion,
        durationMs: message.durationMs,
        usage: (message.usage as ChatMessageDto['usage']) ?? null,
        limit: (message.limit as ChatMessageDto['limit']) ?? null,
        stages: message.stages as ChatMessageDto['stages'],
        plan: message.plan,
        structuredPlan: (message.structuredPlan as ChatMessageDto['structuredPlan']) ?? null,
        suggestions: suggestionsOf(message.suggestions),
        idea: ideaOf(message.idea),
        engineFacts: (message.engineFacts as ChatMessageDto['engineFacts']) ?? null,
        reports: message.reports as unknown as WorkReport[],
        notices: message.notices as unknown as ChatNotice[],
        docDrafts: drafts.get(message.id) ?? [],
        changedFiles: message.changedFiles as ChatMessageDto['changedFiles'],
        steps: steps
          .filter((step) => step.messageId === message.id)
          .map((step): ChatStepDto => ({
            id: step.id,
            toolUseId: step.toolUseId,
            parentToolUseId: step.parentToolUseId,
            name: step.name,
            status: step.status as ChatStepDto['status'],
            input: step.input,
            command: step.command,
            output: step.output,
            decision: step.decision,
            textOffset: step.textOffset,
            startedAt: step.startedAt.toISOString(),
            endedAt: iso(step.endedAt),
          })),
        questions: approvals
          .filter((approval) => approval.messageId === message.id && approval.kind === 'question')
          .map((approval): ChatQuestionDto => ({
            id: approval.id,
            messageId: approval.messageId,
            toolUseId: approval.toolUseId,
            questions: approval.questions as ChatQuestionDto['questions'],
            status: approval.status as ChatQuestionDto['status'],
            answers: (approval.answers as ChatQuestionDto['answers']) ?? null,
            expiresAt: approval.expiresAt.toISOString(),
            answeredAt: iso(approval.answeredAt),
            createdAt: approval.createdAt.toISOString(),
          })),
        approvals: approvals
          .filter((approval) => approval.messageId === message.id && approval.kind === 'approval')
          .map((approval): ChatApprovalDto => ({
            id: approval.id,
            messageId: approval.messageId,
            toolUseId: approval.toolUseId,
            toolName: approval.toolName,
            command: approval.command,
            category: approval.category as ChatApprovalDto['category'],
            input: approval.input,
            effect: approval.effect,
            draftId: approval.draftId,
            status: approval.status as ChatApprovalDto['status'],
            expiresAt: approval.expiresAt.toISOString(),
            answeredAt: iso(approval.answeredAt),
            createdAt: approval.createdAt.toISOString(),
          })),
        createdAt: message.createdAt.toISOString(),
        endedAt: iso(message.endedAt),
      })),
    };
  }

  async exportMarkdown(actor: MemberActor, id: string): Promise<{ fileName: string; markdown: string }> {
    const chat = await this.get(actor, id);
    const safe = chat.title.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'chat';
    return { fileName: `${safe.slice(0, 80)}.md`, markdown: chatToMarkdown(chat) };
  }

  // ── Starting and changing a chat ──────────────────────────────────────────────────────────────

  async create(actor: MemberActor, input: CreateChatInput): Promise<ChatDto> {
    const device = await this.devices.owned(actor.userId, input.device);
    const project = await this.projects.get(actor);
    if (!folderIsRegistered(input.folder, project.repoPaths, device.platform)) {
      throw new AppException('hub.chats.folder_not_allowed');
    }
    const row = await this.txHost.tx.chat.create({
      data: {
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        deviceId: input.device,
        folder: input.folder,
        mode: input.mode ?? 'execute',
        model: input.model ?? null,
        effort: input.effort ?? null,
        title: input.title ?? '',
      },
      include: CHAT_INCLUDE,
    });
    await this.audit.record(actor, {
      action: 'chats.create',
      targetType: 'chat',
      targetId: row.id,
      summary: `Started a chat on ${device.name} in ${input.folder}`.slice(0, AUDIT_SUMMARY_CHARS),
    });
    return this.toChat(row);
  }

  async update(actor: MemberActor, id: string, input: UpdateChatInput): Promise<ChatDto> {
    assertNoSecrets(input);
    const before = await this.owned(actor, id);
    const row = await this.txHost.tx.chat.update({
      where: { id, workspaceId: actor.workspaceId },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.pinned === undefined ? {} : { pinnedAt: input.pinned ? this.clock.now() : null }),
        ...(input.mode === undefined ? {} : { mode: input.mode }),
        ...(input.model === undefined ? {} : { model: input.model }),
        ...(input.effort === undefined ? {} : { effort: input.effort }),
      },
      include: CHAT_INCLUDE,
    });
    if (input.mode !== undefined && input.mode !== before.mode)
      await this.applyLiveMode(actor, before, input.mode);
    await this.changed(actor, id, 'chat');
    return this.toChat(row);
  }

  /**
   * A running turn takes a new mode at once, between Execute and Auto (the engine started with the same rules for both; Ask and Plan are read only and
   * start a new turn). Into Auto, each call already paused on the owner is allowed through the same path as an Allow from the panel. A question keeps
   * waiting: it is a decision about the business or the way of working, and Auto never makes one for the owner. The bridge then decides the rest of the
   * turn by the new mode; an older bridge with no `turn.mode` keeps the mode the turn started with for its later calls.
   */
  private async applyLiveMode(actor: MemberActor, chat: ChatRow, mode: ChatMode): Promise<void> {
    const live = (m: string) => m === 'execute' || m === 'auto';
    if (!this.isRunning(chat) || !live(mode) || !live(chat.mode) || !this.hub.isOnline(chat.deviceId)) return;
    if (mode === 'auto') {
      const waiting = await this.txHost.tx.chatApproval.findMany({
        where: { workspaceId: actor.workspaceId, chatId: chat.id, status: 'pending', kind: 'approval' },
        orderBy: { createdAt: 'asc' },
      });
      for (const item of waiting) {
        await this.answer(actor, chat.id, item.id, { decision: 'allow' }).catch(() => undefined);
      }
    }
    await this.hub
      .request(chat.deviceId, 'turn.mode', { chatId: chat.id, mode }, { timeoutMs: ANSWER_TIMEOUT_MS })
      .catch(() => undefined);
  }

  async remove(actor: MemberActor, id: string): Promise<void> {
    const row = await this.owned(actor, id);
    if (this.isRunning(row) && this.hub.isOnline(row.deviceId)) {
      await this.hub.request(row.deviceId, 'turn.stop', { chatId: id }, { timeoutMs: STOP_TIMEOUT_MS });
    }
    if (this.hub.isOnline(row.deviceId)) {
      await this.hub
        .request(row.deviceId, 'chat.close', { chatId: id }, { timeoutMs: STOP_TIMEOUT_MS })
        .catch(() => undefined);
    }
    await this.txHost.withTransaction(async () => {
      await this.txHost.tx.chat.update({
        where: { id, workspaceId: actor.workspaceId },
        data: { deletedAt: this.clock.now() },
      });
      await this.audit.record(actor, {
        action: 'chats.delete',
        targetType: 'chat',
        targetId: id,
        summary: `Deleted the chat "${row.title}"`.slice(0, AUDIT_SUMMARY_CHARS),
      });
    });
    await this.changed(actor, id, 'chat');
  }

  async restore(actor: MemberActor, id: string): Promise<ChatDto> {
    const row = await this.owned(actor, id);
    if (!row.deletedAt) throw new AppException('hub.common.conflict');
    const restored = await this.txHost.withTransaction(async () => {
      const next = await this.txHost.tx.chat.update({
        where: { id, workspaceId: actor.workspaceId },
        data: { deletedAt: null },
        include: CHAT_INCLUDE,
      });
      await this.audit.record(actor, {
        action: 'chats.restore',
        targetType: 'chat',
        targetId: id,
        summary: `Restored the chat "${row.title}"`.slice(0, AUDIT_SUMMARY_CHARS),
      });
      return next;
    });
    await this.changed(actor, id, 'chat');
    return this.toChat(restored);
  }

  /** A new chat holding the words up to that message. It has no engine session, so its first turn is told what came before. */
  async branch(actor: MemberActor, id: string, messageId: string, title?: string): Promise<ChatDto> {
    const source = await this.usable(actor, id);
    const { workspaceId } = actor;
    const at = await this.txHost.tx.chatMessage.findFirst({
      where: { id: messageId, workspaceId, chatId: id },
    });
    if (!at) throw new AppException('hub.chats.message_not_found');
    const row = await this.txHost.withTransaction(async () => {
      const chat = await this.txHost.tx.chat.create({
        data: {
          workspaceId,
          userId: actor.userId,
          deviceId: source.deviceId,
          folder: source.folder,
          mode: source.mode,
          model: source.model,
          effort: source.effort,
          title: title ?? (source.title ? `${source.title} (branch)` : ''),
          parentChatId: id,
          parentMessageId: messageId,
        },
        include: CHAT_INCLUDE,
      });
      const words = await this.txHost.tx.chatMessage.findMany({
        where: { workspaceId, chatId: id, ordinal: { lte: at.ordinal } },
        orderBy: { ordinal: 'asc' },
        select: { role: true, content: true, truncated: true, ordinal: true, createdAt: true },
      });
      await this.txHost.tx.chatMessage.createMany({
        data: words.map((word) => ({
          workspaceId,
          chatId: chat.id,
          ordinal: word.ordinal,
          role: word.role,
          content: word.content,
          truncated: word.truncated,
          status: word.role === 'assistant' ? 'done' : null,
          createdAt: word.createdAt,
        })),
      });
      await this.audit.record(actor, {
        action: 'chats.branch',
        targetType: 'chat',
        targetId: chat.id,
        summary: `Branched from chat ${id}`,
      });
      return chat;
    });
    return this.toChat(row);
  }

  // ── Turns ─────────────────────────────────────────────────────────────────────────────────────

  async send(actor: MemberActor, id: string, input: SendChatMessageInput): Promise<ChatTurnStarted> {
    assertNoSecrets({ text: input.text, context: input.context });
    return this.startTurn(actor, id, input.text, input.context ?? null, input);
  }

  async retry(
    actor: MemberActor,
    id: string,
    options: Pick<SendChatMessageInput, 'mode' | 'model' | 'effort'>,
  ): Promise<ChatTurnStarted> {
    const last = await this.txHost.tx.chatMessage.findFirst({
      where: { workspaceId: actor.workspaceId, chatId: id, role: 'user' },
      orderBy: { ordinal: 'desc' },
    });
    if (!last) throw new AppException('hub.chats.nothing_to_retry');
    return this.startTurn(actor, id, last.content, contextOf(last.context), options);
  }

  /**
   * A queued run (docs/16 §9): a new chat in Execute, owned by the member who queued it, and its first turn, through the same path as the panel's Send. So it carries the same D41 approvals, the same recorder, and the same proof for `report_work` (D52).
   * `run` carries the run's mode (D58), its extra folders (D59) and its roles (D60). They reach the bridge and the engine only from here, never from a panel request or an agent tool.
   */
  async startForQueue(
    actor: MemberActor,
    input: { device: string; folder: string; title: string; prompt: string; card?: string; run?: QueueTurn },
  ): Promise<ChatTurnStarted> {
    assertNoSecrets({ text: input.prompt });
    const chat = await this.create(actor, {
      device: input.device,
      folder: input.folder,
      mode: 'execute',
      title: input.title.slice(0, 200) || 'Queued run',
    });
    return this.startTurn(
      actor,
      chat.id,
      input.prompt,
      { page: 'queue', ...(input.card ? { card: input.card } : {}) },
      { mode: 'execute' },
      input.run,
    );
  }

  /** A paused run resumed in its own chat (docs/16 §9), with the same mode, folders and roles it started with. */
  async sendForQueue(
    actor: MemberActor,
    id: string,
    input: { prompt: string; card?: string; run?: QueueTurn },
  ): Promise<ChatTurnStarted> {
    assertNoSecrets({ text: input.prompt });
    return this.startTurn(
      actor,
      id,
      input.prompt,
      { page: 'queue', ...(input.card ? { card: input.card } : {}) },
      { mode: 'execute' },
      input.run,
    );
  }

  private async startTurn(
    actor: MemberActor,
    id: string,
    text: string,
    context: SendChatMessageInput['context'] | null,
    options: Pick<SendChatMessageInput, 'mode' | 'model' | 'effort'>,
    run?: QueueTurn,
  ): Promise<ChatTurnStarted> {
    const chat = await this.usable(actor, id);
    if (!this.hub.isOnline(chat.deviceId)) throw new AppException('hub.devices.offline');
    const project = await this.projects.get(actor);
    const addDirs = run?.extraFolders ?? [];
    const platform =
      addDirs.length > 0 ? (await this.devices.owned(actor.userId, chat.deviceId)).platform : '';
    for (const folder of addDirs) {
      if (!folderIsRegistered(folder, project.repoPaths, platform)) {
        throw new AppException('hub.chats.folder_not_allowed');
      }
    }
    const { workspaceId } = actor;
    const mode = (options.mode ?? chat.mode) as ChatMode;
    const model = options.model ?? chat.model;
    const effort = options.effort ?? chat.effort;

    let ids: { user: string; assistant: string; earlier: { role: string; content: string }[] };
    try {
      ids = await this.txHost.withTransaction(async () => {
        const earlier = await this.txHost.tx.chatMessage.findMany({
          where: { workspaceId, chatId: id },
          orderBy: { ordinal: 'asc' },
          select: { role: true, content: true, ordinal: true },
        });
        const next = (earlier.at(-1)?.ordinal ?? -1) + 1;
        const user = await this.txHost.tx.chatMessage.create({
          data: {
            workspaceId,
            chatId: id,
            ordinal: next,
            role: 'user',
            content: capText(text, CHAT_LIMITS.promptChars).text,
            ...(context ? { context } : {}),
          },
        });
        const assistant = await this.txHost.tx.chatMessage.create({
          data: { workspaceId, chatId: id, ordinal: next + 1, role: 'assistant', status: 'running' },
        });
        await this.txHost.tx.chat.update({
          where: { id, workspaceId },
          data: { mode, model, effort, ...(chat.title ? {} : { title: titleFrom(text) }) },
        });
        return { user: user.id, assistant: assistant.id, earlier };
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') throw new AppException('hub.chats.turn_running');
      throw error;
    }

    // A branch has words from another chat and no session: its first turn reads them.
    const history = chat.sessionId || !chat.parentChatId ? '' : historyPrefix(ids.earlier);
    const prefix = contextPrefix({
      project: project.slug,
      ...(context ?? {}),
      ...(run
        ? { runMode: run.mode, extraFolders: addDirs, ...(run.roles.length > 0 ? { roles: run.roles } : {}) }
        : {}),
    });
    const prompt = turnPrompt(prefix, history, text);
    this.run(actor, chat, ids.assistant, {
      chatId: id,
      folder: chat.folder,
      ...(addDirs.length > 0 ? { addDirs } : {}),
      ...(run ? { runMode: run.mode, ...(run.mode === 'approval' ? { untimed: true } : {}) } : {}),
      prompt,
      mode,
      ...(model ? { model } : {}),
      ...(effort ? { effort } : {}),
      ...(chat.sessionId ? { sessionId: chat.sessionId } : {}),
    });
    await this.changed(actor, id, 'turn');
    return { chatId: id, userMessageId: ids.user, messageId: ids.assistant };
  }

  /** The turn outlives the request that started it. `onEvent` is called in order; the answer arrives when it ends. */
  private run(
    actor: MemberActor,
    chat: ChatRow,
    messageId: string,
    args: Readonly<Record<string, unknown>>,
  ): void {
    const recorder = new TurnRecorder(
      {
        txHost: this.txHost,
        realtime: this.realtime,
        audit: this.audit,
        clock: this.clock,
        events: this.events,
      },
      {
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        chatId: chat.id,
        messageId,
        deviceName: chat.device.name,
        hadSession: Boolean(chat.sessionId),
      },
    );
    this.turns.set(chat.id, recorder);
    void this.hub
      .request(chat.deviceId, 'turn.start', args, {
        timeoutMs: null,
        onEvent: (event) => recorder.receive(event),
      })
      .then(() => recorder.finish('interrupted', 'unknown'))
      .catch((error: unknown) => this.turnRefused(recorder, error))
      .finally(() => this.turns.release(chat.id, recorder));
  }

  private turnRefused(recorder: TurnRecorder, error: unknown): Promise<void> {
    const code = (error as { code?: string }).code;
    const details = (error as { details?: { reason?: string; message?: string } }).details;
    if (code === 'hub.devices.offline') return recorder.finish('interrupted', 'device_offline');
    return recorder.finish('failed', 'unknown', details?.reason ?? code ?? 'refused');
  }

  async stop(actor: MemberActor, id: string): Promise<void> {
    const row = await this.owned(actor, id);
    if (!this.isRunning(row)) throw new AppException('hub.chats.not_running');
    await this.hub.request(row.deviceId, 'turn.stop', { chatId: id }, { timeoutMs: STOP_TIMEOUT_MS });
    await this.audit.record(actor, {
      action: 'chats.stop',
      targetType: 'chat',
      targetId: id,
      summary: `Stopped a turn on ${row.device.name}`,
    });
  }

  /**
   * First answer wins: `pending` moves once, in one statement. Audited with the exact command, the answer and the device; the audit row's ip and agent say which browser answered. A question takes the same path (docs/16 §7.2), and so does the Save of a draft, with the owner's edit and flag answers.
   * With the device gone nothing can run on this answer, so it is refused rather than recorded as allowed: the socket closing stopped the turn too, as `interrupted` (review M9).
   */
  async answer(
    actor: MemberActor,
    id: string,
    approvalId: string,
    input: AnswerApprovalInput,
  ): Promise<void> {
    const { decision, note, answers, doc } = input;
    assertNoSecrets({ note, answers, doc });
    const chat = await this.owned(actor, id);
    if (!z.uuid().safeParse(approvalId).success) throw new AppException('hub.chats.approval_not_found');
    const { workspaceId } = actor;
    const approval = await this.txHost.tx.chatApproval.findFirst({
      where: { id: approvalId, workspaceId, chatId: id },
    });
    if (!approval) throw new AppException('hub.chats.approval_not_found');
    const question = approval.kind === 'question';
    if (!this.hub.isOnline(chat.deviceId)) {
      await this.txHost.tx.chatApproval.updateMany({
        where: { id: approvalId, workspaceId, chatId: id, status: 'pending' },
        data: { status: 'stopped', answeredAt: this.clock.now() },
      });
      const now = await this.txHost.tx.chatApproval.findFirst({
        where: { id: approvalId, workspaceId, chatId: id },
        select: { status: true },
      });
      if (now?.status === 'stopped') {
        await this.changed(actor, id, 'approval');
        throw new AppException('hub.chats.approval_device_offline');
      }
      throw new AppException('hub.chats.approval_answered');
    }
    if (question && decision === 'allow' && !answers) throw new AppException('hub.common.validation');
    if (approval.draftId && approval.status === 'pending') {
      await this.drafts.applyOwnerAnswers(actor, id, approval.draftId, doc, decision);
    }
    const answeredAt = this.clock.now();
    const allowed = question ? 'answered' : 'allowed';
    const denied = question ? 'declined' : 'denied';
    const moved = await this.txHost.withTransaction(async () => {
      const claim = await this.txHost.tx.chatApproval.updateMany({
        where: { id: approvalId, workspaceId, chatId: id, status: 'pending' },
        data: {
          status: decision === 'allow' ? allowed : denied,
          answeredById: actor.userId,
          answeredAt,
          ...(question && answers ? { answers } : {}),
        },
      });
      if (claim.count === 0) return false;
      await this.audit.record(actor, {
        action: `chats.${question ? 'question' : 'approval'}.${decision}`,
        targetType: 'chat_approval',
        targetId: approvalId,
        summary: `${decision} on ${chat.device.name}: ${approval.command}`.slice(0, AUDIT_SUMMARY_CHARS),
      });
      return true;
    });
    if (!moved) throw new AppException('hub.chats.approval_answered');
    const answered = await this.hub
      .request<{ accepted: boolean }>(
        chat.deviceId,
        'turn.answer',
        {
          chatId: id,
          approvalId,
          decision,
          ...(note ? { note } : {}),
          ...(answers ? { answers } : {}),
        },
        { timeoutMs: ANSWER_TIMEOUT_MS },
      )
      .catch(() => ({ accepted: false }));
    if (!answered.accepted) {
      // The bridge timed out or stopped first, and nothing ran on this answer. The record must say so.
      await this.txHost.tx.chatApproval.update({
        where: { id: approvalId, workspaceId },
        data: { status: 'timed_out' },
      });
      await this.changed(actor, id, 'approval');
      throw new AppException('hub.chats.approval_expired');
    }
    await this.changed(actor, id, 'approval');
  }

  async diff(actor: MemberActor, id: string, path: string): Promise<ChatDiff> {
    const chat = await this.owned(actor, id);
    if (chat.device.revokedAt) throw new AppException('hub.devices.not_found');
    const answer = await this.hub.request<ChatDiff>(
      chat.deviceId,
      'chat.diff',
      { folder: chat.folder, path },
      { timeoutMs: DIFF_TIMEOUT_MS },
    );
    return { ...answer, diff: redactSecrets(answer.diff) };
  }

  /** The engine on a device, for the panel's selectors and honest states. `fresh` is the re-check action: it asks past the bridge's cache (review M9). */
  async engine(actor: MemberActor, deviceId: string, fresh = false): Promise<EngineStatus> {
    await this.devices.owned(actor.userId, deviceId);
    return engineStatusSchema.parse(
      await this.hub.request(deviceId, 'engine.status', fresh ? { fresh: true } : {}, {
        timeoutMs: ENGINE_TIMEOUT_MS,
      }),
    );
  }

  /**
   * Send to VS Code (docs/16 §8). The prompt is built here from what Hub holds, so the bridge's link carries nothing a caller wrote. `sent` is all anyone can know: the owner still presses Enter, and exit codes only prove the handover (S1 Q10).
   */
  async openInVsCode(actor: MemberActor, input: VsCodeOpenInput): Promise<VsCodeOpenResult> {
    const device = await this.devices.owned(actor.userId, input.device);
    const project = await this.projects.get(actor);
    if (!folderIsRegistered(input.folder, project.repoPaths, device.platform)) {
      throw new AppException('hub.chats.folder_not_allowed');
    }
    if (!this.hub.isOnline(input.device)) throw new AppException('hub.devices.offline');
    if (input.cardKey) await this.cards.readable(actor, { cardKey: input.cardKey });
    const chat = input.chatId ? await this.owned(actor, input.chatId) : null;
    const prompt = vscodePrompt({
      cardKey: input.cardKey,
      chatTitle: chat ? redactSecrets(chat.title) : undefined,
      folder: input.folder,
    });
    try {
      await this.hub.request(
        input.device,
        'vscode.open',
        { folder: input.folder, prompt },
        { timeoutMs: VSCODE_TIMEOUT_MS },
      );
    } catch (error) {
      const reason = (error as { details?: { reason?: string } }).details?.reason;
      if (reason === 'folder_not_allowed') throw new AppException('hub.chats.folder_not_allowed');
      throw error;
    }
    await this.audit.record(actor, {
      action: 'chats.vscode',
      targetType: input.chatId ? 'chat' : 'device',
      targetId: input.chatId ?? input.device,
      summary: `Sent ${input.folder} to VS Code on ${device.name}`.slice(0, AUDIT_SUMMARY_CHARS),
    });
    return { sent: true, prompt };
  }

  // ── Prompt templates, per project ─────────────────────────────────────────────────────────────

  async templates(actor: MemberActor): Promise<PromptTemplateDto[]> {
    const rows = await this.txHost.tx.chatPromptTemplate.findMany({
      where: { workspaceId: actor.workspaceId, deletedAt: null },
      orderBy: { title: 'asc' },
    });
    return rows.map((row) => this.toTemplate(row));
  }

  async saveTemplate(
    actor: MemberActor,
    input: PromptTemplateInput,
    id?: string,
  ): Promise<PromptTemplateDto> {
    assertNoSecrets(input);
    const { workspaceId } = actor;
    if (id) {
      await this.template(actor, id);
      const row = await this.txHost.tx.chatPromptTemplate.update({
        where: { id, workspaceId },
        data: { title: input.title, body: input.body },
      });
      return this.toTemplate(row);
    }
    const row = await this.txHost.tx.chatPromptTemplate.create({
      data: { workspaceId, title: input.title, body: input.body, createdById: actor.userId },
    });
    return this.toTemplate(row);
  }

  async removeTemplate(actor: MemberActor, id: string): Promise<void> {
    await this.template(actor, id);
    await this.txHost.tx.chatPromptTemplate.update({
      where: { id, workspaceId: actor.workspaceId },
      data: { deletedAt: this.clock.now() },
    });
  }

  private async template(actor: MemberActor, id: string): Promise<void> {
    if (!z.uuid().safeParse(id).success) throw new AppException('hub.chats.template_not_found');
    const row = await this.txHost.tx.chatPromptTemplate.findFirst({
      where: { id, workspaceId: actor.workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!row) throw new AppException('hub.chats.template_not_found');
  }

  private toTemplate(row: { id: string; title: string; body: string; updatedAt: Date }): PromptTemplateDto {
    return { id: row.id, title: row.title, body: row.body, updatedAt: row.updatedAt.toISOString() };
  }

  // ── Parts ─────────────────────────────────────────────────────────────────────────────────────

  private isRunning(row: ChatRow): boolean {
    return (row.messages?.length ?? 0) > 0;
  }

  private async owned(actor: MemberActor, id: string): Promise<ChatRow> {
    if (!z.uuid().safeParse(id).success) throw new AppException('hub.chats.not_found');
    const row = await this.txHost.tx.chat.findFirst({
      where: { id, workspaceId: actor.workspaceId, userId: actor.userId },
      include: CHAT_INCLUDE,
    });
    if (!row) throw new AppException('hub.chats.not_found');
    return row;
  }

  /** What a new turn needs: not deleted, the device still paired, and the folder still on the project's list. */
  private async usable(actor: MemberActor, id: string): Promise<ChatRow> {
    const row = await this.owned(actor, id);
    if (row.deletedAt) throw new AppException('hub.chats.not_found');
    const device = await this.devices.owned(actor.userId, row.deviceId);
    const project = await this.projects.get(actor);
    if (!folderIsRegistered(row.folder, project.repoPaths, device.platform)) {
      throw new AppException('hub.chats.folder_not_allowed');
    }
    return row;
  }

  private toChat(row: ChatRow): ChatDto {
    return {
      id: row.id,
      deviceId: row.deviceId,
      deviceName: row.device.name,
      deviceOnline: this.hub.isOnline(row.deviceId),
      deviceRevoked: row.device.revokedAt !== null,
      folder: row.folder,
      branch: row.branch,
      mode: row.mode as ChatMode,
      model: row.model,
      effort: row.effort,
      sessionId: row.sessionId,
      title: row.title,
      pinned: row.pinnedAt !== null,
      parentChatId: row.parentChatId,
      parentMessageId: row.parentMessageId,
      running: this.isRunning(row),
      lastSeq: row.lastSeq,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: iso(row.deletedAt),
    };
  }

  private async changed(actor: MemberActor, chatId: string, reason: ChatChanged['reason']): Promise<void> {
    const data: ChatChanged = { chatId, reason };
    await this.realtime.publishEnvelope(actor.workspaceId, {
      event: 'chat.changed',
      data,
      audience: { userIds: [actor.userId] },
    });
  }
}

/** A message's proposals as stored, or null when it has none or they no longer read (D66). */
function ideaOf(value: unknown): ChatMessageDto['idea'] {
  const parsed = proposedIdeaSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function suggestionsOf(value: unknown): ChatMessageDto['suggestions'] {
  const parsed = chatSuggestionsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
