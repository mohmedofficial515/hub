/**
 * @file The turns this process is recording, and which of them an MCP call belongs to (docs/16 §7.2).
 * @description The server must know a call came from a panel chat without taking Claude's word for it. Claude Code gives every MCP call its tool use id in `_meta`, and the stream gives the same id to the recorder, so a step with that id in a running turn of this member's chat is the proof. A chat outside the panel has no such step, and a model cannot put one there. The stream can arrive just after the call, so this waits a moment when a turn is running, and answers at once when none is.
 */
import type { MemberActor, TurnEvent } from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';

import type { TurnRecorder } from './turn-recorder';

const STEP_WAIT_MS = 3_000;
const STEP_POLL_MS = 50;

export interface PanelTurn {
  readonly chatId: string;
  readonly messageId: string;
  readonly deviceId: string;
}

@Injectable()
export class TurnRegistry {
  private readonly running = new Map<string, TurnRecorder>();

  constructor(private readonly txHost: TransactionHost<PrismaTransactionalAdapter>) {}

  set(chatId: string, recorder: TurnRecorder): void {
    this.running.set(chatId, recorder);
  }

  release(chatId: string, recorder: TurnRecorder): void {
    if (this.running.get(chatId) === recorder) this.running.delete(chatId);
  }

  size(): number {
    return this.running.size;
  }

  /** A server-made event on the turn, in order with what the bridge sends. A turn that ended takes nothing. */
  async post(chatId: string, event: TurnEvent): Promise<void> {
    await this.running.get(chatId)?.post(event);
  }

  /** The running panel turn this tool use belongs to, or null: outside the panel, or no id at all. */
  async panelTurn(actor: MemberActor, toolUseId: string | undefined): Promise<PanelTurn | null> {
    if (!toolUseId) return null;
    const deadline = Date.now() + STEP_WAIT_MS;
    for (;;) {
      const found = await this.find(actor, toolUseId);
      if (found) return found;
      if (this.running.size === 0 || Date.now() >= deadline) return null;
      await new Promise((done) => setTimeout(done, STEP_POLL_MS));
    }
  }

  private async find(actor: MemberActor, toolUseId: string): Promise<PanelTurn | null> {
    const step = await this.txHost.tx.chatStep.findFirst({
      where: {
        workspaceId: actor.workspaceId,
        toolUseId,
        chat: { userId: actor.userId },
        message: { status: 'running' },
      },
      select: { chatId: true, messageId: true, chat: { select: { deviceId: true } } },
    });
    return step ? { chatId: step.chatId, messageId: step.messageId, deviceId: step.chat.deviceId } : null;
  }
}
