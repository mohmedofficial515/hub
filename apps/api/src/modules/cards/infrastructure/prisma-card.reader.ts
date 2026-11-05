/**
 * @file Prisma implementation of the read side. Keyset paging throughout (docs/04 §1.3).
 */
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type Prisma } from '@/generated/prisma/client';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { decodeCursor } from '@/shared/http';

import {
  type AttachmentRow,
  type CardFilter,
  type CardPage,
  CardReader,
  type CommentView,
  type EventRow,
  type LinkRow,
  type TimelineFilter,
  type UserCard,
  type WatcherRow,
} from '../application/ports/card.reader';
import type { CardView, JsonObject } from '../domain/card-action';
import { INCLUDE_DETAILS, toView } from './prisma-card.repository';

const SEARCH_LIMIT = 2000;

function cursorWhere(sort: CardPage['sort'], cursor: string | undefined): Prisma.CardWhereInput {
  if (!cursor) return {};
  const { sortKey, id } = decodeCursor(cursor);
  switch (sort) {
    case 'priority':
      return { OR: [{ priority: { gt: sortKey } }, { priority: sortKey, id: { gt: id } }] };
    case 'due':
      return sortKey === ''
        ? { dueAt: null, id: { gt: id } }
        : {
            OR: [
              { dueAt: { gt: new Date(sortKey) } },
              { dueAt: new Date(sortKey), id: { gt: id } },
              { dueAt: null },
            ],
          };
    case 'created':
      return {
        OR: [{ createdAt: { lt: new Date(sortKey) } }, { createdAt: new Date(sortKey), id: { lt: id } }],
      };
    case 'createdAsc':
      return {
        OR: [{ createdAt: { gt: new Date(sortKey) } }, { createdAt: new Date(sortKey), id: { gt: id } }],
      };
    case 'lastEvent':
      return {
        OR: [{ lastEventAt: { lt: new Date(sortKey) } }, { lastEventAt: new Date(sortKey), id: { lt: id } }],
      };
  }
}

function orderBy(sort: CardPage['sort']): Prisma.CardOrderByWithRelationInput[] {
  switch (sort) {
    case 'priority':
      return [{ priority: 'asc' }, { id: 'asc' }];
    case 'due':
      return [{ dueAt: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }];
    case 'created':
      return [{ createdAt: 'desc' }, { id: 'desc' }];
    case 'createdAsc':
      return [{ createdAt: 'asc' }, { id: 'asc' }];
    case 'lastEvent':
      return [{ lastEventAt: 'desc' }, { id: 'desc' }];
  }
}

function flagWhere(filter: CardFilter): Prisma.CardWhereInput[] {
  const open: Prisma.CardWhereInput = { closedAt: null };
  return (filter.flags ?? []).map((flag): Prisma.CardWhereInput => {
    switch (flag) {
      case 'blocked':
        return {
          ...open,
          linksTo: { some: { kind: 'blocks', from: { closedAt: null, archivedAt: null } } },
        };
      case 'overdue':
        return { ...open, dueAt: { lt: filter.now } };
      case 'escalated':
        return { ...open, decision: { escalatedAt: { not: null } } };
      case 'stale':
        return {
          OR: [
            { type: 'handoff', status: 'pending', createdAt: { lt: filter.staleHandoffBefore } },
            { type: 'need', status: 'requested', createdAt: { lt: filter.staleNeedBefore } },
          ],
        };
      case 'noSummary':
        return { change: { session: { path: ['noSummary'], equals: true } } };
    }
  });
}

function toEventRow(row: {
  id: string;
  cardId: string;
  seq: number;
  kind: string;
  actorKind: string;
  actorId: string | null;
  via: string;
  data: unknown;
  createdAt: Date;
}): EventRow {
  return { ...row, data: row.data as JsonObject };
}

@Injectable()
export class PrismaCardReader extends CardReader {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionalAdapter>) {
    super();
  }

  private get tx() {
    return this.txHost.tx;
  }

  /** Full-text over key, title, body and tags, with a trigram fallback on the title (docs/03 §12). */
  private async searchIds(workspaceId: string, q: string): Promise<string[]> {
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const rows = await this.tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM cards
      WHERE workspace_id = ${workspaceId}::uuid
        AND (search_vector @@ websearch_to_tsquery('hub_simple', ${q}) OR title ILIKE ${pattern})
      ORDER BY last_event_at DESC
      LIMIT ${SEARCH_LIMIT}`;
    return rows.map((row) => row.id);
  }

  private async toWhere(workspaceId: string, filter: CardFilter): Promise<Prisma.CardWhereInput> {
    const and: Prisma.CardWhereInput[] = [...flagWhere(filter)];
    if (filter.where) and.push(filter.where);
    if (filter.q) and.push({ id: { in: await this.searchIds(workspaceId, filter.q) } });
    return {
      workspaceId,
      archivedAt: filter.deleted ? { not: null } : null,
      ...(filter.types ? { type: { in: [...filter.types] } } : {}),
      ...(filter.statuses ? { status: { in: [...filter.statuses] } } : {}),
      ...(filter.roles ? { ownerRole: { in: [...filter.roles] } } : {}),
      ...(filter.assigneeId ? { assigneeId: filter.assigneeId } : {}),
      ...(filter.createdById ? { createdById: filter.createdById } : {}),
      ...(filter.repos ? { repo: { in: [...filter.repos] } } : {}),
      ...(filter.modules ? { module: { in: [...filter.modules] } } : {}),
      ...(filter.tags ? { tags: { hasSome: [...filter.tags] } } : {}),
      ...(filter.dueBefore ? { dueAt: { lte: filter.dueBefore } } : {}),
      ...(and.length > 0 ? { AND: and } : {}),
    };
  }

  async findCards(workspaceId: string, filter: CardFilter, page: CardPage): Promise<CardView[]> {
    const where = await this.toWhere(workspaceId, filter);
    const rows = await this.tx.card.findMany({
      where: {
        ...where,
        AND: [...((where.AND as Prisma.CardWhereInput[]) ?? []), cursorWhere(page.sort, page.cursor)],
      },
      include: INCLUDE_DETAILS,
      orderBy: orderBy(page.sort),
      take: page.limit + 1,
    });
    return rows.map((row) => toView(row));
  }

  async findCandidates(
    workspaceId: string,
    filter: CardFilter,
    extra: Prisma.CardWhereInput,
    max: number,
  ): Promise<CardView[]> {
    const where = await this.toWhere(workspaceId, filter);
    const rows = await this.tx.card.findMany({
      where: { ...where, AND: [...((where.AND as Prisma.CardWhereInput[]) ?? []), extra] },
      include: INCLUDE_DETAILS,
      orderBy: { lastEventAt: 'desc' },
      take: max,
    });
    return rows.map((row) => toView(row));
  }

  async findByIds(workspaceId: string, ids: readonly string[]): Promise<CardView[]> {
    if (ids.length === 0) return [];
    const rows = await this.tx.card.findMany({
      where: { workspaceId, id: { in: [...new Set(ids)] } },
      include: INCLUDE_DETAILS,
    });
    return rows.map((row) => toView(row));
  }

  async findUsers(ids: readonly string[]): Promise<Map<string, UserCard>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await this.tx.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, displayName: true, avatarColor: true },
    });
    return new Map(rows.map((row) => [row.id, row]));
  }

  async findBlocked(workspaceId: string, ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.tx.cardLink.findMany({
      where: {
        workspaceId,
        kind: 'blocks',
        toCardId: { in: [...ids] },
        from: { closedAt: null, archivedAt: null },
      },
      select: { toCardId: true },
    });
    return new Set(rows.map((row) => row.toCardId));
  }

  async findLinks(workspaceId: string, cardId: string): Promise<LinkRow[]> {
    const rows = await this.tx.cardLink.findMany({
      where: {
        workspaceId,
        OR: [
          { fromCardId: cardId, to: { archivedAt: null } },
          { toCardId: cardId, from: { archivedAt: null } },
        ],
      },
      include: {
        from: { include: INCLUDE_DETAILS },
        to: { include: INCLUDE_DETAILS },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row): LinkRow => {
      const outgoing = row.fromCardId === cardId;
      const kind = row.kind as 'blocks' | 'relates' | 'parent' | 'duplicates';
      let shown: LinkRow['kind'] = kind;
      if (!outgoing && kind === 'blocks') shown = 'blocked_by';
      if (!outgoing && kind === 'parent') shown = 'child';
      return { kind: shown, card: toView(outgoing ? row.to : row.from) };
    });
  }

  async findBlockedBy(workspaceId: string, blockerIds: readonly string[]): Promise<Map<string, CardView[]>> {
    const result = new Map<string, CardView[]>();
    if (blockerIds.length === 0) return result;
    const rows = await this.tx.cardLink.findMany({
      where: {
        workspaceId,
        kind: 'blocks',
        fromCardId: { in: [...blockerIds] },
        to: { archivedAt: null, closedAt: null },
      },
      include: { to: { include: INCLUDE_DETAILS } },
    });
    for (const row of rows) {
      result.set(row.fromCardId, [...(result.get(row.fromCardId) ?? []), toView(row.to)]);
    }
    return result;
  }

  async findWatchers(cardId: string): Promise<WatcherRow[]> {
    return this.tx.cardWatcher.findMany({
      where: { cardId },
      select: { userId: true, reason: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findAttachments(cardId: string): Promise<AttachmentRow[]> {
    return this.tx.cardAttachment.findMany({
      where: { cardId },
      select: { id: true, kind: true, name: true, url: true, width: true, height: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findEvents(
    workspaceId: string,
    cardId: string,
    cursor: { seq: number } | null,
    limit: number,
  ): Promise<EventRow[]> {
    const rows = await this.tx.cardEvent.findMany({
      where: { workspaceId, cardId, ...(cursor ? { seq: { gt: cursor.seq } } : {}) },
      orderBy: { seq: 'asc' },
      take: limit + 1,
    });
    return rows.map((row) => toEventRow(row));
  }

  async findComments(
    workspaceId: string,
    cardId: string,
    cursor: { createdAt: Date; id: string } | null,
    limit: number,
  ): Promise<CommentView[]> {
    return this.tx.cardComment.findMany({
      where: {
        workspaceId,
        cardId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { gt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { gt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });
  }

  async findComment(workspaceId: string, commentId: string): Promise<CommentView | null> {
    return this.tx.cardComment.findFirst({ where: { workspaceId, id: commentId } });
  }

  async findTimeline(
    workspaceId: string,
    filter: TimelineFilter,
    cursor: { createdAt: Date; id: string } | null,
    limit: number,
  ): Promise<EventRow[]> {
    const card: Prisma.CardWhereInput = {
      archivedAt: null,
      ...(filter.types ? { type: { in: [...filter.types] } } : {}),
      ...(filter.repos ? { repo: { in: [...filter.repos] } } : {}),
      ...(filter.modules ? { module: { in: [...filter.modules] } } : {}),
    };
    const and: Prisma.CardEventWhereInput[] = [];
    if (filter.q) and.push({ cardId: { in: await this.searchIds(workspaceId, filter.q) } });
    if (filter.mineUserId) {
      const me = filter.mineUserId;
      and.push({
        card: {
          OR: [{ watchers: { some: { userId: me } } }, { assigneeId: me }, { createdById: me }],
        },
      });
    }
    if (filter.roles) {
      const holders = await this.tx.membership.findMany({
        where: { workspaceId, roles: { hasSome: [...filter.roles] } },
        select: { userId: true },
      });
      and.push({
        OR: [
          { card: { ownerRole: { in: [...filter.roles] } } },
          { actorId: { in: holders.map((holder) => holder.userId) } },
        ],
      });
    }
    if (cursor) {
      and.push({
        OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }],
      });
    }
    const rows = await this.tx.cardEvent.findMany({
      where: {
        workspaceId,
        kind: filter.kinds ? { in: [...filter.kinds] } : { notIn: ['watch', 'unwatch'] },
        ...(filter.actors ? { actorId: { in: [...filter.actors] } } : {}),
        ...(filter.from || filter.to
          ? {
              createdAt: {
                ...(filter.from ? { gte: filter.from } : {}),
                ...(filter.to ? { lte: filter.to } : {}),
              },
            }
          : {}),
        card,
        ...(and.length > 0 ? { AND: and } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.map((row) => toEventRow(row));
  }

  async countTimelineByDay(
    workspaceId: string,
    timezone: string,
    from: Date,
    to: Date,
  ): Promise<{ date: string; count: number }[]> {
    const rows = await this.tx.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT to_char(e.created_at AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS date, count(*) AS count
      FROM card_events e JOIN cards c ON c.id = e.card_id
      WHERE e.workspace_id = ${workspaceId}::uuid
        AND e.created_at >= ${from} AND e.created_at <= ${to}
        AND e.kind NOT IN ('watch', 'unwatch') AND c.archived_at IS NULL
      GROUP BY 1 ORDER BY 1`;
    return rows.map((row) => ({ date: row.date, count: Number(row.count) }));
  }

  async findWorkspaceTimezone(workspaceId: string): Promise<string> {
    const row = await this.tx.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { timezone: true },
    });
    return row.timezone;
  }

  async findPlanRevisions(workspaceId: string, cardId: string): Promise<EventRow[]> {
    const rows = await this.tx.cardEvent.findMany({
      where: { workspaceId, cardId, kind: 'plan_revised' },
      orderBy: { seq: 'desc' },
    });
    return rows.map((row) => toEventRow(row));
  }

  async readSettings(workspaceId: string, keys: readonly string[]): Promise<Map<string, unknown>> {
    const rows = await this.tx.workspaceSetting.findMany({
      where: { workspaceId, key: { in: [...keys] } },
      select: { key: true, value: true },
    });
    return new Map(rows.map((row) => [row.key, row.value]));
  }
}
