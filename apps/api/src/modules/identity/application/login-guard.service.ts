/**
 * @file Lockout (docs/03 §2): reads and writes `login_attempts`, applies the rule in `domain/lockout.ts`.
 * @description Attempts refused because of a lock are not recorded, so hammering a locked account cannot
 * keep it locked for ever.
 */
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AppException } from '@/shared/errors';

import { lockedUntil, LOCKOUT_LOOKBACK_MS } from '../domain/lockout';

@Injectable()
export class LoginGuard {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async assertNotLocked(email: string, ip: string): Promise<void> {
    const now = this.clock.now();
    const since = new Date(now.getTime() - LOCKOUT_LOOKBACK_MS);
    const rows = await this.txHost.tx.loginAttempt.findMany({
      where: { succeeded: false, createdAt: { gte: since }, OR: [{ email }, { ip }] },
      select: { email: true, ip: true, createdAt: true },
    });
    const byEmail = rows.filter((row) => row.email === email).map((row) => row.createdAt);
    const byIp = rows.filter((row) => row.ip === ip).map((row) => row.createdAt);
    const until = [lockedUntil(byEmail, now), lockedUntil(byIp, now)]
      .filter((date): date is Date => date !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    if (!until) return;
    const retryAfterSec = Math.ceil((until.getTime() - now.getTime()) / 1000);
    throw new AppException('hub.identity.locked', {
      details: { retryAfterSec },
      headers: { 'Retry-After': String(retryAfterSec) },
    });
  }

  async record(email: string, ip: string, succeeded: boolean): Promise<void> {
    await this.txHost.tx.loginAttempt.create({
      data: { email, ip, succeeded, createdAt: this.clock.now() },
    });
  }
}
