/**
 * @file Invites (docs/04 §3.2, §3.5): an owner or pm invites by email with the roles set in advance.
 * @description The link holds a 32 byte token, stored hashed and shown once. Accepting creates the user when
 * needed, joins the project and tells its owners and pms. Only an owner may hand out the owner role. A revoked
 * invite keeps its row, so every list shows the same status (docs/16 D68). The email says how to reach Hub
 * when it is published on a tailnet (D69).
 */
import { randomInt } from 'node:crypto';

import {
  AVATAR_COLORS,
  type MailMode,
  type Me,
  type MemberActor,
  type Principal,
  type Role,
  ROLES,
} from '@hub/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { CLOCK, type Clock } from '@/infra/clock/clock';
import { NotificationOutbox } from '@/infra/outbox/outbox';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { runUnscoped } from '@/infra/prisma/workspace-scope';
import { PublishesProjectChange, RealtimePublisher } from '@/infra/redis/redis.module';
import { AuditService } from '@/modules/audit';
import { AppException } from '@/shared/errors';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import { newOpaqueToken, sha256 } from '../domain/credentials';
import { inviteMail, tailnetOf } from '../domain/invite-mail';
import { inviteStatusOf } from '../domain/invite-status';
import { mailModeOf } from '../domain/mail-config';
import { isWeakPassword } from '../domain/password-policy';
import { MeService } from './me.service';
import { PasswordHasher } from './password-hasher';
import { Mailer } from './ports/mailer';
import { type IssuedSession, SessionService } from './session.service';

const INVITE_TTL_MS = 7 * 86_400_000;

export function assertKnownRoles(roles: readonly string[]): asserts roles is readonly Role[] {
  if (roles.some((role) => !(ROLES as readonly string[]).includes(role))) {
    throw new AppException('hub.workspaces.role_invalid');
  }
}

export interface AcceptInviteInput {
  readonly displayName?: string | undefined;
  readonly password?: string | undefined;
  readonly locale?: 'ar' | 'en' | undefined;
}

export interface InviteAccepted {
  readonly user: Me;
  readonly workspace: { readonly slug: string };
  /** Set when a new account signed in by accepting. */
  readonly session: IssuedSession | null;
}

@Injectable()
export class InviteService {
  private readonly logger = new Logger(InviteService.name);

  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionService,
    private readonly me: MeService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimePublisher,
    private readonly mailer: Mailer,
    private readonly outbox: NotificationOutbox,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(actor: MemberActor) {
    const rows = await this.txHost.tx.invite.findMany({
      where: { workspaceId: actor.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    const creators = await this.txHost.tx.user.findMany({
      where: { id: { in: [...new Set(rows.map((row) => row.createdById))] } },
      select: { id: true, displayName: true },
    });
    const names = new Map(creators.map((creator) => [creator.id, creator.displayName]));
    const now = this.clock.now();
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      roles: row.roles,
      createdBy: names.get(row.createdById) ?? '',
      expiresAt: row.expiresAt.toISOString(),
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      status: inviteStatusOf(row, now),
    }));
  }

  @PublishesProjectChange('invites')
  async create(actor: MemberActor, rawEmail: string, roles: readonly string[]) {
    assertKnownRoles(roles);
    this.assertMayGrant(actor, roles);
    const email = rawEmail.toLowerCase();
    const workspace = await this.openWorkspace(actor.workspaceId);
    const now = this.clock.now();
    const token = newOpaqueToken();
    const invite = await this.txHost.withTransaction(async () => {
      const active = await this.txHost.tx.invite.findFirst({
        where: {
          workspaceId: actor.workspaceId,
          email,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true },
      });
      const member = await this.txHost.tx.membership.findFirst({
        where: { workspaceId: actor.workspaceId, status: 'active', user: { email } },
        select: { id: true },
      });
      if (active || member) throw new AppException('hub.common.conflict');
      const created = await this.txHost.tx.invite.create({
        data: {
          workspaceId: actor.workspaceId,
          email,
          roles: [...roles],
          tokenHash: sha256(token),
          createdById: actor.userId,
          expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
          createdAt: now,
        },
      });
      await this.audit.record(actor, {
        action: 'identity.invite.create',
        targetType: 'invite',
        targetId: created.id,
        summary: `Invited ${email} as ${roles.join(', ')}`,
      });
      return created;
    });
    const url = this.inviteUrl(workspace.defaultLocale, token);
    const mail = await this.mailInvite(actor, email, workspace, url, invite.expiresAt);
    return {
      id: invite.id,
      email,
      roles: invite.roles,
      expiresAt: invite.expiresAt.toISOString(),
      url,
      mail,
    };
  }

  /**
   * A new link: a new token replaces the old one, which stops working, and the seven days start again. An expired invite may be renewed;
   * an accepted or revoked one may not.
   */
  @PublishesProjectChange('invites')
  async resend(actor: MemberActor, id: string): Promise<{ url: string; expiresAt: string; mail: MailMode }> {
    const workspace = await this.openWorkspace(actor.workspaceId);
    const invite = await this.txHost.tx.invite.findFirst({ where: { id, workspaceId: actor.workspaceId } });
    if (!invite) throw new AppException('hub.common.not_found');
    if (invite.acceptedAt) throw new AppException('hub.identity.invite_accepted');
    if (invite.revokedAt) throw new AppException('hub.identity.invite_revoked');
    const token = newOpaqueToken();
    const expiresAt = new Date(this.clock.now().getTime() + INVITE_TTL_MS);
    await this.txHost.withTransaction(async () => {
      const renewed = await this.txHost.tx.invite.updateMany({
        where: { id, workspaceId: actor.workspaceId, acceptedAt: null, revokedAt: null },
        data: { tokenHash: sha256(token), expiresAt },
      });
      if (renewed.count !== 1) throw new AppException('hub.identity.invite_accepted');
      await this.audit.record(actor, {
        action: 'identity.invite.resend',
        targetType: 'invite',
        targetId: id,
        summary: `Resent the invite to ${invite.email}`,
      });
    });
    const url = this.inviteUrl(workspace.defaultLocale, token);
    const mail = await this.mailInvite(actor, invite.email, workspace, url, expiresAt);
    return { url, expiresAt: expiresAt.toISOString(), mail };
  }

  /** The link stops working at once. The row stays, marked revoked, since Hub never deletes (docs/16 D68). */
  @PublishesProjectChange('invites')
  async revoke(actor: MemberActor, id: string): Promise<void> {
    await this.openWorkspace(actor.workspaceId);
    await this.txHost.withTransaction(async () => {
      const revoked = await this.txHost.tx.invite.updateMany({
        where: { id, workspaceId: actor.workspaceId, acceptedAt: null, revokedAt: null },
        data: { revokedAt: this.clock.now(), revokedById: actor.userId },
      });
      if (revoked.count === 0) throw new AppException('hub.common.not_found');
      await this.audit.record(actor, {
        action: 'identity.invite.revoke',
        targetType: 'invite',
        targetId: id,
        summary: 'Revoked an invite',
      });
    });
  }

  async preview(token: string) {
    const invite = await this.findUsable(token);
    const [workspace, inviter] = await Promise.all([
      this.txHost.tx.workspace.findUniqueOrThrow({
        where: { id: invite.workspaceId },
        select: { slug: true, name: true },
      }),
      this.txHost.tx.user.findUnique({
        where: { id: invite.createdById },
        select: { displayName: true },
      }),
    ]);
    return {
      email: invite.email,
      workspace,
      roles: invite.roles,
      expiresAt: invite.expiresAt.toISOString(),
      invitedBy: inviter?.displayName ?? '',
    };
  }

  /** `principal` is the signed-in member joining another project, else a new account is created. */
  async accept(
    token: string,
    input: AcceptInviteInput,
    principal: Principal | null,
  ): Promise<InviteAccepted> {
    const invite = await this.findUsable(token);
    const workspace = await this.openWorkspace(invite.workspaceId);
    const existing = await this.txHost.tx.user.findUnique({ where: { email: invite.email } });
    // Another account's session in this browser, such as the owner trying the link: say so plainly, and create nothing.
    if (principal && existing?.id !== principal.userId) {
      throw new AppException('hub.identity.invite_other_account');
    }
    if (!principal && existing) throw new AppException('hub.identity.email_taken');
    const newAccount = principal ? null : await this.newAccountData(invite.email, input);

    const { userId, session } = await this.txHost.withTransaction(async () => {
      const user = principal
        ? { id: principal.userId, displayName: existing?.displayName ?? '' }
        : await this.txHost.tx.user.create({ data: newAccount as NonNullable<typeof newAccount> });
      const claimed = await this.txHost.tx.invite.updateMany({
        where: { id: invite.id, workspaceId: invite.workspaceId, acceptedAt: null, revokedAt: null },
        data: { acceptedAt: this.clock.now(), acceptedUserId: user.id },
      });
      if (claimed.count !== 1) throw new AppException('hub.identity.invite_accepted');
      await this.txHost.tx.membership.upsert({
        where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: user.id } },
        create: { workspaceId: invite.workspaceId, userId: user.id, roles: invite.roles },
        update: { roles: invite.roles, status: 'active', removedAt: null },
      });
      await this.txHost.tx.user.updateMany({
        where: { id: user.id, defaultWorkspaceId: null },
        data: { defaultWorkspaceId: invite.workspaceId },
      });
      await this.audit.record(
        {
          kind: 'user',
          userId: user.id,
          via: 'web',
          workspaceId: invite.workspaceId,
          roles: invite.roles as Role[],
        },
        {
          action: 'identity.invite.accept',
          targetType: 'invite',
          targetId: invite.id,
          summary: `${invite.email} joined as ${invite.roles.join(', ')}`,
        },
      );
      await this.notifyLeads(invite.workspaceId, user.id, user.displayName);
      return { userId: user.id, session: principal ? null : await this.sessions.start(user.id) };
    });
    await this.realtime.publishProjectChange(invite.workspaceId, 'members');
    return { user: await this.me.get(userId), workspace: { slug: workspace.slug }, session };
  }

  /** Only an owner may hand out or take away the owner role. */
  assertMayGrant(actor: MemberActor, roles: readonly string[]): void {
    if (roles.includes('owner') && !actor.roles.includes('owner')) {
      throw new AppException('hub.common.forbidden');
    }
  }

  private async newAccountData(email: string, input: AcceptInviteInput) {
    if (!input.displayName || !input.password) {
      const missing = [input.displayName ? null : 'displayName', input.password ? null : 'password'];
      throw new AppException('hub.common.validation', {
        details: {
          issues: missing
            .filter((path) => path !== null)
            .map((path) => ({ path, message: 'Required for a new account' })),
        },
      });
    }
    assertNoSecrets({ displayName: input.displayName });
    if (isWeakPassword(input.password)) throw new AppException('hub.identity.password_weak');
    return {
      email,
      displayName: input.displayName,
      passwordHash: await this.hasher.hash(input.password),
      locale: input.locale ?? 'ar',
      avatarColor: AVATAR_COLORS[randomInt(AVATAR_COLORS.length)] as string,
      createdAt: this.clock.now(),
    };
  }

  private async findUsable(token: string) {
    const invite = await runUnscoped(
      'an invite is looked up by its token, before any project is known',
      // Awaited inside: a Prisma promise only runs when awaited, and the scope check must see this context.
      async () => await this.txHost.tx.invite.findUnique({ where: { tokenHash: sha256(token) } }),
    );
    if (!invite) throw new AppException('hub.identity.invite_invalid');
    const status = inviteStatusOf(invite, this.clock.now());
    if (status === 'accepted') throw new AppException('hub.identity.invite_accepted');
    if (status === 'revoked') throw new AppException('hub.identity.invite_revoked');
    if (status === 'expired') throw new AppException('hub.identity.invite_expired');
    return invite;
  }

  private async openWorkspace(workspaceId: string) {
    const workspace = await this.txHost.tx.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new AppException('hub.workspaces.not_found');
    if (workspace.status === 'closed') throw new AppException('hub.workspaces.closed');
    return workspace;
  }

  private async notifyLeads(workspaceId: string, joinedId: string, name: string): Promise<void> {
    const leads = await this.txHost.tx.membership.findMany({
      where: {
        workspaceId,
        status: 'active',
        userId: { not: joinedId },
        roles: { hasSome: ['owner', 'pm'] },
      },
      select: { user: { select: { id: true, locale: true } } },
    });
    await this.outbox.write({
      workspaceId,
      kind: 'system',
      recipients: leads.map(({ user }) => ({ userId: user.id, locale: user.locale })),
      i18nKey: 'member_joined',
      params: { name },
      data: { link: { view: 'members' } },
    });
  }

  private inviteUrl(locale: string, token: string): string {
    return `${this.config.HUB_PUBLIC_URL.replace(/\/$/, '')}/${locale}/invite/${token}`;
  }

  /**
   * Best effort, and not waited for: the owner already has the link, so a slow or absent mail server must not hold the answer. A mail server that refuses
   * or times out is only a warning. Answers where the mail went, so the owner knows whether to share the link themselves.
   */
  private async mailInvite(
    actor: MemberActor,
    to: string,
    workspace: { name: string; defaultLocale: string },
    url: string,
    expiresAt: Date,
  ): Promise<MailMode> {
    const inviter = await this.txHost.tx.user.findUnique({
      where: { id: actor.userId },
      select: { displayName: true },
    });
    const message = inviteMail({
      locale: workspace.defaultLocale,
      project: workspace.name,
      inviter: inviter?.displayName ?? '',
      url,
      expiresAt,
      tailnet: tailnetOf(this.config.HUB_PUBLIC_URL),
    });
    void this.mailer.send({ to, ...message }).catch((error: unknown) => {
      this.logger.warn(`Invite mail failed: ${error instanceof Error ? error.name : 'unknown'}`);
    });
    return mailModeOf(this.config);
  }
}
