/**
 * @file Sessions: one row per refresh token, grouped in a family (docs/03 §2, docs/04 §1.6).
 * @description Using a refresh token replaces it. Presenting one that was already replaced means it leaked
 * or was stolen, so the whole family is revoked. That revocation commits before the error is thrown, because
 * rolling it back would leave the thief signed in. The one exception is D35: for 30 seconds after its first
 * replacement a token still works while its family is alive, because a reload during a refresh drops the answer
 * and leaves the browser holding the old token. Replaying it does not restart those seconds.
 */
import { randomUUID } from 'node:crypto';

import { settingDefault } from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { ClsService } from 'nestjs-cls';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { CLS_IP, CLS_USER_AGENT } from '@/modules/audit';
import { AppException } from '@/shared/errors';

import { newOpaqueToken, sha256 } from '../domain/credentials';
import { ACCESS_TTL_SEC, CredentialTokens } from './credential-tokens.service';

const DAY_MS = 86_400_000;
const REPLACED_TOKEN_GRACE_MS = 30_000;

export interface IssuedSession {
  readonly sessionId: string;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly familyId: string;
  readonly accessExpiresAt: Date;
  readonly refreshExpiresAt: Date;
}

export interface SessionListRow {
  readonly familyId: string;
  readonly userAgent: string | null;
  readonly ip: string | null;
  readonly createdAt: string;
  readonly lastUsedAt: string;
  readonly current: boolean;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly tokens: CredentialTokens,
    private readonly cls: ClsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Starts a new family. */
  async start(userId: string): Promise<IssuedSession> {
    return this.issue(userId, randomUUID(), await this.expiryFor(userId));
  }

  /** Rotates a refresh token. Every failure answers `refresh_invalid`, as the docs require. */
  async rotate(refreshToken: string): Promise<IssuedSession> {
    const now = this.clock.now();
    const row = await this.txHost.tx.session.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: { select: { status: true } } },
    });
    if (!row) throw new AppException('hub.identity.refresh_invalid');
    if (row.revokedAt) {
      if (!row.replacedById) throw new AppException('hub.identity.refresh_invalid');
      const inGrace = now.getTime() - row.revokedAt.getTime() <= REPLACED_TOKEN_GRACE_MS;
      if (!inGrace || !(await this.isFamilyAlive(row.familyId, now))) {
        await this.revokeFamily(row.familyId);
        throw new AppException('hub.identity.refresh_invalid');
      }
    }
    if (row.expiresAt <= now) throw new AppException('hub.identity.refresh_invalid');
    if (row.user.status !== 'active') {
      await this.revokeFamily(row.familyId);
      throw new AppException('hub.identity.account_disabled');
    }

    return this.txHost.withTransaction(async () => {
      const next = await this.issue(row.userId, row.familyId, row.expiresAt);
      const claimed = await this.txHost.tx.session.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: now, replacedById: next.sessionId },
      });
      // Already replaced, by a replay or a refresh in the same moment. A family keeps one live token, and this
      // statement runs after the claim so that it sees a token the other request has just committed.
      if (claimed.count === 0) {
        await this.txHost.tx.session.updateMany({
          where: { familyId: row.familyId, revokedAt: null, id: { not: next.sessionId } },
          data: { revokedAt: now, replacedById: next.sessionId },
        });
      }
      return next;
    });
  }

  private async isFamilyAlive(familyId: string, now: Date): Promise<boolean> {
    const live = await this.txHost.tx.session.count({
      where: { familyId, revokedAt: null, expiresAt: { gt: now } },
    });
    return live > 0;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.txHost.tx.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: this.clock.now() },
    });
  }

  /** Revokes every family of the user, except one when given. */
  async revokeAll(userId: string, exceptFamilyId?: string): Promise<void> {
    await this.txHost.tx.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptFamilyId ? { familyId: { not: exceptFamilyId } } : {}),
      },
      data: { revokedAt: this.clock.now() },
    });
  }

  /** A family that belongs to the user and is still alive, or nothing. */
  async list(userId: string, currentFamilyId: string | null): Promise<SessionListRow[]> {
    const now = this.clock.now();
    const rows = await this.txHost.tx.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
    const families = await this.txHost.tx.session.groupBy({
      by: ['familyId'],
      where: { familyId: { in: rows.map((row) => row.familyId) } },
      _min: { createdAt: true },
    });
    const started = new Map(families.map((family) => [family.familyId, family._min.createdAt]));
    return rows.map((row) => ({
      familyId: row.familyId,
      userAgent: row.userAgent,
      ip: row.ip,
      createdAt: (started.get(row.familyId) ?? row.createdAt).toISOString(),
      // A family's newest row was written by its latest refresh.
      lastUsedAt: row.createdAt.toISOString(),
      current: row.familyId === currentFamilyId,
    }));
  }

  /** Revokes one of the user's own families. A family of someone else answers not found. */
  async revokeOwnFamily(userId: string, familyId: string): Promise<void> {
    const updated = await this.txHost.tx.session.updateMany({
      where: { userId, familyId, revokedAt: null },
      data: { revokedAt: this.clock.now() },
    });
    if (updated.count === 0) throw new AppException('hub.common.not_found');
  }

  private async issue(userId: string, familyId: string, expiresAt: Date): Promise<IssuedSession> {
    const refreshToken = newOpaqueToken();
    const now = this.clock.now();
    const active = this.cls.isActive();
    const created = await this.txHost.tx.session.create({
      select: { id: true },
      data: {
        userId,
        familyId,
        tokenHash: sha256(refreshToken),
        userAgent: active ? (this.cls.get<string | undefined>(CLS_USER_AGENT) ?? null) : null,
        ip: active ? (this.cls.get<string | undefined>(CLS_IP) ?? null) : null,
        createdAt: now,
        expiresAt,
      },
    });
    return {
      sessionId: created.id,
      accessToken: await this.tokens.signAccess({ userId, familyId }),
      refreshToken,
      familyId,
      accessExpiresAt: new Date(now.getTime() + ACCESS_TTL_SEC * 1000),
      refreshExpiresAt: expiresAt,
    };
  }

  /** `security.session_refresh_days`, the shortest among the member's projects. */
  private async expiryFor(userId: string): Promise<Date> {
    const memberships = await this.txHost.tx.membership.findMany({
      where: { userId, status: 'active' },
      select: { workspaceId: true },
    });
    const overrides = await this.txHost.tx.workspaceSetting.findMany({
      where: {
        key: 'security.session_refresh_days',
        workspaceId: { in: memberships.map((membership) => membership.workspaceId) },
      },
      select: { value: true },
    });
    const days = Math.min(
      settingDefault('security.session_refresh_days'),
      ...overrides.map((override) => Number(override.value)),
    );
    return new Date(this.clock.now().getTime() + days * DAY_MS);
  }
}
