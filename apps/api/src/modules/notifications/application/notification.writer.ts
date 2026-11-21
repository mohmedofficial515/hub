/**
 * @file Writes the routing table's answer as inbox rows, inside the mutation's transaction (docs/07 §2).
 * @description One item per member per event, the highest kind wins. The actor never hears about their own action,
 * and a removed or disabled member hears nothing. A new `watch_update` folds into an unread one from the last 30
 * minutes, so a busy card is one row with a count. Also used by the digests, which have no event.
 */
import type { NotificationKind, RealtimeEnvelope } from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { NotificationOutbox } from '@/infra/outbox/outbox';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { CardRepository } from '@/modules/cards';

import { KIND_RANK, type Notice } from '../domain/routing';
import { InboxService } from './inbox.service';

const FOLD_WINDOW_MS = 30 * 60 * 1000;

export interface NoticeTarget {
  readonly workspaceId: string;
  /** The one who caused it: never told. */
  readonly actorId: string | null;
  readonly card?: { readonly id: string; readonly key: string; readonly title: string };
  readonly params?: Readonly<Record<string, string | number>>;
}

interface Chosen {
  readonly notice: Notice;
  readonly locale: string;
}

const rankOf = (kind: NotificationKind): number => KIND_RANK.indexOf(kind);

@Injectable()
export class NotificationWriter {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly cards: CardRepository,
    private readonly outbox: NotificationOutbox,
    private readonly inbox: InboxService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Returns what to publish after commit. */
  async deliver(target: NoticeTarget, notices: readonly Notice[]): Promise<RealtimeEnvelope[]> {
    const chosen = await this.choose(target, notices);
    const envelopes: RealtimeEnvelope[] = [];
    for (const [userId, { notice, locale }] of chosen) {
      if (notice.kind === 'watch_update' && target.card) {
        if (await this.foldIntoUnread(target.workspaceId, userId, target.card.id)) continue;
      }
      const action = notice.action ? { action: notice.action } : {};
      const [row] = await this.outbox.writeEach({
        workspaceId: target.workspaceId,
        ...(target.card ? { cardId: target.card.id } : {}),
        kind: notice.kind,
        recipients: [{ userId, locale }],
        i18nKey: notice.i18nKey,
        params: {
          ...(target.card ? { cardKey: target.card.key, title: target.card.title } : {}),
          ...target.params,
          ...notice.params,
        },
        data: {
          ...(target.card ? { cardKey: target.card.key } : {}),
          ...action,
          ...(notice.link ? { link: notice.link } : {}),
        },
      });
      if (!row) continue;
      // Names what changed and carries no text: the page reads it through the API (docs/04 §4).
      envelopes.push({
        event: 'inbox.new',
        data: {
          id: row.id,
          kind: notice.kind,
          cardKey: target.card?.key ?? null,
          action: notice.action ?? null,
          unread: await this.inbox.unreadCount(target.workspaceId, userId),
        },
        audience: { userIds: [userId] },
      });
    }
    return envelopes;
  }

  private async choose(target: NoticeTarget, notices: readonly Notice[]): Promise<Map<string, Chosen>> {
    const chosen = new Map<string, Chosen>();
    const watchers =
      target.card && notices.some((notice) => notice.watchers)
        ? await this.cards.findWatcherIds(target.card.id)
        : [];
    for (const notice of notices) {
      const userIds = [...(notice.userIds ?? []), ...(notice.watchers ? watchers : [])];
      const recipients = await this.cards.findRecipients(target.workspaceId, notice.roles ?? [], userIds);
      for (const { userId, locale } of recipients) {
        if (userId === target.actorId) continue;
        const current = chosen.get(userId);
        if (!current || rankOf(notice.kind) < rankOf(current.notice.kind)) {
          chosen.set(userId, { notice, locale });
        }
      }
    }
    return chosen;
  }

  private async foldIntoUnread(workspaceId: string, userId: string, cardId: string): Promise<boolean> {
    const since = new Date(this.clock.now().getTime() - FOLD_WINDOW_MS);
    const folded = await this.txHost.tx.$executeRaw`
      UPDATE notifications
      SET data = jsonb_set(data, '{count}', to_jsonb(COALESCE((data->>'count')::int, 1) + 1))
      WHERE workspace_id = ${workspaceId}::uuid AND user_id = ${userId}::uuid AND card_id = ${cardId}::uuid
        AND kind = 'watch_update' AND read_at IS NULL AND archived_at IS NULL AND created_at >= ${since}`;
    return folded > 0;
  }
}
