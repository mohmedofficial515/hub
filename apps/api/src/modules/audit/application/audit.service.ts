/**
 * @file Writes the audit log (docs/03 §11). Joins the active transaction.
 * @description `CardService` calls it for every card mutation. Any other mutation (settings, members,
 * sources, tokens, projects) calls `record` itself, inside its own transaction. Never pass a secret in
 * `summary`. The request's ip and user agent come from CLS, set in app.module.ts.
 */
import { type Actor, storedActorKind } from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';

export interface AuditEntry {
  /** Stable name, such as `cards.task.create` or `settings.update`. */
  readonly action: string;
  readonly targetType: string;
  readonly targetId?: string | null;
  /** One line, no secrets. */
  readonly summary: string;
}

/** Keys of the CLS store, filled by the middleware in app.module.ts. */
export const CLS_IP = 'hub.ip';
export const CLS_USER_AGENT = 'hub.userAgent';

@Injectable()
export class AuditService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly cls: ClsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async record(actor: Actor, entry: AuditEntry): Promise<void> {
    const active = this.cls.isActive();
    await this.txHost.tx.auditLog.create({
      data: {
        workspaceId: actor.workspaceId,
        actorKind: storedActorKind(actor),
        actorId: actor.userId,
        via: actor.via,
        tokenId: 'tokenId' in actor ? actor.tokenId : null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        summary: entry.summary,
        ip: active ? (this.cls.get<string | undefined>(CLS_IP) ?? null) : null,
        userAgent: active ? (this.cls.get<string | undefined>(CLS_USER_AGENT) ?? null) : null,
        createdAt: this.clock.now(),
      },
    });
  }
}
