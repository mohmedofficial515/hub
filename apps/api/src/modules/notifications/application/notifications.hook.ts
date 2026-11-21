/**
 * @file Joins the notifications to `CardService.apply`, in the mutation's transaction.
 * @description For each event: route it, write the rows, and mark or restore the actor's own items on the card
 * (review M1). Acting marks read and records which act did it, so the inverse restores exactly those and never an
 * item the member read themselves.
 */
import type { RealtimeEnvelope } from '@hub/contracts';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { Prisma } from '@/generated/prisma/client';
import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { type CardEventContext, type CardEventHook, CardEventHooks } from '@/modules/cards';

import { actsTakenBack, isAct } from '../domain/acts';
import { type Notice, routeEvent } from '../domain/routing';
import { InboxService } from './inbox.service';
import { NotificationWriter } from './notification.writer';

@Injectable()
export class NotificationsHook implements CardEventHook, OnModuleInit {
  constructor(
    private readonly hooks: CardEventHooks,
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly writer: NotificationWriter,
    private readonly inbox: InboxService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    this.hooks.register(this);
  }

  async onEvent(context: CardEventContext): Promise<readonly RealtimeEnvelope[]> {
    const { actor, card, previous, event, intents } = context;
    const routed = routeEvent(
      { kind: event.kind, data: event.data },
      card,
      previous ? previous.ownerRole : card.ownerRole,
    );
    const asked = intents.map((intent): Notice => ({
      kind: intent.kind,
      i18nKey: intent.i18nKey,
      ...(intent.roles ? { roles: intent.roles } : {}),
      ...(intent.userIds ? { userIds: intent.userIds } : {}),
      ...(typeof intent.data?.['action'] === 'string' ? { action: intent.data['action'] } : {}),
      ...(intent.params ? { params: intent.params } : {}),
    }));
    const envelopes = await this.writer.deliver(
      {
        workspaceId: card.workspaceId,
        actorId: actor.userId,
        card: { id: card.id, key: card.key, title: card.title },
      },
      [...asked, ...routed],
    );
    const own = await this.applyOwnEffects(context);
    return own ? [...envelopes, own] : envelopes;
  }

  private async applyOwnEffects(context: CardEventContext): Promise<RealtimeEnvelope | null> {
    const { actor, action, card, event } = context;
    const userId = actor.userId;
    if (actor.kind === 'system' || !userId) return null;

    const takenBack = actsTakenBack(action);
    let ids: { id: string }[] = [];
    if (takenBack.length > 0) {
      ids = await this.txHost.tx.$queryRaw<{ id: string }[]>`
        UPDATE notifications SET read_at = NULL, data = data - 'readByAct'
        WHERE workspace_id = ${card.workspaceId}::uuid AND user_id = ${userId}::uuid AND card_id = ${card.id}::uuid
          AND data->'readByAct'->>'action' IN (${Prisma.join([...takenBack])})
        RETURNING id`;
    }
    if (ids.length === 0 && isAct(action)) {
      const marker = JSON.stringify({ readByAct: { action, eventId: event.id } });
      ids = await this.txHost.tx.$queryRaw<{ id: string }[]>`
        UPDATE notifications SET read_at = ${this.clock.now()}, data = data || ${marker}::jsonb
        WHERE workspace_id = ${card.workspaceId}::uuid AND user_id = ${userId}::uuid AND card_id = ${card.id}::uuid
          AND read_at IS NULL
        RETURNING id`;
    }
    if (ids.length === 0) return null;
    return {
      event: 'inbox.read',
      data: {
        ids: ids.map((row) => row.id),
        unread: await this.inbox.unreadCount(card.workspaceId, userId),
      },
      audience: { userIds: [userId] },
    };
  }
}
