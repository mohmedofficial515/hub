/**
 * @file Personal API tokens (docs/15 §5): they belong to the member, not to a project.
 * @description Lookup by prefix, compare SHA-256. The kind picks the Principal. Roles are never stored
 * here, so a change of role affects every token on its next call. `lastUsedAt` moves at most once a minute.
 */
import type { ApiTokenKind, Principal } from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit';
import { AppException } from '@/shared/errors';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import { apiTokenPrefix, hashesMatch, newApiToken, sha256 } from '../domain/credentials';
import { webSubject } from './account-audit';

const LAST_USED_RESOLUTION_MS = 60_000;

@Injectable()
export class ApiTokenService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async create(userId: string, name: string, kind: ApiTokenKind) {
    assertNoSecrets({ name });
    const { token, prefix, tokenHash } = newApiToken();
    const row = await this.txHost.withTransaction(async () => {
      const created = await this.txHost.tx.apiToken.create({
        data: { userId, name, kind, prefix, tokenHash, createdAt: this.clock.now() },
      });
      await this.audit.recordAccount(webSubject(userId), {
        action: 'identity.token.create',
        targetType: 'api_token',
        targetId: created.id,
        summary: `Created ${kind} token ${prefix}`,
      });
      return created;
    });
    return { id: row.id, token, prefix, name, kind };
  }

  /** A credential pairing issues, in the caller's transaction. Its value leaves here once, and it is managed through the device. */
  async createForDevice(
    userId: string,
    deviceId: string,
    name: string,
    kind: 'device' | 'hook',
  ): Promise<string> {
    const { token, prefix, tokenHash } = newApiToken();
    await this.txHost.tx.apiToken.create({
      data: { userId, deviceId, name, kind, prefix, tokenHash, createdAt: this.clock.now() },
    });
    return token;
  }

  async revokeForDevice(deviceId: string): Promise<void> {
    await this.txHost.tx.apiToken.updateMany({
      where: { deviceId, revokedAt: null },
      data: { revokedAt: this.clock.now() },
    });
  }

  async list(userId: string) {
    const rows = await this.txHost.tx.apiToken.findMany({
      where: { userId, deviceId: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind as ApiTokenKind,
      prefix: row.prefix,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
    }));
  }

  /** Only the member's own token. Someone else's answers not found. */
  async revoke(userId: string, id: string): Promise<void> {
    await this.txHost.withTransaction(async () => {
      const updated = await this.txHost.tx.apiToken.updateMany({
        where: { id, userId, deviceId: null, revokedAt: null },
        data: { revokedAt: this.clock.now() },
      });
      if (updated.count === 0) throw new AppException('hub.common.not_found');
      await this.audit.recordAccount(webSubject(userId), {
        action: 'identity.token.revoke',
        targetType: 'api_token',
        targetId: id,
        summary: 'Revoked a token',
      });
    });
  }

  /** Revokes every token of a member being disabled. */
  async revokeAll(userId: string): Promise<void> {
    await this.txHost.tx.apiToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: this.clock.now() },
    });
  }

  /** The Principal behind a bearer token, or the error the docs name. */
  async authenticate(raw: string): Promise<Principal> {
    const prefix = apiTokenPrefix(raw);
    if (!prefix) throw new AppException('hub.identity.token_invalid');
    const row = await this.txHost.tx.apiToken.findUnique({
      where: { prefix },
      include: { user: { select: { status: true } } },
    });
    if (!row || !hashesMatch(row.tokenHash, sha256(raw))) {
      throw new AppException('hub.identity.token_invalid');
    }
    if (row.revokedAt) throw new AppException('hub.identity.token_revoked');
    if (row.user.status !== 'active') throw new AppException('hub.identity.account_disabled');
    await this.touch(row.id, row.lastUsedAt);
    if (row.kind === 'hook') return { kind: 'hook', userId: row.userId, via: 'hook', tokenId: row.id };
    return {
      kind: 'agent',
      userId: row.userId,
      via: 'mcp',
      tokenId: row.id,
      ...(row.kind === 'device' && row.deviceId ? { deviceId: row.deviceId } : {}),
    };
  }

  private async touch(id: string, lastUsedAt: Date | null): Promise<void> {
    const now = this.clock.now();
    if (lastUsedAt && now.getTime() - lastUsedAt.getTime() < LAST_USED_RESOLUTION_MS) return;
    await this.txHost.tx.apiToken.update({ where: { id }, data: { lastUsedAt: now } });
  }
}
