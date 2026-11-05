/**
 * @file "Since last visit": when a member last looked, per project (docs/04 §3.23, review M4).
 * @description Lives in Redis as the plan says. A member with no mark starts from 24 hours ago, or from when they
 * joined if that is later, so a first visit is not a wall of imported history.
 */
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { RedisClients } from '@/infra/redis/redis.module';

const DAY = 86_400_000;
const keyOf = (workspaceId: string, userId: string): string => `seen:${workspaceId}:${userId}`;

@Injectable()
export class SeenStore {
  constructor(
    private readonly redis: RedisClients,
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async since(workspaceId: string, userId: string): Promise<Date> {
    const stored = await this.redis.main.get(keyOf(workspaceId, userId));
    if (stored) return new Date(stored);
    const member = await this.txHost.tx.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { joinedAt: true },
    });
    const dayAgo = this.clock.now().getTime() - DAY;
    return new Date(Math.max(dayAgo, member?.joinedAt.getTime() ?? dayAgo));
  }

  async mark(workspaceId: string, userId: string): Promise<void> {
    await this.redis.main.set(keyOf(workspaceId, userId), this.clock.now().toISOString());
  }
}
