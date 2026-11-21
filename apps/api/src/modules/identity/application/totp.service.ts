/**
 * @file TOTP enrolment and checks (docs/04 §3.2), with otplib as F:/Goteav/backend does.
 * @description The secret is encrypted at rest. A code that was accepted is remembered until it can no longer
 * be valid, so an observed code cannot be replayed. Recovery codes are shown once and stored hashed.
 */
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { RedisClients } from '@/infra/redis/redis.module';
import { AuditService } from '@/modules/audit';
import { AppException } from '@/shared/errors';
import { SecretCipher } from '@/shared/security/secret-cipher';

import { hashRecoveryCode, newRecoveryCode } from '../domain/credentials';
import { webSubject } from './account-audit';
import { TotpPolicy } from './totp-policy.service';

const ISSUER = 'Hub';
const RECOVERY_CODE_COUNT = 8;
/** One step either side of the current one. */
const WINDOW = 1;
const REPLAY_TTL_SEC = 120;

@Injectable()
export class TotpService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly cipher: SecretCipher,
    private readonly redis: RedisClients,
    private readonly audit: AuditService,
    private readonly policy: TotpPolicy,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async setup(userId: string): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }> {
    const user = await this.txHost.tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.totpEnabledAt) throw new AppException('hub.identity.totp_already_enabled');
    const secret = authenticator.generateSecret(20);
    await this.txHost.tx.user.update({
      where: { id: userId },
      data: { totpSecretEnc: this.cipher.encrypt(secret) },
    });
    const otpauthUrl = authenticator.keyuri(user.email, ISSUER, secret);
    return { secret, otpauthUrl, qrDataUrl: await toDataURL(otpauthUrl) };
  }

  async confirm(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.txHost.tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.totpEnabledAt) throw new AppException('hub.identity.totp_already_enabled');
    if (!user.totpSecretEnc) throw new AppException('hub.identity.totp_not_enabled');
    if (!this.matches(user.totpSecretEnc, code)) throw new AppException('hub.identity.totp_invalid');
    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);
    await this.txHost.withTransaction(async () => {
      await this.txHost.tx.user.update({
        where: { id: userId },
        data: {
          totpEnabledAt: this.clock.now(),
          totpRecoveryCodes: recoveryCodes.map(hashRecoveryCode),
        },
      });
      await this.audit.recordAccount(webSubject(userId), {
        action: 'identity.totp.enable',
        targetType: 'user',
        targetId: userId,
        summary: 'Enabled two-factor sign-in',
      });
    });
    return { recoveryCodes };
  }

  async disable(userId: string, code: string): Promise<void> {
    const user = await this.txHost.tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpEnabledAt || !user.totpSecretEnc) {
      throw new AppException('hub.identity.totp_not_enabled');
    }
    if (await this.policy.requiredForUser(userId)) {
      throw new AppException('hub.identity.totp_setup_required');
    }
    if (!(await this.checkCode(userId, code))) throw new AppException('hub.identity.totp_invalid');
    await this.txHost.withTransaction(async () => {
      await this.txHost.tx.user.update({
        where: { id: userId },
        data: { totpEnabledAt: null, totpSecretEnc: null, totpRecoveryCodes: [] },
      });
      await this.audit.recordAccount(webSubject(userId), {
        action: 'identity.totp.disable',
        targetType: 'user',
        targetId: userId,
        summary: 'Disabled two-factor sign-in',
      });
    });
  }

  /** True for a correct code seen for the first time. */
  async checkCode(userId: string, code: string): Promise<boolean> {
    const user = await this.txHost.tx.user.findUnique({
      where: { id: userId },
      select: { totpSecretEnc: true, totpEnabledAt: true },
    });
    if (!user?.totpEnabledAt || !user.totpSecretEnc) return false;
    if (!this.matches(user.totpSecretEnc, code)) return false;
    const first = await this.redis.main.set(`totp:used:${userId}:${code}`, '1', 'EX', REPLAY_TTL_SEC, 'NX');
    return first === 'OK';
  }

  /** Spends one recovery code. True when it was unused. */
  async consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
    const hash = hashRecoveryCode(code);
    return this.txHost.withTransaction(async () => {
      const user = await this.txHost.tx.user.findUnique({
        where: { id: userId },
        select: { totpRecoveryCodes: true },
      });
      if (!user?.totpRecoveryCodes.includes(hash)) return false;
      const claimed = await this.txHost.tx.user.updateMany({
        where: { id: userId, totpRecoveryCodes: { has: hash } },
        data: { totpRecoveryCodes: user.totpRecoveryCodes.filter((stored) => stored !== hash) },
      });
      return claimed.count === 1;
    });
  }

  private matches(secretEnc: string, code: string): boolean {
    const checker = authenticator.clone({ window: WINDOW, epoch: this.clock.now().getTime() });
    return checker.check(code, this.cipher.decrypt(secretEnc));
  }
}
