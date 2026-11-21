/**
 * @file Pairing (docs/16 §5): the device asks, the signed-in owner approves in a browser, the device collects its credentials once.
 * @description Pairing issues two tokens, both tied to the device and revoked with it. The device credential reaches only `/mcp` and the bridge
 * channel. The hook token is the existing `hook` kind, for the plugin's session hooks. Their values exist only in the one answer that claims them.
 * `pairDirect` is the main machine's path (D42): whoever runs it already holds the database, so there is no browser step to add.
 */
import {
  PAIRING_POLL_SECONDS,
  PAIRING_TTL_SECONDS,
  type PairingStatus,
  type Principal,
} from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit';
import { ApiTokenService } from '@/modules/identity';
import { AppException } from '@/shared/errors';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import { hashDeviceCode, newDeviceCode, newUserCode, pairingStatus } from '../domain/pairing';

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export interface ClaimedCredentials {
  readonly deviceId: string;
  readonly credential: string;
  readonly hookToken: string;
}

@Injectable()
export class PairingService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly tokens: ApiTokenService,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async start(input: { name: string; platform: string }) {
    assertNoSecrets(input);
    const now = this.clock.now();
    await this.txHost.tx.devicePairing.deleteMany({
      where: { expiresAt: { lt: new Date(now.getTime() - STALE_AFTER_MS) } },
    });
    const deviceCode = newDeviceCode();
    const userCode = newUserCode();
    await this.txHost.tx.devicePairing.create({
      data: {
        deviceCodeHash: hashDeviceCode(deviceCode),
        userCode,
        name: input.name,
        platform: input.platform,
        expiresAt: new Date(now.getTime() + PAIRING_TTL_SECONDS * 1000),
      },
    });
    const base = this.config.HUB_PUBLIC_URL.replace(/\/+$/, '');
    return {
      deviceCode,
      userCode,
      approveUrl: `${base}/connect?code=${userCode}`,
      expiresInSeconds: PAIRING_TTL_SECONDS,
      pollSeconds: PAIRING_POLL_SECONDS,
    };
  }

  /** What the approval page shows. */
  async view(userCode: string) {
    const row = await this.find(userCode);
    return {
      userCode: row.userCode,
      name: row.name,
      platform: row.platform,
      status: pairingStatus(row, this.clock.now()),
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  async approve(principal: Principal, userCode: string): Promise<void> {
    const row = await this.answerable(userCode);
    await this.txHost.withTransaction(async () => {
      await this.txHost.tx.devicePairing.update({
        where: { id: row.id },
        data: { status: 'approved', approvedById: principal.userId },
      });
      await this.audit.recordAccount(principal, {
        action: 'devices.pairing.approve',
        targetType: 'device_pairing',
        targetId: row.id,
        summary: `Approved pairing of ${row.name}`,
      });
    });
  }

  async deny(principal: Principal, userCode: string): Promise<void> {
    const row = await this.answerable(userCode);
    await this.txHost.withTransaction(async () => {
      await this.txHost.tx.devicePairing.update({ where: { id: row.id }, data: { status: 'denied' } });
      await this.audit.recordAccount(principal, {
        action: 'devices.pairing.deny',
        targetType: 'device_pairing',
        targetId: row.id,
        summary: `Denied pairing of ${row.name}`,
      });
    });
  }

  /** The device's poll. The credentials come back once: a second poll after claiming gets `claimed` and nothing else. */
  async poll(deviceCode: string): Promise<{ status: PairingStatus } & Partial<ClaimedCredentials>> {
    const row = await this.txHost.tx.devicePairing.findUnique({
      where: { deviceCodeHash: hashDeviceCode(deviceCode) },
    });
    if (!row) throw new AppException('hub.devices.pairing_not_found');
    const status = pairingStatus(row, this.clock.now());
    if (status !== 'approved' || !row.approvedById) return { status };
    const approvedBy = row.approvedById;
    const credentials = await this.txHost.withTransaction(async () => {
      const claimed = await this.txHost.tx.devicePairing.updateMany({
        where: { id: row.id, status: 'approved' },
        data: { status: 'claimed' },
      });
      if (claimed.count === 0) return null;
      const issued = await this.issue(approvedBy, row.name, row.platform);
      await this.txHost.tx.devicePairing.update({
        where: { id: row.id },
        data: { deviceId: issued.deviceId },
      });
      await this.audit.recordAccount(
        { kind: 'user', userId: approvedBy, via: 'web' },
        {
          action: 'devices.pair',
          targetType: 'device',
          targetId: issued.deviceId,
          summary: `Paired ${row.name}`,
        },
      );
      return issued;
    });
    return credentials ? { status: 'claimed', ...credentials } : { status: 'claimed' };
  }

  /** `pnpm start:local` on the main machine: pairs the owner's device with no browser step (D42). */
  async pairDirect(email: string, name: string, platform: string): Promise<ClaimedCredentials> {
    const user = await this.txHost.tx.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) throw new AppException('hub.common.not_found');
    return this.txHost.withTransaction(async () => {
      const issued = await this.issue(user.id, name, platform);
      await this.audit.recordAccount(
        { kind: 'user', userId: user.id, via: 'web' },
        {
          action: 'devices.pair',
          targetType: 'device',
          targetId: issued.deviceId,
          summary: `Paired the main machine, ${name}, from start:local`,
        },
      );
      return issued;
    });
  }

  private async issue(userId: string, name: string, platform: string): Promise<ClaimedCredentials> {
    const device = await this.txHost.tx.device.create({
      data: { userId, name, platform, pairedAt: this.clock.now() },
    });
    const credential = await this.tokens.createForDevice(userId, device.id, name, 'device');
    const hookToken = await this.tokens.createForDevice(userId, device.id, name, 'hook');
    return { deviceId: device.id, credential, hookToken };
  }

  private async find(userCode: string) {
    const row = await this.txHost.tx.devicePairing.findUnique({ where: { userCode } });
    if (!row) throw new AppException('hub.devices.pairing_not_found');
    return row;
  }

  private async answerable(userCode: string) {
    const row = await this.find(userCode);
    const status = pairingStatus(row, this.clock.now());
    if (status === 'expired') throw new AppException('hub.devices.pairing_not_found');
    if (status !== 'pending') throw new AppException('hub.devices.pairing_closed');
    return row;
  }
}
