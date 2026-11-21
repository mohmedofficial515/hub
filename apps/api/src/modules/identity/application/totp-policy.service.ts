/**
 * @file TOTP enforcement (docs/04 §1.6): a member holding a role in `security.totp_required_roles` must have
 * enrolled before using any route of that project.
 * @description `ActorService` calls it, so REST and MCP are the same. The e2e harness replaces this
 * provider unless a test asks for real auth, so tests that are not about auth need no enrolment.
 */
import { parseSetting, type Role, settingDefault } from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AppException } from '@/shared/errors';

@Injectable()
export class TotpPolicy {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionalAdapter>) {}

  /** Throws `totp_setup_required` when the member must enrol first. */
  async assertSatisfied(userId: string, workspaceId: string, roles: readonly string[]): Promise<void> {
    const user = await this.txHost.tx.user.findUnique({
      where: { id: userId },
      select: { totpEnabledAt: true },
    });
    if (user?.totpEnabledAt) return;
    const required = await this.requiredRoles(workspaceId);
    if (roles.some((role) => required.includes(role as Role))) {
      throw new AppException('hub.identity.totp_setup_required');
    }
  }

  async requiredRoles(workspaceId: string): Promise<readonly Role[]> {
    const row = await this.txHost.tx.workspaceSetting.findUnique({
      where: { workspaceId_key: { workspaceId, key: 'security.totp_required_roles' } },
      select: { value: true },
    });
    return row
      ? parseSetting('security.totp_required_roles', row.value)
      : settingDefault('security.totp_required_roles');
  }

  /** Whether any active membership of the user requires TOTP. Disabling it is refused in that case. */
  async requiredForUser(userId: string): Promise<boolean> {
    const memberships = await this.txHost.tx.membership.findMany({
      where: { userId, status: 'active' },
      select: { workspaceId: true, roles: true },
    });
    for (const membership of memberships) {
      const required = await this.requiredRoles(membership.workspaceId);
      if (membership.roles.some((role) => required.includes(role as Role))) return true;
    }
    return false;
  }
}
