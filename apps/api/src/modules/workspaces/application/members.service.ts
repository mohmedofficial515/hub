/**
 * @file Memberships, roles and GitHub identities (docs/04 §3.5, §3.23).
 * @description A project always keeps one active owner. Each change that could remove the last one locks the
 * project row first, so two concurrent changes cannot both pass the check. Roles are read live on every call,
 * so a change here reaches the member's API tokens on their next call with nothing else to update.
 */
import type { MemberActor, MemberRow } from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit';
import { AccountAdmin, assertKnownRoles, InviteService } from '@/modules/identity';
import { AppException } from '@/shared/errors';
import { decodeCursor, encodeCursor, type Paginated } from '@/shared/http';

import { MemberRemovalHooks } from './member-removal.hooks';
import { ProjectGate } from './project-gate';

@Injectable()
export class MembersService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly audit: AuditService,
    private readonly gate: ProjectGate,
    private readonly accounts: AccountAdmin,
    private readonly invites: InviteService,
    private readonly removal: MemberRemovalHooks,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Oldest member first. */
  async list(
    actor: MemberActor,
    query: { cursor?: string | undefined; limit: number },
  ): Promise<Paginated<MemberRow>> {
    const where = { workspaceId: actor.workspaceId };
    const after = query.cursor ? decodeCursor(query.cursor) : null;
    const rows = await this.txHost.tx.membership.findMany({
      where,
      include: { user: true },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      ...(after ? { cursor: { id: after.id }, skip: 1 } : {}),
    });
    const page = rows.slice(0, query.limit);
    const identities = await this.txHost.tx.githubIdentity.findMany({
      where: { workspaceId: actor.workspaceId, userId: { in: page.map((row) => row.userId) } },
    });
    const last = page[page.length - 1];
    return {
      items: page.map((row) => ({
        userId: row.userId,
        email: row.user.email,
        displayName: row.user.displayName,
        avatarColor: row.user.avatarColor,
        roles: row.roles,
        status: row.status,
        joinedAt: row.joinedAt.toISOString(),
        lastSeenAt: row.user.lastSeenAt?.toISOString() ?? null,
        githubLogins: identities
          .filter((identity) => identity.userId === row.userId)
          .map((identity) => identity.login),
        totpEnabled: row.user.totpEnabledAt !== null,
      })),
      pagination: {
        nextCursor:
          rows.length > query.limit && last ? encodeCursor(last.joinedAt.toISOString(), last.id) : null,
        limit: query.limit,
        total: await this.txHost.tx.membership.count({ where }),
      },
    };
  }

  async changeRoles(actor: MemberActor, userId: string, roles: readonly string[]): Promise<MemberRow> {
    assertKnownRoles(roles);
    await this.gate.assertOpen(actor.workspaceId);
    await this.txHost.withTransaction(async () => {
      const membership = await this.lockedMembership(actor, userId);
      if (membership.status !== 'active') throw new AppException('hub.workspaces.member_removed');
      const losesOwner = membership.roles.includes('owner') && !roles.includes('owner');
      const gainsOwner = !membership.roles.includes('owner') && roles.includes('owner');
      if (losesOwner || gainsOwner) this.invites.assertMayGrant(actor, ['owner']);
      if (losesOwner) await this.assertNotLastOwner(actor.workspaceId, userId);
      await this.txHost.tx.membership.update({
        where: { workspaceId_userId: { workspaceId: actor.workspaceId, userId } },
        data: { roles: [...new Set(roles)] },
      });
      await this.audit.record(actor, {
        action: 'members.change_roles',
        targetType: 'user',
        targetId: userId,
        summary: `Roles are now ${roles.join(', ')}`,
      });
    });
    return this.row(actor, userId);
  }

  async remove(actor: MemberActor, userId: string): Promise<void> {
    await this.gate.assertOpen(actor.workspaceId);
    await this.txHost.withTransaction(() => this.deactivate(actor, userId, 'members.remove'));
    await this.removal.run(actor.workspaceId, userId);
  }

  /**
   * Disables the account when this was the member's only project; otherwise only removes them here, because
   * one project's owner must not lock someone out of another project (docs/04 §3.23).
   */
  async disable(actor: MemberActor, userId: string): Promise<void> {
    await this.gate.assertOpen(actor.workspaceId);
    await this.txHost.withTransaction(async () => {
      await this.deactivate(actor, userId, 'members.disable');
      const others = await this.txHost.tx.membership.count({
        where: { userId, status: 'active', workspaceId: { not: actor.workspaceId } },
      });
      if (others === 0) await this.accounts.disable(userId);
    });
    await this.removal.run(actor.workspaceId, userId);
  }

  async enable(actor: MemberActor, userId: string): Promise<void> {
    await this.gate.assertOpen(actor.workspaceId);
    await this.txHost.withTransaction(async () => {
      await this.lockedMembership(actor, userId);
      await this.txHost.tx.membership.update({
        where: { workspaceId_userId: { workspaceId: actor.workspaceId, userId } },
        data: { status: 'active', removedAt: null },
      });
      await this.accounts.enable(userId);
      await this.audit.record(actor, {
        action: 'members.enable',
        targetType: 'user',
        targetId: userId,
        summary: 'Enabled the member',
      });
    });
  }

  /** A reset link the member gets from their owner or pm. Shown once and never logged (docs/04 §3.23). */
  async passwordResetLink(actor: MemberActor, userId: string): Promise<{ url: string }> {
    const membership = await this.txHost.tx.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: actor.workspaceId, userId } },
      include: { user: { select: { locale: true } } },
    });
    if (!membership) throw new AppException('hub.common.not_found');
    // An owner's password stays with owners, or a pm could take over the account above them.
    if (membership.roles.includes('owner')) this.invites.assertMayGrant(actor, ['owner']);
    const url = await this.accounts.resetLink(userId, membership.user.locale);
    await this.audit.record(actor, {
      action: 'members.password_reset_link',
      targetType: 'user',
      targetId: userId,
      summary: 'Created a password reset link',
    });
    return { url };
  }

  async setGithubLogins(
    actor: MemberActor,
    userId: string,
    logins: readonly string[],
  ): Promise<{ logins: string[] }> {
    await this.gate.assertOpen(actor.workspaceId);
    const lowered = [...new Set(logins.map((login) => login.toLowerCase()))];
    await this.txHost.withTransaction(async () => {
      const membership = await this.txHost.tx.membership.findUnique({
        where: { workspaceId_userId: { workspaceId: actor.workspaceId, userId } },
        select: { id: true },
      });
      if (!membership) throw new AppException('hub.common.not_found');
      await this.txHost.tx.githubIdentity.deleteMany({ where: { workspaceId: actor.workspaceId, userId } });
      await this.txHost.tx.githubIdentity.createMany({
        data: lowered.map((login) => ({ workspaceId: actor.workspaceId, userId, login })),
      });
      await this.audit.record(actor, {
        action: 'members.github_identity',
        targetType: 'user',
        targetId: userId,
        summary: `GitHub logins are now ${lowered.join(', ') || 'none'}`,
      });
    });
    return { logins: lowered };
  }

  private async deactivate(actor: MemberActor, userId: string, action: string): Promise<void> {
    const membership = await this.lockedMembership(actor, userId);
    if (membership.status !== 'active') throw new AppException('hub.workspaces.member_removed');
    if (membership.roles.includes('owner')) {
      this.invites.assertMayGrant(actor, ['owner']);
      await this.assertNotLastOwner(actor.workspaceId, userId);
    }
    await this.txHost.tx.membership.update({
      where: { workspaceId_userId: { workspaceId: actor.workspaceId, userId } },
      data: { status: 'removed', removedAt: this.clock.now() },
    });
    await this.txHost.tx.user.updateMany({
      where: { id: userId, defaultWorkspaceId: actor.workspaceId },
      data: { defaultWorkspaceId: null },
    });
    await this.audit.record(actor, {
      action,
      targetType: 'user',
      targetId: userId,
      summary: 'Removed the member from the project',
    });
  }

  /** Locks the project row, which serialises every change to who owns it. */
  private async lockedMembership(actor: MemberActor, userId: string) {
    await this.txHost.tx
      .$queryRaw`SELECT id FROM workspaces WHERE id = ${actor.workspaceId}::uuid FOR UPDATE`;
    const membership = await this.txHost.tx.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: actor.workspaceId, userId } },
    });
    if (!membership) throw new AppException('hub.common.not_found');
    return membership;
  }

  private async assertNotLastOwner(workspaceId: string, leavingUserId: string): Promise<void> {
    const others = await this.txHost.tx.membership.count({
      where: {
        workspaceId,
        status: 'active',
        roles: { has: 'owner' },
        userId: { not: leavingUserId },
      },
    });
    if (others === 0) throw new AppException('hub.workspaces.last_owner');
  }

  private async row(actor: MemberActor, userId: string): Promise<MemberRow> {
    const membership = await this.txHost.tx.membership.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId: actor.workspaceId, userId } },
      include: { user: true },
    });
    const identities = await this.txHost.tx.githubIdentity.findMany({
      where: { workspaceId: actor.workspaceId, userId },
    });
    return {
      userId,
      email: membership.user.email,
      displayName: membership.user.displayName,
      avatarColor: membership.user.avatarColor,
      roles: membership.roles,
      status: membership.status,
      joinedAt: membership.joinedAt.toISOString(),
      lastSeenAt: membership.user.lastSeenAt?.toISOString() ?? null,
      githubLogins: identities.map((identity) => identity.login),
      totpEnabled: membership.user.totpEnabledAt !== null,
    };
  }
}
