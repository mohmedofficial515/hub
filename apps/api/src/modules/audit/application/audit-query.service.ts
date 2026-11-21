/**
 * @file Reads the audit log (docs/04 §3.21, §3.23). Keyset on the row id, newest first, and the same filters as CSV.
 */
import type { Actor, AuditQueryInput, AuditRow } from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import type { Prisma } from '@/generated/prisma/client';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AppException } from '@/shared/errors';
import { decodeCursor, encodeCursor, type Paginated } from '@/shared/http';

const DEFAULT_LIMIT = 25;
const CSV_MAX_ROWS = 50_000;
const CSV_HEADER = 'id,createdAt,actorKind,actorId,actorName,via,action,targetType,targetId,summary,ip';

@Injectable()
export class AuditQueryService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionalAdapter>) {}

  private whereOf(actor: Actor, query: AuditQueryInput): Prisma.AuditLogWhereInput {
    return {
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
    };
  }

  /** UTF-8 with a BOM, so Excel reads Arabic. A formula-looking cell is neutralised (docs/04 §3.23). */
  async csv(actor: Actor, query: AuditQueryInput): Promise<string> {
    const where = this.whereOf(actor, query);
    if ((await this.txHost.tx.auditLog.count({ where })) > CSV_MAX_ROWS) {
      throw new AppException('hub.audit.export_too_large', { details: { max: CSV_MAX_ROWS } });
    }
    const rows = await this.txHost.tx.auditLog.findMany({ where, orderBy: { id: 'desc' } });
    const ids = [...new Set(rows.flatMap((row) => (row.actorId ? [row.actorId] : [])))];
    const users = await this.txHost.tx.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true },
    });
    const names = new Map(users.map((user) => [user.id, user.displayName]));
    const cell = (value: string | null): string => {
      const text = value ?? '';
      const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const lines = rows.map((row) =>
      [
        row.id.toString(),
        row.createdAt.toISOString(),
        row.actorKind,
        row.actorId,
        row.actorId ? (names.get(row.actorId) ?? null) : null,
        row.via,
        row.action,
        row.targetType,
        row.targetId,
        row.summary,
        row.ip,
      ]
        .map(cell)
        .join(','),
    );
    return `\uFEFF${[CSV_HEADER, ...lines].join('\r\n')}\r\n`;
  }

  async list(actor: Actor, query: AuditQueryInput): Promise<Paginated<AuditRow>> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const before = query.cursor ? BigInt(decodeCursor(query.cursor).id) : null;
    const rows = await this.txHost.tx.auditLog.findMany({
      where: { ...this.whereOf(actor, query), ...(before !== null ? { id: { lt: before } } : {}) },
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
