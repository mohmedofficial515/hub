/**
 * @file Reads the audit log (docs/04 §3.21). Keyset on the row id, newest first. The CSV export is H5-04's.
 */
import type { Actor, AuditQueryInput, AuditRow } from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { decodeCursor, encodeCursor, type Paginated } from '@/shared/http';

const DEFAULT_LIMIT = 25;

@Injectable()
export class AuditQueryService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionalAdapter>) {}

  async list(actor: Actor, query: AuditQueryInput): Promise<Paginated<AuditRow>> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const before = query.cursor ? BigInt(decodeCursor(query.cursor).id) : null;
    const rows = await this.txHost.tx.auditLog.findMany({
      where: {
        workspaceId: actor.workspaceId,
        ...(query.actor ? { actorId: query.actor } : {}),
        ...(query.action ? { action: { startsWith: query.action } } : {}),
        ...(query.targetType ? { targetType: query.targetType } : {}),
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
        ...(before !== null ? { id: { lt: before } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
    });
    const shown = rows.slice(0, limit);
    const ids = [...new Set(shown.flatMap((row) => (row.actorId ? [row.actorId] : [])))];
    const users = await this.txHost.tx.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true },
    });
    const names = new Map(users.map((user) => [user.id, user.displayName]));
    const last = shown[shown.length - 1];
    return {
      items: shown.map((row) => ({
        id: row.id.toString(),
        actor: {
          kind: row.actorKind === 'agent' || row.actorKind === 'system' ? row.actorKind : 'user',
          userId: row.actorId,
          displayName: row.actorId ? (names.get(row.actorId) ?? null) : null,
          via: row.via,
        },
        via: row.via,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        summary: row.summary,
        ip: row.ip,
        userAgent: row.userAgent,
        createdAt: row.createdAt.toISOString(),
      })),
      pagination: {
        nextCursor: rows.length > limit && last ? encodeCursor('', last.id.toString()) : null,
        limit,
      },
    };
  }
}
