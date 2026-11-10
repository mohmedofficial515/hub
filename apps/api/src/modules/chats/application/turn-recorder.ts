/**
 * @file Records one turn as it streams (docs/16 §4, §7.1): Hub's own copy, written before anyone is told, so a device that reconnects reads what it missed.
 * @description Every event is checked against `turnEventSchema`, and everything passes the secret filter before it is stored or sent. Streamed text goes through `createStreamRedactor`, since a secret can be split across pieces, and
 * reaches the database and the stream together every `TEXT_FLUSH_MS`. Each sent event has a number per chat, written in the same statement as what it describes, so a page reading the chat knows exactly which events it already has. Sizes are capped, with a marker.
 * Sent events are transient; `chat.changed` is the durable nudge, for what must not be missed: an approval, and a turn starting or ending.
 */
import {
  capText,
  type ChangedFile,
  CHAT_LIMITS,
  CHAT_TRUNCATED_MARK,
  type ChatChanged,
  type ChatLiveEvent,
  type ChatNotice,
  type ChatStage,
  createStreamRedactor,
  redactDeep,
  redactSecrets,
  type TurnEvent,
  turnEventSchema,
  type WorkReport,
} from '@hub/contracts';
import { Logger } from '@nestjs/common';
import { type TransactionHost } from '@nestjs-cls/transactional';
import { z } from 'zod';

import type { Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import type { RealtimePublisher } from '@/infra/redis/redis.module';
import type { AuditService } from '@/modules/audit';
import type { BridgeEvent } from '@/modules/devices';

import { capJson } from '../domain/folders';
import { withProposals } from '../domain/suggestions';
import type { ChatTurnEvents } from './turn-events';

const TEXT_FLUSH_MS = 120;
const AUDIT_SUMMARY_CHARS = 1_000;
const NOTICES_LIMIT = 50;

/** The draft a `save_doc` names, so the panel can show Save on its approval. */
function draftIdOf(input: unknown): string | null {
  const draft = (input as { draft?: unknown } | null)?.draft;
  return typeof draft === 'string' && z.uuid().safeParse(draft).success ? draft : null;
}

export interface RecorderDeps {
  readonly txHost: TransactionHost<PrismaTransactionalAdapter>;
  readonly realtime: RealtimePublisher;
  readonly audit: AuditService;
  readonly clock: Clock;
  /** The queue listens here (docs/16 §9). */
  readonly events?: ChatTurnEvents;
}

export interface TurnIdentity {
  readonly workspaceId: string;
  readonly userId: string;
  readonly chatId: string;
  readonly messageId: string;
  readonly deviceName: string;
  readonly hadSession: boolean;
}

export class TurnRecorder {
  private readonly logger = new Logger(TurnRecorder.name);
  private readonly redactor = createStreamRedactor();
  private chain: Promise<void> = Promise.resolve();
  private pending = '';
  private timer: NodeJS.Timeout | null = null;
  private length = 0;
  private cut = false;
  private steps = 0;
  private stages: ChatStage[] = [];
  private notices: ChatNotice[] = [];
  private reports: WorkReport[] = [];
  private ended = false;

  constructor(
    private readonly deps: RecorderDeps,
    private readonly turn: TurnIdentity,
  ) {}

  /** One frame from the bridge. A frame that is not a known event is dropped: the bridge is a device's bytes. */
  receive(frame: BridgeEvent): void {
    const parsed = turnEventSchema.safeParse(frame.data);
    if (!parsed.success) {
      this.logger.warn(`Dropped an unknown turn event of kind ${frame.kind.slice(0, 40)}`);
      return;
    }
    this.enqueue(() => this.handle(parsed.data));
  }

  /** A server-made event, in order with the bridge's. Answers once it is written. */
  async post(event: TurnEvent): Promise<void> {
    this.enqueue(() => this.handle(event));
    await this.chain;
  }

  /** The action ended with no `turn.ended` of its own, as when the device goes away. */
  finish(
    status: 'interrupted' | 'failed',
    failure: 'device_offline' | 'unknown',
    message?: string,
  ): Promise<void> {
    this.enqueue(async () => {
      if (!this.ended) {
        await this.handle({
          kind: 'turn.ended',
          status,
          failure,
          ...(message ? { message: message.slice(0, 500) } : {}),
        });
      }
    });
    return this.chain;
  }

  private enqueue(work: () => Promise<void>): void {
    this.chain = this.chain.then(work).catch((error: unknown) => {
      this.logger.warn(`A turn event was not recorded: ${String(error)}`);
    });
  }

  private get tx() {
    return this.deps.txHost.tx;
  }

  private async handle(event: TurnEvent): Promise<void> {
    if (this.ended) return;
    if (event.kind === 'text.delta') {
      this.pending += this.redactor.push(event.text);
      if (!this.timer && this.pending !== '') {
        this.timer = setTimeout(() => {
          this.timer = null;
          this.enqueue(() => this.flushText());
        }, TEXT_FLUSH_MS);
        this.timer.unref();
      }
      return;
    }
    // A tool or the end closes a block of text, so what the redactor holds back comes out now and in the right place.
    await this.flushText(event.kind === 'turn.ended' || event.kind === 'tool.started');
    await this.record(event);
  }

  private async flushText(final = false): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (final) this.pending += this.redactor.end();
    if (this.pending === '') return;
    let piece = this.pending;
    this.pending = '';
    if (this.cut) return;
    const room = CHAT_LIMITS.messageChars - this.length;
    if (piece.length > room) {
      piece = `${piece.slice(0, room)}${CHAT_TRUNCATED_MARK}`;
      this.cut = true;
    }
    this.length += piece.length;
    const { chatId, messageId, workspaceId } = this.turn;
    const rows = await this.tx.$queryRaw<{ last_seq: number }[]>`
      WITH written AS (
        UPDATE chat_messages SET content = content || ${piece}, truncated = ${this.cut}
        WHERE id = ${messageId}::uuid AND workspace_id = ${workspaceId}::uuid
      )
      UPDATE chats SET last_seq = last_seq + 1, updated_at = now()
      WHERE id = ${chatId}::uuid AND workspace_id = ${workspaceId}::uuid
      RETURNING last_seq`;
    await this.publish(rows[0]?.last_seq ?? 0, { kind: 'text.delta', text: piece });
  }

  private async bump(): Promise<number> {
    const { chatId, workspaceId } = this.turn;
    const chat = await this.tx.chat.update({
      where: { id: chatId, workspaceId },
      data: { lastSeq: { increment: 1 } },
      select: { lastSeq: true },
    });
    return chat.lastSeq;
  }

  private async publish(seq: number, event: TurnEvent): Promise<void> {
    const { chatId, messageId, userId, workspaceId } = this.turn;
    const data: ChatLiveEvent = { chatId, messageId, seq, event };
    await this.deps.realtime.publishTransient(workspaceId, {
      event: 'chat.event',
      data,
      audience: { userIds: [userId] },
    });
  }

  private async nudge(reason: ChatChanged['reason']): Promise<void> {
    const data: ChatChanged = { chatId: this.turn.chatId, reason };
    await this.deps.realtime.publishEnvelope(this.turn.workspaceId, {
      event: 'chat.changed',
      data,
      audience: { userIds: [this.turn.userId] },
    });
  }

  /** Writes the event, numbers it in the same transaction, and tells the open pages after commit. */
  private async record(raw: TurnEvent): Promise<void> {
    let event: TurnEvent = raw;
    const seq = await this.deps.txHost.withTransaction(async () => {
      event = await this.write(raw);
      return this.bump();
    });
    await this.publish(seq, event);
    if (
      raw.kind === 'approval.requested' ||
      raw.kind === 'approval.resolved' ||
      raw.kind === 'question.asked' ||
      raw.kind === 'question.resolved' ||
      raw.kind === 'auto.decision'
    ) {
      await this.nudge('approval');
    }
    if (raw.kind === 'turn.ended') await this.nudge('turn');
    await this.tell(event);
  }

  /** After commit, so a listener reads what is written. */
  private async tell(event: TurnEvent): Promise<void> {
    const events = this.deps.events;
    if (!events) return;
    const { workspaceId, userId, chatId, messageId } = this.turn;
    if (event.kind === 'approval.requested' || event.kind === 'question.asked') {
      const question = event.kind === 'question.asked';
      await events.waiting({
        workspaceId,
        userId,
        chatId,
        messageId,
        approvalId: question ? event.questionId : event.approvalId,
        kind: question ? 'question' : 'approval',
        command: question ? (event.questions[0]?.text ?? '') : event.command,
      });
    }
    if (event.kind === 'limit') await events.limit({ workspaceId, userId, chatId, limit: event.limit });
    if (event.kind === 'turn.ended') {
      await events.ended({
        workspaceId,
        userId,
        chatId,
        messageId,
        status: event.status,
        failure: event.failure ?? null,
        resetsAt: event.resetsAt ?? null,
        changedFiles: event.changedFiles ?? [],
      });
    }
  }

  private async write(event: TurnEvent): Promise<TurnEvent> {
    const { chatId, messageId, workspaceId } = this.turn;
    const now = this.deps.clock.now();
    switch (event.kind) {
      case 'turn.session': {
        await this.tx.chat.update({
          where: { id: chatId, workspaceId },
          data: { sessionId: event.sessionId, ...(event.branch ? { branch: event.branch } : {}) },
        });
        const facts =
          event.skills || event.mcpServers
            ? redactDeep({ skills: event.skills ?? [], mcpServers: event.mcpServers ?? [] })
            : null;
        await this.tx.chatMessage.update({
          where: { id: messageId, workspaceId },
          data: {
            ...(event.model ? { model: event.model } : {}),
            ...(event.claudeVersion ? { claudeVersion: event.claudeVersion } : {}),
            ...(facts ? { engineFacts: facts } : {}),
          },
        });
        return facts ? { ...event, ...facts } : event;
      }
      case 'tool.started': {
        if (this.steps >= CHAT_LIMITS.stepsPerTurn) return event;
        this.steps += 1;
        await this.tx.chatStep.upsert({
          where: { messageId_toolUseId: { messageId, toolUseId: event.toolUseId }, workspaceId },
          update: {},
          create: {
            workspaceId,
            chatId,
            messageId,
            toolUseId: event.toolUseId,
            parentToolUseId: event.parentToolUseId ?? null,
            name: event.name,
            textOffset: this.length,
            startedAt: now,
          },
        });
        return event;
      }
      case 'tool.input': {
        const input = capJson(redactDeep(event.input), CHAT_LIMITS.toolInputChars);
        const command =
          event.command === undefined
            ? undefined
            : capText(redactSecrets(event.command), CHAT_LIMITS.commandChars).text;
        await this.tx.chatStep.updateMany({
          where: { workspaceId, messageId, toolUseId: event.toolUseId },
          data: { input: input as object, ...(command === undefined ? {} : { command }) },
        });
        return { ...event, input, ...(command === undefined ? {} : { command }) };
      }
      case 'tool.result': {
        const { text } = capText(redactSecrets(event.output), CHAT_LIMITS.toolOutputChars);
        await this.tx.chatStep.updateMany({
          where: { workspaceId, messageId, toolUseId: event.toolUseId },
          data: {
            output: text,
            status: event.isError ? 'error' : 'done',
            decision: event.decision ?? null,
            endedAt: now,
          },
        });
        return { ...event, output: text };
      }
      case 'approval.requested': {
        const input = capJson(redactDeep(event.input), CHAT_LIMITS.toolInputChars);
        const command = capText(redactSecrets(event.command), CHAT_LIMITS.commandChars).text;
        await this.tx.chatApproval.create({
          data: {
            id: event.approvalId,
            workspaceId,
            chatId,
            messageId,
            toolUseId: event.toolUseId,
            toolName: event.toolName,
            command,
            category: event.category,
            input: input as object,
            effect: event.effect,
            draftId: draftIdOf(input),
            expiresAt: new Date(event.expiresAt),
          },
        });
        await this.tx.chatStep.updateMany({
          where: { workspaceId, messageId, toolUseId: event.toolUseId },
          data: { status: 'waiting' },
        });
        return { ...event, input, command };
      }
      case 'approval.resolved': {
        await this.closeApproval(event.approvalId, event.status);
        return event;
      }
      case 'stage': {
        this.stages = [
          ...this.stages,
          {
            protocol: event.protocol,
            stage: event.stage,
            state: event.state,
            at: now.toISOString(),
            ...(event.note ? { note: redactSecrets(event.note) } : {}),
          },
        ].slice(-50);
        await this.tx.chatMessage.update({
          where: { id: messageId, workspaceId },
          data: { stages: this.stages },
        });
        return event.note ? { ...event, note: redactSecrets(event.note) } : event;
      }
      case 'plan.proposed': {
        const { text } = capText(redactSecrets(event.plan), CHAT_LIMITS.messageChars);
        const structured = event.structured ? (redactDeep(event.structured) as object) : undefined;
        await this.tx.chatMessage.update({
          where: { id: messageId, workspaceId },
          data: { plan: text, ...(structured ? { structuredPlan: structured } : {}) },
        });
        return { ...event, plan: text };
      }
      case 'idea.proposed': {
        // The Idea Studio's report (docs/15 §4): each call replaces the last, so the page shows the whole current report.
        const idea = redactDeep(event.idea) as typeof event.idea;
        await this.tx.chatMessage.update({ where: { id: messageId, workspaceId }, data: { idea } });
        return { ...event, idea };
      }
      case 'suggestions.proposed': {
        // Proposals create nothing: they wait on the message for the owner's Accept or Dismiss (D66).
        const items = redactDeep(event.items) as typeof event.items;
        const summary = event.summary ? capText(redactSecrets(event.summary), 2_000).text : null;
        const current = await this.tx.chatMessage.findUnique({
          where: { id: messageId, workspaceId },
          select: { suggestions: true },
        });
        const merged = withProposals(current?.suggestions ?? null, summary, items);
        await this.tx.chatMessage.update({
          where: { id: messageId, workspaceId },
          data: { suggestions: merged },
        });
        return { ...event, summary: merged.summary, items: merged.items };
      }
      case 'auto.decision': {
        // An automatic queue run (D58) decided with nobody asked: one closed row, so the chat and the run's summary both show it, and nothing waits.
        const input = capJson(redactDeep(event.input), CHAT_LIMITS.toolInputChars);
        const command = capText(redactSecrets(event.command), CHAT_LIMITS.commandChars).text;
        const question = event.decision === 'answered';
        const approved = event.decision === 'approved';
        await this.tx.chatApproval.create({
          data: {
            id: event.decisionId,
            workspaceId,
            chatId,
            messageId,
            toolUseId: event.toolUseId,
            toolName: event.toolName,
            command,
            category: event.category,
            input: input as object,
            effect: event.effect,
            kind: question ? 'question' : 'approval',
            ...(event.questions ? { questions: redactDeep(event.questions) as object } : {}),
            ...(event.answers ? { answers: redactDeep(event.answers) as object } : {}),
            status: question ? 'auto_answered' : approved ? 'auto_allowed' : 'skipped',
            answeredAt: now,
            expiresAt: now,
          },
        });
        await this.deps.audit.record(
          { kind: 'system', userId: null, via: 'adapter', workspaceId, roles: [] },
          {
            action: question ? 'queue.auto_answered' : approved ? 'chat.auto_allowed' : 'queue.skipped',
            targetType: 'chat_approval',
            targetId: event.decisionId,
            summary:
              `${question ? 'Answered for the owner' : approved ? 'Allowed in Auto mode' : 'Skipped for the owner'} on ${this.turn.deviceName}: ${command}`.slice(
                0,
                AUDIT_SUMMARY_CHARS,
              ),
          },
        );
        return { ...event, input, command };
      }
      case 'question.asked': {
        const questions = redactDeep(event.questions) as typeof event.questions;
        await this.tx.chatApproval.create({
          data: {
            id: event.questionId,
            workspaceId,
            chatId,
            messageId,
            toolUseId: event.toolUseId,
            toolName: 'question',
            command: capText(questions[0]?.text ?? '', CHAT_LIMITS.commandChars).text,
            category: 'other',
            kind: 'question',
            questions,
            expiresAt: new Date(event.expiresAt),
          },
        });
        await this.tx.chatStep.updateMany({
          where: { workspaceId, messageId, toolUseId: event.toolUseId },
          data: { status: 'waiting' },
        });
        return { ...event, questions };
      }
      case 'question.resolved': {
        await this.closeApproval(event.questionId, event.status);
        const { answers: _answers, ...rest } = event;
        return rest;
      }
      case 'turn.starting':
      case 'engine.warning':
        return this.notice(event, event, now);
      case 'tool.blocked': {
        const clean = { ...event, command: redactSecrets(event.command) };
        return this.notice(clean, clean, now);
      }
      case 'report.refused':
        return this.notice(event, event, now);
      case 'work.reported': {
        const report = redactDeep(event.report) as WorkReport;
        this.reports = [...this.reports, report];
        await this.tx.chatMessage.update({
          where: { id: messageId, workspaceId },
          data: { reports: this.reports },
        });
        return { ...event, report };
      }
      case 'limit': {
        await this.tx.chatMessage.update({
          where: { id: messageId, workspaceId },
          data: { limit: event.limit },
        });
        return event;
      }
      case 'turn.ended':
        return this.end(event, now);
      default:
        return event;
    }
  }

  private async notice<T extends TurnEvent>(
    event: T,
    fields: Omit<ChatNotice, 'at'>,
    now: Date,
  ): Promise<TurnEvent> {
    const { messageId, workspaceId } = this.turn;
    this.notices = [...this.notices, { ...fields, at: now.toISOString() } as ChatNotice].slice(
      -NOTICES_LIMIT,
    );
    await this.tx.chatMessage.update({
      where: { id: messageId, workspaceId },
      data: { notices: this.notices },
    });
    return event;
  }

  /** A timeout or a stop reported by the bridge. An answer given here already moved it, and then this changes nothing. */
  private async closeApproval(
    id: string,
    status: 'allowed' | 'denied' | 'timed_out' | 'stopped' | 'answered' | 'declined',
  ): Promise<void> {
    const { chatId, workspaceId, deviceName } = this.turn;
    const moved = await this.tx.chatApproval.updateMany({
      where: { id, workspaceId, chatId, status: 'pending' },
      data: { status, answeredAt: this.deps.clock.now() },
    });
    const row = await this.tx.chatApproval.findFirst({ where: { id, workspaceId } });
    if (!row) return;
    await this.tx.chatStep.updateMany({
      where: { workspaceId, messageId: row.messageId, toolUseId: row.toolUseId, status: 'waiting' },
      data: { status: 'running' },
    });
    if (moved.count > 0) {
      await this.deps.audit.record(
        { kind: 'system', userId: null, via: 'adapter', workspaceId, roles: [] },
        {
          action: `chats.approval.${status}`,
          targetType: 'chat_approval',
          targetId: id,
          summary: `${status} on ${deviceName}: ${row.command}`.slice(0, AUDIT_SUMMARY_CHARS),
        },
      );
    }
  }

  private async end(event: Extract<TurnEvent, { kind: 'turn.ended' }>, now: Date): Promise<TurnEvent> {
    const { chatId, messageId, workspaceId } = this.turn;
    this.ended = true;
    const pending = await this.tx.chatApproval.findMany({
      where: { workspaceId, chatId, messageId, status: 'pending' },
      select: { id: true },
    });
    for (const approval of pending) await this.closeApproval(approval.id, 'stopped');
    await this.tx.chatStep.updateMany({
      where: { workspaceId, messageId, status: { in: ['running', 'waiting'] } },
      data: { status: 'cut_off', endedAt: now },
    });
    const files = redactDeep((event.changedFiles ?? []).slice(0, CHAT_LIMITS.changedFiles)) as ChangedFile[];
    const message = event.message ? redactSecrets(event.message) : null;
    await this.tx.chatMessage.update({
      where: { id: messageId, workspaceId },
      data: {
        status: event.status,
        failure: event.failure ?? null,
        failureMessage: message,
        ...(event.durationMs === undefined ? {} : { durationMs: Math.round(event.durationMs) }),
        ...(event.model ? { model: event.model } : {}),
        ...(event.usage ? { usage: event.usage } : {}),
        changedFiles: files,
        endedAt: now,
      },
    });
    // A session that never became a conversation, or one the engine no longer has, is not offered again.
    const lost = event.failure === 'session_missing' || (event.status === 'failed' && !this.turn.hadSession);
    if (lost) {
      await this.tx.chat.update({ where: { id: chatId, workspaceId }, data: { sessionId: null } });
    }
    return { ...event, changedFiles: files, ...(message ? { message } : {}) };
  }
}
