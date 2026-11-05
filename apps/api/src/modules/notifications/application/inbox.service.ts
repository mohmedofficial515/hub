/**
 * @file The inbox (docs/04 §3.17): list, read, read-all, archive and the unread count.
 * @description An item on a deleted card hides with the card and comes back with it (D28), so every read joins the
 * card. Reading is per member, and nothing here can reach another member's row: each query carries `userId`.
 */
import type {
  CardSummary,
  InboxCount,
  InboxItem,
  InboxQueryInput,
  MemberActor,
  NotificationKind,
  ReadAllInput,
} from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { Prisma } from '@/generated/prisma/client';
import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { RealtimePublisher } from '@/infra/redis/redis.module';
import { CardQueryService, CardReader } from '@/modules/cards';
import { AppException } from '@/shared/errors';
import { decodeCursor, encodeCursor, type Paginated } from '@/shared/http';

const DEFAULT_LIMIT = 25;

interface Row {
  id: string;
  kind: string;
  card_id: string | null;
  group_key: string | null;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  created_at: Date;
  read_at: Date | null;
  archived_at: Date | null;
}

const NOT_ON_DELETED_CARD = Prisma.sql`NOT EXISTS (
  SELECT 1 FROM cards c WHERE c.id = n.card_id AND c.archived_at IS NOT NULL
)`;

@Injectable()
export class InboxService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly query: CardQueryService,
    private readonly reader: CardReader,
    private readonly realtime: RealtimePublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async unreadCount(workspaceId: string, userId: string): Promise<number> {
    const [row] = await this.txHost.tx.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count FROM notifications n
      WHERE n.workspace_id = ${workspaceId}::uuid AND n.user_id = ${userId}::uuid
        AND n.read_at IS NULL AND n.archived_at IS NULL AND ${NOT_ON_DELETED_CARD}`;
    return Number(row?.count ?? 0);
  }

  async list(actor: MemberActor, query: InboxQueryInput): Promise<Paginated<InboxItem>> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await this.txHost.tx.$queryRaw<Row[]>`
      SELECT n.id, n.kind, n.card_id, n.group_key, n.title, n.body, n.data, n.created_at, n.read_at, n.archived_at
      FROM notifications n
      WHERE n.workspace_id = ${actor.workspaceId}::uuid AND n.user_id = ${actor.userId}::uuid
        AND ${NOT_ON_DELETED_CARD}
        AND ${query.archived ? Prisma.sql`n.archived_at IS NOT NULL` : Prisma.sql`n.archived_at IS NULL`}
        AND ${query.unread ? Prisma.sql`n.read_at IS NULL` : Prisma.sql`TRUE`}
        AND ${query.kinds?.length ? Prisma.sql`n.kind IN (${Prisma.join(query.kinds)})` : Prisma.sql`TRUE`}
        AND ${
          cursor
            ? Prisma.sql`(n.created_at, n.id) < (${new Date(cursor.sortKey)}, ${cursor.id}::uuid)`
            : Prisma.sql`TRUE`
        }
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT ${limit + 1}`;
    const shown = rows.slice(0, limit);
    const cards = await this.reader.findByIds(
      actor.workspaceId,
      shown.flatMap((row) => (row.card_id ? [row.card_id] : [])),
    );
    const summaries = await this.query.summaries(actor, cards);
    const byId = new Map<string, CardSummary>(summaries.map((card) => [card.id, card]));
    const last = shown[shown.length - 1];
    return {
      items: shown.map((row) => this.toItem(row, byId)),
      pagination: {
        nextCursor: rows.length > limit && last ? encodeCursor(last.created_at.toISOString(), last.id) : null,
        limit,
        total: await this.unreadCount(actor.workspaceId, actor.userId),
      },
    };
  }

  private toItem(row: Row, cards: ReadonlyMap<string, CardSummary>): InboxItem {
    const { cardKey, action, count } = row.data as { cardKey?: string; action?: string; count?: number };
    return {
      id: row.id,
      kind: row.kind as NotificationKind,
      title: row.title,
      body: row.body,
      card: row.card_id ? (cards.get(row.card_id) ?? null) : null,
      data: {
        ...(cardKey ? { cardKey } : {}),
        ...(action ? { action } : {}),
        ...(count ? { count } : {}),
      },
      groupKey: row.group_key,
      createdAt: row.created_at.toISOString(),
      readAt: row.read_at?.toISOString() ?? null,
      archivedAt: row.archived_at?.toISOString() ?? null,
    };
  }

  async count(actor: MemberActor): Promise<InboxCount> {
    const awaiting = await this.query.list(actor, { awaiting: 'me', limit: 100 });
    const ofType = (...types: readonly string[]) =>
      awaiting.items.filter((card) => types.includes(card.type)).length;
    return {
      unread: await this.unreadCount(actor.workspaceId, actor.userId),
      awaitingMe: {
        decisions: ofType('decision'),
        needs: ofType('need'),
        handoffs: ofType('handoff'),
        reviews: ofType('redesign', 'task', 'plan'),
      },
    };
  }

  private async set(
    actor: MemberActor,
    id: string,
    data: { readAt?: Date | null; archivedAt?: Date | null },
  ): Promise<void> {
    const { count } = await this.txHost.tx.notification.updateMany({
      where: { id, workspaceId: actor.workspaceId, userId: actor.userId },
      data,
    });
    if (count === 0) throw new AppException('hub.common.not_found');
    await this.tellOtherTabs(actor, [id]);
  }

  read(actor: MemberActor, id: string): Promise<void> {
    return this.set(actor, id, { readAt: this.clock.now() });
  }

  unread(actor: MemberActor, id: string): Promise<void> {
    return this.set(actor, id, { readAt: null });
  }

  archive(actor: MemberActor, id: string): Promise<void> {
    return this.set(actor, id, { archivedAt: this.clock.now() });
  }

  unarchive(actor: MemberActor, id: string): Promise<void> {
    return this.set(actor, id, { archivedAt: null });
  }

  async readAll(actor: MemberActor, input: ReadAllInput): Promise<void> {
    await this.txHost.tx.notification.updateMany({
      where: {
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        readAt: null,
        ...(input.before ? { createdAt: { lte: new Date(input.before) } } : {}),
      },
      data: { readAt: this.clock.now() },
    });
    await this.tellOtherTabs(actor, []);
  }

  private async tellOtherTabs(actor: MemberActor, ids: readonly string[]): Promise<void> {
    await this.realtime.publishEnvelope(actor.workspaceId, {
      event: 'inbox.read',
      data: { ids, unread: await this.unreadCount(actor.workspaceId, actor.userId) },
      audience: { userIds: [actor.userId] },
    });
  }
}
