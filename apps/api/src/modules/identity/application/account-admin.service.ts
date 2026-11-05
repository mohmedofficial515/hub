/**
 * @file What the `workspaces` module may do to an account: cut all access, restore it, hand out a reset link.
 * @description Disabling takes effect on the very next request, because the resolver reads the user's status
 * and the session on every call.
 */
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';

import { ApiTokenService } from './api-token.service';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

@Injectable()
export class AccountAdmin {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly sessions: SessionService,
    private readonly tokens: ApiTokenService,
    private readonly auth: AuthService,
  ) {}

  /** Joins the caller's transaction. */
  async disable(userId: string): Promise<void> {
    await this.txHost.tx.user.update({ where: { id: userId }, data: { status: 'disabled' } });
    await this.sessions.revokeAll(userId);
    await this.tokens.revokeAll(userId);
  }

  async enable(userId: string): Promise<void> {
    await this.txHost.tx.user.update({ where: { id: userId }, data: { status: 'active' } });
  }

  resetLink(userId: string, locale: string): Promise<string> {
    return this.auth.createAdminResetLink(userId, locale);
  }
}
