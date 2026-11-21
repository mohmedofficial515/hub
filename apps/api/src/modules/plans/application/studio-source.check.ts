/**
 * @file The studio chat an idea or a plan says it came from (owner decision 9c, docs/03 §4.4).
 * @description A chat is its member's own (`chats.user_id`), and the studio reads `sourceChatId` to find the card its next
 * save overwrites. So a card may only name a chat of the member who writes it, in this workspace, not deleted, and a
 * `sourceMessageId` must be a message of that chat (or, alone, of one of the member's chats). Otherwise one member could tie
 * their card to another member's session and catch that member's next save. Used by the idea and plan actions, `to_plan`
 * included (it writes through `plan.create`).
 */
import type { Actor } from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AppException } from '@/shared/errors';

export interface StudioSourceInput {
  readonly sourceChatId?: string | null | undefined;
  readonly sourceMessageId?: string | null | undefined;
}

@Injectable()
export class StudioSourceCheck {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionalAdapter>) {}

  /** Throws `hub.chats.not_found` / `hub.chats.message_not_found` unless the source is the actor's own. Null clears pass. */
  async assertOwn(actor: Actor, input: StudioSourceInput): Promise<void> {
    const { sourceChatId, sourceMessageId } = input;
    if (!sourceChatId && !sourceMessageId) return;
    // An adapter or scheduler has no chats of its own.
    if (actor.userId === null) {
      throw new AppException(sourceChatId ? 'hub.chats.not_found' : 'hub.chats.message_not_found');
    }
    const own = { workspaceId: actor.workspaceId, userId: actor.userId, deletedAt: null };
    if (sourceChatId) {
      const chat = await this.txHost.tx.chat.findFirst({
        where: { id: sourceChatId, ...own },
        select: { id: true },
      });
      if (!chat) throw new AppException('hub.chats.not_found');
    }
    if (sourceMessageId) {
      const message = await this.txHost.tx.chatMessage.findFirst({
        where: {
          id: sourceMessageId,
          workspaceId: actor.workspaceId,
          ...(sourceChatId ? { chatId: sourceChatId } : {}),
          chat: own,
        },
        select: { id: true },
      });
      if (!message) throw new AppException('hub.chats.message_not_found');
    }
  }
}
