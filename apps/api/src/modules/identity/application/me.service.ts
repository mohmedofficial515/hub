/**
 * @file The `Me` shape, the member's profile and default project (docs/04 §3.2, §3.3, docs/15 §5).
 */
import { type Me, type Role, ROLES } from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AppException } from '@/shared/errors';

import { TotpPolicy } from './totp-policy.service';

function knownRoles(roles: readonly string[]): Role[] {
  return roles.filter((role): role is Role => (ROLES as readonly string[]).includes(role));
}

export interface ProfilePatch {
  readonly displayName?: string | undefined;
  readonly locale?: string | undefined;
  readonly avatarColor?: string | undefined;
}

@Injectable()
export class MeService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly totp: TotpPolicy,
  ) {}

  async get(userId: string): Promise<Me> {
    const user = await this.txHost.tx.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: 'active' },
          include: { workspace: true },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!user) throw new AppException('hub.common.unauthorized');
    const workspaces = await Promise.all(
      user.memberships.map(async ({ workspace, roles }) => {
        const required = await this.totp.requiredRoles(workspace.id);
        return {
          id: workspace.id,
          slug: workspace.slug,
          name: workspace.name,
          keyPrefix: workspace.keyPrefix,
          status: workspace.status,
          roles: knownRoles(roles),
          timezone: workspace.timezone,
          defaultLocale: workspace.defaultLocale,
          totpRequired: roles.some((role) => required.includes(role as Role)),
        };
      }),
    );
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      locale: user.locale,
      avatarColor: user.avatarColor,
      totpEnabled: user.totpEnabledAt !== null,
      createdAt: user.createdAt.toISOString(),
      defaultProject: workspaces.find((row) => row.id === user.defaultWorkspaceId)?.slug ?? null,
      workspaces,
    };
  }

  async updateProfile(userId: string, patch: ProfilePatch): Promise<Me> {
    await this.txHost.tx.user.update({
      where: { id: userId },
      data: {
        ...(patch.displayName === undefined ? {} : { displayName: patch.displayName }),
        ...(patch.locale === undefined ? {} : { locale: patch.locale }),
        ...(patch.avatarColor === undefined ? {} : { avatarColor: patch.avatarColor }),
      },
    });
    return this.get(userId);
  }

  /** `switch_project`. A project the member is not in answers not found (docs/15 §5). */
  async setDefaultProject(userId: string, slug: string): Promise<Me> {
    const membership = await this.txHost.tx.membership.findFirst({
      where: { userId, status: 'active', workspace: { slug } },
      select: { workspaceId: true },
    });
    if (!membership) throw new AppException('hub.workspaces.not_found');
    await this.txHost.tx.user.update({
      where: { id: userId },
      data: { defaultWorkspaceId: membership.workspaceId },
    });
    return this.get(userId);
  }
}
